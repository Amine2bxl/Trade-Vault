/**
 * Behavior engine types — deterministic behavioral analyses of the trader's
 * own history. Every analysis carries its sample size and a `significant`
 * flag: downstream consumers (UI, AI context) MUST ignore non-significant
 * results — a pattern on 4 trades is noise, not coaching material.
 */

/** Minimum trades for any global behavioral conclusion. */
export const MIN_SAMPLE = 10;
/** Minimum trades inside a bucket (day-of-week, post-loss…) to compare it. */
export const MIN_BUCKET = 5;
/** A follow-up trade within this delay after a loss is a revenge candidate. */
export const REVENGE_WINDOW_MIN = 30;

export interface PostLossAnalysis {
  significant: boolean;
  sampleSize: number;
  /** Win rate over all decided trades (baseline). */
  baselineWinRate: number;
  /** Win rate of trades taken right after a losing trade (same day). */
  postLossWinRate: number;
  baselineAvgPnl: number;
  postLossAvgPnl: number;
  /** Trades entered < REVENGE_WINDOW_MIN after a loss (needs entry times). */
  revengeCount: number;
  revengeTotalPnl: number;
}

export interface OvertradingAnalysis {
  significant: boolean;
  sampleSize: number;
  avgTradesPerDay: number;
  /** Daily trade count beyond which extra trades are measured. */
  threshold: number;
  /** Trades beyond the threshold across all days. */
  excessCount: number;
  excessTotalPnl: number;
  excessAvgPnl: number;
}

export interface DayBucket {
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  count: number;
  totalPnl: number;
  winRate: number;
}

export interface TimingAnalysis {
  significant: boolean;
  sampleSize: number;
  /** Only buckets with >= MIN_BUCKET trades qualify. */
  bestDay: DayBucket | null;
  worstDay: DayBucket | null;
}

export interface MistakeCostRow {
  name: string;
  count: number;
  totalPnl: number;
  /** Cost accumulated in the current calendar month. */
  monthPnl: number;
  monthCount: number;
  /** Cost accumulated in the previous calendar month. */
  prevMonthPnl: number;
}

export interface MistakeCostAnalysis {
  rows: MistakeCostRow[];
  /** Net P&L of mistake-tagged trades this month (negative = cost). */
  monthTotal: number;
  prevMonthTotal: number;
  monthTradeShareTagged: number;
}

export interface AdherenceAnalysis {
  significant: boolean;
  sampleSize: number;
  /** Share of trades carrying at least one tagged mistake (0..1). */
  taggedRate: number;
}

export interface BehaviorReport {
  sampleSize: number;
  postLoss: PostLossAnalysis;
  overtrading: OvertradingAnalysis;
  timing: TimingAnalysis;
  mistakeCosts: MistakeCostAnalysis;
  adherence: AdherenceAnalysis;
}
