import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireJarvisAccess } from "@/backend/require-pro";
import { orchestrateCoach, traceOfError } from "@/modules/ai/agents/coach.orchestrator";
import { ensureJarvisTools } from "@/backend/ai-tools";
import { recordAgentRun } from "./telemetry.server";
import {
  ConversationSchema,
  GoalsSchema,
  RulesSchema,
  StatsSchema,
  TradesSchema,
  withGlobalByteCeiling,
} from "./ai-payload";
import { AI_LIMITS } from "@/domain/ai-limits";

/**
 * AI Coach V1 — server function. Validates the trader's real data (Zod, with
 * size caps), runs the coach agent (grounded prompt → provider), returns the
 * Markdown answer. Auth + quota come from `requireJarvisAccess`; secrets stay
 * server-side. No memory, no proactivity, no other agents — the V1 surface.
 */

// Les briques et leurs plafonds viennent de `ai-payload.ts` — voir l'en-tête
// de ce module pour le raisonnement de coût derrière chaque borne.
const CoachAskShape = z.object({
  question: z.string().min(1).max(AI_LIMITS.question),
  language: z.string().min(2).max(8).optional(),
  /** Devise du journal (ISO 4217) — Jarvis écrit ses montants dans celle-ci. */
  currency: z.string().length(3).optional(),
  /** La date civile LOCALE du trader (YYYY-MM-DD) : « aujourd'hui », « ce mois-ci ». */
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /**
   * Le sous-compte que le trader regarde. Il ne sert PAS à filtrer le contexte
   * poussé (le client l'a déjà filtré) : il cloisonne les OUTILS, qui lisent la
   * base directement. Sans lui, une question posée depuis le compte prop
   * recevrait des chiffres agrégés sur tous les comptes — vrais, et faux pour
   * la question.
   */
  accountId: z.string().max(64).optional(),
  stats: StatsSchema.optional(),
  trades: TradesSchema.optional(),
  mistakes: z
    .array(z.object({ name: z.string().max(100), count: z.number(), totalPnl: z.number() }))
    .max(AI_LIMITS.mistakes)
    .optional(),
  goals: GoalsSchema.optional(),
  rules: RulesSchema.optional(),
  /**
   * Souvenirs DÉJÀ sélectionnés par le client sous budget de tokens. Le serveur
   * ne fait pas confiance à cette sélection : il re-borne (12 entrées, 300
   * caractères) en défense en profondeur, pour qu'un client modifié ne puisse
   * pas gonfler le prompt ni le coût.
   */
  adherence: z
    .array(
      z.object({
        text: z.string().max(300),
        kept: z.number(),
        applicable: z.number(),
        ratePct: z.number(),
      }),
    )
    .max(5)
    .optional(),
  /** Intentions AVANT trades récents — bornées : 25, champs courts. */
  intent: z
    .array(
      z.object({
        tradeId: z.string().max(100),
        symbol: z.string().max(20).optional(),
        setup: z.string().max(100).nullable().optional(),
        reasoning: z.string().max(500).nullable().optional(),
        confidence: z.number().nullable().optional(),
        plannedRisk: z.number().nullable().optional(),
        plan: z.string().max(500).nullable().optional(),
        emotion: z.string().max(40).nullable().optional(),
      }),
    )
    .max(25)
    .optional(),
  /** Réflexions APRÈS trades récents — même bornage. */
  reflection: z
    .array(
      z.object({
        tradeId: z.string().max(100),
        planRespected: z.enum(["yes", "partial", "no"]).nullable().optional(),
        reason: z.string().max(40).nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      }),
    )
    .max(25)
    .optional(),
  /** Edge Score déjà calculé — le serveur re-borne les clés/sous-scores. */
  edge: z
    .object({
      score: z.number().nullable(),
      weakest: z.string().max(40).nullable(),
      windowDays: z.number(),
      subs: z
        .record(
          z.string(),
          z.object({ value: z.number().nullable(), detail: z.string().max(100).optional() }),
        )
        .optional(),
    })
    .optional(),
  /** Session courante — compacte. */
  session: z
    .object({
      date: z.string().max(10),
      emotionalState: z.string().max(40).nullable().optional(),
      readinessScore: z.number().nullable().optional(),
      disciplineScore: z.number().nullable().optional(),
      tradesToday: z.number(),
      pnlToday: z.number(),
    })
    .optional(),
  memory: z
    .array(z.object({ kind: z.string().max(20), content: z.string().max(300) }))
    .max(12)
    .optional(),
  /**
   * Precomputed behaviour signals. The shape is owned by the client engine, so
   * it is validated by size rather than by field: a hard 12 KB ceiling keeps a
   * malformed or oversized payload from ever reaching the provider.
   */
  signals: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= 12_000, "signals payload too large")
    .optional(),
  /** Compact onboarding profile so the coaching is never generic. */
  profile: z.string().max(600).optional(),
  /**
   * Échelle du compte quand l'historique a été recalibré. Le client l'envoyait
   * depuis le début, mais le schéma ne la déclarait pas : Zod la retirait en
   * silence (bug B5) et Jarvis lisait des montants recalibrés sans le savoir —
   * « tu as doublé ton risque » à un trader qui risque toujours 1 %.
   */
  calibration: z
    .object({
      originalBalance: z.number().finite(),
      currentBalance: z.number().finite(),
      scale: z.number().finite(),
    })
    .optional(),
  /**
   * Résultat DÉJÀ calculé par le moteur Monte-Carlo (`modules/probability`).
   * Même bug que la calibration : envoyé, retiré par le schéma, et Jarvis
   * répondait « je n'ai pas de simulation » alors que le trader en avait une.
   */
  simulation: z
    .object({
      engineVersion: z.string().max(40),
      method: z.string().max(60),
      sampleSize: z.number().finite(),
      passProbability: z.number().finite(),
      riskOfRuin: z.number().finite(),
      medianPnl: z.number().finite(),
      medianDrawdown: z.number().finite(),
      horizonTrades: z.number().finite(),
      scenario: z.string().max(200).optional(),
    })
    .optional(),
  conversation: ConversationSchema.optional(),
});

/**
 * Le schéma appliqué, avec le PLAFOND GLOBAL d'octets en plus des bornes par
 * champ. Les bornes par champ se multiplient entre elles ; celle-ci non, et
 * c'est la seule qui tiendra encore quand un champ sera ajouté au contexte.
 */
const CoachAsk = withGlobalByteCeiling(CoachAskShape);

/**
 * LA QUESTION PASSE TOUJOURS.
 *
 * Le contexte poussé par le client est un BONUS : Jarvis lit le journal
 * lui-même par ses outils. Or une seule borne dépassée — une réponse précédente
 * trop longue dans l'historique, un souvenir de trop — faisait rejeter TOUTE
 * la requête par le validateur, et le trader voyait « vérifie ta connexion »
 * sans que le serveur n'ait jamais parlé au modèle. Quand le contexte complet
 * ne passe pas, on garde la question, la langue, le compte et la fin de la
 * conversation (bornée), et on journalise les champs fautifs.
 */
function parseCoachAsk(input: unknown) {
  const full = CoachAsk.safeParse(input);
  if (full.success) return full.data;
  console.warn(
    "[coach] context rejected, answering from the question alone",
    full.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`),
  );
  const raw = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const turns = Array.isArray(raw.conversation) ? raw.conversation : [];
  const conversation = turns
    .filter(
      (t): t is { role: "user" | "assistant"; content: string } =>
        !!t &&
        typeof t === "object" &&
        ((t as { role?: unknown }).role === "user" ||
          (t as { role?: unknown }).role === "assistant") &&
        typeof (t as { content?: unknown }).content === "string",
    )
    .slice(-6)
    .map((t) => ({ role: t.role, content: t.content.slice(0, AI_LIMITS.conversationContent) }));
  return CoachAsk.parse({
    question: str(raw.question, AI_LIMITS.question) || "…",
    language: str(raw.language, 8),
    currency:
      typeof raw.currency === "string" && raw.currency.length === 3 ? raw.currency : undefined,
    today:
      typeof raw.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.today)
        ? raw.today
        : undefined,
    accountId: str(raw.accountId, 64),
    conversation,
  });
}

function sanitizePrompt(text: string): string {
  return text
    .replace(/ignore\s+all\s+(previous|prior)\s+(instructions|directives|commands)/gi, "[redacted]")
    .replace(/you\s+are\s+(now|from\s+now\s+on)\s+(a\s+|an\s+)?/gi, "")
    .replace(/system\s*(prompt|message|instruction)/gi, "[system directive]")
    .replace(/<\|im_start\|>|<\|im_end\|>|<\||\|>/g, "")
    .trim();
}

/**
 * LE REPLI DÉTERMINISTE A ÉTÉ RETIRÉ.
 *
 * Il classait la question dans SIX intentions par expression régulière et
 * remplissait des phrases à trous. Servi sans être annoncé, il faisait passer
 * une panne pour une réponse — et pour le trader, Jarvis devenait « une IA
 * qui répond toujours la même chose sans comprendre la question ». C'était
 * exact : ces réponses-là ne comprenaient rien, par construction.
 *
 * Une panne se dit. Le trader sait alors que le silence vient du service et
 * non de son journal, et nous le voyons dans `ai_agent_runs` au lieu de le
 * découvrir par une plainte.
 */
function indisponible(language?: string) {
  const fr = (language ?? "").toLowerCase().startsWith("fr");
  return fr
    ? "Je n'arrive pas à réfléchir à cette question pour l'instant — le service d'analyse ne répond pas. Réessaie dans un moment : tes données n'ont rien à voir là-dedans, et je n'ai pas envie de te servir une réponse toute faite en attendant."
    : "I can't think this one through right now — the analysis service isn't responding. Try again in a moment. This has nothing to do with your journal, and I'd rather say so than hand you a canned answer.";
}

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireJarvisAccess])
  .inputValidator(parseCoachAsk)
  .handler(async ({ data, context }) => {
    data.question = sanitizePrompt(data.question);
    const userId = (context as { userId?: string } | undefined)?.userId;
    const started = Date.now();

    /* LA TÉLÉMÉTRIE D'UNE QUESTION, ENTIÈRE (bug B9). L'ancien relevé gardait
       le DERNIER appel modèle seulement : une question qui en coûtait quatre
       (boucle d'outils) en déclarait un, et la réflexion de Gemini n'était
       jamais comptée. La trace de l'orchestrateur somme tous les appels,
       réflexion comprise, et dit le niveau, les outils, la validation et le
       coût estimé. Toujours sans le moindre contenu. */
    const track = (
      status: "ok" | "error" | "fallback",
      trace?: Awaited<ReturnType<typeof orchestrateCoach>>["trace"],
      error?: string,
    ) => {
      if (!userId) return;
      void recordAgentRun({
        userId,
        agent: "coach",
        // `chat` : taxonomie AiIntent existante ; le détail est dans `route`.
        intent: "chat",
        provider: trace?.provider ?? "",
        model: trace?.model ?? "",
        status,
        inputTokens: trace?.inputTokens,
        outputTokens: trace?.outputTokens,
        latencyMs: trace?.totalMs ?? Date.now() - started,
        error,
        ...(trace
          ? {
              tier: trace.tier,
              slot: trace.slot,
              route: {
                domains: trace.domains,
                ambiguous: trace.ambiguous,
                modelRouted: trace.modelRouted,
                signals: trace.signals,
              },
              tools: trace.tools.map((t) => t.name),
              toolCalls: trace.tools.length,
              prefetch: trace.prefetch,
              modelCalls: trace.modelCalls,
              thinkingTokens: trace.thinkingTokens,
              cachedInputTokens: trace.cachedInputTokens,
              costUsd: trace.costUsd,
              validation: trace.validation,
              unsupportedFigures: trace.unsupportedFigures,
              contextChars: trace.contextChars,
            }
          : {}),
      });
    };

    try {
      /* LES OUTILS — ce qui fait que Jarvis peut répondre à une question dont la
         réponse n'était pas dans le paquet envoyé.

         Ils ne sont ENREGISTRÉS que si l'utilisateur est identifié : un outil
         sans `userId` n'a aucun journal à lire, et lui en donner un par défaut
         serait exactement la faille à ne pas ouvrir. Enregistrés, ils servent
         d'abord aux LECTURES PRÉPARÉES du Context Engine (sans appel modèle).

         COUPE-CIRCUIT : `AI_TOOLS=off` retire la BOUCLE d'outils pilotée par le
         modèle (chaque tour est un appel modèle de plus) sans redéploiement de
         code. Les lectures préparées, elles, ne coûtent aucun appel modèle et
         restent actives. */
      const registered = userId ? ensureJarvisTools() : [];
      const modelTools = process.env.AI_TOOLS !== "off" ? registered : [];
      const { text: answer, trace } = await orchestrateCoach(data, {
        userId,
        accountId: data.accountId ?? null,
        modelTools,
        prefetch: registered.length > 0,
      });
      const text = answer.trim();
      if (text) {
        track("ok", trace);
        return { answer: text, source: "ai" as const };
      }
      console.warn("[coach] provider answered but text was empty");
      track("fallback", trace, "empty response");
      return {
        answer: indisponible(data.language),
        source: "unavailable" as const,
        reason: "outage" as const,
      };
    } catch (err) {
      console.warn("[coach] provider unavailable", err);
      // Une `RuntimeError` est un objet simple, pas un `Error` : `String(err)`
      // écrivait « [object Object] » dans `ai_agent_runs`, et la vraie cause
      // (quota Gemini, modèle retiré chez OpenRouter) restait invisible.
      const runtime = err as { type?: string; technicalMessage?: string };
      // La trace PARTIELLE : les appels déjà payés avant la panne (routage,
      // tours d'outils réussis) restent comptés, avec le modèle qui a échoué.
      track(
        "error",
        traceOfError(err),
        runtime?.technicalMessage ?? (err instanceof Error ? err.message : String(err)),
      );
      return {
        answer: indisponible(data.language),
        source: "unavailable" as const,
        // Le client en fait une erreur HONNÊTE — « le fournisseur est saturé »
        // n'appelle pas la même attente que « le service est en panne ».
        reason: runtime?.type === "quota" ? ("busy" as const) : ("outage" as const),
      };
    }
  });
