import { describe, expect, test } from "bun:test";
import { dayTone, dayToneFill, dayToneSegments } from "../src/app/utils/calendarTone";
import type { Trade } from "../src/app/types";

const trade = (pnl: number, rMultiple: number, direction: Trade["direction"] = "long") =>
  ({ pnl, rMultiple, direction }) as Trade;

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

  test("journée neutre : break-even seulement → gris discret, aucun filet", () => {
    const tone = dayTone([trade(0, 0, "be")]);
    expect(tone.kind).toBe("flat");
    expect(dayToneFill(tone, 1)).toContain("148 163 184");
    expect(dayToneSegments(tone)).toBeNull();
  });

  test("AUCUN dégradé : le fond est une teinte solide du résultat net", () => {
    const mixed = dayTone([trade(200, 2), trade(-100, -1)]);
    const fill = dayToneFill(mixed, 0.5);
    expect(fill).not.toContain("gradient");
    expect(fill).toContain("--tv-chart-green-rgb");
    expect(dayToneFill(dayTone([trade(-300, -3)]), 1)).toContain("--tv-chart-red-rgb");
    // L'intensité suit l'ampleur, dans une fourchette discrète.
    expect(dayToneFill(mixed, 0)).toContain("0.060");
    expect(dayToneFill(mixed, 1)).toContain("0.160");
  });

  test("la composition d'une journée mixte se lit dans un filet en aplats", () => {
    const tone = dayTone([trade(200, 2), trade(0, 0, "be"), trade(-100, -1)]);
    const seg = dayToneSegments(tone)!;
    expect(seg).toHaveLength(3);
    expect(seg.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 5);
    expect(dayToneSegments(dayTone([trade(200, 2)]))).toBeNull();
  });
});

describe("le liseré de la case", () => {
  test("il prend la couleur du résultat NET de la journée", async () => {
    const { dayToneBorder } = await import("../src/app/utils/calendarTone");
    const mk = (kind: "win" | "loss" | "mixed" | "flat", net: number) =>
      ({ kind, positiveShare: 0.5, neutralShare: 0, magnitude: 1, net, unit: "R" }) as never;
    expect(dayToneBorder(mk("win", 2))).toContain("--tv-chart-green-rgb");
    expect(dayToneBorder(mk("loss", -1))).toContain("--tv-chart-red-rgb");
    expect(dayToneBorder(mk("mixed", 1))).toContain("--tv-chart-green-rgb");
    expect(dayToneBorder(mk("mixed", -1))).toContain("--tv-chart-red-rgb");
    expect(dayToneBorder(mk("flat", 0))).toContain("148 163 184");
  });
});
