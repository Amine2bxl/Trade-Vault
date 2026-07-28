import type { Trade, TradeStats } from "../types";

// ── Edge Score ───────────────────────────────────────────────────────────────
// A deterministic 0–100 discipline score derived ONLY from the trader's real
// data (no AI, no invented numbers). It rewards *behaviour* (plan, risk, clean
// days, routine), never PnL. Four sub-scores are averaged with fixed weights;
// any sub-score whose data is missing is dropped and the remaining weights are
// renormalised, so the score never fabricates a component it can't measure.
//
// Window: the last N (=10) *traded* days — recent enough to react, stable
// enough to reward consistency. Independent of the dashboard period selector.

export const EDGE_WINDOW_DAYS = 10;

/** Weights (sum = 1) applied when every component has data. */
const WEIGHTS = { plan: 0.35, risk: 0.25, cleanDays: 0.25, routine: 0.15 } as const;

export interface EdgeInputs {
  /** Max risk per trade, in %, from the written plan (`risk.maxRiskPerTradePct`). */
  maxRiskPct?: number | null;
  /** Starting balance, to turn maxRiskPct into an absolute threshold. */
  startingBalance?: number | null;
  /**
   * Checklist completion per ISO day, 0..1, read from localStorage by the
   * caller (1 = locked/complete). Absent day = no entry for that day.
   */
  checklistByDay?: Record<string, number>;
}

export interface EdgeSubScore {
  /** 0..100, or null when there isn't enough data to measure it honestly. */
  value: number | null;
  /** Human-facing denominator, e.g. "8/10 jours propres". */
  detail?: string;
}

export interface EdgeResult {
  /** 0..100 rounded, or null when the sample is too thin to score. */
  score: number | null;
  subs: {
    plan: EdgeSubScore;
    risk: EdgeSubScore;
    cleanDays: EdgeSubScore;
    routine: EdgeSubScore;
  };
  /** Distinct traded days in the window (drives "clean days" denominator). */
  tradedDays: number;
  cleanDays: number;
  /** The dominant weakness key (lowest measured sub-score), for the Jarvis line. */
  weakest: "plan" | "risk" | "cleanDays" | "routine" | null;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Distinct ISO dates present in `trades`, newest first. */
function tradedDates(trades: Trade[]): string[] {
  const set = new Set(trades.map((t) => t.date));
  return [...set].sort((a, b) => b.localeCompare(a));
}

/**
 * Absolute per-trade risk threshold ($). Prefers the plan's max-risk rule
 * (`maxRiskPct` × starting balance); falls back to 1.5 × median historical
 * risk when the rule or balance is missing. Returns null if neither is usable.
 */
export function riskThreshold(
  trades: Trade[],
  maxRiskPct?: number | null,
  startingBalance?: number | null,
): number | null {
  if (maxRiskPct && maxRiskPct > 0 && startingBalance && startingBalance > 0) {
    return (maxRiskPct / 100) * startingBalance;
  }
  const risks = trades.map((t) => t.riskAmount).filter((r) => r > 0);
  if (risks.length === 0) return null;
  return median(risks) * 1.5;
}

/**
 * Compute the Edge Score over the last `EDGE_WINDOW_DAYS` traded days.
 * `allTrades` is the full account history (not the period-filtered set).
 */
export function computeEdgeScore(allTrades: Trade[], inputs: EdgeInputs = {}): EdgeResult {
  const empty = (): EdgeSubScore => ({ value: null });
  const dates = tradedDates(allTrades).slice(0, EDGE_WINDOW_DAYS);
  const windowDates = new Set(dates);
  const window = allTrades.filter((t) => windowDates.has(t.date));

  const subs = {
    plan: empty(),
    risk: empty(),
    cleanDays: empty(),
    routine: empty(),
  };

  if (window.length === 0) {
    return { score: null, subs, tradedDays: 0, cleanDays: 0, weakest: null };
  }

  // Plan adherence: share of window trades logged with zero mistakes.
  subs.plan = {
    value: (window.filter((t) => t.mistakes.length === 0).length / window.length) * 100,
  };

  // Risk respect: share of window trades at or under the risk threshold.
  const threshold = riskThreshold(allTrades, inputs.maxRiskPct, inputs.startingBalance);
  const risked = window.filter((t) => t.riskAmount > 0);
  if (threshold !== null && risked.length > 0) {
    const ok = risked.filter((t) => t.riskAmount <= threshold).length;
    subs.risk = { value: (ok / risked.length) * 100, detail: `${ok}/${risked.length}` };
  }

  // Clean days: traded days in the window with no mistake-tagged trade.
  const byDay = new Map<string, boolean>(); // date -> hasMistake
  for (const t of window) {
    byDay.set(t.date, (byDay.get(t.date) ?? false) || t.mistakes.length > 0);
  }
  const tradedDaysN = byDay.size;
  const cleanDaysN = [...byDay.values()].filter((hasMistake) => !hasMistake).length;
  subs.cleanDays = {
    value: tradedDaysN > 0 ? (cleanDaysN / tradedDaysN) * 100 : null,
    detail: `${cleanDaysN}/${tradedDaysN}`,
  };

  // Routine: average checklist completion across the window's traded days.
  const checklist = inputs.checklistByDay ?? {};
  const daysWithChecklist = dates.filter((d) => d in checklist);
  if (daysWithChecklist.length > 0) {
    const sum = daysWithChecklist.reduce(
      (acc, d) => acc + Math.max(0, Math.min(1, checklist[d])),
      0,
    );
    subs.routine = {
      value: (sum / daysWithChecklist.length) * 100,
      detail: `${daysWithChecklist.length}/${dates.length}`,
    };
  }

  // Weighted average over measured components only (renormalise weights).
  let weightSum = 0;
  let acc = 0;
  (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).forEach((k) => {
    const v = subs[k].value;
    if (v !== null) {
      acc += v * WEIGHTS[k];
      weightSum += WEIGHTS[k];
    }
  });
  const score = weightSum > 0 ? Math.round(acc / weightSum) : null;

  // Weakest measured component (lowest value) — drives the coaching line.
  let weakest: EdgeResult["weakest"] = null;
  let lowest = Infinity;
  (Object.keys(subs) as (keyof typeof subs)[]).forEach((k) => {
    const v = subs[k].value;
    if (v !== null && v < lowest) {
      lowest = v;
      weakest = k;
    }
  });

  return { score, subs, tradedDays: tradedDaysN, cleanDays: cleanDaysN, weakest };
}

// ── Règle du jour (derived from the real recurring leak) ─────────────────────

export interface DailyRule {
  /** Short imperative rule, e.g. "Max 2 trades aujourd'hui". */
  text: string;
  /** The leak the rule targets, when derived from mistakeStats. */
  leak?: string;
}

/**
 * Derive today's rule from the trader's #1 money-bleeding mistake
 * (`stats.mistakeStats`, most negative total PnL). Returns null when there
 * isn't a clearly costly leak yet — the caller then shows a neutral fallback.
 * Never invents a rule.
 */
export function deriveDailyRule(stats: TradeStats): DailyRule | null {
  const entries = Object.entries(stats.mistakeStats);
  if (entries.length === 0) return null;
  // Worst leak = the mistake with the most negative cumulative PnL.
  const worst = entries
    .filter(([, s]) => s.totalPnl < 0)
    .sort((a, b) => a[1].totalPnl - b[1].totalPnl)[0];
  if (!worst) return null;
  const [name, s] = worst;
  return { text: name, leak: `${name} · ${s.count}× · ${Math.round(s.totalPnl)}` };
}
