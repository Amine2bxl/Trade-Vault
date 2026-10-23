import { describe, expect, test } from "bun:test";
import {
  historicalModel,
  plannedModel,
  projectStrategy,
  strategyEdge,
  validStrategyConfig,
  simulationInterval,
  type StrategyConfig,
} from "../strategy";

const config: StrategyConfig = {
  balance: 10000,
  risk: 100,
  trades: 30,
  perDay: 2,
  extraCost: 0,
  target: 1000,
  lossLimit: 1000,
  dailyLimit: 0,
  drawdownType: "static",
  seed: 7182,
};
const metrics = { winRate: 0.5, avgWinR: 2, avgLossR: 1, breakEvenRate: 0 };

describe("laboratoire : provenance et hypothèses", () => {
  test("le R net vient du P&L / risque initial, pas d'une valeur stockée périmée", () => {
    const m = historicalModel([
      { pnl: 200, riskAmount: 100, rMultiple: 99 },
      { pnl: -100, riskAmount: 100, rMultiple: 99 },
      { pnl: NaN, riskAmount: 100 },
      { pnl: 900, riskAmount: 100, isExample: true },
    ]);
    expect(m.values).toEqual([2, -1]);
    expect(m.sampleSize).toBe(2);
    expect(m.excluded).toBe(2);
    expect(m.estimated).toBe(0);
  });
  test("un P&L sans risque est explicitement estimé, ou exclu si aucune échelle n'existe", () => {
    const m = historicalModel([{ pnl: 200 }, { pnl: -100 }, { pnl: 0 }]);
    expect(m.values).toEqual([2, -1, 0]);
    expect(m.estimated).toBe(2);
    expect(historicalModel([{ pnl: 200 }]).sampleSize).toBe(0);
  });
  test("une hypothèse ne crée jamais 500 faux trades et conserve exactement les métriques saisies", () => {
    const m = plannedModel({ ...metrics, winRate: 0.537, breakEvenRate: 0.137 });
    expect(m.sampleSize).toBe(0);
    expect(m.values).toEqual([]);
    expect(m.metrics.winRate).toBe(0.537);
    expect(m.metrics.breakEvenRate).toBe(0.137);
  });
  test("coûts et neutres entrent dans l'espérance et le seuil d'équilibre", () => {
    const model = plannedModel({ ...metrics, breakEvenRate: 0.2 });
    const e = strategyEdge(model, 100, 20);
    expect(e.netExpectancyR).toBeCloseTo(0.2, 10);
    expect(e.breakEvenWinRate).toBeCloseTo(1.25 / 3, 10);
    expect(strategyEdge(plannedModel(metrics), 100, 50).netExpectancyR).toBe(0);
  });
  test("les hypothèses invalides et les plans corrompus sont refusés", () => {
    expect(() => plannedModel({ ...metrics, winRate: 1.1 })).toThrow();
    expect(validStrategyConfig({ ...config, drawdownType: "unknown" })).toBe(false);
    expect(validStrategyConfig({ ...config, trades: 1001 })).toBe(false);
    expect(validStrategyConfig({ ...config, perDay: NaN })).toBe(false);
    expect(validStrategyConfig({ ...config, risk: 20000 })).toBe(false);
    expect(validStrategyConfig({ balance: 10000 })).toBe(false);
  });
});

describe("laboratoire : calcul des trajectoires", () => {
  test("une cible atteinte ne tronque pas la projection de stratégie", () => {
    const r = projectStrategy(
      plannedModel({ ...metrics, winRate: 1, avgWinR: 1 }),
      { ...config, trades: 10, target: 100 },
      100,
    );
    expect(r.passProbability).toBe(1);
    expect(r.objectiveStops[0]).toBe(1);
    expect(r.capital.at(-1)?.p50).toBe(11000);
    expect(r.objectives.at(-1)?.p50).toBe(10100);
    expect(r.medianPnl).toBe(1000);
    expect(r.medianTargetTrades).toBe(1);
  });
  test("la perte journalière arrête le compte contraint mais conserve le vrai drawdown", () => {
    const r = projectStrategy(
      plannedModel({ ...metrics, winRate: 0 }),
      { ...config, trades: 10, dailyLimit: 50 },
      100,
    );
    expect(r.failProbability).toBe(1);
    expect(r.objectiveStops[0]).toBe(1);
    expect(r.objectiveBalances[0]).toBe(9900);
    expect(r.drawdown95).toBe(1000);
    expect(r.longestStreak95).toBe(10);
  });
  test("le même scénario et la même graine rendent le même résultat, sans hasard global", () => {
    const m = plannedModel(metrics);
    const a = projectStrategy(m, config, 200),
      b = projectStrategy(m, config, 200);
    expect(a.paths).toEqual(b.paths);
    expect(a.profitProbability).toBe(b.profitProbability);
    expect(projectStrategy(m, { ...config, seed: config.seed + 1 }, 200).paths).not.toEqual(
      a.paths,
    );
  });
  test("risque divisé par deux : mêmes séquences, P&L et drawdown divisés par deux", () => {
    const m = plannedModel(metrics);
    const a = projectStrategy(m, config, 200),
      b = projectStrategy(m, { ...config, risk: 50 }, 200);
    for (let i = 0; i < a.paths.length; i++)
      expect(b.paths[i] - config.balance).toBeCloseTo((a.paths[i] - config.balance) / 2, 8);
    expect(b.drawdown95).toBeCloseTo(a.drawdown95 / 2, 8);
    expect(b.profitProbability).toBe(a.profitProbability);
    expect(b.longestStreak95).toBe(a.longestStreak95);
  });
  test("un scénario calibré garde les queues conditionnelles de l'historique", () => {
    const values = [-2, -1, -1, 0, 1, 2, 8];
    const measured = historicalModel(values.map((r) => ({ pnl: r * 100, riskAmount: 100 })));
    const planned = plannedModel(measured.metrics, measured.values);
    const r = projectStrategy(planned, { ...config, trades: 1 }, 10000);
    const finals = new Set(r.finalPnl.map((v) => Math.round(v)));
    expect(finals.has(800)).toBe(true);
    expect(finals.has(-200)).toBe(true);
    expect(finals.size).toBe(6);
    expect(r.netExpectancyR).toBeCloseTo(values.reduce((a, b) => a + b, 0) / values.length, 10);
  });
  test("toutes les issues sont comptées et les bandes viennent des mêmes 10 000 trajectoires", () => {
    const r = projectStrategy(plannedModel(metrics), { ...config, trades: 10 });
    expect(r.runs).toBe(10000);
    expect(r.paths.length).toBe(10000 * r.points.length);
    expect(r.passProbability + r.failProbability + r.openProbability).toBeCloseTo(1, 12);
    expect(r.capital.at(-1)!.p50 - config.balance).toBeCloseTo(r.medianPnl, 8);
    for (const point of r.capital) {
      expect(
        point.p5 <= point.p25 &&
          point.p25 <= point.p50 &&
          point.p50 <= point.p75 &&
          point.p75 <= point.p95,
      ).toBe(true);
    }
  });
  test("la décimation du dessin garde le premier et le dernier pas, avec tous les trades simulés", () => {
    const r = projectStrategy(
      plannedModel({ ...metrics, winRate: 1, avgWinR: 1 }),
      { ...config, trades: 1000 },
      10,
    );
    expect(r.points.length).toBeLessThanOrEqual(121);
    expect(r.points[0]).toBe(0);
    expect(r.points.at(-1)).toBe(1000);
    expect(r.medianPnl).toBe(100000);
  });
  test("les surcoûts sont débités aussi sur les neutres, sans double soustraire les frais historiques", () => {
    const m = plannedModel({ ...metrics, breakEvenRate: 1 });
    const r = projectStrategy(m, { ...config, trades: 10, extraCost: 5 }, 10);
    expect(r.medianPnl).toBe(-50);
    expect(r.longestStreak95).toBe(10);
    expect(r.netExpectancyR).toBeCloseTo(-0.05, 10);
  });
  test("la courbe de risque est monotone et n'omet aucune trajectoire", () => {
    const r = projectStrategy(plannedModel(metrics), config, 200);
    expect(r.drawdownExceedance[0].probability).toBe(1);
    for (let i = 1; i < r.drawdownExceedance.length; i++)
      expect(r.drawdownExceedance[i].probability).toBeLessThanOrEqual(
        r.drawdownExceedance[i - 1].probability,
      );
  });
});

describe("incertitude de simulation", () => {
  test("Wilson conserve de l'incertitude aux extrêmes et reste dans [0,1]", () => {
    const zero = simulationInterval(0, 10000),
      all = simulationInterval(10000, 10000),
      half = simulationInterval(5000, 10000);
    expect(zero.low).toBeCloseTo(0, 10);
    expect(zero.high).toBeGreaterThan(0);
    expect(all.low).toBeLessThan(1);
    expect(all.high).toBe(1);
    expect(half.low).toBeCloseTo(0.4902, 4);
    expect(half.high).toBeCloseTo(0.5098, 4);
  });
});
