import { makeRng, randomIndex } from "@/modules/probability/rng";

/**
 * ÉCART ENTRE DEUX GROUPES — bootstrap par SÉANCES, module pur.
 *
 * Même raison que `modules/research/bootstrap` : les trades d'une séance ne
 * sont pas indépendants. Chaque groupe est rééchantillonné par séances
 * entières, indépendamment de l'autre, et l'on lit la distribution de l'écart
 * des moyennes par trade (A − B). Reproductible : même graine, même résultat.
 */

export const DIFF_METHOD = "two-group-session-block-percentile" as const;
export const DIFF_VERSION = 1;
export const DIFF_ITERATIONS = 2000;

export interface DiffResult {
  /** Moyenne par trade du groupe A, du groupe B, et leur écart observé. */
  meanA: number;
  meanB: number;
  diff: number;
  /** Intervalle percentile à 95 % de l'écart. */
  low: number;
  high: number;
  /** p bilatéral approché de « l'écart vaut 0 » (2 × la plus petite queue). */
  p: number;
  iterations: number;
  seed: number;
  method: typeof DIFF_METHOD;
  version: number;
}

function mean(blocks: readonly (readonly number[])[]): number {
  let s = 0;
  let n = 0;
  for (const b of blocks)
    for (const v of b) {
      s += v;
      n++;
    }
  return n ? s / n : NaN;
}

/**
 * `a`, `b` : les valeurs par trade, regroupées par séance. `null` si l'un des
 * groupes a moins de deux séances — un bloc unique ne se rééchantillonne pas.
 */
export function sessionBlockDiff(
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
  opts: { seed: number; iterations?: number },
): DiffResult | null {
  const A = a.filter((s) => s.length);
  const B = b.filter((s) => s.length);
  if (A.length < 2 || B.length < 2) return null;
  const iterations = Math.max(200, Math.floor(opts.iterations ?? DIFF_ITERATIONS));
  const sumsA = A.map((s) => s.reduce((x, v) => x + v, 0));
  const sumsB = B.map((s) => s.reduce((x, v) => x + v, 0));
  const lenA = A.map((s) => s.length);
  const lenB = B.map((s) => s.length);
  const rng = makeRng(opts.seed);
  const diffs = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) {
    let sa = 0;
    let na = 0;
    for (let k = 0; k < A.length; k++) {
      const j = randomIndex(rng, A.length);
      sa += sumsA[j];
      na += lenA[j];
    }
    let sb = 0;
    let nb = 0;
    for (let k = 0; k < B.length; k++) {
      const j = randomIndex(rng, B.length);
      sb += sumsB[j];
      nb += lenB[j];
    }
    diffs[i] = sa / na - sb / nb;
  }
  diffs.sort();
  const at = (q: number) =>
    diffs[Math.min(iterations - 1, Math.max(0, Math.floor(q * iterations)))];
  let below = 0;
  let above = 0;
  for (const d of diffs) {
    if (d <= 0) below++;
    if (d >= 0) above++;
  }
  const meanA = mean(A);
  const meanB = mean(B);
  return {
    meanA,
    meanB,
    diff: meanA - meanB,
    low: at(0.025),
    high: at(0.975),
    p: Math.min(1, (2 * Math.min(below, above)) / iterations),
    iterations,
    seed: opts.seed,
    method: DIFF_METHOD,
    version: DIFF_VERSION,
  };
}
