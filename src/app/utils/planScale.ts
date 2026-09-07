import type { Trade } from "../types";

/**
 * LE PRIX, À L'ÉCHELLE DE CE QUE LE TRADER RISQUE DÉJÀ.
 *
 * ── LA DEMANDE, ET CE QU'ELLE NE PEUT PAS ÊTRE ──────────────────────────────
 *
 * « Montre que c'est vraiment rentable. » Un produit de journalisation ne peut
 * pas promettre un gain : il n'exécute aucun trade, et une page qui écrirait
 * « +X % de performance » inventerait un résultat. C'est interdit, et ce serait
 * de toute façon la mauvaise vente — un trader reconnaît une promesse creuse.
 *
 * Ce qu'on peut faire, sans rien inventer : poser le prix DANS L'ÉCHELLE que le
 * trader utilise déjà tous les jours. Quinze euros par mois ne veut rien dire
 * dans l'absolu ; « quinze euros, contre une perte moyenne de quatre-vingts »
 * se compare instantanément, et c'est un fait tiré de son propre journal.
 *
 * ── POURQUOI LA PERTE MOYENNE, ET NON LE GAIN MOYEN ─────────────────────────
 *
 * Comparer un abonnement à un GAIN moyen suggérerait que l'abonnement produit
 * ce gain. La perte moyenne ne suggère rien : c'est le montant que le trader
 * accepte déjà de perdre sur un seul trade. Le rapprochement est une mise à
 * l'échelle, pas un argument de rendement.
 *
 * ── CE QUI FAIT TAIRE LE BLOC ───────────────────────────────────────────────
 *
 * Sous vingt trades perdants, la moyenne n'est pas une moyenne — et le bloc
 * n'apparaît pas. Mieux vaut ne rien montrer qu'une comparaison à un chiffre
 * de sable, sur la page où l'on demande de payer.
 */

/** Sous ce nombre de pertes, aucune moyenne n'est publiée. */
export const SCALE_MIN_LOSSES = 20;

export interface PlanScale {
  /** Perte moyenne d'un trade perdant, en valeur absolue. */
  perteMoyenne: number;
  /** Nombre de trades perdants sur lesquels elle est mesurée. */
  nLosses: number;
  /** Le prix mensuel rapporté à cette perte, en %. */
  partDUnePerte: number;
}

/**
 * La mise à l'échelle, ou `null` si l'historique ne la porte pas.
 *
 * `null` plutôt qu'un objet à zéro : un « 0 % » se lirait comme « ça ne coûte
 * rien », alors que la vérité est « on ne sait pas encore ».
 */
export function planScale(trades: Trade[], prixMensuel: number): PlanScale | null {
  if (prixMensuel <= 0) return null;

  const pertes = trades.filter((t) => t.pnl < 0);
  if (pertes.length < SCALE_MIN_LOSSES) return null;

  const somme = pertes.reduce((s, t) => s + Math.abs(t.pnl), 0);
  const perteMoyenne = somme / pertes.length;
  if (perteMoyenne <= 0) return null;

  return {
    perteMoyenne: Math.round(perteMoyenne * 100) / 100,
    nLosses: pertes.length,
    partDUnePerte: Math.round((prixMensuel / perteMoyenne) * 100),
  };
}
