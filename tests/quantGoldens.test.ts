import { describe, expect, test } from "bun:test";
import { computeStats } from "../src/domain/tradeCalcs";
import { computeQuantStats } from "../src/domain/quantStats";
import { computeBehavioral } from "../src/domain/behavioral";
import type { Trade } from "../src/domain/trade";

/**
 * Independent, hand-worked reference ledger.
 *
 * Closed P&L order is B (+200), C (-150), A (-100), D (+300), E (-50).
 * Cumulative realized P&L: 0 -> 200 -> 50 -> -50 -> 250 -> 200.
 * Net +200, gross profits 500, gross losses 300, peak-to-trough DD 250.
 * Initial capital 25,000: percent DD = 250 / 25,200.
 * Observed R by trade: [-1, +2, -1, +2, -1], average = +0.2R.
 * Three tagged incidents are attached to two trades A and C. Their net
 * P&L is -250, NOT the duplicated per-tag sum of -350.
 *
 * Expected numbers are fixed algebraically, not computed by the engine.
 */
function trade(
  id: string,
  date: string,
  entryTime: string,
  exitTime: string,
  pnl: number,
  riskAmount: number,
  mistakes: string[] = [],
): Trade {
  return {
    id,
    date,
    symbol: "NQ",
    direction: "long",
    pnl,
    riskAmount,
    rMultiple: pnl / riskAmount,
    strategy: "reference",
    mistakes,
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime,
    exitTime,
    confluences: [],
    confidence: 50,
  };
}

const reference = [
  trade("A", "2026-07-01", "09:30", "12:00", -100, 100, ["FOMO", "No stop loss"]),
  trade("B", "2026-07-01", "10:00", "10:15", 200, 100),
  trade("C", "2026-07-01", "11:00", "11:15", -150, 150, ["FOMO"]),
  trade("D", "2026-07-02", "09:30", "10:00", 300, 150),
  trade("E", "2026-07-02", "10:15", "10:30", -50, 50),
];

describe("independent quantitative golden ledger", () => {
  test("realized sums, payoff statistics and signed risk remain correct", () => {
    const stats = computeStats([reference[4], reference[2], reference[0], reference[3], reference[1]]);
    expect(stats.totalPnl).toBe(200);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(3);
    expect(stats.winRate).toBeCloseTo(2 / 5);
    expect(stats.profitFactor).toBeCloseTo(5 / 3);
    expect(stats.avgRR).toBeCloseTo(0.2);
    expect(stats.avgWinR).toBeCloseTo(2);
    expect(stats.avgLossR).toBeCloseTo(-1);
    expect(stats.rSampleSize).toBe(5);
    expect(stats.rCoveragePct).toBe(100);
  });

  test("drawdown uses actual closing order despite overlapping positions", () => {
    const stats = computeStats(reference);
    const quant = computeQuantStats(reference, 25000);
    expect(stats.maxDrawdown).toBe(250);
    expect(stats.maxDrawdownOrderVerified).toBe(true);
    expect(quant.maxDrawdownPct).toBeCloseTo(250 / 25200);
    expect(quant.recoveryDays).toBe(1);
    expect(quant.expectancy).toBe(40);
    expect(quant.expectancyR).toBeCloseTo(0.2);
    expect(quant.sharpe).toBeNull();
    expect(quant.sortino).toBeNull();
  });

  test("multi-tag mistakes count incidents but never duplicate account P&L", () => {
    const behavior = computeBehavioral(reference);
    expect(behavior.totalIncidents).toBe(3);
    expect(behavior.tradesWithMistakes).toBe(2);
    expect(behavior.totalCost).toBe(-250);
    expect(behavior.rows.reduce((sum, row) => sum + row.totalPnl, 0)).toBe(-350);
    expect(behavior.weeklyTrend.reduce((sum, row) => sum + row.cost, 0)).toBe(-250);
  });

  test("absent initial risk remains unknown rather than a measured loss of zero R", () => {
    const noRisk = { ...reference[0], riskAmount: 0, rMultiple: 0 };
    const stats = computeStats([noRisk]);
    const quant = computeQuantStats([noRisk], 25000);
    expect(stats.rSampleSize).toBe(0);
    expect(stats.rCoveragePct).toBe(0);
    expect(quant.expectancyR).toBeNull();
    expect(quant.sharpeStatus).toBe("unverified_returns");
  });
});
