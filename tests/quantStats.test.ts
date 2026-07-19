import { describe, it, expect } from "bun:test";
import {
  computeQuantStats,
  getSession,
  getMacroEvents,
  statsBySession,
  statsByHour,
  dayHourMatrix,
  winRateOf,
} from "../src/app/utils/quantStats";
import type { Trade } from "../src/app/types";

function mkTrade(over: Partial<Trade>): Trade {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    date: "2026-07-01",
    symbol: "NQ",
    direction: "long",
    pnl: 0,
    riskAmount: 100,
    rMultiple: 0,
    strategy: "Silver Bullet",
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

describe("getSession", () => {
  it("maps ET times to ICT sessions", () => {
    expect(getSession("03:15")).toBe("london");
    expect(getSession("02:00")).toBe("london");
    expect(getSession("08:00")).toBe("newyork");
    expect(getSession("09:30")).toBe("newyork");
    expect(getSession("16:29")).toBe("newyork");
    expect(getSession("16:30")).toBe("asia");
    expect(getSession("20:00")).toBe("asia");
    expect(getSession("00:30")).toBe("asia");
  });
  it("returns null for missing/invalid time", () => {
    expect(getSession("")).toBeNull();
    expect(getSession("xx")).toBeNull();
  });
});

describe("getMacroEvents", () => {
  it("flags NFP on the first Friday of the month", () => {
    expect(getMacroEvents("2026-07-03")).toContain("NFP"); // Fri July 3rd 2026
    expect(getMacroEvents("2026-07-10")).not.toContain("NFP"); // second Friday
    expect(getMacroEvents("2026-07-01")).not.toContain("NFP"); // Wednesday
  });
  it("flags FOMC decision days", () => {
    expect(getMacroEvents("2026-07-29")).toContain("FOMC");
    expect(getMacroEvents("2026-07-28")).not.toContain("FOMC");
  });
});

describe("computeQuantStats", () => {
  it("returns nulls/zeros on empty input", () => {
    const q = computeQuantStats([]);
    expect(q.expectancy).toBe(0);
    expect(q.sharpe).toBeNull();
    expect(q.kelly).toBeNull();
  });

  it("computes expectancy in $ and R", () => {
    const q = computeQuantStats([
      mkTrade({ pnl: 200, riskAmount: 100 }),
      mkTrade({ pnl: -100, riskAmount: 100 }),
    ]);
    expect(q.expectancy).toBe(50); // (200-100)/2
    expect(q.expectancyR).toBeCloseTo(0.5); // (2R + -1R)/2
  });

  it("kelly = W - (1-W)/R", () => {
    // 2 wins avg 200, 2 losses avg 100 → W=0.5, R=2 → 0.5 - 0.5/2 = 0.25
    const q = computeQuantStats([
      mkTrade({ pnl: 200 }),
      mkTrade({ pnl: 200 }),
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -100 }),
    ]);
    expect(q.kelly).toBeCloseTo(0.25);
  });

  it("kelly is null with no losses", () => {
    expect(computeQuantStats([mkTrade({ pnl: 100 })]).kelly).toBeNull();
  });

  it("sharpe/sortino need >= 10 trading days", () => {
    const nine = Array.from({ length: 9 }, (_, i) =>
      mkTrade({ date: `2026-07-0${i + 1}`, pnl: 100 + i }),
    );
    expect(computeQuantStats(nine).sharpe).toBeNull();

    const eleven = Array.from({ length: 11 }, (_, i) =>
      mkTrade({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, pnl: i % 2 === 0 ? 150 : -50 }),
    );
    const q = computeQuantStats(eleven);
    expect(q.sharpe).not.toBeNull();
    expect(q.sharpe!).toBeGreaterThan(0);
    expect(q.sortino).not.toBeNull();
  });

  it("sortino caps at 99 when no losing day", () => {
    const days = Array.from({ length: 12 }, (_, i) =>
      mkTrade({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, pnl: 50 + i }),
    );
    expect(computeQuantStats(days).sortino).toBe(99);
  });

  it("maxDrawdownPct uses starting balance + peak", () => {
    const trades = [
      mkTrade({ date: "2026-07-01", pnl: 500 }),
      mkTrade({ date: "2026-07-02", pnl: -700 }),
    ];
    // maxDD 700, peak 500, base 10000+500 → 700/10500
    const q = computeQuantStats(trades, 10000);
    expect(q.maxDrawdownPct).toBeCloseTo(700 / 10500);
    expect(computeQuantStats(trades, 0).maxDrawdownPct).toBeNull();
  });

  it("recovery: -1 while still in drawdown, days once recovered", () => {
    const still = computeQuantStats([
      mkTrade({ date: "2026-07-01", pnl: 500 }),
      mkTrade({ date: "2026-07-02", pnl: -300 }),
    ]);
    expect(still.recoveryDays).toBe(-1);

    const recovered = computeQuantStats([
      mkTrade({ date: "2026-07-01", pnl: 500 }),
      mkTrade({ date: "2026-07-02", pnl: -300 }),
      mkTrade({ date: "2026-07-05", pnl: 400 }),
    ]);
    expect(recovered.recoveryDays).toBe(3); // 07-02 → 07-05
  });

  it("consistency: best day share of total profit", () => {
    const q = computeQuantStats([
      mkTrade({ date: "2026-07-01", pnl: 800 }),
      mkTrade({ date: "2026-07-02", pnl: 200 }),
    ]);
    expect(q.bestDayShare).toBeCloseTo(0.8);
    expect(q.consistencyScore).toBeCloseTo(20);
    expect(computeQuantStats([mkTrade({ pnl: -100 })]).consistencyScore).toBeNull();
  });

  it("plan adherence = share of mistake-free trades", () => {
    const q = computeQuantStats([
      mkTrade({ mistakes: [] }),
      mkTrade({ mistakes: ["FOMO entry"] }),
      mkTrade({ mistakes: [] }),
      mkTrade({ mistakes: [] }),
    ]);
    expect(q.planAdherence).toBeCloseTo(0.75);
  });
});

describe("breakdowns", () => {
  it("statsBySession buckets by entry time", () => {
    const s = statsBySession([
      mkTrade({ entryTime: "03:00", pnl: 100 }),
      mkTrade({ entryTime: "09:30", pnl: -50 }),
      mkTrade({ entryTime: "09:45", pnl: 75 }),
      mkTrade({ entryTime: "21:00", pnl: 25 }),
    ]);
    expect(s.london.count).toBe(1);
    expect(s.newyork.count).toBe(2);
    expect(s.newyork.pnl).toBe(25);
    expect(s.asia.count).toBe(1);
  });

  it("statsByHour and winRateOf", () => {
    const byHour = statsByHour([
      mkTrade({ entryTime: "09:30", pnl: 100 }),
      mkTrade({ entryTime: "09:55", pnl: -60 }),
      mkTrade({ entryTime: "10:05", pnl: 40 }),
      mkTrade({ entryTime: "09:10", pnl: 0, direction: "be" }),
    ]);
    expect(byHour[9].count).toBe(3);
    expect(winRateOf(byHour[9])).toBeCloseTo(0.5); // 1W/1L, BE excluded
    expect(byHour[10].count).toBe(1);
  });

  it("dayHourMatrix keys are dow-hour", () => {
    const m = dayHourMatrix([mkTrade({ date: "2026-07-01", entryTime: "09:30", pnl: 10 })]);
    expect(m["3-9"].count).toBe(1); // 2026-07-01 = Wednesday
  });
});
