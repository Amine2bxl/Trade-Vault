import type { computeBehaviorSignals } from "./behaviorSignals";

/**
 * Sélection des signaux comportementaux envoyés au coach.
 *
 * Module PUR et isolé (aucun accès réseau, DB ou UI) : la qualité du contexte
 * transmis au modèle est une décision produit à part entière, testable seule —
 * même contrat que les détecteurs et l'Insight Engine.
 *
 * Le problème qu'il résout : les buckets arrivent TRIÉS PAR P&L CROISSANT
 * (`behaviorSignals.ts` : `sort((a, b) => a.pnl - b.pnl)`). Une troncature
 * naïve `slice(0, n)` ne conserve donc que les PERDANTS :
 *   - le contraste disparaît — « win rate 38 % le vendredi » survit, mais le
 *     « vs 64 % en semaine » qui rend le diagnostic percutant est supprimé ;
 *   - pour `byStrategy`, le MEILLEUR setup est purement jeté, ce qui rend
 *     « quel setup me rapporte le plus ? » impossible à répondre.
 */

export type BehaviorSignalsShape = ReturnType<typeof computeBehaviorSignals>;

/** Plafond de sérialisation. Le serveur valide `signals` à 12 KB (Zod) : au
 *  delà, la requête est rejetée (400) et le trader voit « une erreur est
 *  survenue ». On reste volontairement en dessous. */
export const SIGNALS_CAP = 10_000;

/**
 * Conserve les DEUX extrémités d'une liste triée — exactement la règle que
 * `computeBehaviorSignals` applique déjà aux symboles (`bySymbol`).
 */
export function keepExtremes<T>(list: T[], perSide: number): T[] {
  if (list.length <= perSide * 2) return list;
  return [...list.slice(0, perSide), ...list.slice(-perSide)];
}

/**
 * Combien de buckets conserver par section. `"all"` pour les sections
 * naturellement minuscules dont chaque entrée porte du sens :
 *   - `byWeekday` : 7 buckets maximum (~110 tokens) et c'est la question la
 *     plus fréquente — la tronquer coûte bien plus cher que la garder ;
 *   - `bySession` : 3 buckets maximum (Asie / Londres / New York).
 */
export const SIGNAL_KEEP: Record<string, number | "all"> = {
  byWeekday: "all",
  bySession: "all",
  bySymbol: 3,
  byStrategy: 3,
};

function reduceSignals(
  signals: BehaviorSignalsShape,
  perSideOverride?: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(signals)) {
    const value = (signals as Record<string, unknown>)[key];
    if (!Array.isArray(value)) {
      out[key] = value;
      continue;
    }
    const policy = SIGNAL_KEEP[key] ?? 3;
    // En dégradation seulement, les sections « all » acceptent d'être réduites.
    if (policy === "all" && perSideOverride === undefined) out[key] = value;
    else out[key] = keepExtremes(value, perSideOverride ?? (policy === "all" ? 3 : policy));
  }
  return out;
}

/**
 * Garde les signaux sous le plafond serveur tout en préservant le sens.
 * Dégradation en TROIS temps — une section entière n'est sacrifiée qu'en
 * dernier recours :
 *   1. sélection normale (extrémités des deux côtés) ;
 *   2. resserrage à 2 buckets par côté ;
 *   3. suppression des sections, de la moins critique à la plus critique
 *      (`byWeekday` en dernier : c'est la plus demandée).
 */
export function slimSignals(signals: BehaviorSignalsShape): Record<string, unknown> {
  const size = (o: Record<string, unknown>) => JSON.stringify(o).length;

  let out = reduceSignals(signals);
  if (size(out) <= SIGNALS_CAP) return out;

  out = reduceSignals(signals, 2);
  if (size(out) <= SIGNALS_CAP) return out;

  for (const drop of ["conviction", "setupQuality", "bySession", "bySymbol", "byWeekday"]) {
    if (size(out) <= SIGNALS_CAP) break;
    delete out[drop];
  }
  return out;
}
