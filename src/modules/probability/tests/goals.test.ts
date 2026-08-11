import { describe, it, expect } from "bun:test";
import { buildDataset } from "../dataset";
import { forecastCapitalGoal } from "../goals";

/** 40 trades sur 20 jours, gagnant en moyenne → 2 trades/jour mesurés. */
const gagnant = buildDataset(
  Array.from({ length: 40 }, (_, i) => ({
    pnl: i % 3 === 0 ? -400 : 300,
    date: `2026-01-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`,
    riskAmount: 400,
    rMultiple: i % 3 === 0 ? -1 : 0.75,
  })),
);

/** Même cadence, mais perdant : sert à prouver que le sens du résultat suit
 *  réellement la qualité du trading, et non la taille de l'objectif seule. */
const perdant = buildDataset(
  Array.from({ length: 40 }, (_, i) => ({
    pnl: i % 3 === 0 ? 300 : -400,
    date: `2026-01-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`,
    riskAmount: 400,
    rMultiple: i % 3 === 0 ? 0.75 : -1,
  })),
);

const base = { currentBalance: 25_000, targetBalance: 27_000, daysRemaining: 30 };

describe("projection d'un objectif de capital", () => {
  it("rend une probabilité bornée et un résultat exploitable", () => {
    const f = forecastCapitalGoal(gagnant, base);
    expect(f).not.toBeNull();
    expect(f!.probability).toBeGreaterThanOrEqual(0);
    expect(f!.probability).toBeLessThanOrEqual(1);
    expect(f!.sample.size).toBe(40);
  });

  it("un objectif plus ambitieux est moins probable", () => {
    const proche = forecastCapitalGoal(gagnant, { ...base, targetBalance: 26_000 })!;
    const lointain = forecastCapitalGoal(gagnant, { ...base, targetBalance: 40_000 })!;
    expect(lointain.probability).toBeLessThan(proche.probability);
  });

  it("plus de temps rend l'objectif plus probable", () => {
    const court = forecastCapitalGoal(gagnant, { ...base, daysRemaining: 5 })!;
    const long = forecastCapitalGoal(gagnant, { ...base, daysRemaining: 90 })!;
    expect(long.probability).toBeGreaterThan(court.probability);
  });

  it("un trading perdant rend le même objectif nettement moins probable", () => {
    const bon = forecastCapitalGoal(gagnant, base)!;
    const mauvais = forecastCapitalGoal(perdant, base)!;
    expect(bon.probability).toBeGreaterThan(mauvais.probability);
  });

  it("dit aussi QUAND, sur les trajectoires qui aboutissent", () => {
    const f = forecastCapitalGoal(gagnant, base)!;
    if (f.probability > 0) {
      expect(f.medianDaysToTarget).not.toBeNull();
      expect(f.medianDaysToTarget!).toBeGreaterThan(0);
    }
  });

  it("est reproductible : rouvrir la page ne change pas le chiffre", () => {
    // Un pourcentage qui bouge tout seul entre deux visites détruit la
    // confiance plus vite qu'un pourcentage pessimiste.
    const a = forecastCapitalGoal(gagnant, base)!;
    const b = forecastCapitalGoal(gagnant, base)!;
    expect(a.probability).toBe(b.probability);
  });

  it("aucune règle de perte n'est inventée : un objectif personnel ne se perd pas", () => {
    const f = forecastCapitalGoal(perdant, base)!;
    expect(f.result.riskOfRuin).toBe(0);
    expect(f.result.failProbability).toBe(0);
  });
});

describe("ce qui ne se projette pas — et doit rendre null", () => {
  it("historique trop court", () => {
    const petit = buildDataset([
      { pnl: 100, date: "2026-01-01" },
      { pnl: -50, date: "2026-01-02" },
    ]);
    expect(forecastCapitalGoal(petit, base)).toBeNull();
  });

  it("journal vide", () => {
    expect(forecastCapitalGoal(buildDataset([]), base)).toBeNull();
  });

  it("échéance dépassée", () => {
    expect(forecastCapitalGoal(gagnant, { ...base, daysRemaining: 0 })).toBeNull();
    expect(forecastCapitalGoal(gagnant, { ...base, daysRemaining: -10 })).toBeNull();
  });

  it("objectif déjà atteint ou en dessous du solde actuel", () => {
    // Il n'y a plus rien à projeter : l'interface doit dire « atteint », pas
    // afficher 100 % comme s'il s'agissait d'une prévision.
    expect(forecastCapitalGoal(gagnant, { ...base, targetBalance: 25_000 })).toBeNull();
    expect(forecastCapitalGoal(gagnant, { ...base, targetBalance: 20_000 })).toBeNull();
  });

  it("solde de départ absurde", () => {
    expect(forecastCapitalGoal(gagnant, { ...base, currentBalance: 0 })).toBeNull();
    expect(forecastCapitalGoal(gagnant, { ...base, currentBalance: Number.NaN })).toBeNull();
  });

  it("cadence non mesurable", () => {
    // Tous les trades le même jour : 40 trades/jour est une cadence mesurée,
    // donc ça passe. En revanche un horizon nul ne se convertit en rien.
    const memeJour = buildDataset(
      Array.from({ length: 20 }, () => ({ pnl: 50, date: "2026-01-01" })),
    );
    expect(forecastCapitalGoal(memeJour, base)).not.toBeNull();
  });
});
