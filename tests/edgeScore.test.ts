import { expect, test } from "bun:test";
import { computeEdgeScore, riskThreshold, deriveDailyRule } from "../src/domain/edgeScore";
import { computeStats } from "../src/domain/tradeCalcs";
import type { Trade } from "../src/app/types";

function trade(over: Partial<Trade> & { date: string; id: string }): Trade {
  return {
    symbol: "NQ",
    direction: "long",
    strategy: "",
    pnl: 100,
    rMultiple: 1,
    riskAmount: 100,
    setupQuality: 3,
    confluences: [],
    mistakes: [],
    screenshots: [],
    notes: "",
    entryTime: "10:00",
    exitTime: "10:10",
    confidence: 50,
    ...over,
  } as Trade;
}
const sample = Array.from({ length: 10 }, (_, i) =>
  trade({
    id: "t" + i,
    date: "2026-07-" + String(10 + Math.floor(i / 2)).padStart(2, "0"),
  }),
);
const verified = Object.fromEntries(sample.map((t) => [t.id, "PASS" as const]));
const balances = Object.fromEntries(sample.map((t) => [t.id, 25000]));
const inputs = {
  ruleEvidenceByTradeId: verified,
  verifiedBalanceBeforeTrade: balances,
  riskPlanVersionVerified: true,
  maxRiskPct: 1,
};

test("no observations means no score or coverage", () => {
  const r = computeEdgeScore([]);
  expect(r.score).toBeNull();
  expect(r.coveragePct).toBe(0);
});

test("absence of mistake tags must never imply a verified 100/100 score", () => {
  const r = computeEdgeScore(sample);
  expect(r.score).toBeNull();
  expect(r.coveragePct).toBe(0);
  expect(r.subs.cleanTrades.value).toBeNull();
  expect(r.subs.cleanDays.value).toBeNull();
  expect(r.weakest).toBeNull();
});

test("removing self-reported mistakes cannot improve an evidence-based score", () => {
  const tagged = sample.map((t, i) => ({ ...t, mistakes: i % 2 ? ["FOMO"] : [] }));
  const untagged = tagged.map((t) => ({ ...t, mistakes: [] }));
  expect(computeEdgeScore(tagged, inputs)).toEqual(computeEdgeScore(untagged, inputs));
});

test("full historic coverage across at least five sessions enables a grade", () => {
  const r = computeEdgeScore(sample, inputs);
  expect(r.score).toBe(100);
  expect(r.coveragePct).toBe(100);
  expect(r.subs.cleanTrades.value).toBe(100);
  expect(r.subs.cleanDays.value).toBe(100);
  expect(r.cleanDays).toBe(5);
  expect(r.verifiedDays).toBe(5);
});

test("violations lower the score even if no mistakes were self-reported", () => {
  const evidence = { ...verified, t0: "FAIL" as const };
  const r = computeEdgeScore(sample, { ...inputs, ruleEvidenceByTradeId: evidence });
  expect(r.subs.cleanTrades.value).toBe(90);
  expect(r.subs.cleanDays.value).toBe(80);
  expect(r.score).toBe(94);
  expect(r.weakest).toBe("cleanTrades");
});

test("unknown rule versions or historical entry balances block scoring", () => {
  expect(computeEdgeScore(sample, { ...inputs, verifiedBalanceBeforeTrade: {} }).score).toBeNull();
  expect(computeEdgeScore(sample, { ...inputs, riskPlanVersionVerified: false }).score).toBeNull();
  expect(
    computeEdgeScore(sample, {
      ...inputs,
      verifiedBalanceBeforeTrade: { ...balances, t0: 0 },
    }).score,
  ).toBeNull();
});

test("partial evidence reports coverage instead of promoting a partial 100%", () => {
  const r = computeEdgeScore(sample, {
    ...inputs,
    ruleEvidenceByTradeId: { t0: "PASS" },
  });
  expect(r.score).toBeNull();
  expect(r.subs.cleanTrades.value).toBe(100);
  expect(r.subs.cleanDays.value).toBeNull();
  expect(r.coveragePct).toBe(42);
});

test("risk uses each actual balance at the time of entry", () => {
  const highRisk = sample.map((t, i) => (i === 0 ? { ...t, riskAmount: 300 } : t));
  const r = computeEdgeScore(highRisk, inputs);
  expect(r.subs.risk.value).toBe(90);
  expect(r.score).toBe(97);
});

test("self-recorded checklist is shown separately and never graded", () => {
  const checklistByDay = Object.fromEntries(sample.map((t) => [t.date, 1]));
  const r = computeEdgeScore(sample, { checklistByDay });
  expect(r.subs.routine.value).toBe(100);
  expect(r.score).toBeNull();
});

test("10 trades across fewer than five sessions are insufficient", () => {
  expect(computeEdgeScore(sample.slice(0, 8), inputs).score).toBeNull();
  const sameDay = sample.map((t) => ({ ...t, date: "2026-07-15" }));
  expect(computeEdgeScore(sameDay, inputs).score).toBeNull();
});

test("risk threshold cannot invent a plan by multiplying the historical median", () => {
  expect(riskThreshold(sample, null, null)).toBeNull();
  expect(riskThreshold(sample, 1, 50000)).toBe(500);
});

test("last ten trading sessions determine the window", () => {
  const older = Array.from({ length: 6 }, (_, i) =>
    trade({ id: "old" + i, date: "2026-06-" + String(i + 10).padStart(2, "0") }),
  );
  const r = computeEdgeScore([...sample, ...older], inputs);
  expect(r.tradedDays).toBe(10);
  expect(r.score).toBeNull();
});

test("the daily focus uses associated PnL, never proven causal cost", () => {
  const dirty = [
    trade({ id: "a", date: "2026-07-20", pnl: -640, mistakes: ["revenge trade"] }),
    trade({ id: "b", date: "2026-07-21", pnl: -50, mistakes: ["early exit"] }),
  ];
  const rule = deriveDailyRule(computeStats(dirty));
  expect(rule?.text).toBe("revenge trade");
  expect(rule?.leak).toContain("640");
  expect(deriveDailyRule(computeStats([sample[0]])).toBeNull();
});
