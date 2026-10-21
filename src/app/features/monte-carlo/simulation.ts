import type { EdgeModel, Pools } from "./strategy";

/**
 * MONTE-CARLO — DIX MILLE COMPTES, SANS JAMAIS BLOQUER L'ÉCRAN.
 *
 * ══ CE QUI CHANGE PAR RAPPORT AU PREMIER MOTEUR ══
 *
 * `runMonteCarlo` gardait chaque trajectoire comme un tableau JavaScript de
 * nombres : à 2 000 tirages ça passait, à 10 000 sur 120 jours c'était 12
 * millions de nombres alloués d'un bloc, et l'interface gelée le temps du
 * calcul. Ici :
 *
 *   • tout vit dans des tableaux typés alloués une fois (≈ 6 Mo à 10 000
 *     tirages) ;
 *   • le calcul AVANCE PAR TRANCHES (`advance`) : la page en fait quelques
 *     centaines par image, l'écran reste fluide et le faisceau se remplit sous
 *     les yeux du trader ;
 *   • chaque tirage a sa propre graine, dérivée de son numéro : le tirage n°42
 *     voit les mêmes hasards quels que soient les réglages. Deux scénarios se
 *     comparent donc sur les mêmes « journées » — l'écart entre eux vient des
 *     réglages, pas du bruit (variables aléatoires communes).
 *
 * ══ CE QUI EST SIMULÉ ══
 *
 * À chaque trade : neutre avec la probabilité `beRate`, sinon gain avec la
 * probabilité `winRate`, sinon perte. La taille est tirée dans le réservoir de
 * la forme du trader (voir `strategy.ts`), multipliée par la moyenne du
 * modèle, puis par le montant risqué (1R). Un compte qui touche l'objectif ou
 * la limite S'ARRÊTE : il ne trade plus.
 *
 * Les trajectoires sont gardées à `points` instants réguliers (au plus 150) :
 * assez pour un tracé fin, sans stocker chaque trade d'un horizon de 1 200.
 */

export interface SimConfig {
  model: EdgeModel;
  pools: Pools;
  /** Solde de départ. */
  balance: number;
  /** Montant risqué par trade (1R), en devise. */
  risk: number;
  tradesPerDay: number;
  days: number;
  /** Objectif, en % du solde de départ (0 = aucun). */
  targetPct: number;
  /** Limite de perte, en % du solde de départ (0 = aucune). */
  limitPct: number;
  runs: number;
  seed: number;
  /** Garder les trajectoires (faisceau, percentiles) — sinon les issues seules. */
  keepPaths?: boolean;
  maxPoints?: number;
}

export const OUTCOME_OPEN = 0;
export const OUTCOME_PASSED = 1;
export const OUTCOME_FAILED = 2;

export interface Simulation {
  readonly cfg: SimConfig;
  /** Trades par tirage sur l'horizon complet. */
  readonly steps: number;
  /** Instants gardés par trajectoire. */
  readonly points: number;
  /** Le numéro de trade de chaque instant (0 = départ). */
  readonly stepAt: Int32Array;
  /** Soldes, `runs × points`. Après un arrêt, le dernier solde est répété. */
  readonly paths: Float32Array | null;
  /** Dernier instant tracé de chaque tirage (celui de l'arrêt). */
  readonly ends: Uint16Array;
  readonly status: Uint8Array;
  readonly final: Float32Array;
  /** Pire baisse depuis un sommet, en devise. */
  readonly maxDD: Float32Array;
  /** Plus longue série de pertes. */
  readonly streak: Uint16Array;
  /** Numéro du trade d'arrêt (`steps` si le compte a tenu l'horizon). */
  readonly stopStep: Uint32Array;
  readonly target: number;
  readonly floor: number;
  /** Tirages déjà calculés. */
  readonly done: number;
  readonly finished: boolean;
  /** Calcule les `count` tirages suivants. */
  advance(count: number): void;
}

export function createSimulation(cfg: SimConfig): Simulation {
  const runs = Math.max(1, Math.floor(cfg.runs));
  const tpd = Math.max(1, Math.round(cfg.tradesPerDay));
  const steps = Math.max(1, Math.round(cfg.days) * tpd);
  const points = Math.min(steps + 1, Math.max(2, cfg.maxPoints ?? 150));
  const stepAt = new Int32Array(points);
  for (let c = 0; c < points; c++) stepAt[c] = Math.round((c * steps) / (points - 1));

  const keep = cfg.keepPaths !== false;
  const paths = keep ? new Float32Array(runs * points) : null;
  const ends = new Uint16Array(runs);
  const status = new Uint8Array(runs);
  const final = new Float32Array(runs);
  const maxDD = new Float32Array(runs);
  const streak = new Uint16Array(runs);
  const stopStep = new Uint32Array(runs);

  const start = cfg.balance;
  const target = cfg.targetPct > 0 ? start * (1 + cfg.targetPct / 100) : Infinity;
  const floor = cfg.limitPct > 0 ? start * (1 - cfg.limitPct / 100) : -Infinity;
  const { model, pools, risk } = cfg;
  const pBE = Math.min(1, Math.max(0, model.beRate));
  const pWin = (1 - pBE) * Math.min(1, Math.max(0, model.winRate));
  const wins = pools.wins;
  const losses = pools.losses;
  const winScale = risk * model.avgWinR;
  const lossScale = risk * model.avgLossR;
  const seed = cfg.seed >>> 0;

  let done = 0;

  const runOne = (i: number) => {
    // mulberry32, une graine par tirage (variables aléatoires communes).
    let a = (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
    const rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    let bal = start;
    let peak = start;
    let dd = 0;
    let run = 0;
    let worstRun = 0;
    let outcome = OUTCOME_OPEN;
    let stop = steps;
    let next = 1;
    const base = i * points;
    if (paths) paths[base] = bal;

    for (let s = 1; s <= steps; s++) {
      // Deux hasards par trade, toujours : la suite reste alignée d'un
      // scénario à l'autre, quelle que soit l'issue du trade.
      const u = rnd();
      const v = rnd();
      let pnl = 0;
      if (u < pBE) pnl = 0;
      else if (u < pBE + pWin) pnl = wins[Math.floor(v * wins.length)] * winScale;
      else pnl = -losses[Math.floor(v * losses.length)] * lossScale;
      bal += pnl;

      if (pnl < 0) {
        run++;
        if (run > worstRun) worstRun = run;
      } else run = 0;
      if (bal > peak) peak = bal;
      else if (peak - bal > dd) dd = peak - bal;

      if (bal >= target) {
        outcome = OUTCOME_PASSED;
        stop = s;
        break;
      }
      if (bal <= floor) {
        outcome = OUTCOME_FAILED;
        stop = s;
        break;
      }
      if (paths && s === stepAt[next]) {
        paths[base + next] = bal;
        next++;
      }
    }

    if (outcome !== OUTCOME_OPEN) {
      // Le solde d'arrêt est posé au premier instant qui suit, et répété
      // ensuite : la courbe finit SUR le mur, les percentiles gardent le
      // compte à son dernier solde.
      if (paths) for (let c = next; c < points; c++) paths[base + c] = bal;
      ends[i] = Math.min(next, points - 1);
    } else ends[i] = points - 1;

    status[i] = outcome;
    final[i] = bal;
    maxDD[i] = dd;
    streak[i] = worstRun;
    stopStep[i] = stop;
  };

  return {
    cfg,
    steps,
    points,
    stepAt,
    paths,
    ends,
    status,
    final,
    maxDD,
    streak,
    stopStep,
    target,
    floor,
    get done() {
      return done;
    },
    get finished() {
      return done >= runs;
    },
    advance(count: number) {
      const to = Math.min(runs, done + Math.max(1, Math.floor(count)));
      for (let i = done; i < to; i++) runOne(i);
      done = to;
    },
  };
}

/** Calcule tout d'un bloc — pour les tests et les petits tirages. */
export function simulateAll(cfg: SimConfig): Simulation {
  const sim = createSimulation(cfg);
  sim.advance(cfg.runs);
  return sim;
}

export interface Quantiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

/** Rang `floor(q × (n − 1))` d'un tableau trié — la convention du premier moteur. */
const at = (sorted: ArrayLike<number>, q: number) =>
  sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];

export function quantiles(values: ArrayLike<number>): Quantiles {
  const s = Float64Array.from(values).sort();
  return { p5: at(s, 0.05), p25: at(s, 0.25), p50: at(s, 0.5), p75: at(s, 0.75), p95: at(s, 0.95) };
}

export interface SimSummary {
  runs: number;
  passRate: number;
  failRate: number;
  openRate: number;
  /** Part des comptes qui finissent au-dessus du solde de départ. */
  profitRate: number;
  /** Erreur type du taux d'objectif : √(p(1−p)/N). */
  se: number;
  final: Quantiles;
  /** Pire baisse depuis un sommet, en devise. */
  dd: Quantiles;
  streak: Quantiles;
  /** Jours pour atteindre l'objectif, parmi les comptes qui l'atteignent. */
  daysToTarget: Quantiles | null;
}

/** Les issues et leurs distributions — quelques tris, aucune trajectoire relue. */
export function summarize(sim: Simulation): SimSummary {
  const n = sim.done;
  let pass = 0;
  let fail = 0;
  let profit = 0;
  const tpd = Math.max(1, Math.round(sim.cfg.tradesPerDay));
  const passDays: number[] = [];
  for (let i = 0; i < n; i++) {
    if (sim.status[i] === OUTCOME_PASSED) {
      pass++;
      passDays.push(Math.ceil(sim.stopStep[i] / tpd));
    } else if (sim.status[i] === OUTCOME_FAILED) fail++;
    if (sim.final[i] > sim.cfg.balance) profit++;
  }
  const rate = (k: number) => (n > 0 ? k / n : 0);
  const passRate = rate(pass);
  return {
    runs: n,
    passRate,
    failRate: rate(fail),
    openRate: rate(n - pass - fail),
    profitRate: rate(profit),
    se: n > 0 ? Math.sqrt((passRate * (1 - passRate)) / n) : 0,
    final: quantiles(sim.final.subarray(0, n)),
    dd: quantiles(sim.maxDD.subarray(0, n)),
    streak: quantiles(sim.streak.subarray(0, n)),
    daysToTarget: passDays.length > 0 ? quantiles(passDays) : null,
  };
}

/**
 * LE FAISCEAU EN CHIFFRES — à chaque instant, sur TOUS les tirages : les cinq
 * percentiles du solde, la part des comptes au-dessus du départ, et la part
 * déjà arrivée à l'objectif ou à la limite.
 */
export interface Bands {
  p5: Float32Array;
  p25: Float32Array;
  p50: Float32Array;
  p75: Float32Array;
  p95: Float32Array;
  /** Part des comptes au-dessus du solde de départ. */
  above: Float32Array;
  /** Part des comptes arrivés à l'objectif à cet instant ou avant. */
  passedBy: Float32Array;
  /** Part des comptes arrivés à la limite à cet instant ou avant. */
  failedBy: Float32Array;
  /** Instants déjà calculés (les percentiles se calculent par tranches). */
  ready: number;
}

export function createBands(sim: Simulation): Bands {
  const P = sim.points;
  const n = sim.done;
  const passedBy = new Float32Array(P);
  const failedBy = new Float32Array(P);
  for (let i = 0; i < n; i++) {
    if (sim.status[i] === OUTCOME_PASSED) passedBy[sim.ends[i]]++;
    else if (sim.status[i] === OUTCOME_FAILED) failedBy[sim.ends[i]]++;
  }
  for (let c = 1; c < P; c++) {
    passedBy[c] += passedBy[c - 1];
    failedBy[c] += failedBy[c - 1];
  }
  for (let c = 0; c < P; c++) {
    passedBy[c] /= Math.max(1, n);
    failedBy[c] /= Math.max(1, n);
  }
  return {
    p5: new Float32Array(P),
    p25: new Float32Array(P),
    p50: new Float32Array(P),
    p75: new Float32Array(P),
    p95: new Float32Array(P),
    above: new Float32Array(P),
    passedBy,
    failedBy,
    ready: 0,
  };
}

/** Calcule les `count` instants suivants des percentiles (un tri par instant). */
export function advanceBands(sim: Simulation, bands: Bands, count: number): void {
  const paths = sim.paths;
  if (!paths) return;
  const P = sim.points;
  const n = sim.done;
  const col = new Float32Array(n);
  const start = sim.cfg.balance;
  const to = Math.min(P, bands.ready + Math.max(1, count));
  for (let c = bands.ready; c < to; c++) {
    let above = 0;
    for (let i = 0; i < n; i++) {
      const v = paths[i * P + c];
      col[i] = v;
      if (v > start) above++;
    }
    col.sort();
    bands.p5[c] = at(col, 0.05);
    bands.p25[c] = at(col, 0.25);
    bands.p50[c] = at(col, 0.5);
    bands.p75[c] = at(col, 0.75);
    bands.p95[c] = at(col, 0.95);
    bands.above[c] = n > 0 ? above / n : 0;
  }
  bands.ready = to;
}

/** Le jour (1…horizon) d'un numéro de trade. */
export const dayOfStep = (step: number, tradesPerDay: number) =>
  Math.ceil(step / Math.max(1, Math.round(tradesPerDay)));

/**
 * LES NIVEAUX DE RISQUE ÉPROUVÉS, en % du solde : une grille fixe de 0,25 % à
 * 5 %, plus le risque actuel — pour que le point « tu es ici » soit un vrai
 * point calculé, pas une interpolation.
 */
export function riskLevels(currentPct: number): number[] {
  const grid = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
  const cur = Math.round(currentPct * 100) / 100;
  const all = grid.some((g) => Math.abs(g - cur) < 0.01) || cur <= 0 ? grid : [...grid, cur];
  return all.sort((a, b) => a - b);
}

export interface RiskPoint {
  riskPct: number;
  pass: number;
  fail: number;
  profit: number;
}

/** Le niveau de risque qui maximise l'objectif — à égalité, le plus prudent. */
export function bestRisk(points: RiskPoint[]): RiskPoint | null {
  let best: RiskPoint | null = null;
  for (const p of points) if (!best || p.pass > best.pass + 1e-9) best = p;
  return best;
}
