import { Trade } from '../types';
import { getSession, TradingSession } from './quantStats';

// ── Behavioral taxonomy ─────────────────────────────────────────────────────
// Each logged mistake maps to a severity tier. Severity weights the discipline
// score and drives the "fix this first" ordering.
export type Severity = 'high' | 'medium' | 'low';
export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export const MISTAKE_SEVERITY: Record<string, Severity> = {
  'No stop loss': 'high',
  'Revenge trade': 'high',
  'Size too large': 'high',
  'Averaged down': 'high',
  'FOMO entry': 'medium',
  'Overtrading': 'medium',
  'Chased entry': 'medium',
  'Ignored plan': 'medium',
  'Ignored market conditions': 'medium',
  'Premature exit': 'low',
  'Holding too long': 'low',
  'Low liquidity': 'low',
};

export function severityOf(mistake: string): Severity {
  return MISTAKE_SEVERITY[mistake] ?? 'medium';
}

export interface MistakeRow {
  mistake: string;
  severity: Severity;
  count: number;
  totalPnl: number;
  avgPnl: number;
}

export interface BehavioralReport {
  rows: MistakeRow[];
  totalIncidents: number;
  totalCost: number;
  tradesWithMistakes: number;
  cleanTrades: number;
  cleanWinRate: number | null;
  mistakeWinRate: number | null;
  /** 0–100; 100 = flawless discipline, penalized by severity-weighted incidents */
  disciplineScore: number;
  severityCounts: Record<Severity, number>;
  bySession: Record<TradingSession, number>;
  byDay: Record<number, number>;
  /** last 8 ISO-week buckets, oldest→newest */
  weeklyTrend: { week: string; count: number; cost: number }[];
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day + 3); // nearest Thursday
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function computeBehavioral(trades: Trade[]): BehavioralReport {
  const agg: Record<string, { count: number; totalPnl: number }> = {};
  const severityCounts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  const bySession: Record<TradingSession, number> = { london: 0, newyork: 0, asia: 0 };
  const byDay: Record<number, number> = {};
  const weekMap: Record<string, { count: number; cost: number }> = {};

  let weightedInfractions = 0;

  for (const t of trades) {
    if (t.mistakes.length === 0) continue;
    const session = getSession(t.entryTime);
    const dow = new Date(t.date + 'T12:00:00').getDay();
    const wk = isoWeekKey(t.date);
    for (const m of t.mistakes) {
      if (!agg[m]) agg[m] = { count: 0, totalPnl: 0 };
      agg[m].count++;
      agg[m].totalPnl += t.pnl;
      const sev = severityOf(m);
      severityCounts[sev]++;
      weightedInfractions += SEVERITY_WEIGHT[sev];
      if (session) bySession[session]++;
      byDay[dow] = (byDay[dow] || 0) + 1;
      if (!weekMap[wk]) weekMap[wk] = { count: 0, cost: 0 };
      weekMap[wk].count++;
      weekMap[wk].cost += t.pnl;
    }
  }

  const rows: MistakeRow[] = Object.entries(agg)
    .map(([mistake, d]) => ({
      mistake,
      severity: severityOf(mistake),
      count: d.count,
      totalPnl: Math.round(d.totalPnl * 100) / 100,
      avgPnl: Math.round((d.totalPnl / d.count) * 100) / 100,
    }))
    // worst first: severity weight × cost magnitude
    .sort((a, b) => (SEVERITY_WEIGHT[b.severity] * b.count) - (SEVERITY_WEIGHT[a.severity] * a.count));

  const totalIncidents = rows.reduce((s, r) => s + r.count, 0);
  const totalCost = rows.reduce((s, r) => s + r.totalPnl, 0);
  const tradesWithMistakes = trades.filter(t => t.mistakes.length > 0).length;
  const cleanTrades = trades.length - tradesWithMistakes;

  const cleanDecided = trades.filter(t => t.mistakes.length === 0 && t.direction !== 'be');
  const mistakeDecided = trades.filter(t => t.mistakes.length > 0 && t.direction !== 'be');
  const cleanWinRate = cleanDecided.length > 0 ? cleanDecided.filter(t => t.pnl > 0).length / cleanDecided.length : null;
  const mistakeWinRate = mistakeDecided.length > 0 ? mistakeDecided.filter(t => t.pnl > 0).length / mistakeDecided.length : null;

  // Discipline: perfect at 0 infractions, each severity-weighted incident per
  // trade chips away. Tuned so ~1 medium mistake every 3 trades ≈ 85.
  const disciplineScore = trades.length === 0
    ? 100
    : Math.max(0, Math.min(100, Math.round(100 - (weightedInfractions / trades.length) * 22)));

  // Last 8 weeks present in the data, chronological
  const weeklyTrend = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, d]) => ({ week: week.slice(5), count: d.count, cost: Math.round(d.cost * 100) / 100 }));

  return {
    rows, totalIncidents, totalCost, tradesWithMistakes, cleanTrades,
    cleanWinRate, mistakeWinRate, disciplineScore, severityCounts,
    bySession, byDay, weeklyTrend,
  };
}
