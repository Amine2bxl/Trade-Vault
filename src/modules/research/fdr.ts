/**
 * TESTS MULTIPLES — Benjamini-Hochberg (lot 2).
 *
 * Balayer dix setups et en retenir un « significatif » à 5 %, c'est presque
 * garantir d'en trouver un par hasard. La correction de Benjamini-Hochberg
 * contrôle la proportion attendue de fausses découvertes parmi ce qui est
 * retenu (FDR) : chaque p est ramené à un q comparable au seuil déclaré.
 */

/** Les q-valeurs, dans l'ordre des p reçus. Un p invalide rend un q `null`. */
export function benjaminiHochberg(pValues: readonly (number | null)[]): (number | null)[] {
  const tested = pValues
    .map((p, i) => ({ p, i }))
    .filter((x): x is { p: number; i: number } => x.p !== null && Number.isFinite(x.p))
    .sort((a, b) => a.p - b.p);
  const m = tested.length;
  const out: (number | null)[] = pValues.map(() => null);
  let running = 1;
  for (let k = m - 1; k >= 0; k--) {
    running = Math.min(running, (tested[k].p * m) / (k + 1));
    out[tested[k].i] = Math.min(1, running);
  }
  return out;
}
