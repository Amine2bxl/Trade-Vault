/**
 * PRÉVU CONTRE RÉALISÉ — les prix d'un trade, lus sans interprétation.
 *
 * Le plan de séance écrit une zone d'entrée, une invalidation et une cible ;
 * le trade réel a une entrée, un stop initial, une cible et une sortie. Ce
 * module ne fait que la géométrie entre ces prix : distance du stop en points
 * et en ticks, R promis par les niveaux, R obtenu par les prix.
 *
 * RÈGLE : un prix manquant, un stop du mauvais côté ou une cible derrière
 * l'entrée donnent `null` — jamais 0, jamais une valeur devinée. Le R de
 * référence d'un trade reste `measuredR` (P&L / risque) ; le R « par les prix »
 * n'en est qu'un contrôle, utile quand le P&L ne dit pas tout (frais, taille).
 *
 * Module PUR : aucune IO, aucune horloge.
 */

import { futuresSpecFor } from "./futuresContracts";

export type Side = "long" | "short";

/**
 * Le plan de séance tel qu'il était au moment de l'encodage, en prix. Figé
 * dans l'intention du trade : c'est la référence de tout écart.
 */
export interface PlannedLevels {
  direction: Side | null;
  entry: number | null;
  /** L'invalidation du plan. */
  stop: number | null;
  /** La cible (DoL). */
  target: number | null;
  scenario: "A" | "B" | null;
}

export const hasPlannedLevels = (p: PlannedLevels | null | undefined): p is PlannedLevels =>
  !!p && (p.direction != null || p.entry != null || p.stop != null || p.target != null);

/** Un prix saisi ou importé : nombre fini et strictement positif, sinon inconnu. */
export function priceOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/** Distance entrée → stop, du BON côté seulement (sous l'entrée pour un long). */
export function stopDistance(side: Side, entry: number | null, stop: number | null): number | null {
  if (entry == null || stop == null) return null;
  const d = side === "long" ? entry - stop : stop - entry;
  return d > 0 ? d : null;
}

/**
 * R signé d'une sortie (ou d'une cible) face au stop initial. `null` si le stop
 * n'est pas du bon côté : un « R » sans risque défini n'a pas de sens.
 */
export function rFromPrices(
  side: Side,
  entry: number | null,
  stop: number | null,
  exit: number | null,
): number | null {
  const risk = stopDistance(side, entry, stop);
  if (risk == null || exit == null || entry == null) return null;
  const move = side === "long" ? exit - entry : entry - exit;
  return Math.round((move / risk) * 100) / 100;
}

/** R promis par des niveaux : la cible doit être DEVANT l'entrée, sinon `null`. */
export function plannedR(
  side: Side,
  entry: number | null,
  stop: number | null,
  target: number | null,
): number | null {
  const r = rFromPrices(side, entry, stop, target);
  return r != null && r > 0 ? r : null;
}

export interface StopSize {
  points: number;
  /** `null` quand le symbole n'est pas un contrat connu (CFD, forex) : pas de tick deviné. */
  ticks: number | null;
}

export function stopSize(
  side: Side,
  entry: number | null,
  stop: number | null,
  symbol: string,
): StopSize | null {
  const points = stopDistance(side, entry, stop);
  if (points == null) return null;
  const spec = futuresSpecFor(symbol);
  const ticks = spec ? Math.round(points / spec.tickSize) : null;
  return { points: Math.round(points * 10000) / 10000, ticks };
}

/**
 * Risque en dollars que des prix impliquent pour un contrat connu. `null`
 * sans fiche de contrat ou sans quantité : la valeur d'un point d'un CFD
 * dépend du courtier.
 */
export function riskFromPrices(
  side: Side,
  entry: number | null,
  stop: number | null,
  quantity: number | null,
  symbol: string,
): number | null {
  const points = stopDistance(side, entry, stop);
  const spec = futuresSpecFor(symbol);
  if (points == null || !spec || quantity == null || !(quantity > 0)) return null;
  return Math.round(points * spec.pointValue * quantity * 100) / 100;
}
