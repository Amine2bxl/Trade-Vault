import type { MonteCarloResult, RMultipleSample, SimulationRun } from "./monteCarlo";

/**
 * CE QUE LES 2 000 TIRAGES DISENT, CALCULÉ — PAS DESSINÉ.
 *
 * La page Monte-Carlo montrait un faisceau lissé sur les 200 premiers tirages
 * et un histogramme : on ne VOYAIT aucune trajectoire, rien ne rappelait que
 * chaque courbe est une suite de trades réellement tirés dans le journal. Ce
 * module extrait du résultat du moteur (`runMonteCarlo`) tout ce que le
 * graphe montre, sans rien approximer :
 *
 *   - `pathBands` — à CHAQUE trade, les percentiles 5/25/50/75/95 du solde
 *     sur l'ensemble des tirages (un tirage arrêté par la cible ou la limite
 *     garde son dernier solde : il ne trade plus) ;
 *   - `samplePaths` — de vraies trajectoires, choisies à rangs réguliers dans
 *     la distribution des soldes finaux : on voit la meilleure, la pire et tout
 *     l'entre-deux, pas un tirage au hasard qui tomberait toujours au milieu ;
 *   - `drawdownStats` — la distribution des pires baisses, en montant et en %;
 *   - `streakStats` — la plus longue série de pertes de chaque tirage ;
 *   - `rHistogram` — la forme des résultats RÉELS rejoués (en R).
 *
 * Tout est pur et testé : aucune courbe de cette page ne peut être une
 * illustration.
 */

export interface BandPoint {
  /** Numéro du trade (0 = départ). */
  step: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

const quantile = (sorted: number[], q: number) =>
  sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];

/** Le solde d'un tirage au trade `step` — figé au dernier connu s'il s'est arrêté. */
const equityAt = (run: SimulationRun, step: number) =>
  run.equity[Math.min(step, run.equity.length - 1)];

/**
 * Les percentiles du solde, trade par trade, sur TOUS les tirages.
 * `points` borne le nombre de points rendus (un graphe n'a pas besoin de 600
 * abscisses) : les pas sont répartis régulièrement, départ et fin inclus.
 */
export function pathBands(result: MonteCarloResult, points = 80): BandPoint[] {
  const runs = result.runs;
  if (runs.length === 0) return [];
  const maxStep = Math.max(...runs.map((r) => r.equity.length - 1));
  const n = Math.max(2, Math.min(points, maxStep + 1));
  const out: BandPoint[] = [];
  for (let i = 0; i < n; i++) {
    const step = Math.round((i / (n - 1)) * maxStep);
    if (out.length && out[out.length - 1].step === step) continue;
    const vals = runs.map((r) => equityAt(r, step)).sort((a, b) => a - b);
    out.push({
      step,
      p5: quantile(vals, 0.05),
      p25: quantile(vals, 0.25),
      p50: quantile(vals, 0.5),
      p75: quantile(vals, 0.75),
      p95: quantile(vals, 0.95),
    });
  }
  return out;
}

export interface SamplePath {
  /** Rang du tirage dans la distribution des soldes finaux (0 = le pire). */
  rank: number;
  outcome: "passed" | "failed" | "timedOut";
  equity: number[];
}

/** `count` vraies trajectoires, prises à rangs réguliers du pire au meilleur. */
export function samplePaths(result: MonteCarloResult, count = 40): SamplePath[] {
  const sorted = [...result.runs].sort((a, b) => a.finalBalance - b.finalBalance);
  if (sorted.length === 0) return [];
  const k = Math.min(count, sorted.length);
  const out: SamplePath[] = [];
  for (let i = 0; i < k; i++) {
    const rank = k === 1 ? 0 : Math.round((i / (k - 1)) * (sorted.length - 1));
    const run = sorted[rank];
    out.push({
      rank,
      outcome: run.passed ? "passed" : run.failed ? "failed" : "timedOut",
      equity: run.equity,
    });
  }
  return out;
}

/**
 * Les points du graphe : les percentiles ET les trajectoires, à la même
 * abscisse. Les trajectoires deviennent des colonnes `t0…tN` ; un tirage
 * arrêté s'interrompt (valeur `null`) au lieu de tracer un palier plat qui
 * ferait croire qu'il continue.
 */
export function chartRows(
  bands: BandPoint[],
  paths: SamplePath[],
): Array<Record<string, number | null | [number, number]>> {
  return bands.map((b) => {
    const row: Record<string, number | null | [number, number]> = {
      step: b.step,
      p5: b.p5,
      p50: b.p50,
      p95: b.p95,
      band90: [b.p5, b.p95],
      band50: [b.p25, b.p75],
    };
    paths.forEach((p, i) => {
      row[`t${i}`] = b.step < p.equity.length ? p.equity[b.step] : null;
    });
    return row;
  });
}

export interface Distribution {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

const distribution = (values: number[]): Distribution => {
  const s = [...values].sort((a, b) => a - b);
  return {
    p5: quantile(s, 0.05),
    p25: quantile(s, 0.25),
    p50: quantile(s, 0.5),
    p75: quantile(s, 0.75),
    p95: quantile(s, 0.95),
  };
};

/** La pire baisse (pic → creux) de chaque tirage, en montant et en % du pic. */
export function drawdownStats(result: MonteCarloResult): {
  amount: Distribution;
  pct: Distribution;
  values: number[];
} {
  const values: number[] = [];
  const pcts: number[] = [];
  for (const run of result.runs) {
    let peak = run.equity[0] ?? 0;
    let dd = 0;
    let ddPct = 0;
    for (const v of run.equity) {
      if (v > peak) peak = v;
      const d = peak - v;
      if (d > dd) dd = d;
      if (peak > 0 && d / peak > ddPct) ddPct = d / peak;
    }
    values.push(dd);
    pcts.push(ddPct);
  }
  return { amount: distribution(values), pct: distribution(pcts), values };
}

/** La plus longue suite de trades perdants de chaque tirage. */
export function streakStats(result: MonteCarloResult): Distribution {
  const longest = result.runs.map((run) => {
    let cur = 0;
    let best = 0;
    for (const r of run.trades) {
      cur = r < 0 ? cur + 1 : 0;
      if (cur > best) best = cur;
    }
    return best;
  });
  return distribution(longest);
}

/** Part des tirages qui finissent au-dessus du solde de départ. */
export function probabilityOfProfit(result: MonteCarloResult): number {
  if (result.runs.length === 0) return 0;
  const start = result.params.startingBalance;
  return result.runs.filter((r) => r.finalBalance > start).length / result.runs.length;
}

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

/** La forme des résultats réels, en R, par demi-R de -3R à +5R. */
export function rHistogram(samples: RMultipleSample[]) {
  return histogram(
    samples.map((s) => s.r),
    -3,
    5,
    16,
  );
}
