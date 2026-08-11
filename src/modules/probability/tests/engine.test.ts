import { describe, it, expect } from "bun:test";
import { ENGINE_VERSION, percentile, runSimulation, type SimulationConfig } from "../engine";
import { buildDataset, tradesForDays, scaleRisk } from "../dataset";
import { makeRng, randomIndex, seedFrom } from "../rng";
import type { AccountRules } from "../rules";

const rules: AccountRules = {
  startingBalance: 50_000,
  profitTarget: 3000,
  maxDrawdown: 2000,
  drawdownType: "static",
};

function cfg(over: Partial<SimulationConfig> = {}): SimulationConfig {
  return { rules, tradesPerPath: 60, tradesPerDay: 3, runs: 500, seed: 42, ...over };
}

/** Un historique gagnant : 60 % de gains à +300, 40 % de pertes à −200. */
function winningHistory(n = 100) {
  return Array.from({ length: n }, (_, i) => ({
    pnl: i % 5 < 3 ? 300 : -200,
    date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    riskAmount: 200,
    rMultiple: i % 5 < 3 ? 1.5 : -1,
  }));
}

describe("RNG seedable — la base de tests non flaky", () => {
  it("la même graine rend exactement la même séquence", () => {
    const a = makeRng(7);
    const b = makeRng(7);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it("deux graines VOISINES ne produisent pas des séquences corrélées", () => {
    // Le piège classique d'un LCG mal initialisé : seed 1 et seed 2 donnent
    // des suites presque identiques, et 10 000 trajectoires « indépendantes »
    // se réduisent en pratique à quelques-unes.
    const a = makeRng(1);
    const b = makeRng(2);
    let identiques = 0;
    for (let i = 0; i < 100; i++) if (Math.abs(a() - b()) < 1e-6) identiques++;
    expect(identiques).toBeLessThan(3);
  });

  it("les tirages restent dans [0, 1)", () => {
    const rng = makeRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randomIndex ne sort JAMAIS des bornes du tableau", () => {
    // Un index hors bornes rendrait `undefined` et propagerait des NaN dans
    // toute la simulation.
    const rng = makeRng(9);
    for (let i = 0; i < 500; i++) {
      const idx = randomIndex(rng, 7);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(7);
    }
    expect(randomIndex(rng, 0)).toBe(0);
  });

  it("seedFrom est stable pour une même chaîne", () => {
    expect(seedFrom("scenario-a")).toBe(seedFrom("scenario-a"));
    expect(seedFrom("scenario-a")).not.toBe(seedFrom("scenario-b"));
  });
});

describe("déterminisme — le même scénario rend le même chiffre", () => {
  it("deux exécutions identiques donnent des résultats identiques", () => {
    // Sans cela, la « probabilité de réussite » du trader bougerait à chaque
    // clic sans qu'il ait rien changé.
    const d = buildDataset(winningHistory());
    const a = runSimulation(d, cfg());
    const b = runSimulation(d, cfg());
    expect(a.passProbability).toBe(b.passProbability);
    expect(a.riskOfRuin).toBe(b.riskOfRuin);
    expect(a.pnl.median).toBe(b.pnl.median);
  });

  it("changer la graine change le résultat, mais peu", () => {
    // La dispersion entre deux graines mesure le bruit de simulation. Sur 500
    // trajectoires il doit rester faible, sinon le nombre de runs est trop bas.
    const d = buildDataset(winningHistory());
    const a = runSimulation(d, cfg({ seed: 1 }));
    const b = runSimulation(d, cfg({ seed: 2 }));
    expect(Math.abs(a.passProbability - b.passProbability)).toBeLessThan(0.1);
  });

  it("le résultat porte la version du moteur", () => {
    const r = runSimulation(buildDataset(winningHistory()), cfg());
    expect(r.engineVersion).toBe(ENGINE_VERSION);
    expect(r.seed).toBe(42);
  });
});

describe("cohérence statistique", () => {
  const result = runSimulation(buildDataset(winningHistory()), cfg());

  it("les trois issues somment EXACTEMENT à 1", () => {
    const total = result.passProbability + result.failProbability + result.openProbability;
    expect(total).toBeCloseTo(1, 10);
  });

  it("toutes les probabilités sont bornées dans [0, 1]", () => {
    for (const p of [
      result.passProbability,
      result.failProbability,
      result.openProbability,
      result.riskOfRuin,
    ]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("la ruine est un SOUS-ENSEMBLE des échecs", () => {
    // Amalgamer les deux gonflerait le chiffre le plus anxiogène de l'écran
    // avec des dépassements de délai, qui ne coûtent pas le compte.
    expect(result.riskOfRuin).toBeLessThanOrEqual(result.failProbability);
  });

  it("les causes d'échec somment au nombre d'échecs", () => {
    const sum = Object.values(result.failReasons).reduce((a, b) => a + b, 0);
    expect(sum).toBe(Math.round(result.failProbability * result.runs));
  });

  it("aucun NaN ni Infinity nulle part", () => {
    const nums = [
      result.passProbability,
      result.riskOfRuin,
      result.pnl.median,
      result.pnl.mean,
      result.drawdown.p95,
    ];
    for (const n of nums) expect(Number.isFinite(n)).toBe(true);
  });

  it("les percentiles sont ordonnés", () => {
    const d = result.pnl;
    expect(d.p5).toBeLessThanOrEqual(d.p25);
    expect(d.p25).toBeLessThanOrEqual(d.median);
    expect(d.median).toBeLessThanOrEqual(d.p75);
    expect(d.p75).toBeLessThanOrEqual(d.p95);
  });

  it("le drawdown simulé est toujours positif ou nul", () => {
    expect(result.drawdown.p5).toBeGreaterThanOrEqual(0);
  });
});

describe("le moteur reflète la réalité de l'historique", () => {
  it("une expectancy positive donne un taux de réussite élevé", () => {
    const r = runSimulation(buildDataset(winningHistory()), cfg());
    expect(r.passProbability).toBeGreaterThan(0.5);
  });

  it("une expectancy NÉGATIVE donne un taux de ruine élevé", () => {
    // Le moteur ne doit pas flatter : un historique perdant doit produire des
    // chiffres qui le disent.
    const perdant = Array.from({ length: 100 }, (_, i) => ({
      pnl: i % 5 < 3 ? 100 : -400,
      date: "2026-03-02",
      riskAmount: 400,
      rMultiple: i % 5 < 3 ? 0.25 : -1,
    }));
    const r = runSimulation(buildDataset(perdant), cfg());
    expect(r.riskOfRuin).toBeGreaterThan(0.5);
    expect(r.passProbability).toBeLessThan(0.3);
  });

  it("RÉDUIRE le risque réduit la ruine — la question centrale du produit", () => {
    // « Et si je risquais 0,5 % au lieu de 1 % ? » doit produire un effet, et
    // dans le bon sens. L'historique doit être VOLATIL pour que le test dise
    // quelque chose : sur un historique très favorable la ruine est déjà
    // nulle à plein risque, et il n'y a rien à réduire.
    const volatil = Array.from({ length: 100 }, (_, i) => ({
      pnl: i % 2 === 0 ? 900 : -800,
      date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
      riskAmount: 800,
      rMultiple: i % 2 === 0 ? 1.125 : -1,
    }));
    const d = buildDataset(volatil);
    const plein = runSimulation(d, cfg({ riskMultiplier: 1 }));
    const moitie = runSimulation(d, cfg({ riskMultiplier: 0.5 }));
    expect(plein.riskOfRuin).toBeGreaterThan(0); // sinon le test ne prouve rien
    expect(moitie.riskOfRuin).toBeLessThan(plein.riskOfRuin);
    expect(moitie.drawdown.median).toBeLessThan(plein.drawdown.median);
  });

  it("les trajectoires gagnantes portent un délai d'atteinte", () => {
    const r = runSimulation(buildDataset(winningHistory()), cfg());
    expect(r.daysToTarget).not.toBeNull();
    expect(r.daysToTarget!.median).toBeGreaterThan(0);
  });
});

describe("cas limites — le moteur ne doit jamais produire d'absurdité", () => {
  it("journal VIDE : tout à zéro, aucune probabilité inventée", () => {
    const r = runSimulation(buildDataset([]), cfg());
    expect(r.sampleSize).toBe(0);
    expect(r.passProbability).toBe(0);
    expect(r.riskOfRuin).toBe(0);
    expect(r.daysToTarget).toBeNull();
    expect(Number.isFinite(r.pnl.median)).toBe(true);
  });

  it("UN SEUL trade : le moteur tourne, sans planter", () => {
    const r = runSimulation(buildDataset([{ pnl: 100, date: "2026-03-02" }]), cfg({ runs: 50 }));
    expect(r.sampleSize).toBe(1);
    expect(Number.isFinite(r.passProbability)).toBe(true);
  });

  it("que des gains : jamais de ruine", () => {
    const d = buildDataset(Array.from({ length: 20 }, () => ({ pnl: 200, date: "2026-03-02" })));
    const r = runSimulation(d, cfg());
    expect(r.riskOfRuin).toBe(0);
    expect(r.passProbability).toBe(1);
  });

  it("que des pertes : jamais de réussite", () => {
    const d = buildDataset(Array.from({ length: 20 }, () => ({ pnl: -200, date: "2026-03-02" })));
    const r = runSimulation(d, cfg());
    expect(r.passProbability).toBe(0);
    expect(r.riskOfRuin).toBe(1);
  });

  it("que du break-even : ni réussite ni ruine, les trajectoires restent ouvertes", () => {
    const d = buildDataset(Array.from({ length: 20 }, () => ({ pnl: 0, date: "2026-03-02" })));
    const r = runSimulation(d, cfg());
    expect(r.passProbability).toBe(0);
    expect(r.failProbability).toBe(0);
    expect(r.openProbability).toBe(1);
    expect(r.pnl.median).toBe(0);
  });

  it("zéro trajectoire demandée : résultat neutre, pas de division par zéro", () => {
    const r = runSimulation(buildDataset(winningHistory()), cfg({ runs: 0 }));
    expect(Number.isFinite(r.passProbability)).toBe(true);
    expect(r.passProbability).toBe(0);
  });

  it("un gain ÉNORME ne fausse pas la distribution au point de produire NaN", () => {
    const d = buildDataset([
      ...winningHistory(50),
      { pnl: 1_000_000, date: "2026-03-02", riskAmount: 200, rMultiple: 5000 },
    ]);
    const r = runSimulation(d, cfg());
    expect(Number.isFinite(r.pnl.p95)).toBe(true);
    expect(Number.isFinite(r.pnl.mean)).toBe(true);
  });
});

describe("règle « stop après N pertes » — le Risk Guard simulé", () => {
  it("arrêter tôt réduit le drawdown", () => {
    const d = buildDataset(winningHistory());
    const libre = runSimulation(d, cfg({ tradesPerDay: 6 }));
    const bride = runSimulation(d, cfg({ tradesPerDay: 6, stopAfterLosses: 2 }));
    expect(bride.drawdown.median).toBeLessThanOrEqual(libre.drawdown.median);
  });
});

describe("percentile", () => {
  it("interpole entre deux valeurs", () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
  });

  it("gère les séries d'un seul élément et vides", () => {
    expect(percentile([42], 0.9)).toBe(42);
    expect(percentile([], 0.5)).toBe(0);
  });

  it("borne les quantiles hors de [0, 1]", () => {
    expect(percentile([1, 2, 3], -1)).toBe(1);
    expect(percentile([1, 2, 3], 2)).toBe(3);
  });
});

describe("dataset — jamais de donnée inventée", () => {
  it("un trade SANS risque n'a pas de R", () => {
    // Fabriquer un R à partir d'un risque supposé produirait des probabilités
    // qui ont l'air rigoureuses sans l'être.
    const d = buildDataset([{ pnl: 100, date: "2026-03-02" }]);
    expect(d.trades[0].r).toBeNull();
    expect(d.rCoverage).toBe(0);
  });

  it("un rMultiple stocké avec un risque NUL est ignoré", () => {
    // C'est une valeur par défaut du formulaire, pas une mesure.
    const d = buildDataset([{ pnl: 100, date: "2026-03-02", riskAmount: 0, rMultiple: 2 }]);
    expect(d.trades[0].r).toBeNull();
  });

  it("mesure la couverture en R de l'historique", () => {
    const d = buildDataset([
      { pnl: 100, date: "2026-03-02", riskAmount: 50, rMultiple: 2 },
      { pnl: -50, date: "2026-03-02" },
    ]);
    expect(d.rCoverage).toBe(0.5);
  });

  it("compte les jours de bourse distincts et la fréquence", () => {
    const d = buildDataset([
      { pnl: 1, date: "2026-03-02" },
      { pnl: 1, date: "2026-03-02" },
      { pnl: 1, date: "2026-03-03" },
    ]);
    expect(d.tradingDays).toBe(2);
    expect(d.tradesPerDay).toBe(1.5);
  });

  it("scaleRisk change le montant mais JAMAIS le R", () => {
    const t = { pnl: 500, r: 2, day: "2026-03-02" };
    const half = scaleRisk(t, 0.5);
    expect(half.pnl).toBe(250);
    expect(half.r).toBe(2); // un ratio ne dépend pas de la taille de position
  });

  it("sans fréquence mesurable, l'horizon en jours n'est pas devinable", () => {
    // Un trader qui a tout journalisé le même jour n'a pas de cadence : il
    // faut le lui dire, pas inventer « 3 trades par jour ».
    expect(tradesForDays(buildDataset([]), 20)).toBeNull();
    expect(tradesForDays(buildDataset([{ pnl: 1, date: "2026-03-02" }]), 20)).toBe(20);
  });
});
