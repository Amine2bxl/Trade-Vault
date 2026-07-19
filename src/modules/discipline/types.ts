import type { TradingRule, Violation } from "@/app/utils/tradingRules";

/**
 * Discipline domain types. The rule shape (TradingRule) is owned by the
 * profile editor and stored in profiles.trading_rules — we reuse it as-is
 * to avoid a competing definition.
 */

export type DisciplineEventKind =
  | "DISCIPLINE_WARNING"
  | "DISCIPLINE_LIMIT_REACHED"
  | "DISCIPLINE_SUCCESS";

export interface DisciplineViolation {
  /** The user-authored rule that was broken. */
  rule: TradingRule;
  /** Kind-but-firm coaching message (locale-aware, built by the rule engine). */
  message: string;
  /** Hard limits (risk cap, stop-after-losses) escalate to LIMIT_REACHED. */
  level: "warning" | "limit";
}

export interface DisciplineSummary {
  date: string;
  tradesToday: number;
  lossesToday: number;
  pnlToday: number;
  /** True when the whole day closed without a single violation. */
  clean: boolean;
}

export interface DisciplineContext {
  userId: string;
  /** Trades already logged the same day (excluding the one being checked). */
  sameDayTrades: import("@/app/types").Trade[];
  accountBalance: number;
  rules: TradingRule[];
}

export type { TradingRule, Violation };
