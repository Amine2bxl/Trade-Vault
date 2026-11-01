import { describe, expect, test } from "bun:test";
import {
  calendarViewKey,
  currentCalendarView,
  parseCalendarView,
  serializeCalendarView,
  shiftCalendarView,
} from "../src/app/features/calendar/calendarView";
import { readSource } from "./helpers/source";

describe("calendar — month memory per sub-account", () => {
  test("same user, two accounts, two independent saved months", () => {
    const first = calendarViewKey("user-1", "account-A");
    const second = calendarViewKey("user-1", "account-B");
    const anotherUser = calendarViewKey("user-2", "account-A");
    expect(first).not.toBe(second);
    expect(first).not.toBe(anotherUser);

    const saved = new Map([
      [first, serializeCalendarView({ year: 2020, month: 5 })],
      [second, serializeCalendarView({ year: 2025, month: 10 })],
    ]);
    expect(parseCalendarView(saved.get(first))).toEqual({ year: 2020, month: 5 });
    expect(parseCalendarView(saved.get(second))).toEqual({ year: 2025, month: 10 });
  });

  test("return to the exact month and year after a reload", () => {
    const initial = { year: 2017, month: 1 };
    expect(parseCalendarView(serializeCalendarView(initial))).toEqual(initial);
    expect(parseCalendarView("2026-12")).toEqual({ year: 2026, month: 11 });
  });

  test("invalid storage safely falls back to the current local month", () => {
    const now = new Date(2026, 10, 1, 12);
    for (const invalid of [null, {}, "2026-00", "2026-13", "abc", "1800-04", "2026-1"]) {
      expect(parseCalendarView(invalid, now)).toEqual(currentCalendarView(now));
    }
  });

  test("navigation across years is exact", () => {
    expect(shiftCalendarView({ year: 2026, month: 0 }, -1)).toEqual({
      year: 2025, month: 11,
    });
    expect(shiftCalendarView({ year: 2026, month: 10 }, -12)).toEqual({
      year: 2025, month: 10,
    });
    expect(shiftCalendarView({ year: 2026, month: 11 }, 1)).toEqual({
      year: 2027, month: 0,
    });
  });

  test("calendar UI is keyed per account and reads/writes the chosen month", () => {
    const source = readSource("../src/app/features/calendar/CalendarPage.tsx");
    expect(source).toContain('key={`${user?.id ?? "anon"}:${activeId ?? "none"}`}');
    expect(source).toContain("parseCalendarView(readJSON<unknown>(viewKey, null))");
    expect(source).toContain("writeJSON(viewKey, serializeCalendarView(view))");
    expect(source).toContain("navigateTo({ year: Number(event.target.value), month })");
    expect(source).toContain("navigateTo({ year, month: Number(event.target.value) })");
  });
});
