import type { Trade } from "../types";
import { computeStats, toInsightTradesPayload } from "./tradeCalcs";
import { loadMemory, remember } from "@/modules/ai/memory";
import { loadOnboarding } from "../store";
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
