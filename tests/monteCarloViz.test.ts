import { describe, expect, test } from "bun:test";
import { histogram } from "../src/app/features/monte-carlo/monteCarloViz";
import { historicalModel, plannedModel, strategyEdge } from "../src/modules/probability/strategy";

/**
 * Ce que le laboratoire Monte Carlo affiche est calculé, jamais plafonné.
 *
 * Lot 6 : l'ancien moteur (`monteCarloEngine`) est retiré ; les garanties du
 * lot 0 sur le profit factor portent désormais sur le moteur monté
 * (`strategyEdge`, lu par `StrategyDetails`).
 */

describe("Monte-Carlo : ce que le graphe montre est calculé", () => {
  test("les classes comptent chaque valeur une fois, hors-plage compris", () => {
    const h = histogram([-10, 0, 1, 2, 99], 0, 4, 4);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(5);
    expect(h[0].count).toBe(2);
    expect(h[3].count).toBe(1);
  });
});

describe("Lot 0 — intégrité du profit factor (moteur canonique)", () => {
  test("sans perte observée, le profit factor est inconnu — pas 99", () => {
    const m = historicalModel([
      { pnl: 200, rMultiple: 2 },
      { pnl: 100, rMultiple: 1 },
    ]);
    expect(strategyEdge(m, 100, 0).netProfitFactor).toBeNull();
  });

  test("un scénario n'utilise jamais de plafond fabriqué", () => {
    const pf = (winRate: number) =>
      strategyEdge(plannedModel({ winRate, avgWinR: 2, avgLossR: 1, breakEvenRate: 0 }), 100, 0)
        .netProfitFactor;
    expect(pf(1)).toBeNull();
    expect(pf(0.5)).toBeCloseTo(2);
    expect(pf(0.99)).toBeCloseTo(198);
  });

  test("le profit factor reste exact, y compris au-delà de 99", () => {
    const pf = (values: [number, number][]) =>
      strategyEdge(historicalModel(values.map(([pnl, rMultiple]) => ({ pnl, rMultiple }))), 100, 0)
        .netProfitFactor;
    expect(
      pf([
        [500, 5],
        [-300, -3],
      ]),
    ).toBeCloseTo(5 / 3);
    expect(
      pf([
        [120, 1.2],
        [-1, -0.01],
      ]),
    ).toBeCloseTo(120);
  });
});
