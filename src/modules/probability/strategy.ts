import { measuredR, type RiskSource } from "@/domain/trade";
import { easternClockOf } from "@/domain/easternClock";
import { percentile } from "./engine";
import { makeRng } from "./rng";
import { applyTrade, closeDay, initState, type DrawdownType } from "./rules";

/** Laboratoire de stratégie : un historique ou une hypothèse explicite.
 * La projection complète et le compte soumis à des barrières partagent les
 * MÊMES tirages. Leurs distributions restent distinctes : atteindre une cible
 * n'écrête jamais silencieusement la projection de la stratégie. */
export const STRATEGY_VERSION = "strategy_projection_v1";
export const STRATEGY_RUNS = 10_000;
export interface StrategyMetrics {
  winRate: number; // parmi les trades décisifs
  avgWinR: number;
  avgLossR: number;
  breakEvenRate: number;
}
export interface StrategyModel {
  kind: "historical" | "planned";
  values: number[];
  /**
   * Les mêmes valeurs regroupées par SÉANCE (jour de New York de l'instant
   * prouvé, sinon date du journal), dans l'ordre reçu — base du tirage par
   * blocs (mode C). Absent pour une hypothèse ou un fichier sans dates.
   */
  sessions?: number[][];
  metrics: StrategyMetrics;
  sampleSize: number;
  estimated: number;
  excluded: number;
}
export interface StrategyConfig {
  balance: number;
  risk: number; // montant fixe, pas un pourcentage composé
  trades: number;
  perDay: number;
  extraCost: number; // coût ADDITIONNEL ; l'historique contient déjà ses frais
  target: number;
  lossLimit: number;
  dailyLimit: number;
  drawdownType: DrawdownType;
  seed: number;
  /**
   * Unité de tirage : `trade` (mode A, trades indépendants — défaut) ou
   * `session` (mode C, séances entières : la dépendance au sein d'une journée
   * est conservée, l'échantillon effectif devient le nombre de séances).
   */
  sampling?: "trade" | "session";
  /** Stress (mode B) : part retirée à chaque gain, 0–0,5. Une hypothèse, pas une prévision. */
  winHaircut?: number;
}
export interface ProjectionBand {
  step: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}
export interface StrategyProjection {
  version: string;
  runs: number;
  config: StrategyConfig;
  model: StrategyModel;
  points: number[];
  // Pas de 10 000 arbres SVG : les trajectoires restent dans un tampon transférable.
  paths: Float64Array;
  drawdownPaths: Float64Array;
  capital: ProjectionBand[];
  drawdowns: ProjectionBand[];
  objectives: ProjectionBand[];
  objectiveStops: Uint16Array;
  objectiveBalances: Float64Array;
  outcomes: Uint8Array; // 0 = ouvert, 1 = cible avant limite, 2 = limite avant cible
  finalPnl: number[];
  maxDrawdowns: number[];
  lossStreaks: number[];
  profitProbability: number;
  passProbability: number;
  failProbability: number;
  openProbability: number;
  medianTargetTrades: number | null;
  netExpectancyR: number;
  netProfitFactor: number | null;
  breakEvenWinRate: number | null;
  longestStreak95: number;
  drawdown95: number;
  medianPnl: number;
  mcInterval95: { low: number; high: number };
  drawdownExceedance: { amount: number; probability: number }[];
  /** Ce qui a été tiré, et combien d'observations INDÉPENDANTES le portent. */
  samplingUnit: "trade" | "session";
  effectiveSample: number;
  /**
   * `closed_trade` quand le drawdown suiveur est calculé sur les soldes après
   * chaque trade clôturé — une approximation plus clémente qu'une règle de
   * firme fondée sur le plus haut latent. `null` sinon.
   */
  trailingBasis: "closed_trade" | null;
}

/** Le R NET réel vient de la définition UNIQUE du produit (`measuredR` :
 * P&L / risque initial, refusé pour un import non relu ou un risque broker
 * forfaitaire). Sans R mesuré, la perte médiane sert seulement d'unité
 * estimée, marquée comme telle (`estimated`), jamais de R mesuré.
 * Les lignes non finies, les exemples mêlés au réel et les résultats sans
 * échelle exploitable ne deviennent pas des zéros artificiels. */
export function historicalModel(
  trades: readonly {
    pnl: number;
    riskAmount?: number | null;
    rMultiple?: number;
    isExample?: boolean;
    broker?: string | null;
    reviewPending?: boolean;
    riskSource?: RiskSource | null;
    date?: string;
    entryAt?: string | null;
  }[],
): StrategyModel {
  const real = trades.some((t) => !t.isExample) ? trades.filter((t) => !t.isExample) : trades;
  const losses = real
    .filter((t) => Number.isFinite(t.pnl) && t.pnl < 0)
    .map((t) => -t.pnl)
    .sort((a, b) => a - b);
  const unit = losses.length ? percentile(losses, 0.5) : 0;
  const values: number[] = [];
  const bySession = new Map<string, number[]>();
  let estimated = 0;
  for (const t of real) {
    if (!Number.isFinite(t.pnl)) continue;
    let r: number;
    const measured = measuredR({
      pnl: t.pnl,
      riskAmount: t.riskAmount ?? 0,
      broker: t.broker ?? null,
      reviewPending: !!t.reviewPending,
      riskSource: t.riskSource ?? null,
    });
    if (measured !== null) r = measured;
    // Un R DÉCLARÉ à la main (saisie, sans risque) compte ; celui d'un import
    // broker ou non relu n'est qu'un calcul sur un risque non attesté.
    else if (
      !t.broker &&
      !t.reviewPending &&
      t.rMultiple &&
      Number.isFinite(t.rMultiple) &&
      Math.sign(t.rMultiple) === Math.sign(t.pnl)
    )
      r = t.rMultiple;
    else if (t.pnl === 0) r = 0;
    else if (unit > 0) {
      r = t.pnl / unit;
      estimated++;
    } else continue;
    if (!Number.isFinite(r)) continue;
    values.push(r);
    const day = easternClockOf(t.entryAt)?.date ?? t.date;
    if (day) bySession.set(day, [...(bySession.get(day) ?? []), r]);
  }
  // Toutes les valeurs doivent avoir une séance pour qu'un tirage par blocs
  // ne perde rien en silence.
  const sessionsTotal = [...bySession.values()].reduce((n, v) => n + v.length, 0);
  return {
    kind: "historical",
    values,
    ...(sessionsTotal === values.length && bySession.size > 0
      ? { sessions: [...bySession.keys()].sort().map((k) => bySession.get(k)!) }
      : {}),
    metrics: metricsOf(values),
    sampleSize: values.length,
    estimated,
    excluded: trades.length - values.length,
  };
}

export function metricsOf(values: readonly number[]): StrategyMetrics {
  let wins = 0,
    losses = 0,
    gain = 0,
    loss = 0,
    be = 0;
  for (const r of values) {
    if (r > 0) {
      wins++;
      gain += r;
    } else if (r < 0) {
      losses++;
      loss -= r;
    } else be++;
  }
  return {
    winRate: wins + losses ? wins / (wins + losses) : 0,
    avgWinR: wins ? gain / wins : 0,
    avgLossR: losses ? loss / losses : 0,
    breakEvenRate: values.length ? be / values.length : 0,
  };
}

/** Hypothèse explicite : forme conditionnelle observée si disponible, sinon
 * trois issues fixes. Aucun échantillon synthétique ni variance inventée. */
export function plannedModel(
  metrics: StrategyMetrics,
  referenceValues: number[] = [],
): StrategyModel {
  if (
    ![metrics.winRate, metrics.avgWinR, metrics.avgLossR, metrics.breakEvenRate].every(
      Number.isFinite,
    ) ||
    metrics.winRate < 0 ||
    metrics.winRate > 1 ||
    metrics.breakEvenRate < 0 ||
    metrics.breakEvenRate > 1 ||
    metrics.avgWinR <= 0 ||
    metrics.avgLossR <= 0
  )
    throw new Error("INVALID_MODEL");
  return {
    kind: "planned",
    values: referenceValues.filter(Number.isFinite),
    metrics,
    sampleSize: referenceValues.filter(Number.isFinite).length,
    estimated: 0,
    excluded: 0,
  };
}

export function strategyEdge(
  model: StrategyModel,
  risk: number,
  extraCost: number,
  winHaircut = 0,
) {
  const keep = 1 - Math.min(0.5, Math.max(0, winHaircut));
  const m = { ...model.metrics, avgWinR: model.metrics.avgWinR * keep },
    decisive = 1 - m.breakEvenRate;
  const mean = decisive * (m.winRate * m.avgWinR - (1 - m.winRate) * m.avgLossR);
  const fee = risk > 0 ? extraCost / risk : 0;
  let gains = 0,
    losses = 0;
  const add = (r: number, p: number) => {
    const net = (r > 0 && model.kind === "historical" ? r * keep : r) - fee;
    if (net > 0) gains += net * p;
    else losses -= net * p;
  };
  if (model.kind === "historical") for (const r of model.values) add(r, 1 / model.values.length);
  else {
    const wins = model.values.filter((r) => r > 0),
      losing = model.values.filter((r) => r < 0);
    const aw = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 1;
    const al = losing.length ? -losing.reduce((a, b) => a + b, 0) / losing.length : 1;
    if (wins.length)
      for (const r of wins) add((r * m.avgWinR) / aw, (decisive * m.winRate) / wins.length);
    else add(m.avgWinR, decisive * m.winRate);
    if (losing.length)
      for (const r of losing)
        add((r * m.avgLossR) / al, (decisive * (1 - m.winRate)) / losing.length);
    else add(-m.avgLossR, decisive * (1 - m.winRate));
    add(0, m.breakEvenRate);
  }
  // Un seuil >100 % signifie « impossible avec ces coûts », pas 100 %.
  const threshold =
    decisive > 0 && m.avgWinR + m.avgLossR > 0
      ? (m.avgLossR + fee / decisive) / (m.avgWinR + m.avgLossR)
      : null;
  return {
    netExpectancyR: mean - fee,
    netProfitFactor: losses > 0 ? gains / losses : null,
    breakEvenWinRate: threshold,
  };
}

function bands(matrix: Float64Array, runs: number, points: number[]): ProjectionBand[] {
  const width = points.length,
    column = new Float64Array(runs),
    result: ProjectionBand[] = [];
  for (let j = 0; j < width; j++) {
    for (let i = 0; i < runs; i++) column[i] = matrix[i * width + j];
    column.sort();
    result.push({
      step: points[j],
      p5: percentile(column, 0.05),
      p25: percentile(column, 0.25),
      p50: percentile(column, 0.5),
      p75: percentile(column, 0.75),
      p95: percentile(column, 0.95),
    });
  }
  return result;
}

/** Intervalle de Wilson à 95 % sur la fréquence simulée seulement.
 * NIST, Engineering Statistics Handbook §7.2.4.1. Contrairement à ±1,96 SE,
 * il ne donne pas une fausse erreur nulle après 0 ou N succès. */
export function simulationInterval(successes: number, runs: number): { low: number; high: number } {
  if (
    !Number.isInteger(runs) ||
    runs <= 0 ||
    !Number.isInteger(successes) ||
    successes < 0 ||
    successes > runs
  )
    throw new Error("INVALID_COUNTS");
  const p = successes / runs,
    z2 = 1.96 ** 2,
    denom = 1 + z2 / runs,
    center = (p + z2 / (2 * runs)) / denom;
  const half = (1.96 * Math.sqrt((p * (1 - p)) / runs + z2 / (4 * runs * runs))) / denom;
  return {
    low: successes === 0 ? 0 : Math.max(0, center - half),
    high: successes === runs ? 1 : Math.min(1, center + half),
  };
}

/** Frontière commune au Worker et aux plans locaux restaurés. */
export function validStrategyConfig(value: unknown): value is StrategyConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as StrategyConfig;
  return (
    [
      c.balance,
      c.risk,
      c.trades,
      c.perDay,
      c.extraCost,
      c.target,
      c.lossLimit,
      c.dailyLimit,
      c.seed,
    ].every(Number.isFinite) &&
    c.balance >= 100 &&
    c.balance <= 1_000_000 &&
    c.risk > 0 &&
    c.risk <= c.balance &&
    c.extraCost >= 0 &&
    c.target > 0 &&
    c.lossLimit > 0 &&
    c.lossLimit <= c.balance &&
    c.dailyLimit >= 0 &&
    c.dailyLimit <= c.balance &&
    Number.isInteger(c.trades) &&
    c.trades >= 1 &&
    c.trades <= 1000 &&
    Number.isInteger(c.perDay) &&
    c.perDay >= 1 &&
    c.perDay <= 10 &&
    ["static", "trailing", "trailingEod"].includes(c.drawdownType) &&
    (c.sampling === undefined || c.sampling === "trade" || c.sampling === "session") &&
    (c.winHaircut === undefined ||
      (Number.isFinite(c.winHaircut) && c.winHaircut >= 0 && c.winHaircut <= 0.5))
  );
}

/** Minimum de séances pour un tirage par blocs : en dessous, le moteur
 *  rééchantillonnerait quelques journées et passerait pour représentatif. */
export const MIN_SESSION_BLOCKS = 10;

/** Calcul entièrement hors du fil d'affichage. Tous les pas sont simulés ;
 * seul le tampon de dessin est décimé (121 abscisses au maximum).
 * Chaque trajectoire tire le même nombre d'uniformes, barrières atteintes ou
 * non : changer le risque conserve les mêmes séquences pour comparer. */
export function projectStrategy(
  model: StrategyModel,
  config: StrategyConfig,
  runs = STRATEGY_RUNS,
): StrategyProjection {
  const c = config;
  if (
    !validStrategyConfig(c) ||
    !Number.isInteger(runs) ||
    runs < 1 ||
    runs > STRATEGY_RUNS ||
    (model.kind === "historical" &&
      (model.values.length < 5 || model.values.some((r) => !Number.isFinite(r))))
  )
    throw new Error("INVALID_PROJECTION");
  if (model.kind === "planned") plannedModel(model.metrics);
  const bySession = c.sampling === "session";
  if (bySession && (!model.sessions || model.sessions.length < MIN_SESSION_BLOCKS))
    throw new Error("INSUFFICIENT_SESSIONS");
  const keep = 1 - (c.winHaircut ?? 0);
  const possible =
    model.kind === "historical"
      ? model.values
      : [model.metrics.avgWinR, -model.metrics.avgLossR, ...model.values];
  if (
    possible.some((r) => !Number.isFinite(r * c.risk * c.trades)) ||
    !Number.isFinite(c.extraCost * c.trades)
  )
    throw new Error("INVALID_PROJECTION");
  const rng = makeRng(c.seed),
    steps = c.trades;
  const pool = [...model.values].sort((a, b) => a - b);
  const gains = pool.filter((r) => r > 0),
    losses = pool.filter((r) => r < 0);
  const gainMean = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 1;
  const lossMean = losses.length ? -losses.reduce((a, b) => a + b, 0) / losses.length : 1;
  const points = Array.from(
    new Set(
      Array.from({ length: Math.min(steps + 1, 121) }, (_, i) =>
        Math.round((i * steps) / Math.min(steps, 120)),
      ),
    ),
  );
  const width = points.length;
  const paths = new Float64Array(runs * width),
    ddPaths = new Float64Array(runs * width),
    objectivePaths = new Float64Array(runs * width);
  const stops = new Uint16Array(runs),
    objectiveBalances = new Float64Array(runs),
    outcomes = new Uint8Array(runs);
  const finalPnl: number[] = [],
    maxDrawdowns: number[] = [],
    streaks: number[] = [],
    targetTrades: number[] = [];
  let positive = 0,
    passed = 0,
    failed = 0;
  const rules = {
    startingBalance: c.balance,
    profitTarget: c.target,
    maxDrawdown: c.lossLimit,
    drawdownType: c.drawdownType,
    dailyLossLimit: c.dailyLimit || null,
  };
  for (let run = 0; run < runs; run++) {
    const account = initState(rules);
    let equity = c.balance,
      peak = c.balance,
      maxDD = 0,
      streak = 0,
      maxStreak = 0,
      col = 1;
    const offset = run * width;
    paths[offset] = c.balance;
    objectivePaths[offset] = c.balance;
    stops[run] = steps;
    // Mode C : une séance tirée est jouée en entier, dans son ordre, puis la
    // journée est close — la fréquence journalière est celle de l'historique.
    let block: number[] = [];
    let blockAt = 0;
    for (let step = 1; step <= steps; step++) {
      let r: number;
      if (bySession) {
        if (blockAt >= block.length) {
          if (step > 1 && account.outcome === "open") closeDay(account, rules);
          block = model.sessions![Math.floor(rng() * model.sessions!.length)];
          blockAt = 0;
        }
        r = block[blockAt++];
      } else if (model.kind === "historical") {
        const u = rng(); // une seule source aléatoire pour le modèle entier
        r = pool[Math.floor(u * pool.length)];
      } else {
        const u = rng();
        const m = model.metrics;
        const lossP = (1 - m.breakEvenRate) * (1 - m.winRate),
          winP = (1 - m.breakEvenRate) * m.winRate;
        if (u < lossP) {
          const ratio = u / lossP;
          r = losses.length
            ? (losses[Math.min(losses.length - 1, Math.floor(ratio * losses.length))] *
                m.avgLossR) /
              lossMean
            : -m.avgLossR;
        } else if (u < lossP + m.breakEvenRate) r = 0;
        else {
          const ratio = winP > 0 ? (u - lossP - m.breakEvenRate) / winP : 0;
          r = gains.length
            ? (gains[Math.min(gains.length - 1, Math.floor(ratio * gains.length))] * m.avgWinR) /
              gainMean
            : m.avgWinR;
        }
      }
      const pnl = c.risk * (r > 0 ? r * keep : r) - c.extraCost;
      // La projection est arithmétique à risque fixe. Pas de composition ni
      // de marge implicite ; la vue Objectif est celle qui applique l'arrêt.
      equity += pnl;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
      streak = pnl < 0 ? streak + 1 : 0;
      if (streak > maxStreak) maxStreak = streak;
      if (account.outcome === "open") {
        applyTrade(account, pnl, rules);
        if (account.outcome !== "open") stops[run] = step;
        if (!bySession && step % c.perDay === 0) closeDay(account, rules);
      }
      if (points[col] === step) {
        paths[offset + col] = equity;
        ddPaths[offset + col] = dd;
        objectivePaths[offset + col] = account.balance;
        col++;
      }
    }
    if (account.outcome === "passed") {
      passed++;
      outcomes[run] = 1;
      targetTrades.push(stops[run]);
    } else if (account.outcome === "failed") {
      failed++;
      outcomes[run] = 2;
    }
    objectiveBalances[run] = account.balance;
    finalPnl.push(equity - c.balance);
    maxDrawdowns.push(maxDD);
    streaks.push(maxStreak);
    if (equity > c.balance) positive++;
  }
  finalPnl.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);
  streaks.sort((a, b) => a - b);
  targetTrades.sort((a, b) => a - b);
  const profit = positive / runs;
  const max = Math.max(c.lossLimit, percentile(maxDrawdowns, 0.99), c.risk);
  const exceedance = Array.from({ length: 31 }, (_, i) => {
    const amount = (max * i) / 30;
    let lo = 0,
      hi = maxDrawdowns.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (maxDrawdowns[mid] < amount) lo = mid + 1;
      else hi = mid;
    }
    return { amount, probability: (runs - lo) / runs };
  });
  return {
    version: STRATEGY_VERSION,
    runs,
    config: c,
    model,
    points,
    paths,
    drawdownPaths: ddPaths,
    capital: bands(paths, runs, points),
    drawdowns: bands(ddPaths, runs, points),
    objectives: bands(objectivePaths, runs, points),
    objectiveStops: stops,
    objectiveBalances,
    outcomes,
    finalPnl,
    maxDrawdowns,
    lossStreaks: streaks,
    profitProbability: profit,
    passProbability: passed / runs,
    failProbability: failed / runs,
    openProbability: (runs - passed - failed) / runs,
    medianTargetTrades: targetTrades.length ? percentile(targetTrades, 0.5) : null,
    ...strategyEdge(model, c.risk, c.extraCost, c.winHaircut ?? 0),
    longestStreak95: percentile(streaks, 0.95),
    drawdown95: percentile(maxDrawdowns, 0.95),
    medianPnl: percentile(finalPnl, 0.5),
    mcInterval95: simulationInterval(positive, runs),
    drawdownExceedance: exceedance,
    samplingUnit: bySession ? "session" : "trade",
    effectiveSample: bySession ? model.sessions!.length : model.values.length,
    trailingBasis: c.drawdownType === "trailing" ? "closed_trade" : null,
  };
}
