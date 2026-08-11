import { describe, it, expect } from "bun:test";
import { assessDataset, GAP_THRESHOLD } from "../datasetQuality";
import type { Trade } from "../../types";

function trade(patch: Partial<Trade> = {}): Trade {
  return {
    id: Math.random().toString(36).slice(2),
    date: "2026-01-05",
    symbol: "NQ",
    direction: "long",
    pnl: 250,
    riskAmount: 200,
    rMultiple: 1.25,
    strategy: "Breakout",
    mistakes: [],
    setupQuality: 4,
    notes: "",
    screenshots: ["url"],
    entryTime: "09:35",
    exitTime: "10:02",
    confluences: [],
    confidence: 4,
    ...patch,
  };
}

describe("qualité du jeu de données", () => {
  it("un journal complet marque 100", () => {
    const q = assessDataset([trade(), trade(), trade()]);
    expect(q.score).toBe(100);
    expect(q.gaps).toHaveLength(0);
  });

  it("un journal vide ne marque rien et n'invente aucun manque", () => {
    const q = assessDataset([]);
    expect(q.score).toBe(0);
    expect(q.total).toBe(0);
    expect(q.gaps).toHaveLength(0);
    for (const d of q.dimensions) expect(d.coverage).toBe(0);
  });

  it("un risque à 0 n'est PAS un risque saisi", () => {
    // C'est la valeur par défaut du formulaire. La compter comme remplie
    // gonflerait le score exactement là où le trader se fierait au R.
    const q = assessDataset([trade({ riskAmount: 0 }), trade({ riskAmount: 0 })]);
    const risk = q.dimensions.find((d) => d.dimension === "risk");
    expect(risk?.coverage).toBe(0);
    expect(risk?.filled).toBe(0);
  });

  it("un break-even n'est pas une direction exploitable", () => {
    const q = assessDataset([trade({ direction: "be" }), trade({ direction: "long" })]);
    expect(q.dimensions.find((d) => d.dimension === "direction")?.coverage).toBe(0.5);
  });

  it("une stratégie faite d'espaces ne compte pas", () => {
    const q = assessDataset([trade({ strategy: "   " }), trade()]);
    expect(q.dimensions.find((d) => d.dimension === "strategy")?.coverage).toBe(0.5);
  });

  it("les heures exigent l'entrée ET la sortie", () => {
    const q = assessDataset([trade({ exitTime: "" }), trade()]);
    expect(q.dimensions.find((d) => d.dimension === "times")?.coverage).toBe(0.5);
  });

  it("le risque manquant pèse plus lourd que les captures manquantes", () => {
    const sansRisque = assessDataset([trade({ riskAmount: 0 })]);
    const sansCapture = assessDataset([trade({ screenshots: [] })]);
    expect(sansRisque.score).toBeLessThan(sansCapture.score);
  });

  it("les manques sont classés par coût réel, le plus pénalisant d'abord", () => {
    const q = assessDataset([trade({ riskAmount: 0, screenshots: [] })]);
    expect(q.gaps[0].dimension).toBe("risk");
  });

  it("une dimension juste au-dessus du seuil n'est pas signalée", () => {
    // 9 trades sur 10 renseignés = 90 %, au-dessus du seuil : inutile de
    // harceler un trader dont le journal est presque complet.
    const trades = Array.from({ length: 10 }, (_, i) => trade(i === 0 ? { strategy: "" } : {}));
    const q = assessDataset(trades);
    expect(0.9).toBeGreaterThan(GAP_THRESHOLD);
    expect(q.gaps.some((g) => g.dimension === "strategy")).toBe(false);
  });

  it("le score reste borné entre 0 et 100 quoi qu'il arrive", () => {
    const vide = assessDataset([
      trade({
        riskAmount: 0,
        direction: "be",
        strategy: "",
        entryTime: "",
        exitTime: "",
        screenshots: [],
      }),
    ]);
    expect(vide.score).toBe(0);
    expect(assessDataset([trade()]).score).toBe(100);
  });
});
