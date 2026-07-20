/**
 * AI Coach — agent V1.
 *
 * The first usable TradeVault agent: answers the trader's questions using ONLY
 * their real data (stats, trades, recurring mistakes, goals). It interprets the
 * deterministic numbers the engines already computed — it never invents them.
 *
 * Scope of V1 (intentionally minimal):
 *   - read stats · read trades · read mistakes · read goals · answer questions
 *   - NO long-term memory (ai_memory is not read or written here)
 *   - NO proactivity (no jobs, no notifications)
 *   - NO secondary agents
 *
 * Built entirely on the platform infra (context builder → prompt builder →
 * provider service → response formatter). Pure logic: the provider is resolved
 * (or injected via opts), so this is unit-testable without network.
 */
import { generate, type GenerateOptions } from "../provider-service";
import { buildPrompt, type ConversationTurn } from "../prompt-builder";
import { createContextBuilder } from "../context-builder";
import { toFormatted, type FormattedResponse } from "../response-formatter";
import { languageName, type AITradeSummary } from "../context";

export interface CoachInput {
  /** The trader's question. */
  question: string;
  /** ISO 639-1 UI language — the answer is written in this language. */
  language?: string;
  /** Precomputed stats snapshot (deterministic, from the engines). */
  stats?: Record<string, number | string | null>;
  /** Compact recent trades. */
  trades?: AITradeSummary[];
  /** Recurring mistakes with frequency and net cost. */
  mistakes?: { name: string; count: number; totalPnl: number }[];
  /** Active goals and progress. */
  goals?: { kind: string; target: number; current: number }[];
  /** Recent conversation turns (in-request only — NOT persisted). */
  conversation?: ConversationTurn[];
}

/** Persona — the coach knows this trader and must ground every claim. */
export function coachIdentity(lang: string): string {
  return (
    `You are TradeVault's resident trading performance coach — an elite quant ` +
    `mentor who KNOWS this trader. Every claim MUST cite specific numbers from ` +
    `the data provided below. Be candid, concrete and kind-but-firm. ` +
    `Write the ENTIRE response in ${lang}.`
  );
}

/** The non-negotiable "never invent" contract. */
export const ANTI_HALLUCINATION =
  "STRICT DATA RULE: your only sources are the RECENT TRADES, RECURRING MISTAKES, " +
  "ACTIVE GOALS and PRECOMPUTED STATS blocks below. Never invent or estimate a " +
  "number, name or date that is not present there. If the data needed to answer " +
  "is missing or too thin, say so explicitly instead of guessing. You analyze the " +
  "trader's past data only — you never predict the market or give financial advice.";

const CHAT_FORMAT =
  "Respond in GitHub-flavored Markdown with: ## 🎯 Key Takeaways (3-5 bullets with " +
  "real numbers), ## 📊 Stats Snapshot (compact table), ## ✅ Strengths, " +
  "## ⚠️ Weaknesses, ## 🧭 Action Plan (numbered, measurable), ## 💡 Bottom Line " +
  "(one bold sentence). Omit a section only if truly not applicable. Use **bold** " +
  "for key numbers. No fluff.";

/** Assemble the grounded prompt from the trader's real data. Pure & testable. */
export function buildCoachMessages(input: CoachInput) {
  const builder = createContextBuilder().withLanguage(input.language);
  if (input.stats) builder.withStats(input.stats);
  if (input.trades) builder.withTrades(input.trades);
  if (input.mistakes) builder.withMistakes(input.mistakes);
  if (input.goals) builder.withGoals(input.goals);

  const lang = languageName(input.language);
  return buildPrompt({
    identity: `${coachIdentity(lang)}\n\n${ANTI_HALLUCINATION}`,
    outputFormat: CHAT_FORMAT,
    contextBlocks: builder.blocks(),
    conversation: input.conversation,
    userTurn: `Question: ${input.question}`,
  });
}

/** Run the coach end-to-end and return a normalized answer. */
export async function runCoach(
  input: CoachInput,
  opts?: GenerateOptions,
): Promise<FormattedResponse> {
  const messages = buildCoachMessages(input);
  const res = await generate({ messages, maxTokens: 4096 }, opts);
  return toFormatted(res);
}
