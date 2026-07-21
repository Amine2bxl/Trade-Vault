import type { Trade } from "@/app/types";
import {
  MIN_SAMPLE,
  MIN_BUCKET,
  REVENGE_WINDOW_MIN,
  type AdherenceAnalysis,
  type BehaviorReport,
  type DayBucket,
  type MistakeCostAnalysis,
  type OvertradingAnalysis,
  type PostLossAnalysis,
  type TimingAnalysis,
} from "./types";

/**
 * Behavior Engine — pure, deterministic behavioral analyses.
 *
 * The engines calculate, the AI interprets: nothing here does IO, reads
 * state or calls a model. Example/demo trades are excluded everywhere.
 * All money values keep the account's currency unit (whatever PnL is in).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const isWin = (t: Trade) => t.direction !== "be" && t.pnl > 0;
const isLoss = (t: Trade) => t.direction !== "be" && t.pnl < 0;

/** Chronological sort: by date, then entry time when present. */
function chronological(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) =>
    a.date === b.date
      ? (a.entryTime || "").localeCompare(b.entryTime || "")
      : a.date.localeCompare(b.date),
  );
}

function entryMs(t: Trade): number | null {
  if (!t.entryTime) return null;
  const ms = Date.parse(t.entryTime);
  return Number.isFinite(ms) ? ms : null;
}

function analyzePostLoss(sorted: Trade[]): PostLossAnalysis {
  const decided = sorted.filter((t) => t.direction !== "be");
  const baselineWins = decided.filter(isWin).length;
  const baselineWinRate = decided.length ? baselineWins / decided.length : 0;
  const baselineAvgPnl = decided.length
    ? decided.reduce((s, t) => s + t.pnl, 0) / decided.length
    : 0;

  const postLoss: Trade[] = [];
  let revengeCount = 0;
  let revengeTotalPnl = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (!isLoss(prev) || prev.date !== cur.date) continue;
    postLoss.push(cur);
    const a = entryMs(prev);
    const b = entryMs(cur);
    if (a !== null && b !== null && b - a > 0 && b - a <= REVENGE_WINDOW_MIN * 60_000) {
      revengeCount++;
      revengeTotalPnl += cur.pnl;
    }
  }
  const postDecided = postLoss.filter((t) => t.direction !== "be");
  const postWins = postDecided.filter(isWin).length;

  return {
    significant: sorted.length >= MIN_SAMPLE && postDecided.length >= MIN_BUCKET,
    sampleSize: postDecided.length,
    baselineWinRate: round2(baselineWinRate),
    postLossWinRate: round2(postDecided.length ? postWins / postDecided.length : 0),
    baselineAvgPnl: round2(baselineAvgPnl),
    postLossAvgPnl: round2(
      postDecided.length ? postDecided.reduce((s, t) => s + t.pnl, 0) / postDecided.length : 0,
    ),
    revengeCount,
    revengeTotalPnl: round2(revengeTotalPnl),
  };
}

function analyzeOvertrading(sorted: Trade[]): OvertradingAnalysis {
  const byDay = new Map<string, Trade[]>();
  for (const t of sorted) {
    const list = byDay.get(t.date) ?? [];
    list.push(t);
    byDay.set(t.date, list);
  }
  const days = byDay.size;
  const avg = days ? sorted.length / days : 0;
  // "One more than your average day" is where overtrading starts.
  const threshold = Math.max(1, Math.round(avg));

  let excessCount = 0;
  let excessTotalPnl = 0;
  for (const list of byDay.values()) {
    for (let i = threshold; i < list.length; i++) {
      excessCount++;
      excessTotalPnl += list[i].pnl;
    }
  }
  return {
    significant: sorted.length >= MIN_SAMPLE && excessCount >= MIN_BUCKET,
    sampleSize: sorted.length,
    avgTradesPerDay: round2(avg),
    threshold,
    excessCount,
    excessTotalPnl: round2(excessTotalPnl),
    excessAvgPnl: round2(excessCount ? excessTotalPnl / excessCount : 0),
  };
}

function analyzeTiming(sorted: Trade[]): TimingAnalysis {
  const buckets = new Map<number, { count: number; totalPnl: number; wins: number; dec: number }>();
  for (const t of sorted) {
    const dow = new Date(t.date + "T12:00:00").getDay();
    const b = buckets.get(dow) ?? { count: 0, totalPnl: 0, wins: 0, dec: 0 };
    b.count++;
    b.totalPnl += t.pnl;
    if (t.direction !== "be") {
      b.dec++;
      if (isWin(t)) b.wins++;
    }
    buckets.set(dow, b);
  }
  const qualified: DayBucket[] = [...buckets.entries()]
    .filter(([, b]) => b.count >= MIN_BUCKET)
    .map(([dow, b]) => ({
      dow,
      count: b.count,
      totalPnl: round2(b.totalPnl),
      winRate: round2(b.dec ? b.wins / b.dec : 0),
    }));
  qualified.sort((a, b) => b.totalPnl - a.totalPnl);

  return {
    significant: sorted.length >= MIN_SAMPLE && qualified.length >= 2,
    sampleSize: sorted.length,
    bestDay: qualified[0] ?? null,
    worstDay: qualified.length > 1 ? qualified[qualified.length - 1] : null,
  };
}

/** yyyy-mm of a trade date. */
const monthKey = (date: string) => date.slice(0, 7);

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function analyzeMistakeCosts(sorted: Trade[], nowMonth: string): MistakeCostAnalysis {
  const prevMonth = shiftMonth(nowMonth, -1);
  const agg = new Map<
    string,
    { count: number; totalPnl: number; monthPnl: number; monthCount: number; prevMonthPnl: number }
  >();
  let monthTotal = 0;
  let prevMonthTotal = 0;
  let monthTrades = 0;
  let monthTagged = 0;

  for (const t of sorted) {
    const mk = monthKey(t.date);
    if (mk === nowMonth) {
      monthTrades++;
      if (t.mistakes.length) monthTagged++;
    }
    if (!t.mistakes.length) continue;
    if (mk === nowMonth) monthTotal += t.pnl;
    if (mk === prevMonth) prevMonthTotal += t.pnl;
    for (const name of t.mistakes) {
      const row = agg.get(name) ?? {
        count: 0,
        totalPnl: 0,
        monthPnl: 0,
        monthCount: 0,
        prevMonthPnl: 0,
      };
      row.count++;
      row.totalPnl += t.pnl;
      if (mk === nowMonth) {
        row.monthPnl += t.pnl;
        row.monthCount++;
      }
      if (mk === prevMonth) row.prevMonthPnl += t.pnl;
      agg.set(name, row);
    }
  }

  const rows = [...agg.entries()]
    .map(([name, r]) => ({
      name,
      count: r.count,
      totalPnl: round2(r.totalPnl),
      monthPnl: round2(r.monthPnl),
      monthCount: r.monthCount,
      prevMonthPnl: round2(r.prevMonthPnl),
    }))
    // Most expensive (most negative P&L) first — the verdict order.
    .sort((a, b) => a.totalPnl - b.totalPnl);

  return {
    rows,
    monthTotal: round2(monthTotal),
    prevMonthTotal: round2(prevMonthTotal),
    monthTradeShareTagged: round2(monthTrades ? monthTagged / monthTrades : 0),
  };
}

function analyzeAdherence(sorted: Trade[]): AdherenceAnalysis {
  const tagged = sorted.filter((t) => t.mistakes.length > 0).length;
  return {
    significant: sorted.length >= MIN_SAMPLE,
    sampleSize: sorted.length,
    taggedRate: round2(sorted.length ? tagged / sorted.length : 0),
  };
}

export function analyzeBehavior(trades: Trade[], now: Date = new Date()): BehaviorReport {
  const real = trades.filter((t) => !t.isExample);
  const sorted = chronological(real);
  const nowMonth = now.toISOString().slice(0, 7);
  return {
    sampleSize: sorted.length,
    postLoss: analyzePostLoss(sorted),
    overtrading: analyzeOvertrading(sorted),
    timing: analyzeTiming(sorted),
    mistakeCosts: analyzeMistakeCosts(sorted, nowMonth),
    adherence: analyzeAdherence(sorted),
  };
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Compact grounded lines for the AI context — SIGNIFICANT findings only.
 * English on purpose (the persona answers in the UI language); the model
 * cites these numbers, it never recomputes them.
 */
export function toBehaviorLines(report: BehaviorReport, maxLines = 12): string[] {
  const lines: string[] = [];
  const { postLoss, overtrading, timing, mistakeCosts, adherence } = report;

  if (postLoss.significant) {
    lines.push(
      `After a losing trade (same day, ${postLoss.sampleSize} cases): win rate ` +
        `${Math.round(postLoss.postLossWinRate * 100)}% vs baseline ` +
        `${Math.round(postLoss.baselineWinRate * 100)}%, avg P&L ${postLoss.postLossAvgPnl} ` +
        `vs baseline ${postLoss.baselineAvgPnl}.`,
    );
    if (postLoss.revengeCount > 0) {
      lines.push(
        `Revenge-trading signal: ${postLoss.revengeCount} trades entered under ` +
          `${REVENGE_WINDOW_MIN} min after a loss, net P&L ${postLoss.revengeTotalPnl}.`,
      );
    }
  }
  if (overtrading.significant) {
    lines.push(
      `Overtrading: beyond ${overtrading.threshold} trades/day (their average is ` +
        `${overtrading.avgTradesPerDay}), the ${overtrading.excessCount} extra trades ` +
        `netted ${overtrading.excessTotalPnl} (avg ${overtrading.excessAvgPnl} each).`,
    );
  }
  if (timing.significant && timing.bestDay && timing.worstDay) {
    lines.push(
      `Best day: ${DOW[timing.bestDay.dow]} (net ${timing.bestDay.totalPnl} over ` +
        `${timing.bestDay.count} trades). Worst day: ${DOW[timing.worstDay.dow]} ` +
        `(net ${timing.worstDay.totalPnl} over ${timing.worstDay.count} trades).`,
    );
  }
  const worst = mistakeCosts.rows[0];
  if (worst && worst.totalPnl < 0) {
    lines.push(
      `Most expensive recurring mistake: "${worst.name}" — ${worst.count}× overall ` +
        `(net ${worst.totalPnl}), this month ${worst.monthCount}× (net ${worst.monthPnl}), ` +
        `previous month net ${worst.prevMonthPnl}.`,
    );
    lines.push(
      `Mistake-tagged trades this month: net ${mistakeCosts.monthTotal} ` +
        `(previous month: ${mistakeCosts.prevMonthTotal}).`,
    );
  }
  if (adherence.significant && adherence.taggedRate > 0) {
    lines.push(
      `${Math.round(adherence.taggedRate * 100)}% of their trades carry at least one ` +
        `tagged mistake (${adherence.sampleSize} trades).`,
    );
  }
  return lines.slice(0, maxLines);
}
