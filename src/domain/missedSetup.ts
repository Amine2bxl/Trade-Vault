/**
 * SETUPS MANQUÉS — ce qu'un setup non pris coûte VRAIMENT, et seulement lui.
 *
 * Tout mouvement de marché raté n'est pas de l'argent perdu. Un setup ne compte
 * dans « R laissé sur la table » que s'il était VALIDE (ou manqué par
 * hésitation) ET que son issue est CONNUE : cible touchée (+R visé) ou stop
 * touché (−1 R — ne pas l'avoir pris a alors épargné un risque). Un setup
 * invalide ou écarté volontairement ne compte jamais ; une issue inconnue
 * non plus. Les anciennes lignes, sans classe, gardent le R que le trader
 * avait déclaré (on ne réécrit pas l'histoire).
 *
 * Module PUR.
 */

import { plannedR, type Side } from "./executionPlan";

export const MISSED_REASONS = [
  "hesitation",
  "fear",
  "not_recognized",
  "no_confirmation",
  "outside_window",
  "risk_constraint",
  "daily_limit",
  "deliberate",
] as const;
export type MissedReason = (typeof MISSED_REASONS)[number];

export const MISSED_CLASSES = ["valid", "hesitation", "skipped", "invalid"] as const;
export type MissedClass = (typeof MISSED_CLASSES)[number];

export const MISSED_OUTCOMES = ["target", "stop", "unknown"] as const;
export type MissedOutcome = (typeof MISSED_OUTCOMES)[number];

/**
 * La classe que la raison suggère — une SUGGESTION, le trader la change :
 * hésiter ou avoir peur devant un setup valide, c'est le manquer par
 * hésitation ; ne pas l'avoir reconnu, c'est le manquer tout court ; une
 * confirmation absente le rend invalide ; une règle (fenêtre, risque, limite
 * du jour) ou un choix l'écarte volontairement — c'est de la discipline.
 */
export function suggestedClass(reason: MissedReason): MissedClass {
  switch (reason) {
    case "hesitation":
    case "fear":
      return "hesitation";
    case "not_recognized":
      return "valid";
    case "no_confirmation":
      return "invalid";
    case "outside_window":
    case "risk_constraint":
    case "daily_limit":
    case "deliberate":
      return "skipped";
  }
}

export interface MissedLevels {
  direction: Side | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
}

/** R hypothétique d'une issue connue ; `null` sans prix cohérents ou issue inconnue. */
export function hypotheticalR(levels: MissedLevels, outcome: MissedOutcome | null): number | null {
  if (!levels.direction || outcome === null || outcome === "unknown") return null;
  const aim = plannedR(levels.direction, levels.entry, levels.stop, levels.target);
  if (aim === null) return null;
  return outcome === "target" ? aim : -1;
}

export interface MissedRecord extends MissedLevels {
  classification: MissedClass | null;
  outcome: MissedOutcome | null;
  /** R déclaré à la main (anciennes lignes, ou sans prix). */
  declaredR: number;
}

/**
 * Le R qui COMPTE dans « laissé sur la table », ou `null` s'il ne compte pas.
 * Sans classe (ligne d'avant ce modèle) : le R déclaré, tel quel.
 */
export function countedR(m: MissedRecord): number | null {
  if (m.classification === null) return m.declaredR;
  if (m.classification === "invalid" || m.classification === "skipped") return null;
  const computed = hypotheticalR(m, m.outcome);
  if (computed !== null) return computed;
  // Issue connue mais sans prix : le R déclaré par le trader.
  return m.outcome === "target" || m.outcome === "stop" ? m.declaredR : null;
}
