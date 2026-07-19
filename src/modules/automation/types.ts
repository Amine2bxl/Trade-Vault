import type { Trade } from "@/app/types";
import type { TradeAnalysis } from "@/modules/trading/analysis";
import type { DisciplineViolation, TradingRule } from "@/modules/discipline";

/**
 * Automation pipeline contract. A step is a named unit of work executed
 * in order after each trade save. Steps read/enrich the shared context;
 * a failed step logs and is skipped — the pipeline never dies mid-run.
 */

export interface AutomationContext {
  userId: string;
  trade: Trade;
  /** Snapshot of trades BEFORE this save (excludes the new trade). */
  previousTrades: Trade[];
  isNew: boolean;
  accountBalance: number;
  rules: TradingRule[];
  /** Enriched by the "analyze" step. */
  analysis?: TradeAnalysis;
  /** Enriched by the "discipline" step. */
  violations?: DisciplineViolation[];
  /** Free slot for future steps (tags, goals, AI…). */
  extras: Record<string, unknown>;
}

export interface AutomationStep {
  name: string;
  /** Lower runs earlier. Default steps use 10/20/30…, leaving gaps. */
  order: number;
  /** Return false to stop the pipeline (validation gate). */
  run(ctx: AutomationContext): Promise<boolean | void> | boolean | void;
}
