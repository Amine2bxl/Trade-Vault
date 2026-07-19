import { events } from "@/modules/events";
import { analyzeTrade } from "@/modules/trading/analysis";
import { DisciplineEngine } from "@/modules/discipline";
import type { AutomationContext, AutomationStep } from "./types";

/**
 * Automation Engine — the "trade saved" assembly line.
 *
 *   Trade saved → validate → analyze → discipline → events → (future: tags,
 *   goals refresh, AI analysis, backups…)
 *
 * Every future automation plugs in with registerStep() — no page ever
 * chains side effects manually again. Steps are error-isolated and run
 * in `order`; a validation step can halt the line by returning false.
 */

const steps: AutomationStep[] = [];

export function registerStep(step: AutomationStep): () => void {
  steps.push(step);
  steps.sort((a, b) => a.order - b.order);
  return () => {
    const i = steps.indexOf(step);
    if (i >= 0) steps.splice(i, 1);
  };
}

async function runPipeline(ctx: AutomationContext): Promise<AutomationContext> {
  for (const step of [...steps]) {
    try {
      const out = await step.run(ctx);
      if (out === false) {
        console.info(`[automation] pipeline halted by step "${step.name}"`);
        break;
      }
    } catch (e) {
      console.error(`[automation] step "${step.name}" failed — continuing`, e);
    }
  }
  return ctx;
}

export const AutomationEngine = {
  registerStep,

  /**
   * Entry point called after a trade is persisted. Fire-and-forget from
   * the UI's perspective: the optimistic UI never waits on automations.
   */
  async tradeSaved(input: Omit<AutomationContext, "extras">): Promise<AutomationContext> {
    const ctx: AutomationContext = { ...input, extras: {} };
    events.emit(ctx.isNew ? "TradeCreated" : "TradeUpdated", {
      userId: ctx.userId,
      trade: ctx.trade,
      allTrades: [ctx.trade, ...ctx.previousTrades.filter((t) => t.id !== ctx.trade.id)],
    });
    return runPipeline(ctx);
  },

  tradeDeleted(userId: string, tradeId: string): void {
    events.emit("TradeDeleted", { userId, tradeId });
  },
};

// ── Default pipeline ─────────────────────────────────────────────────────────

registerStep({
  name: "validate",
  order: 10,
  run(ctx) {
    // Minimal integrity gate — malformed trades never reach the engines.
    if (!ctx.trade.id || !ctx.trade.date || !ctx.userId) return false;
  },
});

registerStep({
  name: "analyze",
  order: 20,
  run(ctx) {
    const sameDay = ctx.previousTrades.filter(
      (t) => t.date === ctx.trade.date && t.id !== ctx.trade.id,
    );
    ctx.analysis = analyzeTrade(ctx.trade, {
      sameDayTrades: sameDay,
      accountBalance: ctx.accountBalance,
    });
    events.emit("TradeAnalyzed", {
      userId: ctx.userId,
      trade: ctx.trade,
      analysis: ctx.analysis,
    });
  },
});

registerStep({
  name: "discipline",
  order: 30,
  run(ctx) {
    // Edits don't re-trigger coaching — only fresh decisions do.
    if (!ctx.isNew) return;
    const sameDay = ctx.previousTrades.filter(
      (t) => t.date === ctx.trade.date && t.id !== ctx.trade.id,
    );
    ctx.violations = DisciplineEngine.checkTrade(ctx.trade, {
      userId: ctx.userId,
      sameDayTrades: sameDay,
      accountBalance: ctx.accountBalance,
      rules: ctx.rules,
    });
  },
});
