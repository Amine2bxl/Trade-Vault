import { describe, expect, it } from "bun:test";
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

  it("also quarantines snapshots from an unsupported future method version", () => {
    const unknown = { ...current, reportMethodVersion: 999, sortino: 9 };
    expect(isLegacyMonthlyReport(unknown)).toBe(true);
    expect(readArchivedMonthlyReport(unknown).sortino).toBeNull();
  });
});
