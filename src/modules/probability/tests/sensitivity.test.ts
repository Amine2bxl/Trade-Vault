import { describe, it, expect } from "bun:test";
import { buildDataset } from "../dataset";
import type { SimulationConfig } from "../engine";
import { runSimulation } from "../engine";
import { applyLever, defaultLevers, runSensitivity, type Lever } from "../sensitivity";

/** Historique volatil : gagnant en moyenne, mais avec de vraies pertes — sans
 *  quoi la ruine vaudrait zéro partout et les tests passeraient à vide. */
const volatile = buildDataset(
  Array.from({ length: 40 }, (_, i) => ({
    pnl: i % 3 === 0 ? -800 : 550,
    date: `2026-01-${String((i % 20) + 1).padStart(2, "0")}`,
    riskAmount: 800,
    rMultiple: i % 3 === 0 ? -1 : 0.6875,
  })),
);

const config: SimulationConfig = {
  rules: { startingBalance: 50_000, profitTarget: 3000, maxDrawdown: 2000 },
  tradesPerPath: 60,
  tradesPerDay: 4,
  runs: 800,
  seed: 42,
};

describe("leviers", () => {
  it("le risque devient un multiplicateur", () => {
    expect(applyLever(config, { kind: "risk", value: 0.5, id: "x" }).riskMultiplier).toBe(0.5);
  });

  it("un arrêt à zéro perte est traité comme « aucune règle », pas comme un arrêt immédiat", () => {
    const c = applyLever(config, { kind: "stopAfterLosses", value: 0, id: "x" });
    expect(c.stopAfterLosses).toBeNull();
  });

  it("la fréquence et l'horizon ne descendent jamais sous 1", () => {
    expect(applyLever(config, { kind: "tradesPerDay", value: 0, id: "x" }).tradesPerDay).toBe(1);
    expect(applyLever(config, { kind: "horizon", value: -5, id: "x" }).tradesPerPath).toBe(1);
  });

  it("ne mute pas la configuration d'origine", () => {
    applyLever(config, { kind: "risk", value: 3, id: "x" });
    expect(config.riskMultiplier).toBeUndefined();
  });
});

describe("mesure de sensibilité", () => {
  const levers: Lever[] = [
    { kind: "risk", value: 0.5, id: "risk.half" },
    { kind: "risk", value: 2, id: "risk.double" },
  ];

  it("le scénario de base est celui du moteur, à la virgule près", () => {
    const report = runSensitivity(volatile, config, levers);
    const direct = runSimulation(volatile, config);
    expect(report.base.passProbability).toBe(direct.passProbability);
    expect(report.base.riskOfRuin).toBe(direct.riskOfRuin);
  });

  it("doubler le risque augmente la ruine, la diviser la réduit", () => {
    const report = runSensitivity(volatile, config, levers);
    const moitie = report.rows[0];
    const double = report.rows[1];
    // Le test serait vide si la ruine de base était nulle : on l'exige.
    expect(report.base.riskOfRuin).toBeGreaterThan(0);
    expect(moitie.deltaRuin).toBeLessThan(0);
    expect(double.deltaRuin).toBeGreaterThan(0);
  });

  it("les deltas sont cohérents avec les résultats bruts", () => {
    const report = runSensitivity(volatile, config, levers);
    for (const row of report.rows) {
      expect(row.deltaPass).toBeCloseTo(
        row.result.passProbability - report.base.passProbability,
        12,
      );
      expect(row.deltaRuin).toBeCloseTo(row.result.riskOfRuin - report.base.riskOfRuin, 12);
      expect(row.deltaMedianPnl).toBeCloseTo(row.result.pnl.median - report.base.pnl.median, 6);
    }
  });

  it("est parfaitement reproductible : deux appels identiques, mêmes deltas", () => {
    const a = runSensitivity(volatile, config, levers);
    const b = runSensitivity(volatile, config, levers);
    expect(a.rows.map((r) => r.deltaRuin)).toEqual(b.rows.map((r) => r.deltaRuin));
  });

  it("un levier neutre ne change RIEN — preuve que la graine est commune", () => {
    // C'est le test qui protège la méthode : avec des graines différentes, un
    // multiplicateur de 1 produirait quand même un écart de bruit.
    const report = runSensitivity(volatile, config, [{ kind: "risk", value: 1, id: "risk.same" }]);
    expect(report.rows[0].deltaPass).toBe(0);
    expect(report.rows[0].deltaRuin).toBe(0);
    expect(report.rows[0].deltaMedianPnl).toBe(0);
  });

  it("une liste de leviers vide rend un rapport valide, pas une erreur", () => {
    const report = runSensitivity(volatile, config, []);
    expect(report.rows).toHaveLength(0);
    expect(report.base.runs).toBe(config.runs);
  });

  it("ne produit jamais de probabilité hors bornes ni de NaN", () => {
    const report = runSensitivity(volatile, config, defaultLevers(config));
    for (const row of report.rows) {
      const r = row.result;
      for (const p of [r.passProbability, r.failProbability, r.openProbability, r.riskOfRuin]) {
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
      expect(Number.isFinite(row.deltaMedianPnl)).toBe(true);
    }
  });
});

describe("leviers par défaut", () => {
  it("propose de réduire la fréquence quand elle peut baisser", () => {
    const ids = defaultLevers({ ...config, tradesPerDay: 6 }).map((l) => l.id);
    expect(ids).toContain("frequency.half");
  });

  it("ne propose pas un levier vide à un trader qui prend déjà un trade par jour", () => {
    const ids = defaultLevers({ ...config, tradesPerDay: 1 }).map((l) => l.id);
    expect(ids).not.toContain("frequency.half");
  });

  it("les identifiants sont uniques", () => {
    const ids = defaultLevers(config).map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
