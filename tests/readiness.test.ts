import { expect, test } from "bun:test";
import { computeReadiness, EMOTIONAL_STATES, isEmotionalState } from "../src/app/utils/readiness";

const base = {
  checklistDone: 0,
  checklistTotal: 0,
  emotionalState: null,
  activeRuleCount: 0,
} as const;

test("nothing measured gives null, not zero", () => {
  // La distinction porte tout le reste : zéro serait « préparation nulle,
  // mesurée » ; null est « rien n'a été mesuré ». Les séances reprises de
  // l'historique tombent ici et ne doivent peser dans aucune moyenne.
  expect(computeReadiness(base).score).toBeNull();
});

test("a fully ticked checklist alone cannot reach 100", () => {
  // La checklist plafonne à 60 : quelqu'un qui coche tout sans règle de risque
  // ni état déclaré n'est pas « parfaitement préparé ».
  const r = computeReadiness({ ...base, checklistDone: 8, checklistTotal: 8 });
  expect(r.score).toBe(60);
});

test("the score rises with the share of the checklist actually ticked", () => {
  const half = computeReadiness({ ...base, checklistDone: 4, checklistTotal: 8 }).score!;
  const full = computeReadiness({ ...base, checklistDone: 8, checklistTotal: 8 }).score!;
  expect(half).toBeLessThan(full);
  expect(half).toBe(30);
});

test("overconfident scores no better than frustrated, and both below tired", () => {
  const s = (state: (typeof EMOTIONAL_STATES)[number]) =>
    computeReadiness({ ...base, emotionalState: state }).score!;
  expect(s("overconfident")).toBe(s("frustrated"));
  expect(s("overconfident")).toBeLessThan(s("tired"));
  expect(s("focused")).toBeGreaterThan(s("calm"));
});

test("the first risk rule is the one that counts", () => {
  const none = computeReadiness({ ...base, activeRuleCount: 0 }).score;
  const one = computeReadiness({ ...base, activeRuleCount: 1 }).score!;
  const three = computeReadiness({ ...base, activeRuleCount: 3 }).score!;
  const ten = computeReadiness({ ...base, activeRuleCount: 10 }).score!;
  expect(none).toBeNull();
  expect(one).toBe(10);
  expect(three).toBe(20);
  // Empiler des règles n'est pas se préparer davantage.
  expect(ten).toBe(three);
});

test("the score stays inside 0..100 whatever the inputs", () => {
  const r = computeReadiness({
    checklistDone: 999,
    checklistTotal: 8,
    emotionalState: "focused",
    activeRuleCount: 999,
  });
  expect(r.score).toBeLessThanOrEqual(100);
  expect(r.score).toBeGreaterThanOrEqual(0);
  // Les entrées rendues sont normalisées : cochés ≤ total.
  expect(r.inputs.checklistDone).toBe(8);
});

test("negative and fractional inputs cannot produce a NaN score", () => {
  const r = computeReadiness({
    checklistDone: -3,
    checklistTotal: 4.7,
    emotionalState: null,
    activeRuleCount: -1,
  });
  expect(Number.isNaN(r.score)).toBe(false);
  expect(r.score).toBe(0);
});

test("the inputs travel with the score so it stays auditable", () => {
  const r = computeReadiness({
    checklistDone: 3,
    checklistTotal: 6,
    emotionalState: "calm",
    activeRuleCount: 2,
  });
  expect(r.inputs).toEqual({
    checklistDone: 3,
    checklistTotal: 6,
    emotionalState: "calm",
    activeRuleCount: 2,
  });
  expect(r.parts.checklist + r.parts.emotion + r.parts.rules).toBe(r.score);
});

test("isEmotionalState rejects anything outside the six words", () => {
  expect(isEmotionalState("calm")).toBe(true);
  expect(isEmotionalState("happy")).toBe(false);
  expect(isEmotionalState(70)).toBe(false);
  expect(isEmotionalState(null)).toBe(false);
});
