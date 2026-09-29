import { describe, expect, test } from "bun:test";
import { runMonteCarlo, extractRSamples, type MonteCarloParams } from "../src/app/utils/monteCarlo";
import {
  pathBands,
  samplePaths,
  chartRows,
  drawdownStats,
  streakStats,
  probabilityOfProfit,
  histogram,
  rHistogram,
} from "../src/app/utils/monteCarloViz";

const trades = [
  ...Array.from({ length: 30 }, () => ({ pnl: 200, rMultiple: 2, direction: "long" as const })),
  ...Array.from({ length: 40 }, () => ({ pnl: -100, rMultiple: -1, direction: "short" as const })),
  ...Array.from({ length: 5 }, () => ({ pnl: 0, rMultiple: 0, direction: "be" as const })),
];
const params: MonteCarloParams = {
  startingBalance: 10_000,
  profitTarget: 1_000,
  maxDrawdown: 1_000,
  maxDailyLoss: 0,
  trailingDrawdown: false,
  maxTradingDays: 30,
  maxTradesPerDay: 2,
  riskPerTrade: 100,
  simulations: 500,
  seed: 42,
};
const samples = extractRSamples(trades);
const result = runMonteCarlo(params, samples);

describe("Monte-Carlo : ce que le graphe montre est calculé", () => {
  test("les percentiles partent tous du solde de départ et restent ordonnés", () => {
    const bands = pathBands(result);
    expect(bands[0]).toMatchObject({ step: 0, p5: 10_000, p50: 10_000, p95: 10_000 });
    for (const b of bands) {
      expect(b.p5).toBeLessThanOrEqual(b.p25);
      expect(b.p25).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p75);
      expect(b.p75).toBeLessThanOrEqual(b.p95);
    }
  });

  test("la médiane finale du faisceau est celle du moteur", () => {
    const bands = pathBands(result, 1000);
    const last = bands[bands.length - 1];
    // Le moteur prend p50 sur les soldes finaux ; au dernier pas, chaque tirage
    // arrêté a gardé son dernier solde — c'est donc la même population.
    expect(last.p50).toBe(result.finalBalanceDistribution.p50);
  });

  test("les trajectoires sont de vrais tirages, du pire au meilleur", () => {
    const paths = samplePaths(result, 10);
    expect(paths).toHaveLength(10);
    const finals = paths.map((p) => p.equity[p.equity.length - 1]);
    expect(finals).toEqual([...finals].sort((a, b) => a - b));
    const worst = Math.min(...result.runs.map((r) => r.finalBalance));
    expect(finals[0]).toBe(worst);
    for (const p of paths) expect(result.runs.some((r) => r.equity === p.equity)).toBe(true);
  });

  test("un tirage arrêté s'interrompt dans le graphe au lieu de tracer un palier", () => {
    const bands = pathBands(result, 400);
    const paths = samplePaths(result, 5);
    const rows = chartRows(bands, paths);
    const shortest = paths.reduce((m, p) => (p.equity.length < m.equity.length ? p : m));
    const idx = paths.indexOf(shortest);
    const after = rows.filter((r) => (r.step as number) >= shortest.equity.length);
    if (after.length) expect(after.every((r) => r[`t${idx}`] === null)).toBe(true);
  });

  test("drawdown, séries perdantes et probabilité de profit sont cohérents", () => {
    const dd = drawdownStats(result);
    expect(dd.values).toHaveLength(result.runs.length);
    expect(dd.amount.p50).toBeGreaterThanOrEqual(0);
    expect(dd.amount.p95).toBeGreaterThanOrEqual(dd.amount.p50);
    const st = streakStats(result);
    expect(st.p95).toBeGreaterThanOrEqual(st.p50);
    const pp = probabilityOfProfit(result);
    expect(pp).toBeGreaterThan(0);
    expect(pp).toBeLessThanOrEqual(1);
  });

  test("les classes comptent chaque valeur une fois, hors-plage compris", () => {
    const h = histogram([-10, 0, 1, 2, 99], 0, 4, 4);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(5);
    expect(h[0].count).toBe(2);
    expect(h[3].count).toBe(1);
    const rh = rHistogram(samples);
    expect(rh.reduce((s, b) => s + b.count, 0)).toBe(samples.length);
  });
});
