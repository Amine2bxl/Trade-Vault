import { test, expect } from "bun:test";
import {
  computeDayScore,
  computeStreak,
  STREAK_THRESHOLD,
} from "../src/modules/discipline/score";

const tradeAt = (
  entryTime: string,
  quality = 3,
  notes = "solid setup, followed plan",
): { entryTime: string; setupQuality: number; notes: string } => ({
  entryTime,
  setupQuality: quality,
  notes,
});

test("perfect day: checklist before first trade + full journal = 100", () => {
  const day = computeDayScore({
    checklistDoneAt: "2026-07-21T07:30:00Z",
    trades: [tradeAt("2026-07-21T09:15:00Z"), tradeAt("2026-07-21T10:40:00Z")],
  });
  expect(day.score).toBe(100);
  expect(day.checklistBeforeFirstTrade).toBe(true);
  expect(day.journalComplete).toBe(true);
  expect(day.neutral).toBe(false);
});

test("checklist done AFTER the first trade only earns half the checklist points", () => {
  const day = computeDayScore({
    checklistDoneAt: "2026-07-21T11:00:00Z",
    trades: [tradeAt("2026-07-21T09:15:00Z")],
  });
  expect(day.checklistBeforeFirstTrade).toBe(false);
  expect(day.score).toBe(70); // 30 (late checklist) + 40 (journal)
});

test("no checklist, complete journal = 40", () => {
  const day = computeDayScore({
    checklistDoneAt: null,
    trades: [tradeAt("2026-07-21T09:15:00Z")],
  });
  expect(day.score).toBe(40);
  expect(day.checklistDone).toBe(false);
});

test("incomplete journal (missing notes or quality) drops the journal points", () => {
  const day = computeDayScore({
    checklistDoneAt: "2026-07-21T07:30:00Z",
    trades: [tradeAt("2026-07-21T09:15:00Z"), tradeAt("2026-07-21T10:00:00Z", 0, "")],
  });
  expect(day.journalComplete).toBe(false);
  expect(day.score).toBe(60);
});

test("prep day: checklist done, zero trades = fully disciplined (100)", () => {
  const day = computeDayScore({ checklistDoneAt: "2026-07-21T07:30:00Z", trades: [] });
  expect(day.score).toBe(100);
  expect(day.neutral).toBe(false);
});

test("no trades and no checklist = neutral day, never breaks a streak", () => {
  const day = computeDayScore({ checklistDoneAt: null, trades: [] });
  expect(day.neutral).toBe(true);
  expect(day.score).toBe(0);
});

test("example trades are ignored (demo data never scores)", () => {
  const day = computeDayScore({
    checklistDoneAt: null,
    trades: [{ ...tradeAt("2026-07-21T09:00:00Z"), isExample: true }],
  });
  expect(day.neutral).toBe(true);
});

test("trades without a parseable entry time still allow full checklist credit", () => {
  const day = computeDayScore({
    checklistDoneAt: "2026-07-21T07:30:00Z",
    trades: [tradeAt("")],
  });
  expect(day.checklistBeforeFirstTrade).toBe(true);
});

test("streak counts consecutive days at or above the threshold, most recent first", () => {
  expect(
    computeStreak([
      { date: "2026-07-21", score: 80 },
      { date: "2026-07-20", score: STREAK_THRESHOLD },
      { date: "2026-07-18", score: 90 }, // gap (19th neutral/absent) — still counts
      { date: "2026-07-17", score: 40 }, // breaks here
      { date: "2026-07-16", score: 95 },
    ]),
  ).toBe(3);
});

test("streak is zero when the latest recorded day is below threshold", () => {
  expect(
    computeStreak([
      { date: "2026-07-21", score: 40 },
      { date: "2026-07-20", score: 90 },
    ]),
  ).toBe(0);
});

test("empty history = zero streak", () => {
  expect(computeStreak([])).toBe(0);
});
