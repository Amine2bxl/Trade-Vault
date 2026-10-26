import { describe, expect, it } from "bun:test";
import { analyzeTrade } from "../src/modules/trading/analysis/engine";
import type { Trade } from "../src/domain/trade";
import type { AnalysisContext } from "../src/modules/trading/analysis/types";

const trade = (over: Partial<Trade> = {}): Trade => ({
  id: "T1",
  date: "2026-10-26",
  symbol: "NQ",
  direction: "long",
  pnl: 200,
  riskAmount: 100,
  rMultiple: 0,
  strategy: "test",
  mistakes: [],
  setupQuality: 4,
  notes: "",
  screenshots: [],
  entryTime: "10:30",
  exitTime: "11:00",
  confluences: ["sweep"],
  confidence: 80,
  ...over,
});
const ctx = (over: Partial<AnalysisContext> = {}): AnalysisContext => ({
  sameDayTrades: [],
  accountBalance: 25000,
  ...over,
});

describe("trade-analysis evidence integrity", () => {
  it("does not reward missing execution or discipline evidence with 70/100", () => {
    const out = analyzeTrade(trade({ mfe: null }), ctx());
    expect(out.executionScore).toBeNull();
    expect(out.disciplineScore).toBeNull();
    expect(out.score).toBeNull();
    expect(out.grade).toBeNull();
    expect(out.coveragePct).toBe(55);
    expect(out.flags.some((f) => f.code === "clean_execution")).toBe(false);
    expect(out.flags.some((f) => f.code === "insufficient_evidence")).toBe(true);
  });

  it("requires an audited entry balance before computing risk percentage", () => {
    expect(analyzeTrade(trade(), ctx()).riskPct).toBeNull();
    expect(
      analyzeTrade(trade(), ctx({ balanceIsAtEntry: true })).riskPct,
    ).toBeCloseTo(0.4);
  });

  it("never treats a staged import's default quality grade as trader evidence", () => {
    const out = analyzeTrade(trade({ reviewPending: true, setupQuality: 3 }), ctx());
    expect(out.setupScore).toBeNull();
    expect(out.score).toBeNull();
  });

  it("derives realized R from observed PnL and risk rather than stale rMultiple", () => {
    expect(analyzeTrade(trade(), ctx()).rMultiple).toBe(2);
    expect(analyzeTrade(trade({ riskAmount: 0 }), ctx()).rMultiple).toBeNull();
  });

  it("does not use losses that closed AFTER the trade was entered", () => {
    const future = [
      { entryTime: "09:30", exitTime: "12:00", pnl: -100, direction: "short" },
      { entryTime: "09:45", exitTime: "11:30", pnl: -100, direction: "long" },
    ];
    const out = analyzeTrade(trade(), ctx({ sameDayTrades: future }));
    expect(out.flags.some((f) => f.code === "revenge_window")).toBe(false);
  });

  it("labels observed post-loss entries without claiming a psychological cause", () => {
    const earlier = [
      { entryTime: "09:30", exitTime: "09:50", pnl: -100, direction: "short" },
      { entryTime: "10:00", exitTime: "10:15", pnl: -100, direction: "long" },
    ];
    const out = analyzeTrade(trade(), ctx({ sameDayTrades: earlier }));
    const message = out.flags.find((f) => f.code === "revenge_window")?.detail;
    expect(message).toContain("had closed at a loss");
    expect(message).toContain("cannot be inferred");
  });

  it("issues a full composite only if every weighted component is measurable", () => {
    const out = analyzeTrade(
      trade({ mfe: 250 }),
      ctx({ verifiedRuleAdherencePct: 90 }),
    );
    expect(out.executionScore).toBe(80);
    expect(out.coveragePct).toBe(100);
    expect(out.score).not.toBeNull();
    expect(out.grade).not.toBeNull();
  });

  it("never calls a loss beyond 1.5R proof of a moved stop", () => {
    const out = analyzeTrade(
      trade({ pnl: -200, riskAmount: 100, direction: "short" }),
      ctx(),
    );
    const reason = out.flags.find((f) => f.code === "negative_expectancy_rr")?.detail;
    expect(reason).toContain("does not establish whether a stop was moved");
  });
});
