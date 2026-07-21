import type { Trade } from "@/app/types";

/**
 * Discipline Score v1 — pure, deterministic daily scoring.
 *
 * v1 measures only what the product can already observe honestly:
 *   - checklist completed, ideally BEFORE the first trade of the day (60 pts)
 *   - journal kept: every trade of the day has setup quality + notes (40 pts)
 *
 * Deliberately independent from PnL: a disciplined losing day scores 100,
 * a reckless winning day scores low. Weights are extensible: "rules respected"
 * and "commitment kept" join in later sprints without resetting streaks.
 */

export const SCORE_WEIGHTS_V1 = {
  /** Checklist completed before the first trade (full) / after (half). */
  checklist: 60,
  /** Every trade of the day journaled with setupQuality + notes. */
  journal: 40,
} as const;

/** A day counts toward the streak when its score reaches this threshold. */
export const STREAK_THRESHOLD = 70;

export interface DayScoreInput {
  /** ISO timestamp when the pre-market checklist reached 100%, if it did. */
  checklistDoneAt: string | null;
  /** The day's trades (any account), used for timing + journal quality. */
  trades: Pick<Trade, "entryTime" | "setupQuality" | "notes" | "isExample">[];
}

export interface DayScore {
  score: number;
  checklistDone: boolean;
  /** True when the checklist was completed before the first trade's entry. */
  checklistBeforeFirstTrade: boolean;
  journalComplete: boolean;
  tradeCount: number;
  /** No trades and no checklist — the day is neutral and never breaks a streak. */
  neutral: boolean;
}

function firstEntryMs(trades: DayScoreInput["trades"]): number | null {
  let min: number | null = null;
  for (const t of trades) {
    if (!t.entryTime) continue;
    const ms = Date.parse(t.entryTime);
    if (!Number.isFinite(ms)) continue;
    if (min === null || ms < min) min = ms;
  }
  return min;
}

export function computeDayScore(input: DayScoreInput): DayScore {
  const trades = input.trades.filter((t) => !t.isExample);
  const checklistDone = !!input.checklistDoneAt;
  const neutral = trades.length === 0 && !checklistDone;

  const doneMs = input.checklistDoneAt ? Date.parse(input.checklistDoneAt) : NaN;
  const firstMs = firstEntryMs(trades);
  // No timed trades (or no trades at all): completing the checklist counts in full.
  const beforeFirst =
    checklistDone && (firstMs === null || (Number.isFinite(doneMs) && doneMs <= firstMs));

  const journalComplete =
    trades.length > 0 &&
    trades.every((t) => t.setupQuality > 0 && (t.notes ?? "").trim().length > 0);

  let score = 0;
  if (checklistDone)
    score += beforeFirst ? SCORE_WEIGHTS_V1.checklist : SCORE_WEIGHTS_V1.checklist / 2;
  if (journalComplete) score += SCORE_WEIGHTS_V1.journal;
  // A clean prep day (checklist done, zero trades) is a fully disciplined day.
  if (checklistDone && trades.length === 0) score = 100;

  return {
    score: Math.round(score),
    checklistDone,
    checklistBeforeFirstTrade: beforeFirst,
    journalComplete,
    tradeCount: trades.length,
    neutral,
  };
}

export interface StreakDay {
  /** yyyy-mm-dd */
  date: string;
  score: number;
}

/**
 * Consecutive non-neutral days with score >= STREAK_THRESHOLD, walking back
 * from the most recent recorded day. Days absent from the list (weekends,
 * days off) are neutral by definition and never break the streak — only a
 * recorded day below the threshold does.
 */
export function computeStreak(days: StreakDay[]): number {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const day of sorted) {
    if (day.score >= STREAK_THRESHOLD) streak += 1;
    else break;
  }
  return streak;
}
