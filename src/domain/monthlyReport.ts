import { Trade } from "./trade";
import { computeStats } from "./tradeCalcs";
import { computeQuantStats, winRateOf, MIN_BUCKET_SAMPLE } from "./quantStats";

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

/**
 * Version de la MÉTHODE de calcul d'un rapport archivé.
 *
 * 2 : PF nullable, drawdown ordonné par clôtures, Sortino sans plafond.
 * 3 : R moyen limité au R MESURÉ (`domain/trade.measuredR`) — un import broker
 *     ou non relu n'y entre plus — et colonnes de provenance lues côté serveur.
 *     Un rapport v2 n'a jamais quitté la branche du lot 0, mais un R qu'il
 *     aurait calculé ne se compare pas à un R v3 : il est traité comme hérité.
 */
export const REPORT_METHOD_VERSION = 3;

export interface MonthlyReportData {
  month: string; // YYYY-MM
  /** Missing in pre-correction archived reports; only this known version is trusted for derived metrics. */
  reportMethodVersion?: number;
  totalPnl: number;
  trades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  profitFactor: number | null;
  expectancy: number;
  expectancyR: number | null;
  sharpe: number | null;
  sortino: number | null;
  /** Realized max drawdown; null when close order is not verifiable. */
  maxDrawdown: number | null;
  weekly: WeekLine[];
  bestSetups: SetupLine[];
  worstSetups: SetupLine[];
  mistakes: MistakeLine[];
  prev: { month: string; totalPnl: number; winRate: number; trades: number } | null;
  /** Optional Gemini synthesis (Étape 5, option A) — null when unavailable */
  aiSummary: string | null;
}

/** Older snapshots predate nullable PF, time-ordered drawdown and evidence checks.
 * Preserve the archived source without an irreversible DB migration, but never
 * re-issue its unverifiable quantitative claims or AI synthesis as facts.
 * A fresh server-side recalculation upserts a new versioned snapshot.
 */
export function isLegacyMonthlyReport(report: MonthlyReportData): boolean {
  return report.reportMethodVersion !== REPORT_METHOD_VERSION;
}

export function readArchivedMonthlyReport(report: MonthlyReportData): MonthlyReportData {
  if (!isLegacyMonthlyReport(report)) return report;
  return {
    ...report,
    profitFactor: null,
    expectancyR: null,
    sharpe: null,
    sortino: null,
    maxDrawdown: null,
    bestSetups: [],
    worstSetups: [],
    mistakes: [],
    aiSummary: null,
  };
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

  const setups: SetupLine[] = Object.entries(stats.pnlByStrategy).map(([strategy, s]) => ({
    strategy,
    pnl: round2(s.pnl),
    count: s.count,
    // `winRateOf` — l'unique définition du produit. Ce fichier recalculait la
    // sienne, ce qui en faisait la TROISIÈME et la faisait échapper au plancher
    // d'échantillon.
    winRate: (() => {
      const wr = winRateOf(s);
      return wr === null ? null : Math.round(wr * 100) / 100;
    })(),
  }));
  // Un bilan mensuel AFFIRME plus fortement qu'un graphique : il est écrit,
  // archivé, et relu à froid. Désigner « ton meilleur setup du mois » sur deux
  // trades y est donc plus coûteux qu'ailleurs — le trader relira ce rapport
  // dans six mois en le prenant pour un constat établi.
  //
  // Les setups sous le plancher restent dans `setups` (le tableau complet, où
  // leur nombre de trades est visible) ; ils ne peuvent simplement pas être
  // couronnés ni cloués au pilori.
  const byPnl = [...setups]
    .filter((s) => s.count >= MIN_BUCKET_SAMPLE)
    .sort((a, b) => b.pnl - a.pnl);
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
      winRate: Math.round(p.winRate * 10000) / 10000,
      trades: p.totalTrades,
    };
  }

  return {
    month,
    reportMethodVersion: REPORT_METHOD_VERSION,
    totalPnl: round2(stats.totalPnl),
    trades: stats.totalTrades,
    wins: stats.wins,
    losses: stats.losses,
    breakEven: stats.breakEven,
    // Précision du dix-millième : `formatPct` affiche une décimale, et un taux
    // arrondi au centième (0,57) s'affichait « 57,0 % » là où le Dashboard
    // lisait 57,1 % pour les mêmes 8 gains sur 14 trades tranchés.
    winRate: Math.round(stats.winRate * 10000) / 10000,
    profitFactor: stats.profitFactor === null ? null : Math.round(stats.profitFactor * 100) / 100,
    expectancy: round2(quant.expectancy),
    expectancyR: quant.expectancyR === null ? null : Math.round(quant.expectancyR * 100) / 100,
    sharpe: quant.sharpe !== null ? Math.round(quant.sharpe * 100) / 100 : null,
    sortino: quant.sortino !== null ? Math.round(quant.sortino * 100) / 100 : null,
    maxDrawdown: stats.maxDrawdownOrderVerified ? round2(stats.maxDrawdown) : null,
    weekly,
    bestSetups,
    worstSetups,
    mistakes,
    prev,
    aiSummary: null,
  };
}
