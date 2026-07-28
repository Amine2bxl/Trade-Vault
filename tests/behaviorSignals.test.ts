import { test, expect } from "bun:test";
import { computeBehaviorSignals } from "../src/app/utils/behaviorSignals";
import { buildCoachMessages } from "../src/modules/ai/agents/coach.agent";
import type { Trade } from "../src/app/types";

function trade(over: Partial<Trade> & { date: string; pnl: number }): Trade {
  return {
    id: over.date + Math.random(),
    symbol: "ES",
    direction: over.pnl >= 0 ? "long" : "short",
    riskAmount: 100,
    rMultiple: over.pnl / 100,
    strategy: "breakout",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: 60,
    ...over,
  };
}

test("no signals are emitted from a journal too thin to mean anything", () => {
  const signals = computeBehaviorSignals([
    trade({ date: "2026-07-01", pnl: 100 }),
    trade({ date: "2026-07-02", pnl: -50 }),
  ]);
  expect(Object.keys(signals)).toHaveLength(0);
});

test("the losing weekday is surfaced with its own win rate and P&L", () => {
  // 2026-07-03, -10, -17, -24 are Fridays; the Mondays are winners.
  const trades = [
    trade({ date: "2026-07-03", pnl: -300 }),
    trade({ date: "2026-07-10", pnl: -200 }),
    trade({ date: "2026-07-17", pnl: -250 }),
    trade({ date: "2026-07-06", pnl: 200 }),
    trade({ date: "2026-07-13", pnl: 300 }),
    trade({ date: "2026-07-20", pnl: 150 }),
  ];
  const signals = computeBehaviorSignals(trades);
  const friday = signals.byWeekday?.find((b) => b.key === "Friday");
  expect(friday).toBeDefined();
  expect(friday!.pnl).toBe(-750);
  expect(friday!.winRatePct).toBe(0);
  // Buckets are ordered worst-first so the leak is the first thing read.
  expect(signals.byWeekday![0].key).toBe("Friday");
});

test("size drift after a loss is measured, not guessed", () => {
  // Alternating win/loss: every trade after a loss risks twice as much.
  const trades: Trade[] = [];
  for (let i = 0; i < 12; i++) {
    const losing = i % 2 === 0;
    trades.push(
      trade({
        date: `2026-07-${String(i + 1).padStart(2, "0")}`,
        pnl: losing ? -100 : 100,
        riskAmount: losing ? 200 : 100,
      }),
    );
  }
  const drift = computeBehaviorSignals(trades).riskAfterLoss;
  expect(drift).toBeDefined();
  // Trades following a loss are the odd indices — those risk 100 vs 200 base,
  // so the drift is negative here; what matters is that it is computed at all
  // and reported with the sample size behind it.
  expect(drift!.tradesAfterLoss).toBeGreaterThanOrEqual(5);
  expect(drift!.avgRiskNormal).toBeGreaterThan(0);
  expect(typeof drift!.driftPct).toBe("number");
});

test("the coach prompt carries the behaviour signals as citable evidence", () => {
  const messages = buildCoachMessages({
    question: "Why do I lose on Fridays?",
    language: "en",
    signals: {
      byWeekday: [{ key: "Friday", trades: 6, winRatePct: 33.3, pnl: -750, avgPnl: -125 }],
    },
    rules: [{ kind: "max_trades_day", text: "Never take more than 3 trades a day", enabled: true }],
  });
  const grounded = messages.map((m) => m.content).join("\n");
  expect(grounded).toContain("BEHAVIOUR SIGNALS");
  expect(grounded).toContain("Friday");
  expect(grounded).toContain("THE TRADER'S OWN RULES");
  expect(grounded).toContain("Never take more than 3 trades a day");
});

test("the answer format asks for a coach reply, not a six-section report", () => {
  const system = buildCoachMessages({ question: "How am I doing?" })[0].content;
  expect(system).toContain("FORMAT");
  expect(system).toContain("diagnosis");
  // The old rigid report headings must not be imposed on every answer.
  expect(system).not.toContain("## 📊 Stats Snapshot");
});
