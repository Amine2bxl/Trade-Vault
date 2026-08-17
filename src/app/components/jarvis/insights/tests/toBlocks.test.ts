import { describe, it, expect } from "bun:test";
import { insightToBlocks, learningToBlock } from "../toBlocks";
import type { JarvisInsight } from "../types";

const insight: JarvisInsight = {
  moment: "warning",
  pattern: "risk_after_loss",
  priority: 1,
  confidence: 0.69,
  sampleSize: 22,
  evidence: { driftPct: 25, avgRiskNormal: 100, avgRiskAfterLoss: 125, pnlAfterLoss: -1100 },
  impact: { label: "Coût estimé après perte", amount: 1100, unit: "$" },
  mission: ["pause_after_loss", "keep_size_after_loss"],
  affectedTrades: [],
};

describe("toBlocks — insight → blocs", () => {
  it("produit [hero, insight, mission]", () => {
    const blocks = insightToBlocks(insight, { lang: "fr", experience: null });
    expect(blocks.map((b) => b.type)).toEqual(["hero", "insight", "mission"]);
  });

  it("hero : structure Contexte → Observation → Impact → Action", () => {
    const [hero] = insightToBlocks(insight, { lang: "fr", experience: null });
    if (hero.type !== "hero") throw new Error("expected hero");
    expect(hero.lines.map((l) => l.kind)).toEqual(["context", "observation", "impact", "action"]);
  });

  it("insight : label localisé + métriques + impact", () => {
    const [, insightBlock] = insightToBlocks(insight, { lang: "fr", experience: null });
    if (!insightBlock || insightBlock.type !== "insight") throw new Error("expected insight");
    expect(insightBlock.patternLabel).toBe("Risque après perte");
    const values = insightBlock.metrics.map((m) => m.value);
    expect(values).toContain("+25%");
    expect(values).toContain("22");
    expect(insightBlock.impact).toBe("Impact estimé : 1100 $");
  });

  it("mission : titre + items localisés depuis les tokens", () => {
    const [, , mission] = insightToBlocks(insight, { lang: "fr", experience: null });
    if (!mission || mission.type !== "mission") throw new Error("expected mission");
    expect(mission.title).toBe("Mission du jour");
    expect(mission.items).toContain("Pause de 15 minutes après -1R");
    expect(mission.items).toContain("Ne pas augmenter la taille après une perte");
  });

  it("anglais : labels, montants et missions localisés", () => {
    const blocks = insightToBlocks(insight, { lang: "en", experience: null });
    const insightBlock = blocks.find((b) => b.type === "insight");
    const mission = blocks.find((b) => b.type === "mission");
    if (!insightBlock || insightBlock.type !== "insight" || !mission || mission.type !== "mission")
      throw new Error("bad blocks");
    expect(insightBlock.patternLabel).toBe("Risk after a loss");
    expect(insightBlock.impact).toBe("Estimated impact : $1100");
    expect(mission.title).toBe("Today's mission");
    expect(mission.items[0]).toBe("Take a 15-minute break after -1R");
  });
});

describe("toBlocks — mode learning", () => {
  it("produit un seul hero de non-conclusion, sans chiffre de l'insight", () => {
    const block = learningToBlock(22, { lang: "fr", experience: null });
    expect(block.type).toBe("hero");
    if (block.type !== "hero") throw new Error("expected hero");
    expect(block.lines).toHaveLength(1);
    expect(block.lines[0].text).toContain("commence à détecter une tendance");
    expect(block.lines[0].text).not.toContain("25%");
  });
});
