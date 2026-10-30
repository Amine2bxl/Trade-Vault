import { seedFrom } from "@/modules/probability/rng";
import { stopAfterLossesSessions, type ScenarioTrade, type SessionRuleResult } from "./behaviorLab";

/**
 * EXPÉRIENCE DE PROGRESSION — « je teste une pause après N pertes pendant X
 * séances » (lot 4). Module pur.
 *
 * Le protocole est FIGÉ avant la première séance observée : la règle, N, le
 * nombre de séances visé, le premier jour, la version. Ce qui est mesuré :
 *
 *   • le RESPECT, vérifiable séance par séance (`behaviorLab`) : respectée,
 *     enfreinte, non éprouvée (N pertes jamais atteintes) ou inconnue (ordre
 *     non prouvé) — une séance inconnue n'est jamais comptée comme respectée ;
 *   • le P&L par séance, DESCRIPTIF, face à une base prudente : les séances
 *     d'avant le début, sur le même nombre de séances au plus.
 *
 * Il ne conclut pas d'effet : respecter une règle ne prouve pas qu'elle a
 * produit le résultat, et quelques séances n'ont pas la puissance de
 * départager un écart du hasard. Le résultat le dit (`causalClaim: false`).
 */

export const EXPERIMENT_VERSION = 1;

export interface ExperimentProtocol {
  rule: "stop_after_losses";
  maxLosses: number;
  /** Séances observées visées (5–60). */
  targetSessions: number;
  /** Premier jour d'observation, `AAAA-MM-JJ` — jamais dans le passé. */
  startDay: string;
  version: number;
  seed: number;
}

export interface ExperimentResult {
  status: "running" | "complete";
  /** Séances depuis le début (toutes, y compris inconnues). */
  sessionsObserved: number;
  complied: number;
  violated: number;
  notTriggered: number;
  unknown: number;
  /** Respect parmi les séances où la règle a été éprouvée ET vérifiable. */
  complianceRate: number | null;
  /** P&L moyen par séance pendant l'expérience (séances vérifiables). */
  avgSessionPnl: number | null;
  /** Même mesure sur la base d'avant le début. */
  baselineAvgSessionPnl: number | null;
  baselineSessions: number;
  causalClaim: false;
  /** Avertissement de puissance : trop peu de séances pour départager. */
  lowPower: boolean;
}

/** Sous ce nombre de séances de chaque côté, aucune comparaison n'a de puissance. */
export const MIN_EXPERIMENT_SESSIONS = 20;

export function draftExperiment(
  input: { maxLosses: number; targetSessions: number },
  today: string,
): ExperimentProtocol {
  const maxLosses = Math.min(5, Math.max(1, Math.floor(input.maxLosses)));
  const targetSessions = Math.min(60, Math.max(5, Math.floor(input.targetSessions)));
  return {
    rule: "stop_after_losses",
    maxLosses,
    targetSessions,
    startDay: today,
    version: EXPERIMENT_VERSION,
    seed: seedFrom(`experiment:stop_after_losses:${maxLosses}:${targetSessions}:${today}`),
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

export function evaluateExperiment(
  protocol: ExperimentProtocol,
  trades: readonly ScenarioTrade[],
): ExperimentResult {
  const sessions = stopAfterLossesSessions(trades, protocol.maxLosses);
  const during = sessions
    .filter((s) => s.day >= protocol.startDay)
    .slice(0, protocol.targetSessions);
  const before = sessions.filter((s) => s.day < protocol.startDay).slice(-protocol.targetSessions);
  const count = (list: SessionRuleResult[], st: SessionRuleResult["status"]) =>
    list.filter((s) => s.status === st).length;
  const complied = count(during, "complied");
  const violated = count(during, "violated");
  const verifiable = (list: SessionRuleResult[]) => list.filter((s) => s.status !== "unknown");
  const duringPnl = verifiable(during).map((s) => s.pnl);
  const beforePnl = verifiable(before).map((s) => s.pnl);
  return {
    status: during.length >= protocol.targetSessions ? "complete" : "running",
    sessionsObserved: during.length,
    complied,
    violated,
    notTriggered: count(during, "not_triggered"),
    unknown: count(during, "unknown"),
    complianceRate: complied + violated > 0 ? complied / (complied + violated) : null,
    avgSessionPnl: round2(mean(duringPnl)),
    baselineAvgSessionPnl: round2(mean(beforePnl)),
    baselineSessions: beforePnl.length,
    causalClaim: false,
    lowPower:
      duringPnl.length < MIN_EXPERIMENT_SESSIONS || beforePnl.length < MIN_EXPERIMENT_SESSIONS,
  };
}
