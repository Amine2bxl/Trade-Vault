import { describe, it, expect } from "bun:test";
import {
  applyFilter,
  encodeFilter,
  decodeFilter,
  sanitizeFilter,
  type UnifiedFilter,
} from "../tradeFilter";
import type { Trade } from "../../types";

/**
 * Filtre unifié — non-régression.
 *
 * Le filtre est le fondement des deep-links et du claim→evidence : s'il ment,
 * Jarvis ment. On couvre les dimensions, le contexte séquentiel et la
 * sérialisation round-trip.
 */

let seq = 0;
function trade(partial: Partial<Trade>): Trade {
  return {
    id: `t${++seq}`,
    date: "2026-08-05",
    symbol: "NQ",
    direction: "long",
    pnl: 100,
    riskAmount: 200,
    rMultiple: 0.5,
    strategy: "SMT",
    mistakes: [],
    setupQuality: 4,
    notes: "",
    screenshots: [],
    entryTime: "10:00",
    exitTime: "10:30",
    confluences: [],
    confidence: 70,
    ...partial,
  };
}

// 2026-08-05 est un mercredi (getDay() = 3).

describe("applyFilter — dimensions simples", () => {
  it("filtre par instrument", () => {
    const trades = [trade({ symbol: "NQ" }), trade({ symbol: "ES" })];
    expect(applyFilter(trades, { symbol: "NQ" }).map((t) => t.symbol)).toEqual(["NQ"]);
  });

  it("filtre par résultat (win / loss / be)", () => {
    const trades = [
      trade({ pnl: 100, direction: "long" }),
      trade({ pnl: -50, direction: "long" }),
      trade({ pnl: 0, direction: "be" }),
    ];
    expect(applyFilter(trades, { result: "win" }).length).toBe(1);
    expect(applyFilter(trades, { result: "loss" }).length).toBe(1);
    expect(applyFilter(trades, { result: "be" }).length).toBe(1);
  });

  it("filtre par setup, erreur, confluence, A+", () => {
    const trades = [
      trade({ strategy: "SMT", mistakes: ["FOMO"], setupQuality: 5, confluences: ["FVG"] }),
      trade({ strategy: "ORB", mistakes: [], setupQuality: 2, confluences: [] }),
    ];
    expect(applyFilter(trades, { strategy: "SMT" }).length).toBe(1);
    expect(applyFilter(trades, { mistake: "FOMO" }).length).toBe(1);
    expect(applyFilter(trades, { aplus: true }).length).toBe(1);
    expect(applyFilter(trades, { confluence: "FVG" }).length).toBe(1);
  });

  it("filtre par jour de semaine (0=dimanche)", () => {
    const trades = [trade({ date: "2026-08-05" }), trade({ date: "2026-08-09" })]; // mercredi + dimanche
    expect(applyFilter(trades, { weekday: 3 }).length).toBe(1);
    expect(applyFilter(trades, { weekday: 0 }).length).toBe(1);
  });

  it("filtre par session et heure", () => {
    const ny = trade({ entryTime: "10:00" }); // newyork
    const ldn = trade({ entryTime: "03:00" }); // london
    expect(applyFilter([ny, ldn], { session: "newyork" }).length).toBe(1);
    expect(applyFilter([ny, ldn], { hour: 10 }).length).toBe(1);
  });
});

describe("applyFilter — période", () => {
  it("coupe selon la période relative", () => {
    const recent = trade({ date: "2026-08-04" });
    const old = trade({ date: "2020-01-01" });
    expect(applyFilter([recent, old], { period: "30d" }).length).toBe(1);
    expect(applyFilter([recent, old], { period: "all" }).length).toBe(2);
  });
});

describe("applyFilter — contexte séquentiel", () => {
  it("marque le trade qui suit immédiatement une perte", () => {
    const a = trade({ id: "a", date: "2026-08-04", pnl: -100 });
    const b = trade({ id: "b", date: "2026-08-05", pnl: 50 });
    const c = trade({ id: "c", date: "2026-08-06", pnl: 20 });
    const result = applyFilter([a, b, c], { context: "after_loss" });
    expect(result.map((t) => t.id)).toEqual(["b"]);
  });

  it("un BE précédent interrompt la chaîne after_loss", () => {
    const a = trade({ id: "a", date: "2026-08-04", pnl: -100 });
    const be = trade({ id: "be", date: "2026-08-05", pnl: 0, direction: "be" });
    const c = trade({ id: "c", date: "2026-08-06", pnl: 20 });
    // "be" suit la perte → after_loss ; "c" suit un BE → pas after_loss.
    const result = applyFilter([a, be, c], { context: "after_loss" });
    expect(result.map((t) => t.id)).toEqual(["be"]);
  });
});

describe("encode / decode", () => {
  it("round-trip complet", () => {
    const f: UnifiedFilter = {
      period: "30d",
      result: "loss",
      session: "newyork",
      aplus: true,
      trades: ["t1", "t2"],
    };
    expect(decodeFilter(encodeFilter(f))).toEqual(f);
  });

  it("encodage d'un symbole avec espace", () => {
    const f = { symbol: "NQ 30min" };
    expect(decodeFilter(encodeFilter(f)).symbol).toBe("NQ 30min");
  });

  it("tolère une entrée corrompue", () => {
    expect(decodeFilter("period=banane&weekday=99&result=win")).toEqual({ result: "win" });
  });

  it("filtre vide → chaîne vide", () => {
    expect(encodeFilter({})).toBe("");
  });
});

describe("sanitizeFilter", () => {
  it("écarte les valeurs invalides", () => {
    const f = sanitizeFilter({
      period: "nope" as never,
      weekday: 42,
      direction: "diagonal" as never,
      trades: ["ok", 3 as never, ""],
    });
    expect(f).toEqual({ trades: ["ok"] });
  });
});
