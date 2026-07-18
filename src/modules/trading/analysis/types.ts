/**
 * Structured output of the Trade Analysis Engine.
 *
 * Purely analytical — no AI, no IO. The AI Core consumes this object to
 * ground its coaching in hard numbers; the UI can render it directly.
 * Every score is 0–100 (higher = better) so they compose and compare.
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
    | "clean_execution";
  severity: "info" | "warning" | "critical";
  /** Human-readable, locale-neutral detail (numbers already formatted). */
  detail: string;
}

export interface TradeAnalysis {
  tradeId: string;
  /** % of account risked (null when balance unknown or risk not set). */
  riskPct: number | null;
  /** Realized R multiple of the trade. */
  rMultiple: number;
  /** Planned reward:risk quality — derived from result vs risk. */
  rrScore: number;
  /** Setup adherence: setup quality, confluences, confidence coherence. */
  setupScore: number;
  /** Discipline: mistakes tagged, overtrading/revenge context. */
  disciplineScore: number;
  /** Execution: MAE/MFE efficiency and slippage when available. */
  executionScore: number;
  /** Weighted composite of the four scores above. */
  score: number;
  grade: AnalysisGrade;
  flags: AnalysisFlag[];
  /** Exit efficiency: realized PnL vs best unrealized (MFE), 0–1, null if no MFE. */
  exitEfficiency: number | null;
  computedAt: string;
}

export interface AnalysisContext {
  /** Trades of the same day, excluding the analyzed one. */
  sameDayTrades: { pnl: number; direction: string; exitTime?: string }[];
  /** Account balance for %-risk computation (0 = unknown). */
  accountBalance: number;
}
