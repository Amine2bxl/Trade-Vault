/**
 * Classes d'histogramme du laboratoire Monte Carlo (`StrategyDetails`).
 *
 * Lot 6 : l'ancien moteur (`monteCarloEngine`) et les vues qui lisaient ses
 * résultats (faisceaux, trajectoires, drawdown, séries) n'avaient plus aucun
 * appelant de production — la page s'appuie sur `modules/probability/strategy`.
 * Seul ce découpage en classes reste utilisé.
 */

/** Des classes régulières sur des valeurs, bornées par [lo, hi] (le hors-plage
 *  tombe dans la classe extrême : rien n'est perdu du décompte). */
export function histogram(
  values: number[],
  lo: number,
  hi: number,
  bins: number,
): { center: number; from: number; to: number; count: number }[] {
  const width = (hi - lo) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({
    center: lo + width * (i + 0.5),
    from: lo + width * i,
    to: lo + width * (i + 1),
    count: 0,
  }));
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / width)));
    out[i].count++;
  }
  return out;
}
