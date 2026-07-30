import { describe, it, expect } from "bun:test";
import { contextBlocks } from "../src/modules/ai/context";

describe("AI context blocks", () => {
  it("returns empty string for empty context", () => {
    expect(contextBlocks({})).toBe("");
  });

  it("includes trade history when present", () => {
    const result = contextBlocks({
      trades: [{ date: "2026-01-01", symbol: "EURUSD", direction: "long", pnl: 100, rMultiple: 2, strategy: "breakout", mistakes: [], setupQuality: 3, confluences: [] }],
    });
    expect(result).toContain("RECENT TRADES");
    expect(result).toContain("EURUSD");
  });

  it("capped to 30 trades max", () => {
    const trades = Array.from({ length: 50 }, (_, i) => ({
      date: "2026-01-01", symbol: "EURUSD", direction: "long", pnl: i,
      rMultiple: 1, strategy: "scalp", mistakes: [], setupQuality: 3, confluences: [],
    }));
    const result = contextBlocks({ trades });
    expect(result).toContain("50");
    expect(result).toContain("omitted");
  });
});
