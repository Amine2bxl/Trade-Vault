import { describe, it, expect } from "bun:test";
import { computeStats, formatPnl, formatPct, getDuration } from "../src/app/utils/tradeCalcs";
import type { Trade } from "../src/app/types";

function mkTrade(over: Partial<Trade>): Trade {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    date: "2026-07-01",
    symbol: "TSLA",
    direction: "long",
    pnl: 0,
    riskAmount: 100,
    rMultiple: 0,
    strategy: "Scalping",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: 70,
    ...over,
  };
}

describe("computeStats", () => {
  it("returns zeroed stats for empty input", () => {
    const s = computeStats([]);
    expect(s.totalTrades).toBe(0);
    expect(s.totalPnl).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.bestTrade).toBeNull();
    expect(s.equityCurve).toEqual([]);
  });

  it("computes total PnL and win/loss counts", () => {
    const s = computeStats([mkTrade({ pnl: 200 }), mkTrade({ pnl: -100 }), mkTrade({ pnl: 300 })]);
    expect(s.totalPnl).toBe(400);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3);
  });

  it("excludes break-even trades from the win rate", () => {
    const s = computeStats([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: 0, direction: "be" }),
    ]);
    expect(s.breakEven).toBe(1);
    expect(s.winRate).toBeCloseTo(0.5); // 1W / (1W + 1L), BE ignored
  });

  it("computes max drawdown peak-to-trough in date order", () => {
    const s = computeStats([
      mkTrade({ date: "2026-07-01", pnl: 500 }),
      mkTrade({ date: "2026-07-02", pnl: -300 }),
      mkTrade({ date: "2026-07-03", pnl: -400 }),
      mkTrade({ date: "2026-07-04", pnl: 200 }),
    ]);
    // equity: 500 → 200 → -200 → 0; peak 500, trough -200
    expect(s.maxDrawdown).toBe(700);
  });

  it("profit factor is 99 when there are no losses", () => {
    const s = computeStats([mkTrade({ pnl: 100 }), mkTrade({ pnl: 50 })]);
    expect(s.profitFactor).toBe(99);
  });

  it("profit factor = grossProfit / grossLoss", () => {
    const s = computeStats([mkTrade({ pnl: 300 }), mkTrade({ pnl: -100 })]);
    expect(s.profitFactor).toBeCloseTo(3);
  });

  it("tracks the current streak from the most recent trade backwards", () => {
    const s = computeStats([
      mkTrade({ date: "2026-07-01", pnl: -50 }),
      mkTrade({ date: "2026-07-02", pnl: 100 }),
      mkTrade({ date: "2026-07-03", pnl: 150 }),
    ]);
    expect(s.currentStreakType).toBe("win");
    expect(s.currentStreak).toBe(2);
  });

  it("rounds equity curve values to cents (float noise stays out)", () => {
    const s = computeStats([
      mkTrade({ date: "2026-07-01", pnl: 0.1 }),
      mkTrade({ date: "2026-07-02", pnl: 0.2 }),
    ]);
    expect(s.equityCurve[1].equity).toBe(0.3); // not 0.30000000000000004
  });

  it("aggregates daily PnL across trades on the same date", () => {
    const s = computeStats([
      mkTrade({ date: "2026-07-01", pnl: 100 }),
      mkTrade({ date: "2026-07-01", pnl: -40 }),
    ]);
    expect(s.dailyPnl["2026-07-01"]).toBe(60);
  });

  it("attributes PnL to mistake tags", () => {
    const s = computeStats([
      mkTrade({ pnl: -200, mistakes: ["FOMO"] }),
      mkTrade({ pnl: -100, mistakes: ["FOMO", "Oversized"] }),
    ]);
    expect(s.mistakeStats["FOMO"].count).toBe(2);
    expect(s.mistakeStats["FOMO"].totalPnl).toBe(-300);
    expect(s.mistakeStats["Oversized"].count).toBe(1);
  });

  it("identifies best and worst trades", () => {
    const best = mkTrade({ id: "best", pnl: 900 });
    const worst = mkTrade({ id: "worst", pnl: -450 });
    const s = computeStats([mkTrade({ pnl: 10 }), best, worst]);
    expect(s.bestTrade?.id).toBe("best");
    expect(s.worstTrade?.id).toBe("worst");
  });
});

describe("formatPnl", () => {
  it("formats gains with +$ and losses with -$", () => {
    expect(formatPnl(1234.5)).toBe("+$1,234.50");
    expect(formatPnl(-99.999)).toBe("-$100.00");
  });
  it("treats sub-cent values as zero", () => {
    expect(formatPnl(0.004)).toBe("$0.00");
    expect(formatPnl(-0.004)).toBe("$0.00");
  });
});

describe("formatPct", () => {
  it("formats a ratio as a percentage with 1 decimal", () => {
    expect(formatPct(0.545)).toBe("54.5%");
  });
});

describe("getDuration", () => {
  it("computes simple durations", () => {
    expect(getDuration("09:30", "10:45")).toBe("1h 15m");
    expect(getDuration("09:30", "09:31")).toBe("1m");
  });
  it("wraps across midnight", () => {
    expect(getDuration("23:30", "00:30")).toBe("1h 0m");
  });
  it("returns a dash when times are missing", () => {
    expect(getDuration("", "10:00")).toBe("—");
  });
});
