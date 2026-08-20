import { events } from "@/modules/events";
import { analyzeTrade } from "@/modules/trading/analysis";
import { DisciplineEngine } from "@/modules/discipline";
import {
  buildAfterTradeObservation,
  type AfterTradeIntent,
  type AfterTradeReflection,
} from "@/modules/coaching";
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
   * `extras` porte l'intention/réflexion capturées au moment de l'enregistrement
   * (Step 6B) — l'étape d'observation les lit pour produire son signal.
   */
  async tradeSaved(
    input: Omit<AutomationContext, "extras"> & { extras?: AutomationContext["extras"] },
  ): Promise<AutomationContext> {
    const ctx: AutomationContext = { ...input, extras: input.extras ?? {} };
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

let wired = false;
export function initAutomationListeners(): void {
  if (wired) return;
  wired = true;

  registerStep({
    name: "validate",
    order: 10,
    run(ctx) {
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

  // ── Observation d'après-trade (Step 6B) ────────────────────────────────────
  // Compare l'intention à l'exécution. L'observation produite est émise comme
  // événement ; le moteur de notifications décide du canal (qualité > quantité).
  registerStep({
    name: "afterTradeInsight",
    order: 40,
    run(ctx) {
      const extras = ctx.extras ?? {};
      const observation = buildAfterTradeObservation({
        trade: ctx.trade,
        intent: (extras.intent as AfterTradeIntent | null) ?? null,
        reflection: (extras.reflection as AfterTradeReflection | null) ?? null,
        previousTrades: ctx.previousTrades,
      });
      if (observation && (observation.priority === "high" || observation.priority === "medium")) {
        events.emit("AfterTradeInsight", { userId: ctx.userId, observation });
      }
    },
  });
}
