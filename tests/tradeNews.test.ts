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
    ev({ startsAt: "2026-03-10T09:00:00Z", currency: "EUR", title: "ECB Rate" }),
    ev({ startsAt: "2026-03-10T14:00:00Z", impact: "low", title: "Bill Auction" }),
    ev({ startsAt: "2026-03-11T12:30:00Z", title: "PPI m/m" }),
  ];

  test("un trade de NQ voit les annonces USD de SA journée, dans l'ordre", () => {
    const n = newsForTrade({ symbol: "NQ", date: "2026-03-10" }, events, UTC);
    expect(n.currencies).toEqual(["USD"]);
    expect(n.items.map((i) => i.event.title)).toEqual(["CPI m/m", "FOMC Statement"]);
    expect(n.highCount).toBe(2);
  });

  test("un trade d'EUR/USD voit aussi l'EUR", () => {
    const n = newsForTrade({ symbol: "EURUSD", date: "2026-03-10" }, events, UTC);
    expect(n.items.map((i) => i.event.title)).toEqual(["ECB Rate", "CPI m/m", "FOMC Statement"]);
  });

  test("l'impact faible et les autres jours sont ignorés", () => {
    const n = newsForTrade({ symbol: "ES", date: "2026-03-10" }, events, UTC);
    expect(n.items.some((i) => i.event.title === "Bill Auction")).toBe(false);
    expect(n.items.some((i) => i.event.title === "PPI m/m")).toBe(false);
  });

  test("une annonce pendant la position est signalée (±15 min)", () => {
    const n = newsForTrade(
      { symbol: "NQ", date: "2026-03-10", entryTime: "12:20", exitTime: "12:50" },
      events,
      UTC,
    );
    expect(n.items.find((i) => i.event.title === "CPI m/m")?.duringTrade).toBe(true);
    expect(n.items.find((i) => i.event.title === "FOMC Statement")?.duringTrade).toBe(false);
  });

  test("never claim news overlap for broker times, pending CSV, overnight or invalid clocks", () => {
    const overlap = ev({ startsAt: "2026-03-10T12:30:00Z" });
    const base = { symbol: "NQ", date: "2026-03-10", entryTime: "12:20", exitTime: "12:50" };
    expect(newsForTrade(base, [overlap], UTC).items[0].duringTrade).toBe(true);
    expect(newsForTrade({ ...base, broker: "tradovate" }, [overlap], UTC).items[0].duringTrade)
      .toBe(false);
    expect(newsForTrade({ ...base, reviewPending: true }, [overlap], UTC).items[0].duringTrade)
      .toBe(false);
    expect(newsForTrade({ ...base, entryTime: "23:30", exitTime: "00:15" }, [overlap], UTC).items[0].duringTrade)
      .toBe(false);
    expect(newsForTrade({ ...base, entryTime: "99:99" }, [overlap], UTC).items[0].duringTrade)
      .toBe(false);
  });

  test("symbole inconnu : rien n'est affirmé", () => {
    const n = newsForTrade({ symbol: "XYZ123", date: "2026-03-10" }, events, UTC);
    expect(n.items).toEqual([]);
    expect(n.currencies).toEqual([]);
  });

  test("une heure du repli intégré est marquée approximative", () => {
    const n = newsForTrade(
      { symbol: "NQ", date: "2026-03-10" },
      [ev({ startsAt: "2026-03-10T12:30:00Z", source: "builtin" })],
      UTC,
    );
    expect(n.approximate).toBe(true);
  });
});

describe("newsDaySplit", () => {
  const events = [
    ev({ startsAt: "2026-03-10T12:30:00Z" }),
    ev({ startsAt: "2026-03-12T12:30:00Z", impact: "medium", title: "Claims" }),
  ];
  const t = (date: string, pnl: number, symbol = "NQ") => ({
    symbol,
    date,
    pnl,
    rMultiple: pnl / 100,
    riskAmount: 100,
  });

  test("jour d'annonce FORTE face aux jours calmes, avec n", () => {
    const trades = [
      ...Array.from({ length: 5 }, (_, i) => t("2026-03-10", i < 2 ? 100 : -100)),
      ...Array.from({ length: 6 }, () => t("2026-03-12", 50)),
    ];
    const s = newsDaySplit(trades, events, UTC);
    expect(s.newsDays.n).toBe(5);
    expect(s.newsDays.winRate).toBeCloseTo(0.4);
    expect(s.quietDays.n).toBe(6); // une annonce moyenne ne fait pas un « jour d'annonce »
    expect(s.quietDays.winRate).toBe(1);
    expect(s.classified).toBe(11);
  });

  test("ignore un R sans risque initial vérifié dans la série des jours d'annonce", () => {
    const trades = Array.from({ length: 6 }, () => ({
      ...t("2026-03-10", 100),
      riskAmount: 0,
    }));
    const split = newsDaySplit(trades, events, UTC);
    expect(split.newsDays.n).toBe(6);
    expect(split.newsDays.avgPnl).toBe(100);
    expect(split.newsDays.avgR).toBeNull();
  });

  test("aucun chiffre sous l'échantillon minimum", () => {
    const s = newsDaySplit([t("2026-03-10", 100), t("2026-03-12", 50)], events, UTC);
    expect(s.newsDays.n).toBe(1);
    expect(s.newsDays.winRate).toBeNull();
    expect(s.newsDays.avgPnl).toBeNull();
  });

  test("une semaine sans calendrier réel est écartée, et comptée", () => {
    const s = newsDaySplit(
      [t("2026-03-10", 100), t("2026-01-06", 100)],
      [...events, ev({ startsAt: "2026-01-06T13:30:00Z", source: "builtin" })],
      UTC,
    );
    expect(s.classified).toBe(1);
    expect(s.uncovered).toBe(1);
  });
});

describe("page hebdomadaire de la source (fixture)", () => {
  test("URL de la semaine", () => {
    expect(forexFactoryWeekUrl("2026-03-08")).toBe(
      "https://www.forexfactory.com/calendar?week=mar8.2026",
    );
  });

  const html = `<html><script>
    window.calendarComponentStates = window.calendarComponentStates || [];
    window.calendarComponentStates[1] = {
      days: [{"date":"<span>Tue <\\/span><span>Mar 10<\\/span>","dateline":1773100800,"events":[
        {"id":1,"name":"CPI m/m","prefixedName":"CPI m/m","currency":"USD","dateline":1773145800,"timeLabel":"8:30am","impactName":"high","actual":"0.4%","forecast":"0.3%","previous":"0.2%|0.3%"},
        {"id":2,"name":"Prelim CPI m/m","prefixedName":"German Prelim CPI m/m","currency":"EUR","dateline":1773127800,"timeLabel":"3:30am","impactName":"medium","actual":"","forecast":"0.1%","previous":"0.2%"},
        {"id":3,"name":"Bank Holiday","currency":"JPY","dateline":1773100800,"timeLabel":"All Day","impactName":"holiday"},
        {"id":4,"name":"Broken","currency":"","dateline":"x"}
      ]}],
      time: 1773100000
    };
  </script></html>`;

  test("les événements sont lus, valeurs publiées comprises", () => {
    const events = parseForexFactoryCalendarPage(html);
    expect(events.length).toBe(3);
    const cpi = events.find((e) => e.title === "CPI m/m")!;
    expect(cpi.startsAt).toBe("2026-03-10T12:30:00.000Z");
    expect(cpi.impact).toBe("high");
    expect(cpi.actual).toBe("0.4%");
    expect(cpi.previous).toBe("0.2%");
    expect(cpi.country).toBe("United States");
    // Le nom préfixé est celui de l'export officiel : mêmes identifiants.
    expect(events.some((e) => e.title === "German Prelim CPI m/m")).toBe(true);
    const holiday = events.find((e) => e.currency === "JPY")!;
    expect(holiday.allDay).toBe(true);
    expect(holiday.impact).toBe("holiday");
  });

  test("une page illisible ne lève jamais", () => {
    expect(parseForexFactoryCalendarPage("")).toEqual([]);
    expect(parseForexFactoryCalendarPage("<html>Just a moment...</html>")).toEqual([]);
    expect(parseForexFactoryCalendarPage("calendarComponentStates[1] = { days: [{ broken")).toEqual(
      [],
    );
  });
});
