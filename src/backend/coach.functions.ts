import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProAccess } from "@/backend/require-pro";
import { runCoach } from "@/modules/ai/agents/coach.agent";
import { fallbackCoachAnswer } from "@/modules/ai/fallback-coach";
import { recordAgentRun } from "./telemetry.server";

/**
 * AI Coach V1 — server function. Validates the trader's real data (Zod, with
 * size caps), runs the coach agent (grounded prompt → provider), returns the
 * Markdown answer. Auth + rate-limit come from `requireProAccess`; secrets stay
 * server-side. No memory, no proactivity, no other agents — the V1 surface.
 */

const TradeSummary = z.object({
  date: z.string().max(10),
  symbol: z.string().max(20),
  direction: z.string().max(10),
  pnl: z.number(),
  rMultiple: z.number(),
  strategy: z.string().max(50),
  mistakes: z.array(z.string().max(100)).max(20),
  setupQuality: z.number(),
  confluences: z.array(z.string().max(100)).max(30),
  notes: z.string().max(10000).optional(),
});

const CoachAsk = z.object({
  question: z.string().min(1).max(500),
  language: z.string().min(2).max(8).optional(),
  stats: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).optional(),
  trades: z.array(TradeSummary).max(500).optional(),
  mistakes: z
    .array(z.object({ name: z.string().max(100), count: z.number(), totalPnl: z.number() }))
    .max(40)
    .optional(),
  goals: z
    .array(z.object({ kind: z.string().max(40), target: z.number(), current: z.number() }))
    .max(10)
    .optional(),
  rules: z
    .array(z.object({ kind: z.string().max(40), text: z.string().max(300), enabled: z.boolean() }))
    .max(30)
    .optional(),
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
  conversation: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(20)
    .optional(),
});

function sanitizePrompt(text: string): string {
  return text
    .replace(/ignore\s+all\s+(previous|prior)\s+(instructions|directives|commands)/gi, "[redacted]")
    .replace(/you\s+are\s+(now|from\s+now\s+on)\s+(a\s+|an\s+)?/gi, "")
    .replace(/system\s*(prompt|message|instruction)/gi, "[system directive]")
    .replace(/<\|im_start\|>|<\|im_end\|>|<\||\|>/g, "")
    .trim();
}

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => CoachAsk.parse(input))
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
      const res = await runCoach(data, { onUsage });
      const text = res.text?.trim();
      if (text) {
        track("ok");
        return { answer: text, source: "ai" as const };
      }
      console.warn("[coach] provider answered but text was empty — serving fallback", res);
      track("fallback", "empty response");
      return {
        answer: fallbackCoachAnswer(data),
        source: "deterministic" as const,
      };
    } catch (err) {
      console.warn("[coach] provider unavailable — deterministic answer served", err);
      track("error", err instanceof Error ? err.message : String(err));
      return {
        answer: fallbackCoachAnswer(data),
        source: "deterministic" as const,
      };
    }
  });
