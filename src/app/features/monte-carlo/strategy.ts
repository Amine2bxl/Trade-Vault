import type { RMultipleSample } from "./monteCarloEngine";

/**
 * L'EDGE D'UNE STRATÉGIE, EN QUATRE NOMBRES — ET LA FORME DE SES TRADES.
 *
 * La simulation tirait les trades du journal tels quels : fidèle, mais
 * figée. On ne pouvait pas demander « et si je gagnais 5 points de plus ? »
 * ou « et si je laissais courir mes gains jusqu'à 2R ? » — la seule façon de
 * planifier était de décrire une stratégie à la main, ce qui jetait la vraie
 * forme des gains et des pertes du trader pour une moyenne.
 *
 * On sépare donc deux choses que le journal mélange :
 *
 *   • LE MODÈLE — taux de réussite, part de neutres, gain moyen, perte
 *     moyenne. C'est ce que le trader règle.
 *   • LA FORME — la dispersion de ses gains autour de leur moyenne, et celle
 *     de ses pertes. C'est ce qu'il ne règle pas : ses gros gains restent
 *     rares, ses pertes restent serrées autour de son stop.
 *
 * Les deux réservoirs (`Pools`) sont normalisés à une moyenne de 1 : un tirage
 * vaut `réservoir × moyenne voulue`. Quand le modèle est celui du journal, le
 * tirage reproduit exactement ses trades ; quand le trader le modifie, ses
 * trades sont REDIMENSIONNÉS, pas remplacés par une hypothèse.
 */

export interface EdgeModel {
  /** Part des trades gagnants parmi les trades décisifs (neutres exclus), 0–1. */
  winRate: number;
  /** Part des trades neutres, 0–1. */
  beRate: number;
  /** Gain moyen, en R (> 0). */
  avgWinR: number;
  /** Perte moyenne, en R, en valeur absolue (> 0). */
  avgLossR: number;
}

export interface Pools {
  /** Gains, normalisés à une moyenne de 1. */
  wins: Float64Array;
  /** Pertes (valeurs absolues), normalisées à une moyenne de 1. */
  losses: Float64Array;
  /** Les réservoirs viennent de vrais trades (journal, CSV) — sinon, modèle. */
  real: boolean;
}

/** Le modèle d'une liste de trades : taux de réussite hors neutres, comme le journal. */
export function modelFromSamples(samples: RMultipleSample[]): EdgeModel {
  let wins = 0;
  let losses = 0;
  let be = 0;
  let sumWin = 0;
  let sumLoss = 0;
  for (const s of samples) {
    if (s.isWin) {
      wins++;
      sumWin += s.r;
    } else if (s.isLoss) {
      losses++;
      sumLoss += Math.abs(s.r);
    } else be++;
  }
  const decisive = wins + losses;
  return {
    winRate: decisive > 0 ? wins / decisive : 0,
    beRate: samples.length > 0 ? be / samples.length : 0,
    avgWinR: wins > 0 ? sumWin / wins : 0,
    avgLossR: losses > 0 ? sumLoss / losses : 0,
  };
}

const normalise = (values: number[]) => {
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  return Float64Array.from(values, (v) => v / mean);
};

/**
 * Les deux réservoirs d'une liste de trades, ou `null` s'il manque des gains
 * ou des pertes exploitables (en R) — il faut les deux pour qu'une forme
 * existe.
 */
export function poolsFromSamples(samples: RMultipleSample[]): Pools | null {
  const wins = samples.filter((s) => s.isWin && s.r > 0).map((s) => s.r);
  const losses = samples.filter((s) => s.isLoss && s.r < 0).map((s) => -s.r);
  if (wins.length === 0 || losses.length === 0) return null;
  return { wins: normalise(wins), losses: normalise(losses), real: true };
}

/** Quantile de la loi normale centrée réduite (approximation d'Acklam). */
function normalQuantile(p: number): number {
  const a = [
    -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472,
    2.50662827745924,
  ];
  const b = [
    -54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373,
    4.37466414146497, 2.93816398269878,
  ];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

/**
 * UNE FORME PLAUSIBLE QUAND IL N'Y A PAS DE TRADES.
 *
 * Gains log-normaux assez dispersés (quelques gros gains, beaucoup de petits),
 * pertes serrées autour du stop. Déterministe — mêmes quantiles à chaque
 * visite — pour qu'une stratégie modèle donne la même courbe d'un jour à
 * l'autre.
 */
export function syntheticPools(n = 400): Pools {
  const shape = (sigma: number) =>
    Array.from({ length: n }, (_, i) => Math.exp(sigma * normalQuantile((i + 0.5) / n)));
  return { wins: normalise(shape(0.55)), losses: normalise(shape(0.18)), real: false };
}

/** Espérance par trade, en R, neutres compris. */
export function expectancyR(m: EdgeModel): number {
  return (1 - m.beRate) * (m.winRate * m.avgWinR - (1 - m.winRate) * m.avgLossR);
}

/** Les deux termes de l'espérance : ce que rapportent les gains, ce que coûtent les pertes. */
export function edgeTerms(m: EdgeModel): { gain: number; loss: number; net: number } {
  const gain = (1 - m.beRate) * m.winRate * m.avgWinR;
  const loss = (1 - m.beRate) * (1 - m.winRate) * m.avgLossR;
  return { gain, loss, net: gain - loss };
}

/** Le taux de réussite qui annule l'espérance, pour un gain et une perte donnés. */
export function breakEvenWinRate(avgWinR: number, avgLossR: number): number {
  return avgWinR + avgLossR > 0 ? avgLossR / (avgWinR + avgLossR) : 1;
}

/** Gains bruts ÷ pertes brutes. */
export function profitFactor(m: EdgeModel): number {
  const { gain, loss } = edgeTerms(m);
  return loss > 0 ? gain / loss : gain > 0 ? Infinity : 0;
}

/** Deux modèles égaux à l'arrondi de l'affichage près. */
export function sameModel(a: EdgeModel, b: EdgeModel): boolean {
  return (
    Math.abs(a.winRate - b.winRate) < 0.0005 &&
    Math.abs(a.beRate - b.beRate) < 0.0005 &&
    Math.abs(a.avgWinR - b.avgWinR) < 0.005 &&
    Math.abs(a.avgLossR - b.avgLossR) < 0.005
  );
}

/**
 * Ce que vaut un R en argent, LU dans les trades : la médiane de |P&L ÷ R|.
 * C'est le risque réel par trade — la perte moyenne en argent le surestime
 * dès que la perte moyenne dépasse 1R.
 */
export function dollarPerR(samples: RMultipleSample[]): number | null {
  const ratios = samples
    .filter((s) => Math.abs(s.r) >= 0.05 && s.pnl !== 0)
    .map((s) => Math.abs(s.pnl / s.r))
    .sort((a, b) => a - b);
  if (ratios.length === 0) return null;
  return ratios[Math.floor(ratios.length / 2)];
}

/** Les bornes de la carte de l'edge. */
export const EDGE_MAP = {
  winRate: [0.2, 0.8] as const,
  /** Rapport gain moyen ÷ perte moyenne — axe logarithmique. */
  rr: [0.5, 4] as const,
};

/** Le rapport gain/perte à la hauteur `t` (0 = bas, 1 = haut) de la carte. */
export function rrAt(t: number): number {
  const [lo, hi] = EDGE_MAP.rr;
  return lo * Math.pow(hi / lo, t);
}

/** La hauteur (0–1) d'un rapport gain/perte sur la carte. */
export function rrPos(rr: number): number {
  const [lo, hi] = EDGE_MAP.rr;
  return Math.log(Math.max(lo, Math.min(hi, rr)) / lo) / Math.log(hi / lo);
}

/**
 * L'espérance, en pertes moyennes, sur toute la carte : chaque case est un
 * couple (taux de réussite, rapport gain/perte). Ligne 0 = rapport le plus
 * haut, pour se peindre directement de haut en bas.
 */
export function edgeGrid(cols: number, rows: number): Float32Array {
  const [w0, w1] = EDGE_MAP.winRate;
  const out = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    const rr = rrAt(1 - (y + 0.5) / rows);
    for (let x = 0; x < cols; x++) {
      const wr = w0 + ((x + 0.5) / cols) * (w1 - w0);
      out[y * cols + x] = wr * rr - (1 - wr);
    }
  }
  return out;
}

/**
 * La forme des trades SIMULÉS, en R, par demi-R de −3R à +5R : les réservoirs
 * passés au modèle, pondérés par leur probabilité. C'est ce que la
 * simulation tire réellement — le journal tel quel, ou redimensionné. Les
 * classes sont centrées sur les demi-R : le neutre tombe dans la classe de 0,
 * ni gain ni perte.
 */
export function tradeShape(model: EdgeModel, pools: Pools, lo = -3.25, hi = 5.25, bins = 17) {
  const width = (hi - lo) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({
    center: lo + width * (i + 0.5),
    share: 0,
  }));
  const put = (r: number, weight: number) => {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((r - lo) / width)));
    out[i].share += weight;
  };
  const decisive = 1 - model.beRate;
  const wWin = (decisive * model.winRate) / pools.wins.length;
  const wLoss = (decisive * (1 - model.winRate)) / pools.losses.length;
  for (const v of pools.wins) put(v * model.avgWinR, wWin);
  for (const v of pools.losses) put(-v * model.avgLossR, wLoss);
  if (model.beRate > 0) put(0, model.beRate);
  return out;
}
