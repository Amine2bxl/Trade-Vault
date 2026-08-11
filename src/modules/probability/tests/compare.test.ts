import { describe, it, expect } from "bun:test";
import { buildDataset } from "../dataset";
import type { SimulationConfig } from "../engine";
import { runSimulation } from "../engine";
import { bestBy, compareScenarios, type ComparisonEntry, type ComparisonRow } from "../compare";

const dataset = buildDataset(
  Array.from({ length: 40 }, (_, i) => ({
    pnl: i % 3 === 0 ? -800 : 550,
    date: `2026-01-${String((i % 20) + 1).padStart(2, "0")}`,
    riskAmount: 800,
    rMultiple: i % 3 === 0 ? -1 : 0.6875,
  })),
);

function config(patch: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    rules: { startingBalance: 50_000, profitTarget: 3000, maxDrawdown: 2000 },
    tradesPerPath: 60,
    tradesPerDay: 4,
    runs: 600,
    seed: 7,
    ...patch,
  };
}

describe("comparaison de scénarios", () => {
  const entries: ComparisonEntry[] = [
    { id: "a", label: "Firme A", config: config() },
    {
      id: "b",
      label: "Firme B",
      config: config({
        rules: { startingBalance: 50_000, profitTarget: 3000, maxDrawdown: 4000 },
        seed: 99,
      }),
    },
  ];

  it("rend une ligne par scénario, dans l'ordre reçu", () => {
    const rows = compareScenarios(dataset, entries);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows.map((r) => r.label)).toEqual(["Firme A", "Firme B"]);
  });

  it("chaque ligne est exactement ce que le moteur produit seul", () => {
    const rows = compareScenarios(dataset, entries);
    const direct = runSimulation(dataset, entries[0].config);
    expect(rows[0].result.passProbability).toBe(direct.passProbability);
    expect(rows[0].result.riskOfRuin).toBe(direct.riskOfRuin);
  });

  it("un drawdown plus large réduit la ruine — la comparaison a du sens", () => {
    const rows = compareScenarios(dataset, entries);
    expect(rows[0].result.riskOfRuin).toBeGreaterThan(rows[1].result.riskOfRuin);
  });

  it("chaque scénario garde SA graine : ce sont deux comptes, pas deux variantes", () => {
    const rows = compareScenarios(dataset, entries);
    expect(rows[0].result.seed).toBe(7);
    expect(rows[1].result.seed).toBe(99);
  });

  it("l'échantillon est le même partout — seules les règles changent", () => {
    const rows = compareScenarios(dataset, entries);
    expect(rows[0].sample.size).toBe(40);
    expect(rows[1].sample.size).toBe(rows[0].sample.size);
  });

  it("une liste vide rend une liste vide, pas une erreur", () => {
    expect(compareScenarios(dataset, [])).toEqual([]);
  });

  it("est reproductible d'un affichage à l'autre", () => {
    const a = compareScenarios(dataset, entries);
    const b = compareScenarios(dataset, entries);
    expect(a.map((r) => r.result.passProbability)).toEqual(b.map((r) => r.result.passProbability));
  });
});

describe("désignation du meilleur", () => {
  /** Lignes fabriquées : on teste la règle de décision, pas le moteur. */
  function row(id: string, pass: number, ruin: number, median: number): ComparisonRow {
    return {
      id,
      label: id,
      sample: { size: 40, quality: "limited", usable: true, toNextBand: 10, rCoverage: 1 },
      result: {
        ...runSimulation(dataset, config({ runs: 1 })),
        passProbability: pass,
        riskOfRuin: ruin,
        pnl: {
          p5: 0,
          p10: 0,
          p25: 0,
          median,
          p75: 0,
          p90: 0,
          p95: 0,
          mean: 0,
        },
      },
    };
  }

  it("désigne la meilleure probabilité de validation", () => {
    expect(bestBy([row("a", 0.4, 0.2, 100), row("b", 0.7, 0.3, 50)], "pass")).toBe(1);
  });

  it("sur la ruine, le plus PETIT gagne", () => {
    expect(bestBy([row("a", 0.4, 0.2, 100), row("b", 0.7, 0.3, 50)], "ruin")).toBe(0);
  });

  it("désigne le meilleur P&L médian", () => {
    expect(bestBy([row("a", 0.4, 0.2, 100), row("b", 0.7, 0.3, 50)], "pnl")).toBe(0);
  });

  it("ne désigne PERSONNE en cas d'égalité", () => {
    // Mettre en avant un scénario qui fait jeu égal inventerait une
    // différence là où il n'y en a pas : le trader choisirait sur du vide.
    expect(bestBy([row("a", 0.5, 0.2, 100), row("b", 0.5, 0.3, 50)], "pass")).toBeNull();
  });

  it("un meilleur apparu APRÈS une égalité l'emporte quand même", () => {
    expect(
      bestBy([row("a", 0.5, 0.2, 10), row("b", 0.5, 0.2, 10), row("c", 0.9, 0.1, 99)], "pass"),
    ).toBe(2);
  });

  it("une liste vide ne désigne rien", () => {
    expect(bestBy([], "pass")).toBeNull();
  });

  it("un seul scénario est son propre meilleur", () => {
    expect(bestBy([row("a", 0.5, 0.2, 100)], "pass")).toBe(0);
  });
});
