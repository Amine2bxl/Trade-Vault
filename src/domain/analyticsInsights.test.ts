import { describe, expect, test } from "bun:test";
import type { Trade } from "./trade";
import { analyticsInsights, isoWeekday } from "./analyticsInsights";
import { MIN_BUCKET_SAMPLE } from "./quantStats";

let id = 0;
const tr = (p: Partial<Trade>): Trade =>
  ({
    id: String(++id),
    date: "2026-10-05",
    symbol: "NQ",
    direction: "long",
    pnl: 100,
    riskAmount: 100,
    rMultiple: 1,
    strategy: "ORB",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: 3,
    ...p,
  }) as Trade;

const many = (n: number, p: Partial<Trade>) => Array.from({ length: n }, () => tr(p));

describe("isoWeekday", () => {
  test("jour civil, sans dépendre du fuseau de l'appareil", () => {
    expect(isoWeekday("2026-10-05")).toBe(1); // lundi
    expect(isoWeekday("2026-10-11")).toBe(7); // dimanche
    expect(isoWeekday("pas une date")).toBeNull();
  });
});

describe("analyticsInsights", () => {
  test("meilleur et pire setup, chacun avec son n", () => {
    const list = [
      ...many(MIN_BUCKET_SAMPLE, { strategy: "ORB", pnl: 200 }),
      ...many(MIN_BUCKET_SAMPLE, { strategy: "Reversal", pnl: -50 }),
    ];
    const r = analyticsInsights(list);
    expect(r.setup.best).toMatchObject({ key: "ORB", count: MIN_BUCKET_SAMPLE, winRate: 1 });
    expect(r.setup.best?.pnl).toBe(200 * MIN_BUCKET_SAMPLE);
    expect(r.setup.worst).toMatchObject({ key: "Reversal", count: MIN_BUCKET_SAMPLE });
  });

  test("rien sous l'échantillon minimum", () => {
    const r = analyticsInsights(many(MIN_BUCKET_SAMPLE - 1, { strategy: "ORB", pnl: 500 }));
    expect(r.setup.best).toBeNull();
    expect(r.symbol.best).toBeNull();
  });

  test("un seul seau positif : pas de « pire » inventé", () => {
    const r = analyticsInsights(many(MIN_BUCKET_SAMPLE, { pnl: 100 }));
    expect(r.symbol.best?.key).toBe("NQ");
    expect(r.symbol.worst).toBeNull();
  });

  test("jour et heure de New York", () => {
    const list = [
      ...many(MIN_BUCKET_SAMPLE, { date: "2026-10-07", entryTime: "10:15", pnl: 120 }),
      ...many(MIN_BUCKET_SAMPLE, { date: "2026-10-09", entryTime: "14:05", pnl: -80 }),
    ];
    const r = analyticsInsights(list);
    expect(r.day.best?.key).toBe("3"); // mercredi
    expect(r.day.worst?.key).toBe("5"); // vendredi
    expect(r.hour.best?.key).toBe("10");
    expect(r.hour.worst?.key).toBe("14");
  });

  test("séries les plus longues, dans l'ordre chronologique", () => {
    const list = [
      tr({ date: "2026-10-01", pnl: 50 }),
      tr({ date: "2026-10-02", pnl: -10 }),
      tr({ date: "2026-10-03", pnl: -10 }),
      tr({ date: "2026-10-04", pnl: -10 }),
      tr({ date: "2026-10-05", pnl: 50 }),
      tr({ date: "2026-10-06", pnl: 50 }),
    ];
    const r = analyticsInsights(list.reverse());
    expect(r.longestLossStreak).toBe(3);
    expect(r.longestWinStreak).toBe(2);
  });

  test("P&L par mois, chronologique", () => {
    const r = analyticsInsights([
      tr({ date: "2026-10-03", pnl: 50 }),
      tr({ date: "2026-09-30", pnl: -20 }),
      tr({ date: "2026-10-20", pnl: 25 }),
    ]);
    expect(r.months).toEqual([
      { month: "2026-09", pnl: -20, count: 1 },
      { month: "2026-10", pnl: 75, count: 2 },
    ]);
  });

  test("P&L par semaine, la semaine commence le lundi", () => {
    const r = analyticsInsights([
      tr({ date: "2026-10-05", pnl: 100 }), // lundi
      tr({ date: "2026-10-11", pnl: -40 }), // dimanche, même semaine
      tr({ date: "2026-10-12", pnl: 30 }), // lundi suivant
    ]);
    expect(r.weeks).toEqual([
      { week: "2026-10-05", pnl: 60, count: 2, winRate: 0.5 },
      { week: "2026-10-12", pnl: 30, count: 1, winRate: 1 },
    ]);
  });
});
