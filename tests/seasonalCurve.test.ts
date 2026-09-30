import { describe, expect, test } from "bun:test";
import {
  assetEquity,
  normalizeSymbol,
  readSeasonalPath,
  seasonalPath,
  tradeMatchesAsset,
} from "../src/app/features/seasonality/seasonalCurve";
import type { Trade } from "../src/app/types";

describe("la courbe saisonnière compose les mois", () => {
  test("départ à 0 %, treize points, composition et non somme", () => {
    const p = seasonalPath([10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(p).toHaveLength(13);
    expect(p[0]).toEqual({ step: 0, cum: 0 });
    expect(p[1].cum).toBe(10);
    expect(p[2].cum).toBe(21); // 1.1 × 1.1 − 1, pas 20
    expect(p[12].cum).toBe(21);
  });

  test("lecture : à date, restant, sommet, creux, drawdown", () => {
    const path = seasonalPath([5, 5, -10, -10, 5, 0, 0, 0, 0, 0, 0, 10]);
    const r = readSeasonalPath(path, 2); // on est en mars
    expect(r.toDate).toBe(10.25);
    // (1 + year) / (1 + toDate) − 1
    expect(r.remaining).toBeCloseTo(((1 + r.year / 100) / 1.1025 - 1) * 100, 1);
    expect(r.peak.month).toBe(1); // février : +10,25 %, jamais repris ensuite
    expect(r.trough.month).toBe(3);
    // Du sommet de février (1.1025) au creux d'avril (1.1025 × 0.81) : −19 %.
    expect(r.maxDrawdown).toBe(19);
  });
});

describe("les trades du journal sont rattachés au bon actif", () => {
  test("alias de courtier, préfixes de place, suffixes et échéances", () => {
    expect(normalizeSymbol("BINANCE:BTCUSDT")).toBe("BTCUSDT");
    expect(normalizeSymbol("US500.cash")).toBe("US500");
    expect(normalizeSymbol("eur/usd")).toBe("EURUSD");
    expect(tradeMatchesAsset("NAS100", { symbol: "NDX" })).toBe(true);
    expect(tradeMatchesAsset("NQZ4", { symbol: "NDX" })).toBe(true);
    expect(tradeMatchesAsset("DAX40", { symbol: "DAX" })).toBe(true);
    expect(tradeMatchesAsset("GER40.pro", { symbol: "DAX" })).toBe(true);
    expect(tradeMatchesAsset("XAUUSDm", { symbol: "XAUUSD" })).toBe(true);
    expect(tradeMatchesAsset("EUR/USD", { symbol: "EURUSD" })).toBe(true);
  });

  test("pas de correspondance floue", () => {
    expect(tradeMatchesAsset("ETHUSD", { symbol: "BTC" })).toBe(false);
    expect(tradeMatchesAsset("EURGBP", { symbol: "EURUSD" })).toBe(false);
    expect(tradeMatchesAsset("", { symbol: "SPX" })).toBe(false);
  });

  test("equity dans l'ordre chronologique et P&L par mois civil", () => {
    const t = (date: string, symbol: string, pnl: number, entryTime = "") =>
      ({ date, symbol, pnl, entryTime }) as Trade;
    const eq = assetEquity(
      [
        t("2026-03-02", "US100", 50, "10:00"),
        t("2025-11-10", "NAS100", -20),
        t("2026-03-02", "NAS100", 30, "09:00"),
        t("2026-03-05", "EURUSD", 999),
      ],
      { symbol: "NDX" },
    );
    expect(eq.points.map((p) => p.cum)).toEqual([-20, 10, 60]);
    expect(eq.total).toBe(60);
    expect(eq.byMonth[2]).toEqual({ pnl: 80, trades: 2 });
    expect(eq.byMonth[10]).toEqual({ pnl: -20, trades: 1 });
    expect(eq.symbols.sort()).toEqual(["NAS100", "US100"]);
  });
});
