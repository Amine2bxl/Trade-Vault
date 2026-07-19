import type { Trade } from "@/app/types";
import { checkTradeAgainstRules } from "@/app/utils/tradingRules";
// (Trade import used in public method signatures below.)
import { events } from "@/modules/events";
import type { DisciplineContext, DisciplineSummary, DisciplineViolation } from "./types";

/**
 * Discipline Engine — the only place discipline decisions are made.
 *
 * Pages and components NEVER evaluate rules themselves: they hand the
 * trade to this engine (usually via the Automation Engine) and react to
 * DISCIPLINE_* events. Rule evaluation itself is delegated to the pure
 * checker in utils/tradingRules (single source of truth for messages).
 */

/** Rule kinds whose breach means "stop now", not just "be careful". */
const HARD_LIMIT_KINDS = new Set(["stop_after_losses", "max_risk_pct"]);

export const DisciplineEngine = {
  /**
   * Evaluate one trade against the user's own rules, emit the matching
   * DISCIPLINE_* events, and return the violations for the caller
   * (Automation Engine) to route into notifications.
   */
  checkTrade(trade: Trade, ctx: DisciplineContext): DisciplineViolation[] {
    const raw = checkTradeAgainstRules(trade, ctx.rules, {
      sameDayTrades: ctx.sameDayTrades,
      accountBalance: ctx.accountBalance,
    });

    const violations: DisciplineViolation[] = raw.map((v) => ({
      rule: v.rule,
      message: v.message,
      level: HARD_LIMIT_KINDS.has(v.rule.kind) ? "limit" : "warning",
    }));

    for (const violation of violations) {
      events.emit(violation.level === "limit" ? "DISCIPLINE_LIMIT_REACHED" : "DISCIPLINE_WARNING", {
        userId: ctx.userId,
        violation,
        trade,
      });
    }
    return violations;
  },

  /**
   * End-of-day style summary: emits DISCIPLINE_SUCCESS when the day is
   * clean, so streaks and positive reinforcement have a real signal to
   * build on (success must be an event too, not just silence).
   */
  summarizeDay(
    userId: string,
    date: string,
    dayTrades: { pnl: number; direction: string }[],
    hadViolations: boolean,
  ): DisciplineSummary {
    const summary: DisciplineSummary = {
      date,
      tradesToday: dayTrades.length,
      lossesToday: dayTrades.filter((t) => t.direction !== "be" && t.pnl < 0).length,
      pnlToday: dayTrades.reduce((s, t) => s + t.pnl, 0),
      clean: !hadViolations && dayTrades.length > 0,
    };
    if (summary.clean) events.emit("DISCIPLINE_SUCCESS", { userId, summary });
    return summary;
  },
};
