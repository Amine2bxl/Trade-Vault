import { describe, expect, test } from "bun:test";
import { defaultConfigFor } from "../checklistDefaults";
import { windowState } from "../helpers";

// Fuseau explicite : le test donne le même résultat sous la CI de New York
// comme sous celle d'Auckland.
const cfg = (endTime = "") => ({
  ...defaultConfigFor("fr"),
  startTime: "09:49",
  endTime,
  timeZone: "America/New_York",
});
// 31 octobre 2026 : New York est en UTC−4 (heure d'été jusqu'au 1er novembre).
const at = (hhmm: string) => new Date(`2026-10-31T${hhmm}:00-04:00`);

describe("la fenêtre de séance", () => {
  test("avant l'ouverture : le temps restant jusqu'au début", () => {
    expect(windowState(cfg(), at("09:20"))).toEqual({
      phase: "before",
      toStart: 29,
      toEnd: null,
      sinceStart: -29,
    });
  });

  test("ouverte sans fin : ouverte jusqu'à minuit", () => {
    const w = windowState(cfg(), at("15:00"));
    expect(w.phase).toBe("open");
    expect(w.toEnd).toBeNull();
  });

  test("ouverte avec une fin : le temps restant", () => {
    expect(windowState(cfg("10:10"), at("09:56")).toEnd).toBe(14);
  });

  test("après la fin : terminée", () => {
    expect(windowState(cfg("10:10"), at("10:10")).phase).toBe("after");
  });

  test("une fin antérieure au début ne veut rien dire : pas de fin", () => {
    expect(windowState(cfg("09:00"), at("15:00")).phase).toBe("open");
  });
});
