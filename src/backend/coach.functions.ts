import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProAccess } from "@/backend/require-pro";
import { runCoach } from "@/modules/ai/agents/coach.agent";

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
  memory: z
    .array(z.object({ kind: z.string().max(40), content: z.string().max(2000) }))
    .max(60)
    .optional(),
  behavior: z.array(z.string().max(300)).max(16).optional(),
  conversation: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(20)
    .optional(),
});

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => CoachAsk.parse(input))
  .handler(async ({ data }) => {
    const res = await runCoach(data);
    return { answer: res.text };
  });
