import { describe, it, expect } from "bun:test";
import { buildHomeBlocks } from "../buildHome";
import {
  buildHomeData,
  thinJournal,
  riskAfterLossTrader,
  combinedPatternsTrader,
  EMPTY_MEMORY,
} from "./fixtures";

describe("buildHomeBlocks — orchestration du Home", () => {
  it("journal mince → mode apprentissage (un seul bloc hero, pas de conclusion)", () => {
    const { blocks, pattern } = buildHomeBlocks(buildHomeData(thinJournal()), EMPTY_MEMORY, {
      lang: "fr",
      experience: null,
    });
    expect(pattern).toBeNull();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("hero");
  });

  it("insight validé → [hero, insight, mission] + pattern du Hero", () => {
    const { blocks, pattern } = buildHomeBlocks(
      buildHomeData(riskAfterLossTrader()),
      EMPTY_MEMORY,
      { lang: "fr", experience: null },
    );
    expect(pattern).toBe("risk_after_loss");
    expect(blocks.map((b) => b.type)).toEqual(["hero", "insight", "mission"]);
    const hero = blocks[0];
    if (hero.type !== "hero") throw new Error("expected hero");
    expect(hero.lines.map((l) => l.kind)).toEqual(["context", "observation", "impact", "action"]);
    const insight = blocks[1];
    if (insight.type !== "insight") throw new Error("expected insight");
    expect(insight.patternLabel).toBe("Risque après perte");
  });

  it("anti-répétition : le dernier pattern affiché est dépriorisé (rotation)", () => {
    const data = buildHomeData(combinedPatternsTrader());
    const first = buildHomeBlocks(data, EMPTY_MEMORY, { lang: "fr", experience: null });
    // Premier open : risk_after_loss est le Hero (warning, impact fort).
    expect(first.pattern).toBe("risk_after_loss");

    // Second open : le pattern affiché hier est dépriorisé → discipline_streak.
    const memory = { ...EMPTY_MEMORY, lastPattern: "risk_after_loss" };
    const second = buildHomeBlocks(data, memory, { lang: "fr", experience: null });
    expect(second.pattern).toBe("discipline_streak");
    const hero = second.blocks[0];
    if (hero.type !== "hero") throw new Error("expected hero");
    expect(hero.lines.some((l) => l.text.includes("série"))).toBe(true);
  });

  it("le mode de voix vient de l'expérience (avancé → observation courte)", () => {
    const { blocks } = buildHomeBlocks(buildHomeData(riskAfterLossTrader()), EMPTY_MEMORY, {
      lang: "fr",
      experience: "advanced",
    });
    const hero = blocks[0];
    if (hero.type !== "hero") throw new Error("expected hero");
    const obs = hero.lines.find((l) => l.kind === "observation");
    expect(obs?.text).toMatch(/^Pattern : \+25% de risque après une perte\.$/);
  });
});
