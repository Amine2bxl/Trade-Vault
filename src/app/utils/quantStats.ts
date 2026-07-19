import { Trade, isBreakEven } from "../types";

// ── Trading sessions (ET, ICT convention) ──────────────────────────────────
// Times entered in the journal are treated as US Eastern (the reference for
// NQ/ES futures traders): London 02:00–08:00, New York 08:00–16:30, Asia the
// overnight remainder.
export type TradingSession = "asia" | "london" | "newyork";

export function getSession(entryTime: string): TradingSession | null {
  if (!entryTime) return null;
  const [h, m] = entryTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const mins = h * 60 + m;
  if (mins >= 120 && mins < 480) return "london";
  if (mins >= 480 && mins < 990) return "newyork";
  return "asia";
}

// ── Macro events (auto-derived from the trade date) ────────────────────────
// NFP: first Friday of the month (deterministic BLS rule).
// FOMC: hardcoded decision days (published Fed schedule 2024–2026).
const FOMC_DECISION_DAYS = new Set([
  "2024-01-31",
  "2024-03-20",
  "2024-05-01",
  "2024-06-12",
  "2024-07-31",
  "2024-09-18",
  "2024-11-07",
  "2024-12-18",
  "2025-01-29",
  "2025-03-19",
  "2025-05-07",
  "2025-06-18",
  "2025-07-30",
  "2025-09-17",
  "2025-10-29",
  "2025-12-10",
  "2026-01-28",
  "2026-03-18",
  "2026-04-29",
  "2026-06-17",
  "2026-07-29",
  "2026-09-16",
  "2026-10-28",
  "2026-12-09",
]);

export function getMacroEvents(date: string): string[] {
  const events: string[] = [];
  const d = new Date(date + "T12:00:00");
  if (Number.isNaN(d.getTime())) return events;
  if (d.getDay() === 5 && d.getDate() <= 7) events.push("NFP");
  if (FOMC_DECISION_DAYS.has(date)) events.push("FOMC");
  return events;
}

// ── Quant metrics ───────────────────────────────────────────────────────────
export interface QuantStats {
  /** Average $ result per trade (all trades, BE included) */
  expectancy: number;
  /** Average R result per trade (pnl / risk, trades with risk > 0) */
  expectancyR: number;
  /** Annualized Sharpe on daily PnL (null when < 10 trading days or flat) */
  sharpe: number | null;
  /** Annualized Sortino on daily PnL (99 cap when no losing day) */
  sortino: number | null;
  /** Max drawdown as % of (starting balance + peak equity); null without starting balance */
  maxDrawdownPct: number | null;
  /** Kelly fraction (indication only); null when wins or losses are missing */
  kelly: number | null;
  /** Best day PnL as share of total profit (TopStep-style consistency); null if not profitable */
  bestDayShare: number | null;
  /** 100 − bestDayShare% clamped to [0,100]; higher = more consistent */
  consistencyScore: number | null;
  /** Days from max-drawdown trough back to a new equity high; null = no drawdown, -1 = still in it */
  recoveryDays: number | null;
  /** Share of trades logged with zero mistakes */
  planAdherence: number;
}

export function computeQuantStats(trades: Trade[], startingBalance = 0): QuantStats {
  const empty: QuantStats = {
    expectancy: 0,
    expectancyR: 0,
    sharpe: null,
    sortino: null,
    maxDrawdownPct: null,
    kelly: null,
    bestDayShare: null,
    consistencyScore: null,
    recoveryDays: null,
    planAdherence: 0,
  };
  if (trades.length === 0) return empty;

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const expectancy = totalPnl / trades.length;

  const withRisk = trades.filter((t) => t.riskAmount > 0);
  const expectancyR =
    withRisk.length > 0
      ? withRisk.reduce((s, t) => s + t.pnl / t.riskAmount, 0) / withRisk.length
      : 0;

  // Daily PnL series in date order
  const dailyMap: Record<string, number> = {};
  for (const t of trades) dailyMap[t.date] = (dailyMap[t.date] || 0) + t.pnl;
  const dates = Object.keys(dailyMap).sort();
  const daily = dates.map((d) => dailyMap[d]);

  let sharpe: number | null = null;
  let sortino: number | null = null;
  if (daily.length >= 10) {
    const mean = daily.reduce((s, x) => s + x, 0) / daily.length;
    const variance = daily.reduce((s, x) => s + (x - mean) ** 2, 0) / daily.length;
    const std = Math.sqrt(variance);
    if (std > 0) sharpe = (mean / std) * Math.sqrt(252);
    const downside = Math.sqrt(daily.reduce((s, x) => s + Math.min(x, 0) ** 2, 0) / daily.length);
    if (downside > 0) sortino = (mean / downside) * Math.sqrt(252);
    else if (mean > 0) sortino = 99;
  }

  // Max drawdown (trade order by date) + % + recovery
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  let equity = 0,
    peak = 0,
    maxDD = 0,
    peakAtMaxDD = 0;
  let troughDate = "";
  for (const t of sorted) {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) {
      maxDD = dd;
      peakAtMaxDD = peak;
      troughDate = t.date;
    }
  }
  const ddBase = startingBalance > 0 ? startingBalance + peakAtMaxDD : 0;
  const maxDrawdownPct = maxDD > 0 && ddBase > 0 ? maxDD / ddBase : null;

  let recoveryDays: number | null = null;
  if (maxDD > 0 && troughDate) {
    // First date after the trough where equity makes a new high vs the pre-drawdown peak
    let eq = 0,
      recoveredOn: string | null = null;
    for (const t of sorted) {
      eq += t.pnl;
      if (t.date > troughDate && eq >= peakAtMaxDD) {
        recoveredOn = t.date;
        break;
      }
    }
    recoveryDays = recoveredOn
      ? Math.round(
          (new Date(recoveredOn + "T12:00:00").getTime() -
            new Date(troughDate + "T12:00:00").getTime()) /
            86400000,
        )
      : -1;
  }

  // Kelly: W − (1−W)/R with R = avgWin/|avgLoss|
  const decisive = trades.filter((t) => !isBreakEven(t));
  const wins = decisive.filter((t) => t.pnl > 0);
  const losses = decisive.filter((t) => t.pnl < 0);
  let kelly: number | null = null;
  if (wins.length > 0 && losses.length > 0) {
    const w = wins.length / (wins.length + losses.length);
    const avgWin = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length);
    if (avgLoss > 0) kelly = w - (1 - w) / (avgWin / avgLoss);
  }

  // Consistency: best day's profit as share of total PnL (prop-firm style)
  let bestDayShare: number | null = null;
  let consistencyScore: number | null = null;
  if (totalPnl > 0) {
    const bestDay = Math.max(...daily);
    if (bestDay > 0) {
      bestDayShare = bestDay / totalPnl;
      consistencyScore = Math.max(0, Math.min(100, 100 - bestDayShare * 100));
    }
  }

  const planAdherence = trades.filter((t) => t.mistakes.length === 0).length / trades.length;

  return {
    expectancy,
    expectancyR,
    sharpe,
    sortino,
    maxDrawdownPct,
    kelly,
    bestDayShare,
    consistencyScore,
    recoveryDays,
    planAdherence,
  };
}

// ── Breakdown helpers (heatmaps / per-bucket win rates) ─────────────────────
export interface BucketStat {
  pnl: number;
  count: number;
  wins: number;
  breakEven: number;
}

function addToBucket(map: Record<string, BucketStat>, key: string, t: Trade) {
  if (!map[key]) map[key] = { pnl: 0, count: 0, wins: 0, breakEven: 0 };
  map[key].pnl += t.pnl;
  map[key].count++;
  if (isBreakEven(t)) map[key].breakEven++;
  else if (t.pnl > 0) map[key].wins++;
}

export function statsBySession(trades: Trade[]): Record<TradingSession, BucketStat> {
  const map: Record<string, BucketStat> = {};
  for (const t of trades) {
    const s = getSession(t.entryTime);
    if (s) addToBucket(map, s, t);
  }
  return {
    asia: map.asia ?? { pnl: 0, count: 0, wins: 0, breakEven: 0 },
    london: map.london ?? { pnl: 0, count: 0, wins: 0, breakEven: 0 },
    newyork: map.newyork ?? { pnl: 0, count: 0, wins: 0, breakEven: 0 },
  };
}

export function statsByHour(trades: Trade[]): Record<number, BucketStat> {
  const map: Record<string, BucketStat> = {};
  for (const t of trades) {
    if (!t.entryTime) continue;
    const h = parseInt(t.entryTime.split(":")[0], 10);
    if (Number.isNaN(h)) continue;
    addToBucket(map, String(h), t);
  }
  const out: Record<number, BucketStat> = {};
  for (const [k, v] of Object.entries(map)) out[Number(k)] = v;
  return out;
}

/** day-of-week (0–6) × hour matrix for the Analytics heatmap */
export function dayHourMatrix(trades: Trade[]): Record<string, BucketStat> {
  const map: Record<string, BucketStat> = {};
  for (const t of trades) {
    if (!t.entryTime) continue;
    const h = parseInt(t.entryTime.split(":")[0], 10);
    if (Number.isNaN(h)) continue;
    const dow = new Date(t.date + "T12:00:00").getDay();
    addToBucket(map, `${dow}-${h}`, t);
  }
  return map;
}

export function winRateOf(b: BucketStat): number | null {
  const decided = b.count - b.breakEven;
  return decided > 0 ? b.wins / decided : null;
}
