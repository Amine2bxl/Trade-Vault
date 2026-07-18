import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProAccess } from "@/lib/require-pro";
import { resolveProvider, type AIMessage } from "@/modules/core/ai-provider";
import { contextBlocks, languageName } from "@/modules/ai/context";

/**
 * AI Core service catalogue — every AI feature in the product calls one
 * of these functions. They all follow the same recipe:
 *
 *   validated context → grounded prompt → resolveProvider().complete()
 *
 * No vendor names anywhere below this comment: swapping models is an
 * env-var change (see modules/core/ai-provider).
 */

// ── Shared schemas ───────────────────────────────────────────────────────────

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

const UserContext = z.object({
  trades: z.array(TradeSummary).max(500).optional(),
  stats: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).optional(),
  goals: z
    .array(z.object({ kind: z.string().max(40), target: z.number(), current: z.number() }))
    .max(10)
    .optional(),
  rules: z
    .array(z.object({ kind: z.string().max(40), text: z.string().max(300), enabled: z.boolean() }))
    .max(30)
    .optional(),
  memory: z
    .array(z.object({ kind: z.string().max(20), content: z.string().max(2000) }))
    .max(60)
    .optional(),
  conversation: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(20)
    .optional(),
  language: z.string().min(2).max(8).optional(),
});

const COACH_IDENTITY = (lang: string) =>
  `You are TradeVault's resident trading performance coach — an elite quant mentor who KNOWS this trader (their memory, rules and goals are provided). Every claim MUST cite specific numbers from the provided data. Never invent numbers. Be candid, concrete and kind-but-firm. Write the ENTIRE response in ${lang}.`;

function buildMessages(
  ctx: z.infer<typeof UserContext>,
  task: string,
  userTurn: string,
): AIMessage[] {
  const messages: AIMessage[] = [
    { role: "system", content: `${COACH_IDENTITY(languageName(ctx.language))}\n\n${task}` },
  ];
  const blocks = contextBlocks(ctx);
  const opening = blocks ? `${blocks}\n\n${userTurn}` : userTurn;
  const convo = ctx.conversation ?? [];
  if (convo.length > 0) {
    messages.push({ role: "user", content: blocks || "(context above)" });
    messages.push({ role: "assistant", content: "Understood — I have the trader's context." });
    for (const turn of convo) messages.push({ role: turn.role, content: turn.content });
    messages.push({ role: "user", content: userTurn });
  } else {
    messages.push({ role: "user", content: opening });
  }
  return messages;
}

// ── AI.chat ──────────────────────────────────────────────────────────────────

const ChatInput = z.object({ question: z.string().min(1).max(500), context: UserContext });

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const messages = buildMessages(
      data.context,
      `Respond in GitHub-flavored Markdown with: ## 🎯 Key Takeaways (3-5 bullets with real numbers), ## 📊 Stats Snapshot (compact table), ## ✅ Strengths, ## ⚠️ Weaknesses, ## 🧭 Action Plan (numbered, measurable), ## 💡 Bottom Line (one bold sentence). Omit a section only if truly not applicable. Use **bold** for key numbers. No fluff.`,
      `Question: ${data.question}`,
    );
    const res = await resolveProvider().complete({ messages, maxTokens: 4096 });
    return { answer: res.text };
  });

// ── AI.generateDailyBrief ────────────────────────────────────────────────────

const BriefInput = z.object({ context: UserContext, date: z.string().max(10) });

export const aiGenerateDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => BriefInput.parse(input))
  .handler(async ({ data }) => {
    const messages = buildMessages(
      data.context,
      `Produce a SHORT pre-market daily brief (max ~200 words) for ${data.date}: 1) one-line state of the trader (streak, recent tilt risk), 2) the single biggest risk to avoid today based on their history, 3) 2-3 concrete intentions for the session, 4) one encouraging closing line. Markdown, punchy, personal.`,
      "Generate today's brief.",
    );
    const res = await resolveProvider().complete({ messages, maxTokens: 1024 });
    return { brief: res.text };
  });

// ── AI.generateWeeklyReview ──────────────────────────────────────────────────

const ReviewInput = z.object({ context: UserContext, weekLabel: z.string().max(20) });

export const aiGenerateWeeklyReview = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => ReviewInput.parse(input))
  .handler(async ({ data }) => {
    const messages = buildMessages(
      data.context,
      `Produce a weekly review for ${data.weekLabel}: ## Résumé (what actually happened, with numbers), ## Ce qui a marché, ## Ce qui a coûté, ## La leçon de la semaine (ONE lesson, stated memorably), ## Objectif de la semaine prochaine (one measurable behavior). Max ~350 words.`,
      "Generate the weekly review.",
    );
    const res = await resolveProvider().complete({ messages, maxTokens: 2048 });
    return { review: res.text };
  });

// ── AI.analyzeTrade ──────────────────────────────────────────────────────────

const AnalyzeInput = z.object({
  context: UserContext,
  trade: TradeSummary,
  /** Structured output of the (non-AI) Trade Analysis Engine. */
  analysis: z.record(z.string(), z.unknown()),
});

export const aiAnalyzeTrade = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }) => {
    const messages = buildMessages(
      data.context,
      `You receive ONE trade plus the deterministic analysis object computed by the Trade Analysis Engine (scores 0-100, flags). Comment this trade like a mentor debrief (max ~150 words): what was good, what the flags mean for THIS trader given their history, and the one thing to repeat or change next time. Do not recompute scores — interpret them.`,
      `Trade: ${JSON.stringify(data.trade)}\n\nEngine analysis: ${JSON.stringify(data.analysis)}`,
    );
    const res = await resolveProvider().complete({ messages, maxTokens: 1024 });
    return { commentary: res.text };
  });

// ── AI.detectPatterns ────────────────────────────────────────────────────────

export const aiDetectPatterns = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => z.object({ context: UserContext }).parse(input))
  .handler(async ({ data }) => {
    const messages = buildMessages(
      data.context,
      `Mine the trades for recurring patterns (time-of-day, day-of-week, symbol, setup, mistake, sizing after losses). Return STRICT JSON: {"patterns":[{"title":string,"evidence":string,"impact":"positive"|"negative","confidence":"low"|"medium"|"high","suggestion":string}]} — max 6 patterns, each grounded in cited numbers. No prose outside the JSON.`,
      "Detect the patterns.",
    );
    const res = await resolveProvider().complete({ messages, maxTokens: 2048, json: true });
    try {
      return JSON.parse(res.text) as {
        patterns: {
          title: string;
          evidence: string;
          impact: "positive" | "negative";
          confidence: "low" | "medium" | "high";
          suggestion: string;
        }[];
      };
    } catch {
      return { patterns: [] };
    }
  });

// ── AI.generateLessons ───────────────────────────────────────────────────────

export const aiGenerateLessons = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => z.object({ context: UserContext }).parse(input))
  .handler(async ({ data }) => {
    const messages = buildMessages(
      data.context,
      `From the trader's mistakes and losing patterns, distill up to 3 durable LESSONS worth remembering forever. Return STRICT JSON: {"lessons":[{"lesson":string,"basedOn":string}]} — each lesson one sharp sentence in the trader's language, basedOn cites the evidence. No prose outside the JSON.`,
      "Generate the lessons.",
    );
    const res = await resolveProvider().complete({ messages, maxTokens: 1024, json: true });
    try {
      return JSON.parse(res.text) as { lessons: { lesson: string; basedOn: string }[] };
    } catch {
      return { lessons: [] };
    }
  });
