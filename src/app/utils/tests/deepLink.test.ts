import { describe, it, expect } from "bun:test";
import { filterParam, readFilterParam, insightDeepLink } from "../deepLink";
import { encodeFilter } from "../tradeFilter";

describe("deepLink — filtre en query param", () => {
  it("round-trip filtre → param → filtre", () => {
    const f = { period: "30d" as const, result: "loss" as const, trades: ["t1", "t2"] };
    const param = filterParam(f);
    expect(param.startsWith("f=")).toBe(true);
    expect(readFilterParam("?" + param)).toEqual(f);
  });

  it("lit un param absent → filtre vide", () => {
    expect(readFilterParam("")).toEqual({});
    expect(readFilterParam("?upgrade=1")).toEqual({});
  });

  it("deep-link d'un insight vers une page filtrée", () => {
    const url = insightDeepLink(["#182", "#185"], "journal");
    expect(url.startsWith("/journal?f=")).toBe(true);
    // décode le param pour vérifier le contenu
    const f = url.split("?f=")[1];
    expect(decodeURIComponent(f)).toBe(encodeFilter({ trades: ["#182", "#185"] }));
  });

  it("sans trades → chemin nu", () => {
    expect(insightDeepLink([], "analytics")).toBe("/analytics");
  });
});
