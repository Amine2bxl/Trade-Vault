/**
 * Du journal au moteur d'exécution : rassemble, pour UN trade, ce que l'app
 * sait déjà (plan de séance du jour, intention figée, réflexion) et le passe à
 * `assessExecution`. Module PUR : les lectures sont faites par l'appelant.
 */

import type { Trade } from "@/domain/trade";
import { assessExecution, type ExecutionAssessment } from "@/modules/discipline";
import type { TradeIntent, TradeReflection } from "@/app/store/tradeIntel";
import {
  dayFacts,
  parseAmount,
  tradeBreaches,
  type SessionPlan,
  type Scenario,
} from "./sessionPlan";

/** Le plan verrouillé du jour (`sessionFromSnapshot`), ou `null` sans plan écrit. */
export interface SessionContext {
  plan: SessionPlan;
  scenario: Scenario;
}

export function assessTrade(input: {
  trade: Trade;
  /** Tous les trades du jour : le rang du trade fait le « trade en trop ». */
  dayTrades: readonly Trade[];
  session: SessionContext | null;
  intent?: TradeIntent | null;
  reflection?: TradeReflection | null;
}): ExecutionAssessment {
  const { trade, session, intent, reflection } = input;
  const index = dayFacts(input.dayTrades, trade.date).trades.findIndex((t) => t.id === trade.id);
  return assessExecution({
    direction: trade.direction,
    entryPrice: trade.entryPrice ?? null,
    exitPrice: trade.exitPrice ?? null,
    riskAmount: trade.riskAmount > 0 ? trade.riskAmount : null,
    mistakes: trade.mistakes,
    planned: intent?.planned ?? null,
    initialStop: intent?.initialStop ?? null,
    initialTarget: intent?.initialTarget ?? null,
    plannedRisk: session ? parseAmount(session.plan.risk) : null,
    sessionBreaches:
      session && index >= 0 ? tradeBreaches(trade, index, session.plan, session.scenario) : null,
    planRespected: reflection?.planRespected ?? null,
    reflectionReason: reflection?.reason ?? null,
    override: reflection?.executionOverride ?? null,
  });
}
