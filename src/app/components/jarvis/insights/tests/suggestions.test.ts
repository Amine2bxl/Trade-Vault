import { describe, it, expect } from "bun:test";
import { buildSuggestions } from "../suggestions";
import { buildHomeData, thinJournal, riskAfterLossTrader, EMPTY_MEMORY } from "./fixtures";

describe("buildSuggestions — contexte de page", () => {
  it("ajoute la suggestion adaptée à la page active (dashboard)", () => {
    const data = buildHomeData(riskAfterLossTrader());
    const s = buildSuggestions(data, "dashboard", "fr");
    expect(s[0].id).toBe("page_dashboard");
    expect(s[0].label).toBe("Analyser mon Dashboard");
  });

  it("journal → suggestion dédiée au dernier trade", () => {
    const data = buildHomeData(riskAfterLossTrader());
    const s = buildSuggestions(data, "journal", "en");
    expect(s[0].id).toBe("page_journal");
    expect(s[0].prompt).toContain("Analyze my last trade");
  });

  it("calendrier / news → événements économiques", () => {
    const data = buildHomeData(riskAfterLossTrader());
    const s = buildSuggestions(data, "calendar", "fr");
    expect(s[0].id).toBe("page_calendar");
  });
});

describe("buildSuggestions — situation réelle", () => {
  it("détecte la fuite risk_after_loss dans les suggestions", () => {
    const data = buildHomeData(riskAfterLossTrader());
    const s = buildSuggestions(data, undefined, "fr");
    const ids = s.map((x) => x.id);
    expect(ids).toContain("size_after_loss");
    expect(ids).toContain("this_week");
    expect(s.length).toBeLessThanOrEqual(4);
  });

  it("journal mince → jamais vide, suggestions génériques en repli", () => {
    const data = buildHomeData(thinJournal());
    const s = buildSuggestions(data, undefined, "fr");
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(4);
    expect(s.some((x) => x.id.startsWith("fallback_"))).toBe(true);
  });

  it("labels localisés (fr) avec variables injectées", () => {
    const data = buildHomeData(riskAfterLossTrader());
    const s = buildSuggestions(data, undefined, "fr");
    const worst = s.find((x) => x.id === "worst_day");
    expect(worst?.label).toBeDefined();
    // le jour localisé est injecté, jamais le placeholder brut
    expect(worst?.label).not.toContain("{day}");
  });
});

describe("buildSuggestions — contraintes", () => {
  it("ne dépasse jamais 4 suggestions", () => {
    const data = buildHomeData(riskAfterLossTrader());
    for (const page of ["dashboard", "journal", "calendar", "analytics", undefined]) {
      expect(buildSuggestions(data, page, "fr").length).toBeLessThanOrEqual(4);
    }
  });
});
