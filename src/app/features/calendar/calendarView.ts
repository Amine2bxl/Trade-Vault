import { nsKey } from "@/app/utils/persistence";

/** A month in the calendar: zero-based month, like the Date constructor. */
export interface CalendarView {
  year: number;
  month: number;
}

export function currentCalendarView(now: Date = new Date()): CalendarView {
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** One saved month for each (user, sub-account) pair, never shared across accounts. */
export function calendarViewKey(userId: string | undefined, accountId: string | null): string {
  return nsKey(userId, `calendar.view.${accountId ?? "unassigned"}`);
}

/** Local civil month, independent from UTC and safe to persist as a small string. */
export function serializeCalendarView(view: CalendarView): string {
  return `${view.year}-${String(view.month + 1).padStart(2, "0")}`;
}

/** Corrupt/old storage must not make the calendar show an invalid year or month. */
export function parseCalendarView(
  stored: unknown,
  today: Date = new Date(),
): CalendarView {
  const match = typeof stored === "string" ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(stored) : null;
  if (!match) return currentCalendarView(today);
  const year = Number(match[1]);
  if (year < 1900 || year > 2200) return currentCalendarView(today);
  return { year, month: Number(match[2]) - 1 };
}

/** Normalizes December/January transitions, including jumps of 12 months. */
export function shiftCalendarView(view: CalendarView, months: number): CalendarView {
  const next = new Date(view.year, view.month + months, 1, 12);
  return { year: next.getFullYear(), month: next.getMonth() };
}
