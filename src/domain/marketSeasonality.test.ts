import { describe, expect, test } from "bun:test";
import { MIN_YEARS_PER_MONTH, seasonalityFromCloses } from "./marketSeasonality";

/** Une série où janvier gagne 10 % et tous les autres mois 0 %. */
function series(years: number) {
  const out: { month: string; close: number }[] = [];
  let close = 100;
  for (let y = 2010; y < 2010 + years; y++)
    for (let m = 1; m <= 12; m++) {
      if (m === 1 && out.length) close *= 1.1;
      out.push({ month: `${y}-${String(m).padStart(2, "0")}`, close });
    }
  return out;
}

describe("seasonalityFromCloses", () => {
  test("moyenne, part positive et n par mois du calendrier", () => {
    const s = seasonalityFromCloses(series(8));
    expect(s.monthlyAvg[0]).toBe(10);
    expect(s.monthlyWin[0]).toBe(100);
    expect(s.monthlyAvg[5]).toBe(0);
    expect(s.monthlyWin[5]).toBe(0);
    // Le premier janvier n'a pas de décembre précédent : 7 janviers mesurés.
    expect(s.monthlyN[0]).toBe(7);
    expect(s.monthlyN[5]).toBe(8);
    expect(s.years).toBe(7);
    expect(s.from).toBe("2010-01");
  });

  test("aucun chiffre sous l'échantillon minimum", () => {
    const s = seasonalityFromCloses(series(MIN_YEARS_PER_MONTH - 1));
    expect(s.monthlyAvg.every((v) => v === null)).toBe(true);
    expect(s.monthlyWin.every((v) => v === null)).toBe(true);
  });

  test("un mois manquant ne fabrique pas de rendement", () => {
    const gappy = series(6).filter((x) => x.month !== "2012-03");
    const s = seasonalityFromCloses(gappy);
    expect(s.monthlyN[2]).toBe(5); // mars 2012 absent
    expect(s.monthlyN[3]).toBe(5); // avril 2012 sans mars : pas de rendement
  });
});
