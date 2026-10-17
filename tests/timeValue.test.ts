import { describe, expect, test } from "bun:test";
import {
  formatTimeValue,
  minuteOptions,
  normalizeTimeDraft,
  parseTimeValue,
} from "../src/shared/ui/timeValue";

describe("saisie d'une heure civile", () => {
  test("aucune conversion de fuseau ni arrondi de minute", () => {
    expect(parseTimeValue("09:47")).toEqual({ hour: 9, minute: 47 });
    expect(parseTimeValue("0:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseTimeValue("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(formatTimeValue(9, 7)).toBe("09:07");
  });
  test("les heures incomplètes ou impossibles restent des brouillons", () => {
    for (const value of ["", "09:", "24:00", "12:60", "-1:30", "12:3", "0900", "abc"])
      expect(parseTimeValue(value)).toBeNull();
  });
  test("la saisie numérique et le collage HH:MM gardent la précision", () => {
    expect(normalizeTimeDraft("0947")).toBe("09:47");
    expect(normalizeTimeDraft("9:47")).toBe("09:47");
    expect(normalizeTimeDraft("09:47")).toBe("09:47");
    expect(normalizeTimeDraft("09")).toBe("09");
    expect(normalizeTimeDraft("a0947b")).toBe("09:47");
  });
  test("un pas invalide ne peut jamais bloquer le navigateur", () => {
    for (const step of [0, -1, NaN, Infinity]) expect(minuteOptions(step)).toHaveLength(60);
    expect(minuteOptions(100)).toEqual([0]);
  });
  test("une minute importée hors du pas reste sélectionnable", () => {
    const values = minuteOptions(5, 47);
    expect(values).toContain(47);
    expect(values).toContain(45);
    expect(values).toContain(50);
    expect(values).toHaveLength(13);
    expect(minuteOptions(5, 45)).toHaveLength(12);
    expect(minuteOptions(5, 60)).not.toContain(60);
  });
});
