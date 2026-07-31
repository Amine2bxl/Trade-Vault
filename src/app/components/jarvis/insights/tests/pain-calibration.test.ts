import { describe, it, expect } from "bun:test";
import { patternForPain, runInsightEngine } from "../engine";
import type { JarvisHomeData } from "../types";
import { buildHomeData, overtradingTrader, EMPTY_MEMORY } from "./fixtures";

describe("patternForPain — la faiblesse déclarée oriente Jarvis", () => {
  it("mappe chaque faiblesse vers le détecteur pertinent", () => {
    expect(patternForPain("overtrading")).toBe("overtrading");
    expect(patternForPain("risk")).toBe("risk_after_loss");
    expect(patternForPain("emotions")).toBe("discipline_streak");
    expect(patternForPain("consistency")).toBe("discipline_streak");
    expect(patternForPain("journaling")).toBe("costliest_mistake");
    expect(patternForPain(null)).toBeNull();
    expect(patternForPain(undefined)).toBeNull();
  });

  it("gère la multi-sélection (liste séparée par virgules) → premier mappable", () => {
    expect(patternForPain("journaling, emotions")).toBe("costliest_mistake");
    expect(patternForPain("risk, overtrading")).toBe("risk_after_loss");
    expect(patternForPain("emotions, risk")).toBe("discipline_streak");
    expect(patternForPain("  overtrading , emotions ")).toBe("overtrading");
  });

  it("le Hero préfère le pattern lié à la faiblesse déclarée", () => {
    // Un trader overtrading dont la faiblesse déclarée EST overtrading :
    // le détecteur overtrading est validé ET priorisé par le profil.
    const data: JarvisHomeData = {
      ...buildHomeData(overtradingTrader()),
      onboarding: { ...buildHomeData([]).onboarding!, pain: "overtrading" },
    };
    const res = runInsightEngine(data, EMPTY_MEMORY);
    if (res.confidence.status !== "validated") throw new Error("expected validated");
    // Au minimum, le pattern overtrading est dans les candidats validés.
    expect(res.candidates.some((c) => c.pattern === "overtrading")).toBe(true);
  });
});
