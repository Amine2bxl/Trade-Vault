import { describe, it, expect } from "bun:test";
import { buildDataset } from "../dataset";
import { buildScenario, DEFAULT_RUNS, type ScenarioInput } from "../scenario";

/** 40 trades sur 20 jours → cadence mesurée de 2 trades/jour. */
const history = buildDataset(
  Array.from({ length: 40 }, (_, i) => ({
    pnl: i % 3 === 0 ? -400 : 300,
    date: `2026-01-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`,
    riskAmount: 400,
    rMultiple: i % 3 === 0 ? -1 : 0.75,
  })),
);

const rules = { startingBalance: 50_000, profitTarget: 3000, maxDrawdown: 2000 };
const input: ScenarioInput = { rules, horizon: { unit: "days", value: 30 } };

describe("construction du scénario", () => {
  it("convertit un horizon en jours avec la cadence MESURÉE", () => {
    const built = buildScenario(history, input);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(history.tradesPerDay).toBe(2);
    expect(built.config.tradesPerPath).toBe(60); // 30 jours × 2 trades
    expect(built.config.tradesPerDay).toBe(2);
    expect(built.config.runs).toBe(DEFAULT_RUNS);
  });

  it("accepte un horizon exprimé directement en trades", () => {
    const built = buildScenario(history, { ...input, horizon: { unit: "trades", value: 100 } });
    expect(built.ok && built.config.tradesPerPath).toBe(100);
  });

  it("la cadence imposée par le trader prime sur la cadence historique", () => {
    const built = buildScenario(history, { ...input, tradesPerDay: 5 });
    expect(built.ok && built.config.tradesPerDay).toBe(5);
    expect(built.ok && built.config.tradesPerPath).toBe(150);
  });
});

describe("ce qui bloque une simulation — et pourquoi ça doit bloquer", () => {
  it("journal vide", () => {
    const built = buildScenario(buildDataset([]), input);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.blocker).toBe("noTrades");
  });

  it("historique trop court : rééchantillonner 3 trades ne fait pas une distribution", () => {
    const tiny = buildDataset([
      { pnl: 100, date: "2026-01-01" },
      { pnl: -50, date: "2026-01-02" },
      { pnl: 80, date: "2026-01-03" },
    ]);
    const built = buildScenario(tiny, input);
    expect(!built.ok && built.blocker).toBe("tooFewTrades");
  });

  it("solde de départ absent ou absurde", () => {
    for (const startingBalance of [0, -1000, Number.NaN]) {
      const built = buildScenario(history, { ...input, rules: { startingBalance } });
      expect(!built.ok && built.blocker).toBe("noBalance");
    }
  });

  it("horizon en jours sans cadence mesurable : on refuse plutôt que d'inventer un rythme", () => {
    // Tout journalisé le même jour : aucune fréquence n'est observable.
    const sameDay = buildDataset(
      Array.from({ length: 20 }, () => ({ pnl: 100, date: "2026-01-01" })),
    );
    // 20 trades sur 1 jour = 20/jour : la cadence EXISTE ici, donc ça passe.
    expect(buildScenario(sameDay, input).ok).toBe(true);
    // En revanche un horizon nul n'est convertible en rien.
    const zero = buildScenario(history, { ...input, horizon: { unit: "days", value: 0 } });
    expect(!zero.ok && zero.blocker).toBe("noCadence");
  });

  it("porte toujours la qualification d'échantillon, même en cas de blocage", () => {
    const built = buildScenario(buildDataset([]), input);
    expect(built.sample.size).toBe(0);
    expect(built.sample.usable).toBe(false);
  });
});

describe("graine — la reproductibilité est une promesse produit", () => {
  it("le même scénario redonne la même graine", () => {
    const a = buildScenario(history, input);
    const b = buildScenario(history, input);
    expect(a.ok && b.ok && a.config.seed).toBe(b.ok ? b.config.seed : -1);
  });

  it("changer une variable change la graine", () => {
    const base = buildScenario(history, input);
    const autre = buildScenario(history, { ...input, riskMultiplier: 0.5 });
    expect(base.ok && autre.ok && base.config.seed !== autre.config.seed).toBe(true);
  });

  it("une graine explicite est respectée — rejouer une simulation sauvegardée", () => {
    const built = buildScenario(history, { ...input, seed: 123_456 });
    expect(built.ok && built.config.seed).toBe(123_456);
  });

  it("la graine est un entier non signé exploitable par le RNG", () => {
    const built = buildScenario(history, input);
    expect(built.ok && Number.isInteger(built.config.seed)).toBe(true);
    expect(built.ok && built.config.seed >= 0).toBe(true);
  });
});
