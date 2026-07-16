import { Trade } from "../types";
import { computeStats } from "./tradeCalcs";
import { computeQuantStats } from "./quantStats";

// Pure report builder — shared by the Vercel cron (service role) and the
// on-demand server function. No I/O here; callers fetch the trades.

export interface SetupLine {
  strategy: string;
  pnl: number;
  count: number;
  winRate: number | null;
}

export interface MistakeLine {
  name: string;
  count: number;
  cost: number;
}

export interface WeekLine {
  /** 1-based week-of-month bucket (days 1–7, 8–14, …) */
  week: number;
  pnl: number;
  trades: number;
}

export interface MonthlyReportData {
  month: string; // YYYY-MM
  totalPnl: number;
  trades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  expectancyR: number;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number;
  weekly: WeekLine[];
  bestSetups: SetupLine[];
  worstSetups: SetupLine[];
  mistakes: MistakeLine[];
  prev: { month: string; totalPnl: number; winRate: number; trades: number } | null;
  /** Optional Gemini synthesis (Étape 5, option A) — null when unavailable */
  aiSummary: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** First/last ISO date of a YYYY-MM month. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

/** Previous YYYY-MM. */
export function prevMonthOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildMonthlyReport(
  month: string,
  monthTrades: Trade[],
  prevTrades: Trade[],
  startingBalance: number,
): MonthlyReportData {
  const stats = computeStats(monthTrades);
  const quant = computeQuantStats(monthTrades, startingBalance);

  // Week-of-month buckets
  const weekly: WeekLine[] = [];
  for (const t of monthTrades) {
    const day = Number(t.date.slice(8, 10));
    const w = Math.min(5, Math.floor((day - 1) / 7) + 1);
    let line = weekly.find((x) => x.week === w);
    if (!line) {
      line = { week: w, pnl: 0, trades: 0 };
      weekly.push(line);
    }
    line.pnl = round2(line.pnl + t.pnl);
    line.trades++;
  }
  weekly.sort((a, b) => a.week - b.week);

  const setups: SetupLine[] = Object.entries(stats.pnlByStrategy).map(([strategy, s]) => {
    const decisive = s.count - s.breakEven;
    return {
      strategy,
      pnl: round2(s.pnl),
      count: s.count,
      winRate: decisive > 0 ? Math.round((s.wins / decisive) * 100) / 100 : null,
    };
  });
  const byPnl = [...setups].sort((a, b) => b.pnl - a.pnl);
  const bestSetups = byPnl.filter((s) => s.pnl > 0).slice(0, 3);
  const worstSetups = byPnl
    .filter((s) => s.pnl < 0)
    .slice(-3)
    .reverse();

  const mistakes: MistakeLine[] = Object.entries(stats.mistakeStats)
    .map(([name, m]) => ({ name, count: m.count, cost: round2(m.totalPnl) }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 5);

  let prev: MonthlyReportData["prev"] = null;
  if (prevTrades.length > 0) {
    const p = computeStats(prevTrades);
    prev = {
      month: prevMonthOf(month),
      totalPnl: round2(p.totalPnl),
      winRate: Math.round(p.winRate * 100) / 100,
      trades: p.totalTrades,
    };
  }

  return {
    month,
    totalPnl: round2(stats.totalPnl),
    trades: stats.totalTrades,
    wins: stats.wins,
    losses: stats.losses,
    breakEven: stats.breakEven,
    winRate: Math.round(stats.winRate * 100) / 100,
    profitFactor: Math.round(stats.profitFactor * 100) / 100,
    expectancy: round2(quant.expectancy),
    expectancyR: Math.round(quant.expectancyR * 100) / 100,
    sharpe: quant.sharpe !== null ? Math.round(quant.sharpe * 100) / 100 : null,
    sortino: quant.sortino !== null ? Math.round(quant.sortino * 100) / 100 : null,
    maxDrawdown: round2(stats.maxDrawdown),
    weekly,
    bestSetups,
    worstSetups,
    mistakes,
    prev,
    aiSummary: null,
  };
}
