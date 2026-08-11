import { describe, it, expect } from "bun:test";
import { assessSample, wilsonInterval, MIN_SIMULATABLE, SAMPLE_BANDS } from "../sample";

describe("qualification de l'échantillon", () => {
  it("classe chaque palier à sa borne exacte", () => {
    expect(assessSample(0).quality).toBe("low");
    expect(assessSample(19).quality).toBe("low");
    expect(assessSample(20).quality).toBe("limited");
    expect(assessSample(49).quality).toBe("limited");
    expect(assessSample(50).quality).toBe("moderate");
    expect(assessSample(99).quality).toBe("moderate");
    expect(assessSample(100).quality).toBe("strong");
    expect(assessSample(5000).quality).toBe("strong");
  });

  it("dit combien de trades manquent, plutôt que « pas assez »", () => {
    expect(assessSample(8).toNextBand).toBe(SAMPLE_BANDS.limited - 8);
    expect(assessSample(38).toNextBand).toBe(SAMPLE_BANDS.moderate - 38);
    expect(assessSample(90).toNextBand).toBe(SAMPLE_BANDS.strong - 90);
    expect(assessSample(120).toNextBand).toBeNull();
  });

  it("refuse de simuler en dessous du minimum", () => {
    expect(assessSample(MIN_SIMULATABLE - 1).usable).toBe(false);
    expect(assessSample(MIN_SIMULATABLE).usable).toBe(true);
  });

  it("borne la couverture R dans [0,1] même sur une entrée aberrante", () => {
    expect(assessSample(50, 1.7).rCoverage).toBe(1);
    expect(assessSample(50, -0.2).rCoverage).toBe(0);
  });

  it("n'explose pas sur des tailles absurdes", () => {
    expect(assessSample(-5).size).toBe(0);
    expect(assessSample(12.7).size).toBe(12);
  });
});

describe("intervalle de Wilson", () => {
  it("reste dans [0,1] aux extrêmes, là où l'approximation normale déborde", () => {
    // Une ruine à 0,5 % sur 2 000 trajectoires : la borne normale serait
    // négative, ce qui afficherait « entre −0,4 % et 1,4 % » à l'écran.
    const i = wilsonInterval(0.005, 2000);
    expect(i.low).toBeGreaterThanOrEqual(0);
    expect(i.high).toBeLessThanOrEqual(1);
    expect(i.low).toBeLessThan(0.005);
  });

  it("encadre la proportion observée", () => {
    const i = wilsonInterval(0.62, 2000);
    expect(i.low).toBeLessThan(0.62);
    expect(i.high).toBeGreaterThan(0.62);
  });

  it("se resserre quand on ajoute des trajectoires", () => {
    const petit = wilsonInterval(0.5, 100);
    const grand = wilsonInterval(0.5, 10_000);
    expect(grand.high - grand.low).toBeLessThan(petit.high - petit.low);
  });

  it("rend l'intervalle total quand il n'y a aucun tirage", () => {
    expect(wilsonInterval(0.5, 0)).toEqual({ low: 0, high: 1 });
  });

  it("ne rend jamais NaN", () => {
    for (const p of [0, 0.5, 1, -1, 2]) {
      for (const n of [1, 10, 1000]) {
        const i = wilsonInterval(p, n);
        expect(Number.isFinite(i.low)).toBe(true);
        expect(Number.isFinite(i.high)).toBe(true);
        expect(i.high).toBeGreaterThanOrEqual(i.low);
      }
    }
  });
});
