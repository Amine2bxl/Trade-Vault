import { test, expect } from "bun:test";
import { analyzeBehavior, toBehaviorLines } from "../src/modules/trading/behavior";
import type { Trade } from "../src/app/types";

const NOW = new Date("2026-07-21T12:00:00Z");

function trade(p: Partial<Trade> & { date: string; pnl: number }): Trade {
  return {
    id: Math.random().toString(36).slice(2),
    symbol: "ES",
    direction: p.pnl > 0 ? "long" : p.pnl < 0 ? "short" : "be",
    riskAmount: 100,
    rMultiple: p.pnl / 100,
    strategy: "breakout",
    mistakes: [],
    setupQuality: 3,
    notes: "n",
    screenshots: [],
    entryTime: "",
    exitTime: "",
    confluences: [],
    confidence: 3,
    ...p,
  } as Trade;
}

test("insufficient sample: nothing is significant, no lines emitted", () => {
  const report = analyzeBehavior(
    [trade({ date: "2026-07-20", pnl: 100 }), trade({ date: "2026-07-21", pnl: -50 })],
    NOW,
  );
  expect(report.postLoss.significant).toBe(false);
  expect(report.overtrading.significant).toBe(false);
  expect(report.timing.significant).toBe(false);
  // Only mistake-cost lines could appear, and there are no tagged mistakes.
  expect(toBehaviorLines(report)).toEqual([]);
});

test("post-loss degradation is detected with same-day sequels", () => {
  const trades: Trade[] = [];
  // 10 days: each day a losing trade then a follow-up loser (chronological via entryTime).
  for (let d = 1; d <= 10; d++) {
    const date = `2026-07-${String(d).padStart(2, "0")}`;
    trades.push(trade({ date, pnl: -100, entryTime: `${date}T09:00:00Z` }));
    trades.push(trade({ date, pnl: -60, entryTime: `${date}T09:10:00Z` }));
    trades.push(trade({ date, pnl: 120, entryTime: `${date}T14:00:00Z` }));
  }
  const r = analyzeBehavior(trades, NOW).postLoss;
  expect(r.significant).toBe(true);
  // Follow-ups after a loss: the -60 (after -100) and the +120 (after -60) → 50% winrate…
  expect(r.sampleSize).toBe(20);
  // …and every -60 was entered 10 min after a loss → revenge.
  expect(r.revengeCount).toBe(10);
  expect(r.revengeTotalPnl).toBe(-600);
  expect(r.postLossWinRate).toBeLessThan(r.baselineWinRate + 0.2);
});

test("overtrading: trades beyond the daily average are costed", () => {
  const trades: Trade[] = [];
  // 5 days × 2 profitable trades, then 5 days × 4 trades where extras lose.
  for (let d = 1; d <= 5; d++) {
    const date = `2026-06-${String(d).padStart(2, "0")}`;
    trades.push(trade({ date, pnl: 80, entryTime: `${date}T09:00:00Z` }));
    trades.push(trade({ date, pnl: 60, entryTime: `${date}T10:00:00Z` }));
  }
  for (let d = 10; d <= 14; d++) {
    const date = `2026-06-${d}`;
    trades.push(trade({ date, pnl: 50, entryTime: `${date}T09:00:00Z` }));
    trades.push(trade({ date, pnl: 40, entryTime: `${date}T10:00:00Z` }));
    trades.push(trade({ date, pnl: -70, entryTime: `${date}T11:00:00Z` }));
    trades.push(trade({ date, pnl: -90, entryTime: `${date}T12:00:00Z` }));
  }
  const r = analyzeBehavior(trades, NOW).overtrading;
  expect(r.significant).toBe(true);
  expect(r.threshold).toBe(3); // avg = 30/10 = 3
  expect(r.excessCount).toBe(5); // the 4th trade of the 5 heavy days
  expect(r.excessTotalPnl).toBe(-450);
});

test("timing: best and worst weekday need at least MIN_BUCKET trades each", () => {
  const trades: Trade[] = [];
  // Mondays win (6 & 13 & 20 July 2026 are Mondays), Fridays lose.
  for (const date of ["2026-07-06", "2026-07-13", "2026-07-20"]) {
    trades.push(trade({ date, pnl: 100 }), trade({ date, pnl: 80 }));
  }
  for (const date of ["2026-07-03", "2026-07-10", "2026-07-17"]) {
    trades.push(trade({ date, pnl: -90 }), trade({ date, pnl: -70 }));
  }
  const r = analyzeBehavior(trades, NOW).timing;
  expect(r.significant).toBe(true);
  expect(r.bestDay?.dow).toBe(1); // Monday
  expect(r.worstDay?.dow).toBe(5); // Friday
  expect(r.worstDay?.totalPnl).toBe(-480);
});

test("mistake costs: monthly split and previous-month trend", () => {
  const trades: Trade[] = [
    trade({ date: "2026-07-05", pnl: -200, mistakes: ["fomo"] }),
    trade({ date: "2026-07-12", pnl: -100, mistakes: ["fomo"] }),
    trade({ date: "2026-06-20", pnl: -400, mistakes: ["fomo"] }),
    trade({ date: "2026-07-15", pnl: 50 }),
  ];
  const r = analyzeBehavior(trades, NOW).mistakeCosts;
  expect(r.rows[0].name).toBe("fomo");
  expect(r.rows[0].monthPnl).toBe(-300);
  expect(r.rows[0].monthCount).toBe(2);
  expect(r.rows[0].prevMonthPnl).toBe(-400);
  expect(r.monthTotal).toBe(-300);
  expect(r.prevMonthTotal).toBe(-400);
  expect(r.monthTradeShareTagged).toBe(0.67);
});

test("example trades never feed the engine", () => {
  const r = analyzeBehavior(
    [trade({ date: "2026-07-20", pnl: -500, mistakes: ["fomo"], isExample: true })],
    NOW,
  );
  expect(r.sampleSize).toBe(0);
  expect(r.mistakeCosts.rows).toEqual([]);
});

test("lines only surface significant findings and cap their count", () => {
  const trades: Trade[] = [];
  for (let d = 1; d <= 12; d++) {
    const date = `2026-07-${String(d).padStart(2, "0")}`;
    trades.push(trade({ date, pnl: d % 2 ? 50 : -60, mistakes: d % 2 ? [] : ["fomo"] }));
  }
  const lines = toBehaviorLines(analyzeBehavior(trades, NOW));
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.length).toBeLessThanOrEqual(12);
  expect(lines.join(" ")).toContain("fomo");
});
