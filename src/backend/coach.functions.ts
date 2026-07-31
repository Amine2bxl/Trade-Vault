import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProAccess } from "@/backend/require-pro";
import { runCoach } from "@/modules/ai/agents/coach.agent";
import { fallbackCoachAnswer } from "@/modules/ai/fallback-coach";
import { normalizeError } from "@/modules/ai/runtime/errors";

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
  .handler(async ({ data }) => {
    data.question = sanitizePrompt(data.question);
    // The trader must always get a grounded answer. When no provider is
    // configured (beta with no key) or the call fails, we answer deterministically
    // from the very same payload — zero cost, same grounding rules, no error
    // bubble in the conversation.
    //
    // DEBUG : la vraie cause est ajoutée au repli (pré-lancement) pour que
    // l'échec soit visible et corrigeable. À retirer avant la mise en prod.
    try {
      const res = await runCoach(data);
      const text = res.text?.trim();
      if (text) return { answer: text, source: "ai" as const };
      return { answer: fallbackCoachAnswer(data), source: "deterministic" as const };
    } catch (err) {
      console.warn("[coach] provider unavailable — deterministic answer served", err);
      const reason = normalizeError(err, "runtime").technicalMessage;
      return {
        answer: `${fallbackCoachAnswer(data)}\n\n> ⚠️ debug IA : ${reason}`,
        source: "deterministic" as const,
      };
    }
  });
