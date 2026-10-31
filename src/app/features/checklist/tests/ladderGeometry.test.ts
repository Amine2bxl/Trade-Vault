import { describe, expect, test } from "bun:test";
import { LABEL_GAP, planLadder, spreadLabels } from "../ladderGeometry";
import { emptyPlan, type SessionPlan } from "../sessionPlan";

const SHORT: SessionPlan = {
  ...emptyPlan({ risk: "250", maxTrades: 1 }),
  bias: "short",
  narrative: "x",
  target: "21 450 EQL",
  entry: "FVG 21 520",
  invalidation: "21 580",
};

describe("la carte du plan", () => {
  test("le prix le plus haut en haut, avec les marges", () => {
    const l = planLadder(SHORT)!;
    expect(l.levels.map((x) => x.kind)).toEqual(["invalidation", "entry", "target"]);
    expect(l.levels[0].y).toBeCloseTo(0.1);
    expect(l.levels[2].y).toBeCloseTo(0.9);
  });

  test("les R se lisent depuis l'entrée : +R à la cible, −1 à l'invalidation", () => {
    const l = planLadder(SHORT)!;
    const r = Object.fromEntries(l.levels.map((x) => [x.kind, x.r]));
    expect(r.target).toBeCloseTo(70 / 60);
    expect(r.entry).toBe(0);
    expect(r.invalidation).toBe(-1);
    expect(l.rr).toBeCloseTo(70 / 60);
  });

  test("une cible du mauvais côté a un R négatif — la carte le montre", () => {
    const l = planLadder({ ...SHORT, target: "21 700" })!;
    expect(l.levels.find((x) => x.kind === "target")!.r).toBeLessThan(0);
  });

  test("les zones vont de l'entrée à la cible, et de l'entrée à l'invalidation", () => {
    const l = planLadder(SHORT)!;
    const y = Object.fromEntries(l.levels.map((x) => [x.kind, x.y]));
    expect(l.reward).toEqual({ top: y.entry, bottom: y.target });
    expect(l.risk).toEqual({ top: y.invalidation, bottom: y.entry });
  });

  test("la cible B s'ajoute en pointillé, sans R", () => {
    const l = planLadder({
      ...SHORT,
      alt: { condition: "c", bias: "long", target: "21 700 EQH", entry: "" },
    })!;
    const b = l.levels.find((x) => x.kind === "altTarget")!;
    expect(b.r).toBeNull();
    // Au-dessus de l'échelle du A : épinglée en haut, signalée comme telle,
    // et le scénario A garde toute la hauteur.
    expect(b.beyond).toBe("above");
    expect(b.y).toBeLessThan(0.1);
    expect(l.levels.find((x) => x.kind === "target")!.y).toBeCloseTo(0.9);
  });

  test("une cible B dans l'échelle du A garde sa vraie place", () => {
    const l = planLadder({
      ...SHORT,
      alt: { condition: "c", bias: "long", target: "21 500", entry: "" },
    })!;
    const b = l.levels.find((x) => x.kind === "altTarget")!;
    expect(b.beyond).toBeUndefined();
    expect(b.y).toBeGreaterThan(0.1);
    expect(b.y).toBeLessThan(0.9);
  });

  test("pas de carte sans trois prix, ni pour une journée d'observation", () => {
    expect(planLadder({ ...SHORT, target: "EQL" })).toBeNull();
    expect(planLadder({ ...SHORT, bias: "none" })).toBeNull();
    expect(planLadder({ ...SHORT, invalidation: "FVG 21 520" })).toBeNull();
  });
});

describe("les étiquettes ne se chevauchent pas", () => {
  test("des positions déjà espacées ne bougent pas", () => {
    expect(spreadLabels([0.1, 0.5, 0.9])).toEqual([0.1, 0.5, 0.9]);
  });

  test("deux niveaux proches sont écartés d'au moins l'écart minimal", () => {
    const out = spreadLabels([0.1, 0.12, 0.9]);
    expect(out[1] - out[0]).toBeGreaterThanOrEqual(LABEL_GAP - 1e-9);
  });

  test("un débordement en bas remonte les étiquettes, sans sortir du cadre", () => {
    const out = spreadLabels([0.8, 0.85, 0.9]);
    expect(out[2]).toBeLessThanOrEqual(1);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(out[1] - out[0]).toBeGreaterThanOrEqual(LABEL_GAP - 1e-9);
    expect(out[2] - out[1]).toBeGreaterThanOrEqual(LABEL_GAP - 1e-9);
  });
});
