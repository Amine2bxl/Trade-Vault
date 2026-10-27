import { describe, expect, test } from "bun:test";
import {
  isWeekStart,
  newsDaySplit,
  newsForTrade,
  previousWeekStarts,
  weekStartOf,
  type Clock,
  type NewsEvent,
} from "../src/domain/tradeNews";
import {
  forexFactoryWeekUrl,
  parseForexFactoryCalendarPage,
} from "../src/modules/economic-calendar/forex-factory-history";

/**
 * LES ANNONCES DE LA JOURNÉE D'UN TRADE.
 *
 * Horloge fixée en UTC : le résultat ne dépend pas du fuseau de la machine
 * (la CI tourne sous New York et Auckland).
 */
const UTC: Clock = {
  dayOf: (iso) => iso.slice(0, 10),
  timeOf: (iso) => iso.slice(11, 16),
};

function ev(p: Partial<NewsEvent> & { startsAt: string }): NewsEvent {
  return {
    id: `${p.startsAt}-${p.title ?? "x"}-${p.currency ?? "USD"}`,
    currency: "USD",
    title: "CPI m/m",
    impact: "high",
    allDay: false,
    source: "forexfactory",
    ...p,
  };
}

describe("semaines du calendrier (dimanche → samedi)", () => {
  test("le dimanche qui ouvre la semaine", () => {
    expect(weekStartOf("2026-03-10")).toBe("2026-03-08"); // mardi
    expect(weekStartOf("2026-03-08")).toBe("2026-03-08"); // dimanche
    expect(weekStartOf("2026-03-14")).toBe("2026-03-08"); // samedi
    expect(weekStartOf("2026-01-01")).toBe("2025-12-28");
  });

  test("validation d'un début de semaine", () => {
    expect(isWeekStart("2026-03-08")).toBe(true);
    expect(isWeekStart("2026-03-09")).toBe(false);
    expect(isWeekStart("2026-02-30")).toBe(false);
    expect(isWeekStart("nope")).toBe(false);
  });

  test("les semaines passées, de la plus récente à la plus ancienne", () => {
    expect(previousWeekStarts(new Date("2026-03-11T15:00:00Z"), 3)).toEqual([
      "2026-03-01",
      "2026-02-22",
      "2026-02-15",
    ]);
  });
});

describe("newsForTrade", () => {
  const events = [
    ev({ startsAt: "2026-03-10T12:30:00Z", title: "CPI m/m" }),
    ev({ startsAt: "2026-03-10T18:00:00Z", title: "FOMC Statement" }),
    ev({ startsAt: "2026-03-10T09:00:00Z", curren...[truncated]