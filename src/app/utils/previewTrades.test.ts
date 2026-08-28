import { describe, expect, it } from "bun:test";
import { previewTrades } from "./previewTrades";

describe("historique d'aperçu", () => {
  it("est déterministe — la même page montre toujours la même chose", () => {
    const a = previewTrades({ count: 40, seed: 7 });
    const b = previewTrades({ count: 40, seed: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produit un historique complet et trié du plus récent au plus ancien", () => {
    const trades = previewTrades({ count: 120, seed: 1 });
    expect(trades).toHaveLength(120);
    for (let i = 1; i < trades.length; i++) {
      expect(trades[i - 1].date >= trades[i].date).toBe(true);
    }
  });

  it("reste plausible : ni martingale, ni compte qui triple", () => {
    const trades = previewTrades({ count: 200, seed: 3 });
    const wins = trades.filter((t) => t.rMultiple > 0).length;
    const winRate = wins / trades.length;
    expect(winRate).toBeGreaterThan(0.3);
    expect(winRate).toBeLessThan(0.65);

    const avgR = trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length;
    expect(avgR).toBeGreaterThan(0); // un edge, sinon la démo ne vend rien
    expect(avgR).toBeLessThan(1); // mais pas un fantasme
  });

  it("n'attribue des erreurs qu'à des trades perdants", () => {
    for (const t of previewTrades({ count: 200, seed: 5 })) {
      if (t.mistakes.length > 0) expect(t.rMultiple).toBeLessThan(0);
    }
  });

  it("marque tout comme exemple — ces trades ne doivent jamais passer pour réels", () => {
    for (const t of previewTrades({ count: 30, seed: 9 })) {
      expect(t.isExample).toBe(true);
      expect(t.id.startsWith("preview-")).toBe(true);
    }
  });
});
