import { Trade, TradeStats, isBreakEven } from '../types';

export function computeStats(trades: Trade[]): TradeStats {
  const empty: TradeStats = {
    totalPnl: 0, winRate: 0, totalTrades: 0, wins: 0, losses: 0, breakEven: 0,
    avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0,
    currentStreak: 0, currentStreakType: 'none',
    bestTrade: null, worstTrade: null, avgRR: 0,
    dailyPnl: {}, pnlByStrategy: {}, pnlByDayOfWeek: {},
    equityCurve: [], mistakeStats: {},
  };

  if (trades.length === 0) return empty;

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const beTrades = trades.filter(isBreakEven);
  const decisive = trades.filter(t => !isBreakEven(t));
  const wins = decisive.filter(t => t.pnl > 0);
  const losses = decisive.filter(t => t.pnl < 0);
  // win rate excludes BE trades (industry standard)
  const decided = wins.length + losses.length;
  const winRate = decided > 0 ? wins.length / decided : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  let peak = 0, maxDrawdown = 0, equity = 0;
  for (const t of sorted) {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const reversed = [...sorted].reverse();
  let currentStreak = 0;
  let currentStreakType: 'win' | 'loss' | 'be' | 'none' = 'none';
  for (const t of reversed) {
    const type: 'win' | 'loss' | 'be' = isBreakEven(t) ? 'be' : t.pnl > 0 ? 'win' : 'loss';
    if (currentStreakType === 'none') { currentStreakType = type; currentStreak = 1; }
    else if (type === currentStreakType) { currentStreak++; }
    else break;
  }

  const bestTrade = trades.reduce((b, t) => t.pnl > b.pnl ? t : b, trades[0]);
  const worstTrade = trades.reduce((b, t) => t.pnl < b.pnl ? t : b, trades[0]);

  const avgRR = trades.length > 0
    ? trades.reduce((s, t) => s + Math.abs(t.rMultiple), 0) / trades.length
    : 0;

  const dailyPnl: Record<string, number> = {};
  for (const t of trades) { dailyPnl[t.date] = (dailyPnl[t.date] || 0) + t.pnl; }

  const pnlByStrategy: Record<string, { pnl: number; count: number; wins: number; breakEven: number }> = {};
  for (const t of trades) {
    if (!pnlByStrategy[t.strategy]) pnlByStrategy[t.strategy] = { pnl: 0, count: 0, wins: 0, breakEven: 0 };
    pnlByStrategy[t.strategy].pnl += t.pnl;
    pnlByStrategy[t.strategy].count++;
    if (isBreakEven(t)) pnlByStrategy[t.strategy].breakEven++;
    else if (t.pnl > 0) pnlByStrategy[t.strategy].wins++;
  }

  const pnlByDayOfWeek: Record<number, { pnl: number; count: number; wins: number; breakEven: number }> = {};
  for (const t of trades) {
    const dow = new Date(t.date + 'T12:00:00').getDay();
    if (!pnlByDayOfWeek[dow]) pnlByDayOfWeek[dow] = { pnl: 0, count: 0, wins: 0, breakEven: 0 };
    pnlByDayOfWeek[dow].pnl += t.pnl;
    pnlByDayOfWeek[dow].count++;
    if (isBreakEven(t)) pnlByDayOfWeek[dow].breakEven++;
    else if (t.pnl > 0) pnlByDayOfWeek[dow].wins++;
  }

  const equityCurve: { date: string; equity: number }[] = [];
  let eq = 0;
  for (const date of Object.keys(dailyPnl).sort()) {
    eq += dailyPnl[date];
    equityCurve.push({ date, equity: Math.round(eq * 100) / 100 });
  }

  const mistakeStats: Record<string, { count: number; totalPnl: number }> = {};
  for (const t of trades) {
    for (const m of t.mistakes) {
      if (!mistakeStats[m]) mistakeStats[m] = { count: 0, totalPnl: 0 };
      mistakeStats[m].count++;
      mistakeStats[m].totalPnl += t.pnl;
    }
  }

  return {
    totalPnl, winRate, totalTrades: trades.length,
    wins: wins.length, losses: losses.length, breakEven: beTrades.length,
    avgWin, avgLoss, profitFactor, maxDrawdown,
    currentStreak, currentStreakType,
    bestTrade, worstTrade, avgRR,
    dailyPnl, pnlByStrategy, pnlByDayOfWeek,
    equityCurve, mistakeStats,
  };
}

export function formatPnl(value: number): string {
  if (Math.abs(value) < 0.005) return '$0.00';
  const prefix = value >= 0 ? '+$' : '-$';
  return prefix + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPct(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function getDuration(entryTime: string, exitTime: string): string {
  if (!entryTime || !exitTime) return '—';
  const [eh, em] = entryTime.split(':').map(Number);
  const [xh, xm] = exitTime.split(':').map(Number);
  let diffMin = (xh * 60 + xm) - (eh * 60 + em);
  if (diffMin < 0) diffMin += 24 * 60;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Small helpers for BE display
export function directionLabel(d: 'long' | 'short' | 'be'): string {
  if (d === 'be') return 'BE';
  if (d === 'long') return 'L';
  return 'S';
}

export function directionBadgeClass(d: 'long' | 'short' | 'be'): string {
  if (d === 'long') return 'bg-emerald-500/15 text-emerald-400';
  if (d === 'short') return 'bg-red-500/15 text-red-400';
  return 'bg-slate-500/15 text-slate-300';
}
