import { describe, expect, test } from "bun:test";
import {
  countedR,
  hypotheticalR,
  MISSED_REASONS,
  suggestedClass,
  type MissedRecord,
} from "./missedSetup";

const short: MissedRecord = {
  direction: "short",
  entry: 21520,
  stop: 21580,
  target: 21450,
  classification: "valid",
  outcome: "target",
  declaredR: 0,
};

describe("setups manqués", () => {
  test("le R d'une issue connue se calcule depuis les niveaux", () => {
    expect(hypotheticalR(short, "target")).toBe(1.17);
    expect(hypotheticalR(short, "stop")).toBe(-1);
    expect(hypotheticalR(short, "unknown")).toBeNull();
    expect(hypotheticalR({ ...short, target: 21600 }, "target")).toBeNull();
  });

  test("seuls les setups valides à issue connue comptent", () => {
    expect(countedR(short)).toBe(1.17);
    expect(countedR({ ...short, outcome: "stop" })).toBe(-1);
    expect(countedR({ ...short, outcome: "unknown" })).toBeNull();
    expect(countedR({ ...short, classification: "skipped" })).toBeNull();
    expect(countedR({ ...short, classification: "invalid" })).toBeNull();
    expect(countedR({ ...short, classification: "hesitation" })).toBe(1.17);
  });

  test("une ligne d'avant ce modèle garde son R déclaré", () => {
    expect(countedR({ ...short, classification: null, outcome: null, declaredR: 2.5 })).toBe(2.5);
  });

  test("sans prix mais issue connue : le R déclaré", () => {
    expect(countedR({ ...short, entry: null, declaredR: 1.5 })).toBe(1.5);
  });

  test("chaque raison suggère une classe ; les règles écartent, elles ne coûtent pas", () => {
    for (const r of MISSED_REASONS) expect(suggestedClass(r)).toBeDefined();
    expect(suggestedClass("daily_limit")).toBe("skipped");
    expect(suggestedClass("fear")).toBe("hesitation");
    expect(suggestedClass("no_confirmation")).toBe("invalid");
  });
});
