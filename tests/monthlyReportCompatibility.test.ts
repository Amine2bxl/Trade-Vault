import { describe, expect, it } from "bun:test";
import type { Trade } from "../src/domain/trade";
import {
  REPORT_METHOD_VERSION,
  buildMonthlyReport,
  isLegacyMonthlyReport,
  readArchivedMonthlyReport,
} from "../src/domain/monthlyReport";

describe("archived monthly reports — quantitative method compatibility", () => {
  const current = buildMonthlyReport("2026-07", [], [], 25000);

  it("marks freshly calculated snapshots with a method version", () => {
    expect(current.reportMethodVersion).toBe(REPORT_METHOD_VERSION);
    expect(isLegacyMonthlyReport(current)).toBe(false);
  });

  it("does not present unversioned historical estimates or AI claims as verified", () => {
    const { reportMethodVersion: _ignored, ...unversioned } = current;
    const archived = {
      ...unversioned,
      profitFactor: 99,
      expectancyR: 1.2,
      sharpe: 99,
      sortino: 99,
      maxDrawdown: 700,
      bestSetups: [{ strategy: "one trade", pnl: 50, count: 1, winRate: 1 }],
      worstSetups: [{ strategy: "one trade", pnl: -50, count: 1, winRate: 0 }],
      mistakes: [{ name: "FOMO", count: 1, cost: -50 }],
      aiSummary: "Your 99 Sharpe proves a persistent edge.",
    };
    const safe = readArchivedMonthlyReport(archived);
    expect(isLegacyMonthlyReport(safe)).toBe(true);
    expect(safe.profitFactor).toBeNull();
    expect(safe.expectancyR).toBeNull();
    expect(safe.sharpe).toBeNull();
    expect(safe.sortino).toBeNull();
    expect(safe.maxDrawdown).toBeNull();
    expect(safe.bestSetups).toEqual([]);
    expect(safe.worstSetups).toEqual([]);
    expect(safe.mistakes).toEqual([]);
    expect(safe.aiSummary).toBeNull();
    expect(safe.totalPnl).toBe(archived.totalPnl);
    expect(archived.profitFactor).toBe(99); // read-only compatibility, no DB rewrite
  });

  it("preserves legitimate high profit factors from the current verified algorithm", () => {
    const valid = { ...current, profitFactor: 120 };
    expect(readArchivedMonthlyReport(valid)).toBe(valid);
    expect(readArchivedMonthlyReport(valid).profitFactor).toBe(120);
  });

  it("treats overlapping mistake tags as observations, not additive avoidable costs", () => {
    const tagged: Trade = {
      id: "overlap",
      date: "2026-07-01",
      symbol: "NQ",
      direction: "long",
      pnl: -100,
      riskAmount: 100,
      rMultiple: -1,
      strategy: "open",
      mistakes: ["FOMO", "No stop loss"],
      setupQuality: 3,
      notes: "",
      screenshots: [],
      entryTime: "09:30",
      exitTime: "10:00",
      confluences: [],
      confidence: 50,
    };
    const report = buildMonthlyReport("2026-07", [tagged], [], 25000);
    expect(report.totalPnl).toBe(-100);
    expect(report.mistakes).toHaveLength(2);
    expect(report.mistakes.map((m) => m.cost)).toEqual([-100, -100]);
    // Tag rows overlap and must never be summed into a purported cost of errors.
    expect(report.mistakes.reduce((sum, m) => sum + m.cost, 0)).toBe(-200);
  });

  it("also quarantines snapshots from an unsupported future method version", () => {
    const unknown = { ...current, reportMethodVersion: 999, sortino: 9 };
    expect(isLegacyMonthlyReport(unknown)).toBe(true);
    expect(readArchivedMonthlyReport(unknown).sortino).toBeNull();
  });
});
