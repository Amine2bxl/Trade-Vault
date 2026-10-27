import { describe, expect, test } from "bun:test";
import { dayTone, dayToneFill, dayToneSegments } from "../src/app/features/calendar/calendarTone";
import type { Trade } from "../src/app/types";

const trade = (pnl: number, rMultiple: number, direction: Trade["direction"] = "long") =>
  ({ pnl, rMultiple, riskAmount: 100, direction }) as Trade;

describe("teinte d'une journée du calendrier", () => {
  test("+2R et −1R : mixte, aux deux tiers positive", () => {
    const tone = dayTone([trade(200, 2), trade(-100, -1)]);
    expect(tone.kind).toBe("mixed");
    expect(tone.unit).toBe("R");
    expect(tone.positiveShare).toBeCloseTo(2 / 3, 5);
    expect(tone.net).toBe(1);
  });

  test("la MAGNITUDE compte, pas le nombre de gagnants", () => {
    // Deux petits gains, une grosse perte : majoritairement ROUGE.
    const tone = dayTone([trade(50, 0.5), trade(50, 0.5), trade(-300, -3)]);
    expect(tone.positiveShare).toBeCloseTo(0.25, 5);
  });

  test("repli sur le P&L quand un trade n'a pas de R", () => {
    const tone = dayTone([trade(300, 0), trade(-100, -1)]);
    expect(tone.unit).toBe("pnl");
    expect(tone.positiveShare).toBeCloseTo(0.75, 5);
  });

  test("ne confond pas un R stocké sans risque initial avec un R mesuré", () => {
    const imported = { ...trade(200, 2), riskAmount: 0 };
    const tone = dayTone([imported, trade(-100, -1)]);
    expect(tone.unit).toBe("pnl");
    expect(tone.net).toBe(100);
    expect(tone.positiveShare).toBeCloseTo(2 / 3);
    expect(dayTone([{ ...trade(200, 2), broker: "tradovate" }, trade(-100, -1)]).unit).toBe("pnl");
    expect(dayTone([{ ...trade(200, 2), reviewPending: true }, trade(-100, -1)]).unit).toBe("pnl");
  });

  test("journée neutre : break-even seulement → gris discret, aucun filet", () => {
    const tone = dayTone([trade(0, 0, "be")]);
    expect(tone.kind).toBe("flat");
    expect(dayToneFill(tone, 1)).toContain("148 163 184");
    expect(dayToneSegments(tone)).toBeNull();
  });

  test("AUCUN dégradé : l...[truncated]