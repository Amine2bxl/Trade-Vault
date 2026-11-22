import { describe, expect, test } from "bun:test";
import {
  plannedR,
  priceOrNull,
  rFromPrices,
  riskFromPrices,
  stopDistance,
  stopSize,
} from "./executionPlan";

describe("executionPlan", () => {
  test("priceOrNull : seuls les prix strictement positifs comptent", () => {
    expect(priceOrNull("21 450,25")).toBe(21450.25);
    expect(priceOrNull(0)).toBeNull();
    expect(priceOrNull("")).toBeNull();
    expect(priceOrNull("abc")).toBeNull();
    expect(priceOrNull(null)).toBeNull();
  });

  test("le stop doit être du bon côté", () => {
    expect(stopDistance("long", 100, 90)).toBe(10);
    expect(stopDistance("long", 100, 110)).toBeNull();
    expect(stopDistance("short", 100, 110)).toBe(10);
    expect(stopDistance("short", 100, 100)).toBeNull();
    expect(stopDistance("long", null, 90)).toBeNull();
  });

  test("R par les prix, long et short", () => {
    expect(rFromPrices("long", 100, 90, 120)).toBe(2);
    expect(rFromPrices("long", 100, 90, 95)).toBe(-0.5);
    expect(rFromPrices("short", 21500, 21520, 21450)).toBe(2.5);
    expect(rFromPrices("short", 21500, 21480, 21450)).toBeNull();
    expect(rFromPrices("long", 100, 90, null)).toBeNull();
  });

  test("R prévu : une cible derrière l'entrée n'a pas de R", () => {
    expect(plannedR("long", 100, 90, 130)).toBe(3);
    expect(plannedR("long", 100, 90, 95)).toBeNull();
    expect(plannedR("short", 100, 110, null)).toBeNull();
  });

  test("taille du stop en ticks seulement pour un contrat connu", () => {
    expect(stopSize("long", 21500, 21490, "NQ")).toEqual({ points: 10, ticks: 40 });
    expect(stopSize("long", 21500, 21490, "NAS100")).toEqual({ points: 10, ticks: null });
    expect(stopSize("long", 21500, 21510, "NQ")).toBeNull();
  });

  test("risque en dollars depuis les prix", () => {
    expect(riskFromPrices("long", 21500, 21490, 2, "MNQ")).toBe(40);
    expect(riskFromPrices("long", 21500, 21490, 2, "NAS100")).toBeNull();
    expect(riskFromPrices("long", 21500, 21490, null, "NQ")).toBeNull();
  });
});
