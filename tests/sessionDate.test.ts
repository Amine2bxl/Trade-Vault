import { expect, test } from "bun:test";
import { todayLocalDate } from "../src/app/utils/sessionDate";

// La date d'une séance décide à quelle journée les trades se rattachent. Si
// elle vient d'UTC, un trader à l'est de Greenwich qui ouvre sa séance après
// minuit local la voit datée de la veille, et ses trades du matin partent dans
// la mauvaise journée — un décalage invisible qui fausserait ensuite chaque
// corrélation calculée sur les séances.

test("uses the trader's local calendar day, not UTC", () => {
  // 00:30 le 3, heure locale. En UTC ce moment peut être le 2.
  const localMidnightish = new Date(2026, 2, 3, 0, 30, 0);
  expect(todayLocalDate(localMidnightish)).toBe("2026-03-03");
});

test("pads month and day so the string is always sortable", () => {
  expect(todayLocalDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  expect(todayLocalDate(new Date(2026, 10, 30, 12))).toBe("2026-11-30");
});

test("late evening stays on the same local day", () => {
  expect(todayLocalDate(new Date(2026, 5, 15, 23, 59, 59))).toBe("2026-06-15");
});
