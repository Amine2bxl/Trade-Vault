import { describe, expect, test } from "bun:test";
import { OUTLOOK_MIN_TRADES, OUTLOOK_RUNS, journalOutlook } from "../outlook";

const trades = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    pnl: i % 3 === 0 ? -100 : 150,
    riskAmount: 100,
    date: `2026-10-${String((i % 20) + 1).padStart(2, "0")}`,
  }));

describe("journalOutlook", () => {
  test("aucun chiffre sous l'échantillon minimum", () => {
    expect(journalOutlook(trades(OUTLOOK_MIN_TRADES - 1), 25_000)).toBeNull();
    expect(journalOutlook(trades(40), 0)).toBeNull();
  });

  test("les exemples ne comptent pas dans l'échantillon", () => {
    const list = [...trades(OUTLOOK_MIN_TRADES - 1), { pnl: 500, isExample: true }];
    expect(journalOutlook(list, 25_000)).toBeNull();
  });

  test("déterministe : mêmes trades, mêmes chiffres", () => {
    const a = journalOutlook(trades(30), 25_000)!;
    const b = journalOutlook(trades(30), 25_000)!;
    expect(a.projection.finalPnl).toEqual(b.projection.finalPnl);
    expect(a.projection.runs).toBe(OUTLOOK_RUNS);
    expect(a.sample).toBe(30);
  });

  test("risque par trade = médiane des risques saisis, seuil = 10 % du capital", () => {
    const o = journalOutlook(trades(30), 25_000)!;
    expect(o.riskPerTrade).toBe(100);
    expect(o.drawdownLimit).toBe(2_500);
    // Espérance positive (2 gains de 1,5 R pour 1 perte de 1 R) : la médiane finit positive.
    expect(o.projection.medianPnl).toBeGreaterThan(0);
    // La courbe de dépassement part de 100 % et ne remonte jamais.
    const probs = o.projection.drawdownExceedance.map((p) => p.probability);
    for (let i = 1; i < probs.length; i++) expect(probs[i]).toBeLessThanOrEqual(probs[i - 1]);
  });
});
