/**
 * Du journal au moteur d'exécution : rassemble, pour UN trade, ce que l'app
 * sait déjà (plan de séance du jour, intention figée, réflexion) et le passe à
 * `assessExecution`. Module PUR : les lectures sont faites par l'appelant.
 */

import type { Trade } from "@/domain/trade";
import {
  assessCompliance,
  assessExecution,
  type ComplianceAssessment,
  type ExecutionAssessment,
  type ExecutionInput,
} from "@/modules/discipline";
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

/** L'exécution et la conformité au plan, calculées sur les MÊMES faits. */
export type TradeAssessment = ExecutionAssessment & { compliance: ComplianceAssessment };

export function assessTrade(input: {
  trade: Trade;
  /** Tous les trades du jour : le rang du trade fait le « trade en trop ». */
  dayTrades: readonly Trade[];
  session: SessionContext | null;
  intent?: TradeIntent | null;
  reflection?: TradeReflection | null;
  /** Les règles écrites du setup du trade dans le plan de trading (confluences exigées). */
  setupRules?: string | null;
}): TradeAssessment {
  const { trade, session, intent, reflection } = input;
  const index = dayFacts(input.dayTrades, trade.date).trades.findIndex((t) => t.id === trade.id);
  const facts: ExecutionInput = {
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
  };
  return {
    ...assessExecution(facts),
    compliance: assessCompliance(facts, {
      setupRules: input.setupRules,
      confluences: trade.confluences,
    }),
  };
}
