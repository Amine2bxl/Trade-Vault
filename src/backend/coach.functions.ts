import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireJarvisAccess } from "@/backend/require-pro";
import { runCoach } from "@/modules/ai/agents/coach.agent";
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
    // Télémétrie : `onUsage` est le point d'accroche prévu par
    // `provider-service` (« the seam for ai_agent_runs telemetry »). On y
    // capture provider, modèle, tokens et latence RÉELS de l'appel servi —
    // pas une estimation. Écriture best-effort, jamais bloquante.
    const userId = (context as { userId?: string } | undefined)?.userId;
    let served: {
      provider?: string;
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
    } = {};
    const onUsage = (e: {
      provider: string;
      model: string;
      latencyMs: number;
      ok: boolean;
      inputTokens?: number;
      outputTokens?: number;
    }) => {
      // Le routeur peut essayer plusieurs providers (fallback en cascade) :
      // c'est le DERNIER appel qui a servi la réponse, donc celui qu'on garde.
      served = {
        provider: e.provider,
        model: e.model,
        latencyMs: e.latencyMs,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
      };
    };
    const track = (status: "ok" | "error" | "fallback", error?: string) => {
      if (!userId) return;
      void recordAgentRun({
        userId,
        agent: "coach",
        // `chat` : taxonomie AiIntent existante, pas une valeur inventée.
        intent: "chat",
        provider: served.provider ?? "",
        model: served.model ?? "",
        status,
        inputTokens: served.inputTokens,
        outputTokens: served.outputTokens,
        latencyMs: served.latencyMs ?? 0,
        error,
      });
    };
    // The trader must always get a grounded answer. When no provider is
    // configured (beta with no key) or the call fails, we answer deterministically
    // from the very same payload — zero cost, same grounding rules, no error
    // bubble in the conversation.
    try {
      /* LES OUTILS — ce qui fait que Jarvis peut répondre à une question dont la
         réponse n'était pas dans le paquet envoyé.

         Ils ne sont remis au modèle que si l'utilisateur est identifié : un outil
         sans `userId` n'a aucun journal à lire, et lui en donner un par défaut
         serait exactement la faille à ne pas ouvrir. Sans identité, on garde le
         chemin historique — le contexte poussé par le client suffit à répondre.

         COUPE-CIRCUIT : `AI_TOOLS=off` désactive la boucle sans redéploiement de
         code. Le tool-calling multiplie les allers-retours modèle, donc le coût
         d'une question ; il faut pouvoir l'éteindre en une variable le jour où la
         facture le demande. */
      const outils = userId && process.env.AI_TOOLS !== "off" ? ensureJarvisTools() : [];
      const res = await runCoach(data, {
        onUsage,
        tools: outils,
        toolContext: userId ? { userId, accountId: data.accountId ?? null } : undefined,
      });
      const text = res.text?.trim();
      if (text) {
        track("ok");
        return { answer: text, source: "ai" as const };
      }
      console.warn("[coach] provider answered but text was empty", res);
      track("fallback", "empty response");
      return { answer: indisponible(data.language), source: "unavailable" as const };
    } catch (err) {
      console.warn("[coach] provider unavailable", err);
      track("error", err instanceof Error ? err.message : String(err));
      return {
        answer: indisponible(data.language),
        source: "unavailable" as const,
      };
    }
  });
