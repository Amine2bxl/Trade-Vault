/**
 * CE QUI MARCHE, CE QUI COÛTE — module PUR (client et serveur).
 *
 * La page Analyses ne calcule rien : elle affiche ce que ce module rend.
 * Pour chaque dimension (setup, symbole, jour, heure de New York), le seau le
 * plus rentable et le plus coûteux — seulement parmi les seaux d'au moins
 * `MIN_BUCKET_SAMPLE` trades (en dessous, rien : trois trades ne font pas une
 * tendance). Chaque résultat porte son `n`. Aucune causalité : « ton meilleur
 * jour », pas « le jour qui te fait gagner ».
 */
import type { Trade } from "./trade";
import { isBreakEven } from "./trade";
import { MIN_BUCKET_SAMPLE, easternEntryMinute } from "./quantStats";

export interface InsightBucket {
  key: string;
  pnl: number;
  count: number;
  /** Part des trades décisifs gagnés, 0–1 ; null sans trade décisif. */
  winRate: number | null;
}

export interface BestWorst {
  best: InsightBucket | null;
  worst: InsightBucket | null;
}

export interface AnalyticsInsights {
  setup: BestWorst;
  symbol: BestWorst;
  /** Clé = jour de la semaine, « 1 » (lundi) à « 7 » (dimanche). */
  day: BestWorst;
  /** Clé = heure de New York, « 0 » à « 23 ». */
  hour: BestWorst;
  longestWinStreak: number;
  longestLossStreak: number;
  /** P&L par mois civil, chronologique (« AAAA-MM »). */
  months: { month: string; pnl: number; count: number }[];
  /** P&L par semaine (clé = lundi « AAAA-MM-JJ »), chronologique, avec le
   *  taux de réussite des trades décisifs (null sans trade décisif). */
  weeks: { week: string; pnl: number; count: number; winRate: number | null }[];
}

type Acc = { pnl: number; count: number; wins: number; decided: number };

function bestWorst(map: Map<string, Acc>): BestWorst {
  const eligible: InsightBucket[] = [...map.entries()]
    .filter(([, a]) => a.count >= MIN_BUCKET_SAMPLE)
    .map(([key, a]) => ({
      key,
      pnl: Math.round(a.pnl * 100) / 100,
      count: a.count,
      winRate: a.decided ? a.wins / a.decided : null,
    }))
    .sort((a, b) => b.pnl - a.pnl || a.key.localeCompare(b.key));
  const best = eligible[0] && eligible[0].pnl > 0 ? eligible[0] : null;
  const last = eligible.at(-1);
  const worst = last && last.pnl < 0 && last !== best ? last : null;
  return { best, worst };
}

/** Jour de la semaine d'une date CIVILE « AAAA-MM-JJ », sans fuseau. */
export function isoWeekday(date: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function analyticsInsights(trades: readonly Trade[]): AnalyticsInsights {
  const maps = {
    setup: new Map<string, Acc>(),
    symbol: new Map<string, Acc>(),
    day: new Map<string, Acc>(),
    hour: new Map<string, Acc>(),
  };
  const add = (map: Map<string, Acc>, key: string | null, t: Trade) => {
    if (!key) return;
    const a = map.get(key) ?? { pnl: 0, count: 0, wins: 0, decided: 0 };
    a.pnl += t.pnl;
    a.count++;
    if (!isBreakEven(t)) {
      a.decided++;
      if (t.pnl > 0) a.wins++;
    }
    map.set(key, a);
  };
  for (const t of trades) {
    if (!Number.isFinite(t.pnl)) continue;
    add(maps.setup, t.strategy?.trim() || null, t);
    add(maps.symbol, t.symbol?.trim().toUpperCase() || null, t);
    const wd = isoWeekday(t.date);
    add(maps.day, wd === null ? null : String(wd), t);
    const minute = easternEntryMinute(t);
    add(maps.hour, minute === null ? null : String(Math.floor(minute / 60)), t);
  }

  // Séries : ordre chronologique (date, puis heure d'entrée) ; un trade
  // neutre interrompt les deux séries.
  const ordered = [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.entryTime ?? "").localeCompare(b.entryTime ?? ""),
  );
  let win = 0;
  let loss = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  for (const t of ordered) {
    if (isBreakEven(t) || t.pnl === 0) {
      win = 0;
      loss = 0;
    } else if (t.pnl > 0) {
      win++;
      loss = 0;
    } else {
      loss++;
      win = 0;
    }
    longestWinStreak = Math.max(longestWinStreak, win);
    longestLossStreak = Math.max(longestLossStreak, loss);
  }

  const byMonth = new Map<string, { pnl: number; count: number }>();
  for (const t of trades) {
    if (!Number.isFinite(t.pnl) || !/^\d{4}-\d{2}/.test(t.date)) continue;
    const k = t.date.slice(0, 7);
    const m = byMonth.get(k) ?? { pnl: 0, count: 0 };
    m.pnl += t.pnl;
    m.count++;
    byMonth.set(k, m);
  }
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({ month, pnl: Math.round(m.pnl * 100) / 100, count: m.count }));

  const byWeek = new Map<string, Acc>();
  for (const t of trades) {
    const wd = isoWeekday(t.date);
    if (wd === null || !Number.isFinite(t.pnl)) continue;
    const [y, m, d] = t.date.split("-").map(Number);
    const monday = new Date(Date.UTC(y, m - 1, d - (wd - 1))).toISOString().slice(0, 10);
    const a = byWeek.get(monday) ?? { pnl: 0, count: 0, wins: 0, decided: 0 };
    a.pnl += t.pnl;
    a.count++;
    if (!isBreakEven(t)) {
      a.decided++;
      if (t.pnl > 0) a.wins++;
    }
    byWeek.set(monday, a);
  }
  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, a]) => ({
      week,
      pnl: Math.round(a.pnl * 100) / 100,
      count: a.count,
      winRate: a.decided ? a.wins / a.decided : null,
    }));

  return {
    months,
    weeks,
    setup: bestWorst(maps.setup),
    symbol: bestWorst(maps.symbol),
    day: bestWorst(maps.day),
    hour: bestWorst(maps.hour),
    longestWinStreak,
    longestLossStreak,
  };
}
