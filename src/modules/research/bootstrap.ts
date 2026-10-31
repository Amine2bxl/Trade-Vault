import { makeRng, randomIndex } from "@/modules/probability/rng";

/**
 * BOOTSTRAP PAR SÉANCES — module pur (lot 2).
 *
 * Les trades d'une même séance ne sont pas indépendants : même humeur, même
 * marché, même fatigue. Rééchantillonner les trades un par un ferait comme
 * s'ils l'étaient, et rendrait des intervalles trop étroits — une fausse
 * précision. On rééchantillonne donc des SÉANCES entières (blocs), avec
 * remise, et on recalcule l'espérance par trade sur les trades tirés.
 *
 * Reproductible : même graine, même résultat, au chiffre près. La graine, le
 * nombre d'itérations et la version de la méthode sont rendus avec le
 * résultat, pour qu'un chiffre puisse être rejoué plus tard.
 */

export const BOOTSTRAP_METHOD = "session-block-percentile" as const;
/** Incrémenter à tout changement de calcul : un résultat archivé dit avec quelle méthode il a été produit. */
export const BOOTSTRAP_VERSION = 1;
export const DEFAULT_ITERATIONS = 2000;

export interface BootstrapResult {
  /** Espérance observée : P&L moyen par trade. */
  estimate: number;
  /** Intervalle percentile à 95 %. */
  low: number;
  high: number;
  /**
   * p bilatéral de « l'espérance vaut 0 », lu sur la distribution
   * rééchantillonnée (2 × la plus petite queue). Approximation du bootstrap,
   * pas un test exact — dit comme tel.
   */
  p: number;
  iterations: number;
  seed: number;
  /** Nombre de séances (blocs) rééchantillonnées. */
  blocks: number;
  method: typeof BOOTSTRAP_METHOD;
  version: number;
}

/**
 * `sessions` : les valeurs (P&L par trade) regroupées par séance. Rend `null`
 * sans au moins deux séances : un seul bloc ne se rééchantillonne pas.
 */
export function sessionBlockBootstrap(
  sessions: readonly (readonly number[])[],
  opts: { seed: number; iterations?: number },
): BootstrapResult | null {
  const blocks = sessions.filter((s) => s.length > 0);
  if (blocks.length < 2) return null;
  const iterations = Math.max(100, Math.floor(opts.iterations ?? DEFAULT_ITERATIONS));
  const sums = blocks.map((b) => b.reduce((s, v) => s + v, 0));
  const counts = blocks.map((b) => b.length);
  const totalN = counts.reduce((s, c) => s + c, 0);
  const estimate = sums.reduce((s, v) => s + v, 0) / totalN;

  const rng = makeRng(opts.seed);
  const stats = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    let n = 0;
    for (let k = 0; k < blocks.length; k++) {
      const j = randomIndex(rng, blocks.length);
      sum += sums[j];
      n += counts[j];
    }
    stats[i] = sum / n;
  }
  const sorted = Array.from(stats).sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
  const below = sorted.filter((v) => v <= 0).length / iterations;
  const above = sorted.filter((v) => v >= 0).length / iterations;
  return {
    estimate,
    low: at(0.025),
    high: at(0.975),
    p: Math.min(1, 2 * Math.min(below, above)),
    iterations,
    seed: opts.seed >>> 0,
    blocks: blocks.length,
    method: BOOTSTRAP_METHOD,
    version: BOOTSTRAP_VERSION,
  };
}
