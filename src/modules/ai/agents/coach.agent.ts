/**
 * AI Coach — agent V2 Phase 1.
 *
 * Answers the trader's questions using ONLY their real data (stats, trades,
 * recurring mistakes, goals, own rules and long-term memory). It interprets
 * the deterministic numbers the engines already computed — it never invents
 * or recomputes them.
 *
 * V2 Phase 1 additions over V1:
 *   - the coach KNOWS the trader: long-term memory, own rules, active goals
 *   - coaching doctrine: confront with numbers, at most 2 actions, one
 *     follow-up question, hammer the #1 declared weakness
 *   - adaptive format: short conversational answer by default, the full
 *     structured report only when the trader asks for a review (deterministic
 *     keyword detection — never decided by the model)
 *
 * Still out of scope (later phases): memory writes, proactivity, other agents.
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
  /** The trader's own written rules (from their Trading Plan). */
  rules?: { kind: string; text: string; enabled: boolean }[];
  /** Deterministic behavioral findings (significant only), one line each. */
  behavior?: string[];
  /** Long-term memory entries (profile, facts, lessons). */
  memory?: { kind: string; content: string }[];
  /** Recent conversation turns (in-request only — NOT persisted). */
  conversation?: ConversationTurn[];
}

/** Persona — a coach who knows this trader, not a report generator. */
export function coachIdentity(lang: string): string {
  return (
    `You are TradeVault's resident trading performance coach — an elite mentor ` +
    `who KNOWS this trader personally (their profile, weaknesses and rules are ` +
    `in LONG-TERM MEMORY and THE TRADER'S OWN RULES below — use them by name).\n` +
    `COACHING DOCTRINE:\n` +
    `- Every claim MUST cite specific numbers from the data provided.\n` +
    `- Confront honestly when the data shows an expensive behavior; encourage ` +
    `when the data shows progress. Kind but firm, never complacent.\n` +
    `- Recommend AT MOST 2 concrete actions per answer — one is better.\n` +
    `- Keep hammering the trader's #1 declared weakness when relevant.\n` +
    `- When BEHAVIORAL PATTERNS are present, confront the most expensive one ` +
    `first — that is where the money leaks.\n` +
    `- When useful, end with ONE short follow-up question that moves the ` +
    `coaching forward. Never more than one.\n` +
    `- Do not draw conclusions from fewer than 10 relevant trades — say the ` +
    `sample is too thin instead.\n` +
    `Write the ENTIRE response in ${lang}.`
  );
}

/** The non-negotiable "never invent" contract. */
export const ANTI_HALLUCINATION =
  "STRICT DATA RULE: your only sources are the LONG-TERM MEMORY, THE TRADER'S " +
  "OWN RULES, ACTIVE GOALS, BEHAVIORAL PATTERNS, RECURRING MISTAKES, " +
  "PRECOMPUTED STATS and RECENT TRADES blocks below. Never invent or estimate a number, name or date that " +
  "is not present there. If the data needed to answer is missing or too thin, " +
  "say so explicitly instead of guessing. You analyze the trader's past data " +
  "only — you never predict the market or give financial advice.";

/** Default voice: a coach talking, not a report. */
const CONVERSATIONAL_FORMAT =
  "Answer like a coach in conversation: GitHub-flavored Markdown, short " +
  "paragraphs or a few bullets, under ~150 words unless the question truly " +
  "needs more. Use **bold** for key numbers. No section headers, no tables, " +
  "no fluff.";

/** Full review — only when the trader explicitly asks for one. */
const REVIEW_FORMAT =
  "The trader asked for a full review. Respond in GitHub-flavored Markdown " +
  "with: ## 🎯 Key Takeaways (3-5 bullets with real numbers), ## 📊 Stats " +
  "Snapshot (compact table), ## ✅ Strengths, ## ⚠️ Weaknesses, ## 🧭 Action " +
  "Plan (max 2 items, measurable), ## 💡 Bottom Line (one bold sentence). " +
  "Omit a section only if truly not applicable. Use **bold** for key numbers.";

/** Deterministic review-intent detection (EN/FR + common variants). No AI. */
const REVIEW_INTENT =
  /\b(full review|complete review|full analysis|complete analysis|deep dive|audit|breakdown|bilan(?:\s+complet)?|analyse\s+(?:compl[eè]te|globale|d[ée]taill[ée]e)|rapport(?:\s+complet)?|fais\s+le\s+point|vue\s+d'ensemble)\b/i;

export function isReviewIntent(question: string): boolean {
  return REVIEW_INTENT.test(question);
}

/** Assemble the grounded prompt from the trader's real data. Pure & testable. */
export function buildCoachMessages(input: CoachInput) {
  const builder = createContextBuilder().withLanguage(input.language);
  if (input.memory) builder.withMemory(input.memory);
  if (input.rules) builder.withRules(input.rules);
  if (input.behavior) builder.withBehavior(input.behavior);
  if (input.goals) builder.withGoals(input.goals);
  if (input.stats) builder.withStats(input.stats);
  if (input.trades) builder.withTrades(input.trades);
  if (input.mistakes) builder.withMistakes(input.mistakes);

  const lang = languageName(input.language);
  return buildPrompt({
    identity: `${coachIdentity(lang)}\n\n${ANTI_HALLUCINATION}`,
    outputFormat: isReviewIntent(input.question) ? REVIEW_FORMAT : CONVERSATIONAL_FORMAT,
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
