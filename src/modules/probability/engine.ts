/**
 * Moteur Monte Carlo — module PUR, sans React, sans IO, seedable.
 *
 * ── LA MÉTHODE : BOOTSTRAP, PAS SIMULATION PARAMÉTRIQUE ────────────────────
 * On rééchantillonne AVEC REMISE les résultats réels du trader, en tirant
 * l'ordre au hasard. On ne suppose ni loi normale, ni « gain moyen ± écart
 * type ».
 *
 * C'est un choix de fond. Une distribution de P&L de trading n'est jamais
 * normale : elle est asymétrique, à queue épaisse, et le trader a souvent
 * deux ou trois résultats extrêmes qui portent l'essentiel de son
 * expectancy. Tirer dans une gaussienne calibrée sur la moyenne et l'écart
 * type effacerait précisément ces extrêmes — ceux qui déterminent s'il touche
 * son drawdown. Le bootstrap les conserve, avec leur fréquence réelle.
 *
 * Ce que le bootstrap suppose, en revanche, et qu'il faut dire au trader :
 * que ses trades futurs ressembleront aux passés, et qu'ils sont
 * indépendants. La seconde hypothèse est la plus discutable — un trader en
 * tilt enchaîne les pertes, ce que le tirage aléatoire disperse. La
 * simulation tend donc à SOUS-ESTIMER les séries de pertes d'un trader
 * indiscipliné. C'est documenté dans l'UI, pas caché.
 *
 * ── PERFORMANCE ────────────────────────────────────────────────────────────
 * 25 000 trajectoires × 100 trades = 2,5 millions d'itérations. Les résultats
 * sont stockés dans des `Float64Array` (pas des tableaux d'objets), l'état de
 * compte est muté en place, et aucune trajectoire complète n'est conservée
 * sauf pour l'échantillon d'affichage. Le coût dominant devient l'arithmétique
 * elle-même, pas les allocations.
 *
 * ── VERSION DU MOTEUR ──────────────────────────────────────────────────────
 * Chaque résultat porte `engineVersion`. Une simulation sauvegardée il y a
 * six mois doit rester interprétable même si la méthode a changé depuis :
 * sans ce marqueur, on comparerait des chiffres produits par deux
 * algorithmes différents sans le savoir.
 */

import { makeRng, randomIndex, type Rng } from "./rng";
import { scaleRisk, type SimDataset, type SimTrade } from "./dataset";
import { applyTrade, closeDay, initState, type AccountRules, type FailReason } from "./rules";

/** Identifie la méthode ayant produit un résultat. À incrémenter dès que la
 *  façon de simuler change, jamais pour une correction de bug d'affichage. */
export const ENGINE_VERSION = "bootstrap_v1";

export interface SimulationConfig {
  rules: AccountRules;
  /** Nombre de trades joués par trajectoire, au maximum. */
  tradesPerPath: number;
  /** Trades par jour de bourse — découpe la trajectoire en journées, ce dont
   *  dépendent la perte journalière et le trailing EOD. */
  tradesPerDay: number;
  /** Nombre de trajectoires. */
  runs: number;
  /** Multiplicateur de risque : 0,5 = « je risque la moitié ». */
  riskMultiplier?: number;
  /** Arrête la journée après N pertes — la règle « stop après 2 pertes »,
   *  simulée telle qu'elle est écrite dans le Risk Guard. */
  stopAfterLosses?: number | null;
  /** Graine. Deux appels avec la même graine donnent le même résultat. */
  seed: number;
}

export interface SimulationResult {
  engineVersion: string;
  seed: number;
  runs: number;
  /** Taille de l'échantillon historique rééchantillonné. */
  sampleSize: number;

  /** 0..1 — part des trajectoires ayant atteint l'objectif. */
  passProbability: number;
  /** 0..1 — part ayant enfreint une règle. */
  failProbability: number;
  /** 0..1 — part encore ouverte à la fin de l'horizon (ni gagné ni perdu). */
  openProbability: number;
  /** 0..1 — part ayant touché le drawdown maximal. Sous-ensemble des échecs :
   *  un échec pour perte journalière ou délai n'est PAS une ruine. */
  riskOfRuin: number;
  /** Décompte par cause d'échec — dit au trader CE QUI le fait échouer. */
  failReasons: Record<Exclude<FailReason, null>, number>;

  /** Distribution du P&L final, en devise. */
  pnl: Distribution;
  /** Distribution du drawdown maximal atteint, en devise (valeurs positives). */
  drawdown: Distribution;
  /** Jours nécessaires pour valider, sur les seules trajectoires gagnantes.
   *  `null` si aucune n'a validé. */
  daysToTarget: Distribution | null;

  /** Quelques trajectoires représentatives, pour le graphique. */
  samplePaths: number[][];
}

/** Percentiles d'une série. Les extrêmes sont donnés en P5/P95 et non en
 *  min/max : un minimum est un accident de tirage, pas un scénario. */
export interface Distribution {
  p5: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  mean: number;
}

/** Percentile par interpolation linéaire sur une série DÉJÀ triée. */
export function percentile(sorted: Float64Array | number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function describe(values: Float64Array): Distribution {
  const sorted = Float64Array.from(values).sort();
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) sum += sorted[i];
  return {
    p5: percentile(sorted, 0.05),
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    mean: sorted.length ? sum / sorted.length : 0,
  };
}

/** Le résultat neutre d'un dataset vide : que des zéros, aucune probabilité
 *  inventée. Sans lui, un journal vide produirait des NaN qui remonteraient
 *  jusqu'à l'écran. */
function emptyResult(config: SimulationConfig): SimulationResult {
  const zero: Distribution = {
    p5: 0,
    p10: 0,
    p25: 0,
    median: 0,
    p75: 0,
    p90: 0,
    p95: 0,
    mean: 0,
  };
  return {
    engineVersion: ENGINE_VERSION,
    seed: config.seed,
    runs: 0,
    sampleSize: 0,
    passProbability: 0,
    failProbability: 0,
    openProbability: 0,
    riskOfRuin: 0,
    failReasons: { maxDrawdown: 0, dailyLoss: 0, maxTradingDays: 0, consistency: 0 },
    pnl: zero,
    drawdown: zero,
    daysToTarget: null,
    samplePaths: [],
  };
}

/** Combien de trajectoires on conserve entièrement pour le graphique. Au-delà,
 *  le rendu devient illisible et la mémoire inutilement occupée. */
const SAMPLE_PATHS = 40;

/**
 * Lance la simulation.
 *
 * Purement calculatoire : aucun accès réseau, aucune dépendance React, aucun
 * appel à un LLM. Le même `seed` et la même configuration rendent exactement
 * le même résultat, ce qui rend la fonction testable et le résultat
 * reproductible.
 */
export function runSimulation(dataset: SimDataset, config: SimulationConfig): SimulationResult {
  const pool = dataset.trades;
  if (pool.length === 0 || config.runs <= 0 || config.tradesPerPath <= 0) {
    return emptyResult(config);
  }

  const rng: Rng = makeRng(config.seed);
  const riskMul = config.riskMultiplier ?? 1;
  const perDay = Math.max(1, Math.round(config.tradesPerDay));
  const stopAfter = config.stopAfterLosses ?? null;

  const finalPnl = new Float64Array(config.runs);
  const maxDd = new Float64Array(config.runs);
  const daysWon: number[] = [];
  const paths: number[][] = [];

  let passed = 0;
  let failed = 0;
  const reasons = { maxDrawdown: 0, dailyLoss: 0, maxTradingDays: 0, consistency: 0 };

  for (let run = 0; run < config.runs; run++) {
    const state = initState(config.rules);
    const keepPath = run < SAMPLE_PATHS;
    const path: number[] = keepPath ? [state.balance] : [];

    let inDay = 0;
    let lossesToday = 0;

    for (let i = 0; i < config.tradesPerPath && state.outcome === "open"; i++) {
      const drawn: SimTrade = pool[randomIndex(rng, pool.length)];
      const pnl = scaleRisk(drawn, riskMul).pnl;

      applyTrade(state, pnl, config.rules);
      if (keepPath) path.push(state.balance);
      if (pnl < 0) lossesToday++;

      inDay++;
      // Fin de journée : par nombre de trades, ou parce que la règle « stop
      // après N pertes » a été atteinte — dans ce cas le trader arrête, il ne
      // continue pas jusqu'au quota du jour.
      const dayOver = inDay >= perDay || (stopAfter !== null && lossesToday >= stopAfter);
      if (dayOver) {
        closeDay(state, config.rules);
        inDay = 0;
        lossesToday = 0;
      }
    }

    // La journée en cours est close pour que ses trades comptent dans le
    // décompte des jours et dans la règle de consistance.
    if (inDay > 0) closeDay(state, config.rules);

    finalPnl[run] = state.balance - config.rules.startingBalance;
    maxDd[run] = state.maxDrawdown;
    if (state.outcome === "passed") {
      passed++;
      daysWon.push(state.tradingDays);
    } else if (state.outcome === "failed") {
      failed++;
      if (state.failReason) reasons[state.failReason]++;
    }
    if (keepPath) paths.push(path);
  }

  const runs = config.runs;
  const daysSorted = daysWon.length ? Float64Array.from(daysWon).sort() : null;

  return {
    engineVersion: ENGINE_VERSION,
    seed: config.seed,
    runs,
    sampleSize: pool.length,
    passProbability: passed / runs,
    failProbability: failed / runs,
    openProbability: (runs - passed - failed) / runs,
    // La ruine est le drawdown maximal touché, et RIEN d'autre. L'amalgamer
    // aux autres causes d'échec gonflerait le chiffre le plus anxiogène de
    // l'écran avec des dépassements de délai, qui ne coûtent pas le compte.
    riskOfRuin: reasons.maxDrawdown / runs,
    failReasons: reasons,
    pnl: describe(finalPnl),
    drawdown: describe(maxDd),
    daysToTarget: daysSorted ? describe(daysSorted) : null,
    samplePaths: paths,
  };
}
