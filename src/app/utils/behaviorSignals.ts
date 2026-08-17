import { Trade, isBreakEven } from "../types";
import { computeStats } from "./tradeCalcs";
import { getSession, statsBySession, winRateOf, type BucketStat } from "./quantStats";

/**
 * Behaviour signals — the deterministic "why" behind the numbers.
 *
 * `computeStats` answers *what* happened (P&L, win rate, profit factor).
 * A coach has to answer *why*: which weekday leaks money, whether size drifts
 * up after a loss, what an over-traded day costs, whether low-conviction
 * entries are worth taking. Those are exactly the claims a mentor makes — and
 * exactly the ones a language model gets wrong when asked to derive them from
 * a raw trade array.
 *
 * So we compute them here, once, deterministically, and hand the AI the result
 * to interpret. Same contract as the rest of the platform: the engines produce
 * the numbers, the AI reads them and never recalculates them.
 *
 * Pure and synchronous — no IO, no AI, unit-testable.
 */

const round = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => Math.round(n * 1000) / 10;

/** A named slice of the journal, in the compact shape the prompt serializes. */
export interface SignalBucket {
  key: string;
  trades: number;
  winRatePct: number | null;
  pnl: number;
  avgPnl: number;
  /** Les ids des trades de ce groupe — pour le deep-link « voir les N trades ». */
  tradeIds: string[];
}

export interface BehaviorSignals {
  /** Performance per weekday — the "why do I lose on Fridays" question. */
  byWeekday?: SignalBucket[];
  /** Performance per session (Asia / London / New York), when times are logged. */
  bySession?: SignalBucket[];
  /** The instruments that move the account the most, both ways. */
  bySymbol?: SignalBucket[];
  /** Setups ranked by what they actually return. */
  byStrategy?: SignalBucket[];
  /**
   * Position-size drift after a loss — the single most expensive behavioural
   * leak in retail trading, and invisible in aggregate stats.
   */
  riskAfterLoss?: {
    avgRiskNormal: number;
    avgRiskAfterLoss: number;
    driftPct: number;
    tradesAfterLoss: number;
    pnlAfterLoss: number;
    /** Les trades pris immédiatement après une perte — pour le deep-link. */
    afterLossTradeIds: string[];
  };
  /** What a busy day costs versus a selective one. */
  overtrading?: {
    medianTradesPerDay: number;
    busyDayThreshold: number;
    pnlOnBusyDays: number;
    pnlOnCalmDays: number;
    avgPnlPerTradeBusy: number;
    avgPnlPerTradeCalm: number;
  };
  /** Does the trader's own A+ grading actually predict the outcome? */
  setupQuality?: { high: SignalBucket; low: SignalBucket };
  /** Does self-reported conviction predict the outcome? */
  conviction?: { high: SignalBucket; low: SignalBucket };
  /** Share of trades where the trader logged at least one mistake. */
  disciplinePct?: number;
  /** Last 20 trades vs the 20 before — is the trader improving right now? */
  recentForm?: { last: SignalBucket; previous: SignalBucket };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function bucketOf(key: string, trades: Trade[]): SignalBucket {
  const decisive = trades.filter((t) => !isBreakEven(t));
  const wins = decisive.filter((t) => t.pnl > 0).length;
  const pnl = trades.reduce((s, t) => s + t.pnl, 0);
  return {
    key,
    trades: trades.length,
    winRatePct: decisive.length ? pct(wins / decisive.length) : null,
    pnl: round(pnl),
    avgPnl: trades.length ? round(pnl / trades.length) : 0,
    tradeIds: trades.map((t) => t.id),
  };
}

function fromBucketStat(key: string, b: BucketStat): SignalBucket {
  const wr = winRateOf(b);
  return {
    key,
    trades: b.count,
    winRatePct: wr === null ? null : pct(wr),
    pnl: round(b.pnl),
    avgPnl: b.count ? round(b.pnl / b.count) : 0,
    tradeIds: [],
  };
}

function groupBy(trades: Trade[], keyOf: (t: Trade) => string | null): SignalBucket[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyOf(t);
    if (k === null) continue;
    const list = map.get(k);
    if (list) list.push(t);
    else map.set(k, [t]);
  }
  return [...map.entries()].map(([k, list]) => bucketOf(k, list));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Build the signal set. Every section is emitted only when it rests on enough
 * trades to mean something — a coach that reads a trend from 3 trades is worse
 * than a coach that says nothing, so thin slices are dropped rather than sent.
 */
export function computeBehaviorSignals(trades: Trade[]): BehaviorSignals {
  if (trades.length < 5) return {};
  const signals: BehaviorSignals = {};
  const chronological = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  // ── Weekday ───────────────────────────────────────────────────────────────
  const weekday = groupBy(trades, (t) => {
    const d = new Date(t.date + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : WEEKDAYS[d.getDay()];
  }).filter((b) => b.trades >= 3);
  if (weekday.length >= 2) signals.byWeekday = weekday.sort((a, b) => a.pnl - b.pnl);

  // ── Session ───────────────────────────────────────────────────────────────
  if (trades.some((t) => getSession(t.entryTime))) {
    const bySession = Object.entries(statsBySession(trades))
      .filter(([, b]) => b.count >= 3)
      .map(([k, b]) => fromBucketStat(k, b));
    if (bySession.length >= 2) signals.bySession = bySession.sort((a, b) => a.pnl - b.pnl);
  }

  // ── Symbol / strategy — only the extremes are worth prompt space ──────────
  const symbols = groupBy(trades, (t) => t.symbol || null).filter((b) => b.trades >= 3);
  if (symbols.length >= 2) {
    const sorted = symbols.sort((a, b) => a.pnl - b.pnl);
    signals.bySymbol = sorted.length > 6 ? [...sorted.slice(0, 3), ...sorted.slice(-3)] : sorted;
  }

  const strategies = Object.entries(computeStats(trades).pnlByStrategy)
    .filter(([, v]) => v.count >= 3)
    .map(([k, v]) =>
      fromBucketStat(k, { pnl: v.pnl, count: v.count, wins: v.wins, breakEven: v.breakEven }),
    );
  if (strategies.length >= 2) signals.byStrategy = strategies.sort((a, b) => a.pnl - b.pnl);

  // ── Revenge sizing: risk on the trade that follows a loss ─────────────────
  const afterLoss: Trade[] = [];
  const rest: Trade[] = [];
  for (let i = 0; i < chronological.length; i++) {
    const prev = chronological[i - 1];
    const isAfterLoss = !!prev && !isBreakEven(prev) && prev.pnl < 0;
    (isAfterLoss ? afterLoss : rest).push(chronological[i]);
  }
  if (afterLoss.length >= 5 && rest.length >= 5) {
    const avg = (list: Trade[]) => list.reduce((s, t) => s + t.riskAmount, 0) / list.length;
    const normal = avg(rest);
    const revenge = avg(afterLoss);
    if (normal > 0) {
      signals.riskAfterLoss = {
        avgRiskNormal: round(normal),
        avgRiskAfterLoss: round(revenge),
        driftPct: pct(revenge / normal - 1),
        tradesAfterLoss: afterLoss.length,
        pnlAfterLoss: round(afterLoss.reduce((s, t) => s + t.pnl, 0)),
        afterLossTradeIds: afterLoss.map((t) => t.id),
      };
    }
  }

  // ── Overtrading: what a busy day actually returns ─────────────────────────
  const byDay = new Map<string, Trade[]>();
  for (const t of chronological) {
    const list = byDay.get(t.date);
    if (list) list.push(t);
    else byDay.set(t.date, [t]);
  }
  if (byDay.size >= 6) {
    const perDay = [...byDay.values()].map((l) => l.length);
    const med = median(perDay);
    const threshold = Math.max(2, Math.ceil(med) + 1);
    const busy: Trade[] = [];
    const calm: Trade[] = [];
    for (const list of byDay.values()) (list.length >= threshold ? busy : calm).push(...list);
    if (busy.length >= 5 && calm.length >= 5) {
      const sum = (l: Trade[]) => l.reduce((s, t) => s + t.pnl, 0);
      signals.overtrading = {
        medianTradesPerDay: med,
        busyDayThreshold: threshold,
        pnlOnBusyDays: round(sum(busy)),
        pnlOnCalmDays: round(sum(calm)),
        avgPnlPerTradeBusy: round(sum(busy) / busy.length),
        avgPnlPerTradeCalm: round(sum(calm) / calm.length),
      };
    }
  }

  // ── Does the trader's own grading predict anything? ───────────────────────
  const qHigh = trades.filter((t) => t.setupQuality >= 4);
  const qLow = trades.filter((t) => t.setupQuality > 0 && t.setupQuality <= 2);
  if (qHigh.length >= 4 && qLow.length >= 4) {
    signals.setupQuality = {
      high: bucketOf("quality>=4", qHigh),
      low: bucketOf("quality<=2", qLow),
    };
  }

  const cHigh = trades.filter((t) => t.confidence >= 75);
  const cLow = trades.filter((t) => t.confidence > 0 && t.confidence <= 40);
  if (cHigh.length >= 4 && cLow.length >= 4) {
    signals.conviction = {
      high: bucketOf("confidence>=75", cHigh),
      low: bucketOf("confidence<=40", cLow),
    };
  }

  // ── Discipline & current form ─────────────────────────────────────────────
  const withMistake = trades.filter((t) => t.mistakes.length > 0).length;
  signals.disciplinePct = pct(1 - withMistake / trades.length);

  if (chronological.length >= 20) {
    const last = chronological.slice(-20);
    const previous = chronological.slice(-40, -20);
    if (previous.length >= 10) {
      signals.recentForm = {
        last: bucketOf("last 20 trades", last),
        previous: bucketOf("previous 20 trades", previous),
      };
    }
  }

  return signals;
}

/** True when there is enough signal for the coach to be specific at all. */
function hasBehaviorSignals(s: BehaviorSignals): boolean {
  return Object.keys(s).length > 1;
}
