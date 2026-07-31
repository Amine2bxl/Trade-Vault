import { expect, test } from "bun:test";
import { fallbackCoachAnswer } from "../src/modules/ai/fallback-coach";

test("says plainly when there is no data, without inventing coaching", () => {
  const out = fallbackCoachAnswer({ question: "how am I doing?" });
  expect(out).toContain("no trades to read yet");
  expect(out).not.toContain("$NaN");
});

test("cites only figures present in the payload", () => {
  const out = fallbackCoachAnswer({
    question: "how am I doing?",
    stats: {
      totalTrades: 20,
      totalPnl: 1250,
      winRatePct: 55,
      profitFactor: 1.8,
      avgWin: 200,
      avgLoss: -110,
      avgRR: 2.1,
      maxDrawdown: 400,
      currentStreak: 3,
      currentStreakType: "win",
    },
    mistakes: [{ name: "overtrading", count: 5, totalPnl: -640 }],
  });
  expect(out).toContain("$1,250");
  expect(out).toContain("55.0%");
  expect(out).toContain("1.80");
  expect(out).toContain("overtrading");
  expect(out).toContain("$640");
  expect(out).not.toContain("undefined");
  expect(out).not.toContain("NaN");
});

test("answers in French when the UI language is French", () => {
  const out = fallbackCoachAnswer({
    question: "comment je vais ?",
    language: "fr",
    stats: { totalTrades: 5, totalPnl: -300, winRatePct: 20, profitFactor: 0.4 },
  });
  expect(out).toContain("**Plan**");
  expect(out).toContain("Quel est ton objectif");
  expect(out).not.toContain("undefined");
});

test("names the costliest leak, not just any mistake", () => {
  const out = fallbackCoachAnswer({
    question: "q",
    stats: { totalTrades: 10, totalPnl: 0 },
    mistakes: [
      { name: "early exit", count: 9, totalPnl: -50 },
      { name: "revenge trade", count: 2, totalPnl: -900 },
    ],
  });
  expect(out).toContain("revenge trade");
});

test("stays silent on leaks when none are costly", () => {
  const out = fallbackCoachAnswer({
    question: "q",
    stats: { totalTrades: 10, totalPnl: 500 },
    mistakes: [{ name: "noted", count: 1, totalPnl: 20 }],
  });
  expect(out).toContain("error discipline is clean");
  expect(out).not.toContain("undefined");
});
