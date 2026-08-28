import { describe, expect, it } from "bun:test";
import { canLogTrade, tradesLeftThisMonth, tradesThisMonth, currentMonth } from "./planLimits";
import { LIMITS } from "@/domain/plans";
import type { Trade } from "../types";

const month = currentMonth();
function tradeOn(day: string): Trade {
  return {
    id: day,
    date: day,
    symbol: "NQ",
    direction: "long",
    pnl: 0,
    riskAmount: 100,
    rMultiple: 1,
    strategy: "Breakout",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "",
    exitTime: "",
    confluences: [],
    confidence: 50,
  };
}
const thisMonth = (n: number) =>
  Array.from({ length: n }, (_, i) => tradeOn(`${month}-${String((i % 28) + 1).padStart(2, "0")}`));

describe("quota d'encodage mensuel", () => {
  it("ne compte que le mois courant", () => {
    const trades = [...thisMonth(3), tradeOn("2020-01-05"), tradeOn("2019-11-30")];
    expect(tradesThisMonth(trades)).toBe(3);
  });

  it("laisse l'offre gratuite encoder jusqu'à sa limite, puis s'arrête", () => {
    const limit = LIMITS.free.tradesPerMonth;
    expect(canLogTrade("free", thisMonth(limit - 1), false)).toBe(true);
    expect(canLogTrade("free", thisMonth(limit), false)).toBe(false);
    expect(tradesLeftThisMonth("free", thisMonth(limit))).toBe(0);
  });

  it("n'empêche JAMAIS de corriger un trade déjà saisi", () => {
    // Bloquer une modification serait punitif et sans rapport avec l'offre :
    // le quota porte sur les créations.
    expect(canLogTrade("free", thisMonth(999), true)).toBe(true);
  });

  it("ne limite pas les offres payantes", () => {
    for (const tier of ["pro", "elite"] as const) {
      expect(canLogTrade(tier, thisMonth(500), false)).toBe(true);
      expect(tradesLeftThisMonth(tier, thisMonth(500))).toBe(Infinity);
    }
  });
});

describe("quotas du catalogue", () => {
  it("monte à chaque palier, sans jamais redescendre", () => {
    expect(LIMITS.free.accounts).toBeLessThan(LIMITS.pro.accounts);
    expect(LIMITS.pro.accounts).toBeLessThan(LIMITS.elite.accounts);
    expect(LIMITS.free.jarvisPerDay).toBeLessThan(LIMITS.pro.jarvisPerDay);
    expect(LIMITS.pro.jarvisPerDay).toBeLessThan(LIMITS.elite.jarvisPerDay);
    expect(LIMITS.free.tradesPerMonth).toBeLessThan(LIMITS.pro.tradesPerMonth);
  });

  it("dit « aucune limite » avec Infinity, pas avec un grand nombre", () => {
    // Un 9999 magique finit toujours par être atteint par quelqu'un.
    expect(LIMITS.elite.jarvisPerDay).toBe(Infinity);
    expect(LIMITS.elite.accounts).toBe(Infinity);
    expect(LIMITS.pro.tradesPerMonth).toBe(Infinity);
  });
});
