import { expect, test } from "bun:test";
import { computeEdgeScore, riskThreshold, deriveDailyRule } from "../src/app/utils/edgeScore";
import { computeStats } from "../src/app/utils/tradeCalcs";
import type { Trade } from "../src/app/types";

// Minimal trade factory — only the fields the Edge Score reads.
function trade(over: Partial<Trade> & { date: string }): Trade {
  return {
    id: crypto.randomUUID(),
    symbol: "NQ",
    direction: "long",
    strategy: "",
    pnl: 0,
    rMultiple: 1,
    riskAmount: 100,
    setupQuality: 3,
    confluences: [],
    mistakes: [],
    screenshots: [],
    notes: "",
    ...over,
  } as Trade;
}

test("score is null when there are no trades", () => {
  expect(computeEdgeScore([]).score).toBeNull();
});

test("a perfectly disciplined sample scores 100", () => {
  const trades = [
    trade({ date: "2026-07-20", mistakes: [], riskAmount: 100 }),
    trade({ date: "2026-07-21", mistakes: [], riskAmount: 100 }),
  ];
  const r = computeEdgeScore(trades, { checklistByDay: { "2026-07-20": 1, "2026-07-21": 1 } });
  expect(r.score).toBe(100);
  expect(r.subs.cleanTrades.value).toBe(100);
  expect(r.subs.cleanDays.value).toBe(100);
  expect(r.cleanDays).toBe(2);
});

test("les erreurs cochees font baisser cleanTrades et les jours propres", () => {
  const trades = [
    trade({ date: "2026-07-20", mistakes: ["overtrading"] }),
    trade({ date: "2026-07-21", mistakes: [] }),
  ];
  const r = computeEdgeScore(trades);
  expect(r.subs.cleanTrades.value).toBe(50); // 1 of 2 clean
  expect(r.subs.cleanDays.value).toBe(50); // 1 of 2 days clean
  expect(r.weakest).not.toBeNull();
});

test("missing components are dropped, not invented (weights renormalise)", () => {
  // Ni historique de checklist ni donnee de risque → seuls cleanTrades et cleanDays sont mesures.
  const trades = [trade({ date: "2026-07-20", mistakes: [], riskAmount: 0 })];
  const r = computeEdgeScore(trades);
  expect(r.subs.risk.value).toBeNull();
  expect(r.subs.routine.value).toBeNull();
  expect(r.score).toBe(100); // averaged over the measured components only
});

test("risk threshold prefers the plan rule over the median fallback", () => {
  const trades = [trade({ date: "2026-07-20", riskAmount: 100 })];
  // 1% of 50 000 = 500
  expect(riskThreshold(trades, 1, 50000)).toBe(500);
  // No rule → 1.5 × median(100) = 150
  expect(riskThreshold(trades, null, null)).toBe(150);
});

test("risk sub-score counts trades under the threshold", () => {
  const trades = [
    trade({ date: "2026-07-20", riskAmount: 100 }),
    trade({ date: "2026-07-21", riskAmount: 1000 }), // over 1% of 50k = 500
  ];
  const r = computeEdgeScore(trades, { maxRiskPct: 1, startingBalance: 50000 });
  expect(r.subs.risk.value).toBe(50);
});

test("only the last 10 traded days feed the window", () => {
  const trades = Array.from({ length: 14 }, (_, i) =>
    trade({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, mistakes: i < 4 ? ["x"] : [] }),
  );
  // The 4 dirty days are the oldest (1–4) and fall outside the last-10 window.
  const r = computeEdgeScore(trades);
  expect(r.tradedDays).toBe(10);
  expect(r.subs.cleanDays.value).toBe(100);
});

test("daily rule targets the costliest real leak, or nothing", () => {
  const dirty = [
    trade({ date: "2026-07-20", pnl: -640, mistakes: ["revenge trade"] }),
    trade({ date: "2026-07-21", pnl: -50, mistakes: ["early exit"] }),
  ];
  const rule = deriveDailyRule(computeStats(dirty));
  expect(rule?.text).toBe("revenge trade");
  expect(rule?.leak).toContain("640");

  // No costly leak → no invented rule.
  const clean = [trade({ date: "2026-07-20", pnl: 100, mistakes: [] })];
  expect(deriveDailyRule(computeStats(clean))).toBeNull();
});
