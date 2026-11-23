/**
 * LA QUALITÉ D'EXÉCUTION — jugée sur le plan et les faits, JAMAIS sur le P&L.
 *
 * Un A+ perdant est une bonne exécution ; un trade hors plan gagnant est une
 * mauvaise exécution. Le P&L n'est donc pas une entrée de ce module : le type
 * `ExecutionInput` ne le contient pas, et un test le vérifie.
 *
 * TROIS NIVEAUX DE PREUVE, jamais mélangés :
 *   - `observed`   : prouvé par les données (sens contraire au plan, trade en
 *                    trop, entrée hors zone, stop au-delà de l'invalidation,
 *                    risque au-dessus du plan) ;
 *   - `declared`   : dit par le trader (erreur cochée, « plan non respecté »,
 *                    raison de réflexion) ;
 *   - `to_confirm` : possible d'après les prix (sortie avant cible et stop),
 *                    mais l'intention n'est pas lisible dans un prix — c'est
 *                    une question, pas un verdict.
 *
 * VERDICT : une correction manuelle l'emporte ; sinon un écart observé ou
 * déclaré donne « mauvaise exécution » ; une conformité PROUVÉE (comparée à un
 * plan écrit, ou déclarée) donne « bonne exécution » ; sans rien pour comparer,
 * le verdict est INCONNU — jamais bon par défaut.
 *
 * Module PUR : aucune IO, aucune horloge.
 */

import { stopDistance, type PlannedLevels, type Side } from "@/domain/executionPlan";

export type ExecutionVerdict = "good_execution" | "bad_execution" | "unknown";

export type DeviationKind =
  // observés
  | "direction"
  | "extra"
  | "observation"
  | "entry_outside_zone"
  | "stop_beyond_plan"
  | "over_risk"
  // déclarés
  | "mistake"
  | "plan_not_respected"
  | "reflection_reason"
  // à confirmer
  | "early_exit";

export type Certainty = "observed" | "declared" | "to_confirm";

export interface Deviation {
  kind: DeviationKind;
  certainty: Certainty;
  /** Le détail lisible tel quel : l'erreur cochée, la raison, le prix. */
  detail?: string;
}

export interface ExecutionInput {
  direction: "long" | "short" | "be";
  entryPrice: number | null;
  exitPrice: number | null;
  /** Risque réel en devise du compte. */
  riskAmount: number | null;
  mistakes: readonly string[];
  /** Plan de séance figé dans l'intention du trade. */
  planned: PlannedLevels | null;
  initialStop: number | null;
  initialTarget: number | null;
  /** Risque écrit dans le plan de séance (`null` sans séance). */
  plannedRisk: number | null;
  /**
   * Écarts du trade face au plan de séance (`tradeBreaches`) ; `null` quand
   * aucun plan n'a été écrit ce jour-là — rien n'a été comparé.
   */
  sessionBreaches: readonly ("direction" | "extra" | "observation")[] | null;
  planRespected: "yes" | "partial" | "no" | null;
  reflectionReason: string | null;
  override: "good_execution" | "bad_execution" | null;
}

export interface ExecutionAssessment {
  verdict: ExecutionVerdict;
  source: "calculated" | "manual";
  deviations: Deviation[];
}

/**
 * Entrée « hors zone » : plus loin que le plan, dans le MAUVAIS sens (prix
 * pire que prévu), d'au moins ce quart de la distance plan → invalidation.
 * Une entrée meilleure que prévu n'est jamais un écart. Un quart : assez pour
 * ignorer un remplissage à un tick près, assez peu pour voir une poursuite.
 */
export const CHASE_FRACTION = 0.25;

/** Tolérance sur le risque : 5 % au-dessus du risque écrit = sur-risque. */
export const OVER_RISK_TOLERANCE = 0.05;

/** Raisons de réflexion qui sont des écarts d'exécution (`other` n'en est pas un). */
const DEVIATION_REASONS = new Set([
  "fomo",
  "revenge",
  "early_entry",
  "late_entry",
  "wrong_setup",
  "wrong_timing",
  "wrong_risk",
]);

function observedDeviations(input: ExecutionInput, side: Side | null): Deviation[] {
  const out: Deviation[] = [];
  for (const b of input.sessionBreaches ?? []) out.push({ kind: b, certainty: "observed" });

  const p = input.planned;
  if (side && p && p.direction === side && p.entry != null && input.entryPrice != null) {
    const zone = stopDistance(side, p.entry, p.stop);
    const worse = side === "long" ? input.entryPrice - p.entry : p.entry - input.entryPrice;
    if (zone != null && worse > zone * CHASE_FRACTION) {
      out.push({
        kind: "entry_outside_zone",
        certainty: "observed",
        detail: String(input.entryPrice),
      });
    }
  }
  if (side && p?.stop != null && input.initialStop != null) {
    const beyond = side === "long" ? input.initialStop < p.stop : input.initialStop > p.stop;
    if (beyond)
      out.push({
        kind: "stop_beyond_plan",
        certainty: "observed",
        detail: String(input.initialStop),
      });
  }
  if (
    input.plannedRisk != null &&
    input.plannedRisk > 0 &&
    input.riskAmount != null &&
    input.riskAmount > input.plannedRisk * (1 + OVER_RISK_TOLERANCE)
  ) {
    out.push({ kind: "over_risk", certainty: "observed", detail: String(input.riskAmount) });
  }
  return out;
}

function declaredDeviations(input: ExecutionInput): Deviation[] {
  const out: Deviation[] = input.mistakes.map((m) => ({
    kind: "mistake" as const,
    certainty: "declared" as const,
    detail: m,
  }));
  if (input.planRespected === "no") out.push({ kind: "plan_not_respected", certainty: "declared" });
  if (input.reflectionReason && DEVIATION_REASONS.has(input.reflectionReason)) {
    out.push({ kind: "reflection_reason", certainty: "declared", detail: input.reflectionReason });
  }
  return out;
}

function questions(input: ExecutionInput, side: Side | null): Deviation[] {
  if (!side || input.exitPrice == null || input.entryPrice == null) return [];
  const stop = input.initialStop ?? input.planned?.stop ?? null;
  const target = input.initialTarget ?? input.planned?.target ?? null;
  if (stop == null || target == null) return [];
  const [low, high] = side === "long" ? [stop, target] : [target, stop];
  // Sortie strictement entre le stop et la cible : ni l'un ni l'autre n'a été
  // touché. Une sortie volontaire peut être juste — on la demande.
  if (input.exitPrice > low && input.exitPrice < high) {
    return [{ kind: "early_exit", certainty: "to_confirm", detail: String(input.exitPrice) }];
  }
  return [];
}

export function assessExecution(input: ExecutionInput): ExecutionAssessment {
  const side: Side | null = input.direction === "be" ? null : input.direction;
  const deviations = [
    ...observedDeviations(input, side),
    ...declaredDeviations(input),
    ...questions(input, side),
  ];
  if (input.override) return { verdict: input.override, source: "manual", deviations };

  const proven = deviations.some((d) => d.certainty !== "to_confirm");
  if (proven) return { verdict: "bad_execution", source: "calculated", deviations };

  // Conformité PROUVÉE : comparée à un plan écrit, ou déclarée par le trader.
  const compared = input.sessionBreaches !== null || input.planRespected === "yes";
  return { verdict: compared ? "good_execution" : "unknown", source: "calculated", deviations };
}

/* ══ La séance ══ */

export type SessionVerdict = "good_discipline" | "good_execution" | "bad_execution" | "unknown";

/**
 * Le verdict d'une séance close. Ne pas trader, ou laisser passer un setup
 * sans trade de revanche, est une BONNE discipline — c'est précisément ce que
 * le P&L ne montre jamais.
 */
export function assessSession(input: {
  /** Un plan a été verrouillé ce jour-là. */
  planned: boolean;
  tradeVerdicts: readonly ExecutionVerdict[];
}): SessionVerdict {
  if (!input.planned) return "unknown";
  if (input.tradeVerdicts.length === 0) return "good_discipline";
  if (input.tradeVerdicts.includes("bad_execution")) return "bad_execution";
  if (input.tradeVerdicts.every((v) => v === "good_execution")) return "good_execution";
  return "unknown";
}

/* ══ Exécution × résultat ══ */

export interface MatrixCell {
  /** Nombre de trades (un total : vrai à toute taille d'échantillon). */
  n: number;
  /** P&L net cumulé de la case. */
  pnl: number;
}

export interface ExecutionMatrix {
  goodWin: MatrixCell;
  goodLoss: MatrixCell;
  badWin: MatrixCell;
  badLoss: MatrixCell;
  /** Trades sans verdict (rien pour comparer), ou à P&L nul. */
  unassessed: number;
}

/**
 * Les deux systèmes côte à côte, jamais fusionnés : la qualité d'exécution en
 * lignes, le résultat en colonnes. Un gain mal exécuté et une perte bien
 * exécutée deviennent visibles — c'est tout l'objet. Aucun taux ici : des
 * comptes et des sommes, vrais quel que soit l'échantillon.
 */
export function executionMatrix(
  rows: readonly { verdict: ExecutionVerdict; pnl: number }[],
): ExecutionMatrix {
  const cell = (): MatrixCell => ({ n: 0, pnl: 0 });
  const m: ExecutionMatrix = {
    goodWin: cell(),
    goodLoss: cell(),
    badWin: cell(),
    badLoss: cell(),
    unassessed: 0,
  };
  for (const { verdict, pnl } of rows) {
    if (verdict === "unknown" || pnl === 0) {
      m.unassessed += 1;
      continue;
    }
    const key =
      verdict === "good_execution"
        ? pnl > 0
          ? "goodWin"
          : "goodLoss"
        : pnl > 0
          ? "badWin"
          : "badLoss";
    m[key].n += 1;
    m[key].pnl += pnl;
  }
  return m;
}
