/**
 * Structured output of the Trade Analysis Engine.
 *
 * Purely analytical — no AI, no IO. The AI Core consumes this object to
 * ground its coaching in measured evidence. Null means unavailable, not 0/100.
 * Measurable scores remain on a 0–100 scale.
 */

export type AnalysisGrade = "A" | "B" | "C" | "D" | "F";

export interface AnalysisFlag {
  /** Machine-readable identifier, stable across releases. */
  code:
    | "oversized_risk"
    | "no_stop_defined"
    | "negative_expectancy_rr"
    | "low_setup_quality"
    | "missing_confluences"
    | "poor_exit_efficiency"
    | "high_slippage"
    | "tagged_mistakes"
    | "revenge_window"
    | "overtrading_day"
    | "clean_execution"
    | "insufficient_evidence";
  severity: "info" | "warning" | "critical";
  /** Human-readable, locale-neutral detail (numbers already formatted). */
  detail: string;
}

export interface TradeAnalysis {
  tradeId: string;
  /** % of account risked (null when balance unknown or risk not set). */
  riskPct: number | null;
  /** Realized R multiple, null when initial risk is unknown. */
  rMultiple: number | null;
  /** Result vs verified initial risk; not the planned reward:risk. */
  rrScore: number | null;
  /** Subjective setup assessment, null when not reviewed. */
  setupScore: number | null;
  /** Verifiable discipline only; missing user error-tags are not proof. */
  disciplineScore: number | null;
  /** Execution score based on observed MFE (not an arbitrary neutral 70). */
  executionScore: number | null;
  /** Composite only if ALL components are actually measurable. */
  score: number | null;
  grade: AnalysisGrade | null;
  /** Percentage of total composite weight supported by input evidence. */
  coveragePct: number;
  flags: AnalysisFlag[];
  /** Exit efficiency: realized PnL vs best unrealized (MFE), 0–1, null if no MFE. */
  exitEfficiency: number | null;
  computedAt: string;
}

export interface AnalysisContext {
  /** Trades of the same day (not guaranteed to precede the analyzed entry). */
  sameDayTrades: { pnl: number; direction: string; entryTime?: string; exitTime?: string }[];
  /** Account balance, NOT assumed to be the balance at trade entry. */
  accountBalance: number;
  /** True only when the supplied balance is proven to be from before entry. */
  balanceIsAtEntry?: boolean;
  /** Adherence rate only when calculated from fully verified rule observations. */
  verifiedRuleAdherencePct?: number | null;
}
