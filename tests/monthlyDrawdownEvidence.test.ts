import { describe, expect, it } from "bun:test";
import { buildMonthlyReport } from "../src/domain/monthlyReport";
import type { Trade } from "../src/domain/trade";

function trade(id: string, entryTime: string, exitTime: string, pnl: number): Trade {
  return {
    id,
    date: "2026-07-01",
    symbol: "NQ",
    direction: "long",
    pnl,
    riskAmount: 100,
    rMultiple: pnl / 100,
    strategy: "opening",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime,
    exitTime,
    confluences: [],
    confidence: 50,
  };
}

describe("monthly report — realized drawdown evidence", () => {
  it("computes the reference equity drawdown in closing order", () => {
    const rows = [
      trade("opens-first-closes-last", "09:30", "12:00", -100),
      trade("first-close", "10:00", "10:15", 200),
      trade("second-close", "11:00", "11:15", -150),
    ];
    const report = buildMonthlyReport("2026-07", rows, [], 25000);
    expect(report.maxDrawdown).toBe(250);
  });

  it("does not report a guessed drawdown for simultaneous exits", () => {
    const rows = [trade("a", "09:30", "10:00", 200), trade("b", "09:40", "10:00", -100)];
    const report = buildMonthlyReport("2026-07", rows, [], 25000);
    expect(report.maxDrawdown).toBeNull();
  });

  it("cannot infer the date of an overnight exit from HH:MM alone", () => {
    const report = buildMonthlyReport(
      "2026-07",
      [trade("overnight", "23:30", "00:15", -100)],
      [],
      25000,
    );
    expect(report.maxDrawdown).toBeNull();
  });
});
