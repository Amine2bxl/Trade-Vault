import type { Trade } from "../types";
import { computeStats, toInsightTradesPayload } from "./tradeCalcs";
import { computeBehaviorSignals } from "./behaviorSignals";
import type { TradingRule } from "./tradingRules";
import { loadMemory, remember } from "@/modules/ai/memory";
import { loadOnboarding, type OnboardingData } from "../store";
import type { AIUserContext } from "@/modules/ai/context";

/**
 * Coach context builder — the glue that turns the coach from a stateless Q&A
 * box into a mentor that KNOWS the trader. It assembles the grounded context
 * the rich `aiChat` server function expects:
 *
 *   recent trades · compact scalar stats · long-term memory (ai_memory) ·
 *   the running conversation · the UI language
 *
 * Memory is best-effort: any DB hiccup degrades gracefully to "no memory"
 * rather than blocking the coach. RLS (owner-only) still applies to every read.
 */

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Scalar-only snapshot the coach can cite — no arrays/maps (schema + size). */
function compactStats(trades: Trade[]): Record<string, number | string | null> {
  const s = computeStats(trades);
  return {
    totalPnl: round(s.totalPnl),
    winRatePct: round(s.winRate * 100),
    totalTrades: s.totalTrades,
    wins: s.wins,
    losses: s.losses,
    breakEven: s.breakEven,
    avgWin: round(s.avgWin),
    avgLoss: round(s.avgLoss),
    profitFactor: round(s.profitFactor),
    avgRR: round(s.avgRR),
    maxDrawdown: round(s.maxDrawdown),
    currentStreak: s.currentStreak,
    currentStreakType: s.currentStreakType,
  };
}

export async function buildCoachContext(opts: {
  userId?: string;
  trades: Trade[];
  conversation?: CoachTurn[];
  language?: string;
  /** How many trailing turns of the thread to send (protects payload size). */
  maxTurns?: number;
}): Promise<AIUserContext> {
  const { userId, trades, conversation = [], language, maxTurns = 16 } = opts;

  let memory: { kind: string; content: string }[] | undefined;
  if (userId) {
    try {
      const entries = await loadMemory(userId);
      if (entries.length) {
        memory = entries.map((m) => ({ kind: m.kind, content: m.content.slice(0, 2000) }));
      }
    } catch {
      // Best-effort: never let a memory read failure block the coach.
    }
  }

  return {
    trades: toInsightTradesPayload(trades),
    stats: trades.length ? compactStats(trades) : undefined,
    memory,
    conversation: conversation
      .slice(-maxTurns)
      .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 8000) })),
    language,
  };
}

/**
 * Seed a one-line `profile` memory from the onboarding answers so the coach
 * "knows" the trader from the very first message — deterministic, zero AI cost,
 * idempotent (only writes if no profile memory exists yet). Best-effort.
 */
/** Input shape for the AI Coach V1 server function (`askCoach`). */
export interface CoachV1Payload {
  stats?: Record<string, number | string | null>;
  trades?: ReturnType<typeof toInsightTradesPayload>;
  mistakes?: { name: string; count: number; totalPnl: number }[];
  /** Deterministic behaviour signals — the evidence behind a real diagnosis. */
  signals?: Record<string, unknown>;
  /** The rules the trader wrote for themselves, so the coach can enforce them. */
  rules?: { kind: string; text: string; enabled: boolean }[];
  conversation?: { role: "user" | "assistant"; content: string }[];
  profile?: string;
  language?: string;
}

/**
 * One-line trader profile from the onboarding answers — sent with every coach
 * call so the coaching addresses THIS trader (their style, market, declared
 * weakness, goal and target) instead of sounding generic. Pure, sync, no IO.
 */
export function describeProfile(
  onb: (OnboardingData & { monthlyTarget?: number | null }) | null | undefined,
): string | undefined {
  if (!onb) return undefined;
  const parts: string[] = [];
  if (onb.style) parts.push(`style: ${onb.style}`);
  if (onb.experience) parts.push(`experience: ${onb.experience}`);
  if (onb.assets?.length) parts.push(`markets: ${onb.assets.slice(0, 5).join(", ")}`);
  if (onb.usesIct) parts.push("uses ICT concepts");
  if (onb.goal) parts.push(`goal: ${onb.goal}`);
  if (onb.pain) parts.push(`declared weakness to police: ${onb.pain}`);
  if (typeof onb.monthlyTarget === "number" && onb.monthlyTarget > 0)
    parts.push(`monthly target: ${onb.monthlyTarget}%`);
  if (!parts.length) return undefined;
  return `Trader profile — ${parts.join("; ")}.`;
}

/**
 * Build the grounded payload for AI Coach V1 — stats, trades, recurring
 * mistakes (derived from the same deterministic engine), the running
 * conversation and the language. No long-term memory (V1 scope): synchronous,
 * no DB read, so it never blocks the coach.
 */
export function buildCoachV1Payload(opts: {
  trades: Trade[];
  conversation?: CoachTurn[];
  language?: string;
  maxTurns?: number;
  /** Onboarding answers — makes the coaching personal on every single call. */
  onboarding?: (OnboardingData & { monthlyTarget?: number | null }) | null;
  /** The trader's own rules, so the coach holds them to their own standard. */
  rules?: TradingRule[];
}): CoachV1Payload {
  const { trades, conversation = [], language, maxTurns = 16, onboarding, rules } = opts;
  const stats = trades.length ? computeStats(trades) : null;
  const mistakes = stats
    ? Object.entries(stats.mistakeStats)
        .map(([name, v]) => ({ name, count: v.count, totalPnl: round(v.totalPnl) }))
        .sort((a, b) => a.totalPnl - b.totalPnl)
        .slice(0, 40)
    : [];
  // The behavioural read is what turns "here are your stats" into "here is why
  // you lose on Fridays". Computed deterministically, never by the model.
  const signals = computeBehaviorSignals(trades);
  return {
    trades: toInsightTradesPayload(trades),
    stats: trades.length ? compactStats(trades) : undefined,
    mistakes: mistakes.length ? mistakes : undefined,
    signals: Object.keys(signals).length ? (signals as Record<string, unknown>) : undefined,
    rules: rules?.length
      ? rules
          .slice(0, 30)
          .map((r) => ({ kind: r.kind, text: r.text.slice(0, 300), enabled: r.enabled }))
      : undefined,
    conversation: conversation
      .slice(-maxTurns)
      .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 8000) })),
    profile: describeProfile(onboarding),
    language,
  };
}

export async function seedProfileMemory(userId: string): Promise<void> {
  try {
    const existing = await loadMemory(userId, ["profile"], 1);
    if (existing.length) return;

    const onb = await loadOnboarding(userId);
    const parts: string[] = [];
    if (onb.style) parts.push(`style: ${onb.style}`);
    if (onb.pain) parts.push(`main weakness to watch: ${onb.pain}`);
    if (typeof onb.monthlyTarget === "number") parts.push(`monthly target: ${onb.monthlyTarget}%`);
    if (onb.experience) parts.push(`experience: ${onb.experience}`);
    if (onb.usesIct) parts.push("uses ICT concepts");
    if (!parts.length) return;

    await remember(userId, "profile", `Trader profile — ${parts.join("; ")}.`);
  } catch {
    // Best-effort: seeding must never surface an error to the user.
  }
}
