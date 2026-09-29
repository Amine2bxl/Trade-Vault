import { describe, expect, test } from "bun:test";
import { monthGrid, weekTotals } from "../src/app/utils/calendarGrid";

describe("grille du calendrier", () => {
  test("septembre 2026 commence un mardi : la grille ouvre sur le lundi 31 août", () => {
    const g = monthGrid(2026, 8);
    expect(g[0][0]).toEqual({ date: "2026-08-31", day: 31, inMonth: false });
    expect(g[0][1]).toEqual({ date: "2026-09-01", day: 1, inMonth: true });
  });

  test("aucune case sans date, et la dernière semaine est complétée par octobre", () => {
    const g = monthGrid(2026, 8);
    expect(
      g.every((row) => row.length === 7 && row.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date))),
    ).toBe(true);
    const last = g[g.length - 1];
    expect(last[last.length - 1]).toEqual({ date: "2026-10-04", day: 4, inMonth: false });
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(30);
  });

  test("un mois qui commence un lundi n'a pas de jour du mois précédent", () => {
    const g = monthGrid(2026, 5); // juin 2026 : lundi 1er
    expect(g[0][0]).toEqual({ date: "2026-06-01", day: 1, inMonth: true });
  });

  test("les dates se suivent sans trou, d'un changement d'heure à l'autre", () => {
    for (const [y, m] of [
      [2026, 2],
      [2026, 9],
      [2027, 0],
    ]) {
      const flat = monthGrid(y, m).flat();
      for (let i = 1; i < flat.length; i++) {
        const a = new Date(flat[i - 1].date + "T12:00:00");
        const b = new Date(flat[i].date + "T12:00:00");
        expect(Math.round((b.getTime() - a.getTime()) / 86_400_000)).toBe(1);
      }
    }
  });

  test("un trade du 1er octobre est visible en septembre, mais ne compte pas pour septembre", () => {
    const g = monthGrid(2026, 8);
    const last = g[g.length - 1];
    const totals = weekTotals(last, {
      "2026-09-30": { pnl: 200, count: 2 },
      "2026-10-01": { pnl: -500, count: 1 },
    });
    expect(totals).toEqual({ pnl: 200, trades: 2, days: 1, outsidePnl: -500, outsideTrades: 1 });
  });
});
