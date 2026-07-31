import { describe, it, expect } from "bun:test";
import { runInsightEngine } from "../engine";
import { pickPriority } from "../priority";
import type { JarvisInsight } from "../types";
import {
  buildHomeData,
  thinJournal,
  normalTrader,
  riskAfterLossTrader,
  overtradingTrader,
  disciplineStreakTrader,
  costliestMistakeTrader,
  combinedPatternsTrader,
  EMPTY_MEMORY,
} from "./fixtures";

describe("Insight Engine — moins de données", () => {
  it("journal mince → mode learning, aucun insight inventé", () => {
    const res = runInsightEngine(buildHomeData(thinJournal()), EMPTY_MEMORY);
    expect(res.confidence.status).toBe("learning");
    if (res.confidence.status !== "learning") throw new Error("expected learning");
    expect(res.confidence.sampleSize).toBe(4);
    expect(res.candidates).toHaveLength(0);
  });
});

describe("Insight Engine — trader normal", () => {
  it("comportement sain → aucun warning", () => {
    const res = runInsightEngine(buildHomeData(normalTrader()), EMPTY_MEMORY);
    expect(res.confidence.status).toBe("learning");
    for (const c of res.candidates) expect(c.moment).not.toBe("warning");
  });
});

describe("Insight Engine — risque augmenté après perte", () => {
  it("détecte risk_after_loss avec preuve et confiance correctes", () => {
    const res = runInsightEngine(buildHomeData(riskAfterLossTrader()), EMPTY_MEMORY);
    expect(res.confidence.status).toBe("validated");
    if (res.confidence.status !== "validated") return;
    const hero = res.confidence.insight;
    expect(hero.pattern).toBe("risk_after_loss");
    expect(hero.moment).toBe("warning");
    expect(hero.sampleSize).toBe(22);
    expect(hero.confidence).toBeCloseTo(0.69, 2);
    expect(hero.evidence.driftPct).toBe(25);
    expect(hero.evidence.avgRiskNormal).toBe(100);
    expect(hero.evidence.avgRiskAfterLoss).toBe(125);
    expect(hero.evidence.pnlAfterLoss).toBe(-1100);
    expect(hero.impact?.amount).toBe(1100);
    expect(hero.priority).toBe(1);
    expect(hero.mission.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Insight Engine — overtrading", () => {
  it("détecte overtrading avec preuve et confiance correctes", () => {
    const res = runInsightEngine(buildHomeData(overtradingTrader()), EMPTY_MEMORY);
    expect(res.confidence.status).toBe("validated");
    if (res.confidence.status !== "validated") return;
    const hero = res.confidence.insight;
    expect(hero.pattern).toBe("overtrading");
    expect(hero.moment).toBe("warning");
    expect(hero.sampleSize).toBe(23);
    expect(hero.confidence).toBeCloseTo(0.86, 2);
    expect(hero.evidence.pnlOnBusyDays).toBe(-180);
    expect(hero.evidence.avgPnlPerTradeBusy).toBe(-10);
    expect(hero.evidence.avgPnlPerTradeCalm).toBe(6);
    expect(hero.impact?.amount).toBe(180);
  });
});

describe("Insight Engine — amélioration de discipline", () => {
  it("reconnaît une série de victoires (moment brief, pas de warning)", () => {
    const res = runInsightEngine(buildHomeData(disciplineStreakTrader()), EMPTY_MEMORY);
    expect(res.confidence.status).toBe("validated");
    if (res.confidence.status !== "validated") return;
    const hero = res.confidence.insight;
    expect(hero.pattern).toBe("discipline_streak");
    expect(hero.moment).toBe("brief");
    expect(hero.sampleSize).toBe(10);
    expect(hero.confidence).toBeCloseTo(0.6, 2);
    expect(hero.evidence.currentStreak).toBe(6);
    expect(hero.impact).toBeNull();
  });
});

describe("Insight Engine — erreur la plus coûteuse", () => {
  it("isole l'erreur dominante avec sa preuve", () => {
    const res = runInsightEngine(buildHomeData(costliestMistakeTrader()), EMPTY_MEMORY);
    expect(res.confidence.status).toBe("validated");
    if (res.confidence.status !== "validated") return;
    const hero = res.confidence.insight;
    expect(hero.pattern).toBe("costliest_mistake");
    expect(hero.sampleSize).toBe(10);
    expect(hero.confidence).toBeCloseTo(0.6, 2);
    expect(hero.evidence.mistake).toBe("FOMO entry");
    expect(hero.evidence.count).toBe(10);
    expect(hero.evidence.totalPnl).toBe(-1000);
    expect(hero.impact?.amount).toBe(1000);
  });
});

describe("Insight Engine — priorité unique", () => {
  it("un seul Hero (priority 1) ; un warning prime sur un constat", () => {
    const res = runInsightEngine(buildHomeData(combinedPatternsTrader()), EMPTY_MEMORY);
    expect(res.confidence.status).toBe("validated");
    expect(res.candidates.length).toBeGreaterThanOrEqual(2);
    const heroes = res.candidates.filter((c) => c.priority === 1);
    expect(heroes).toHaveLength(1);
    expect(res.candidates[0].pattern).toBe("risk_after_loss");
    expect(res.candidates[0].priority).toBe(1);
    expect(res.candidates[1].priority).toBe(2);
  });

  it("anti-répétition : le dernier pattern affiché est dépriorisé", () => {
    const data = buildHomeData(combinedPatternsTrader());
    const repeated = runInsightEngine(data, {
      ...EMPTY_MEMORY,
      lastPattern: "risk_after_loss",
    });
    expect(repeated.candidates[0].pattern).toBe("discipline_streak");
  });

  it("mémoire : un pattern ignoré (dismiss) est exclu", () => {
    const data = buildHomeData(riskAfterLossTrader());
    const res = runInsightEngine(data, {
      ...EMPTY_MEMORY,
      ignoredPatterns: ["risk_after_loss"],
    });
    expect(res.candidates.find((c) => c.pattern === "risk_after_loss")).toBeUndefined();
    expect(res.confidence.status).toBe("learning");
  });
});

describe("Priority — tri isolé", () => {
  it("pickPriority assigne priority 1..n sans doublon", () => {
    const raw: JarvisInsight[] = [
      {
        moment: "warning",
        pattern: "risk_after_loss",
        priority: 0,
        confidence: 0.69,
        sampleSize: 22,
        evidence: { driftPct: 25 },
        impact: { label: "x", amount: 1100, unit: "$" },
        mission: ["a", "b"],
      },
      {
        moment: "brief",
        pattern: "discipline_streak",
        priority: 0,
        confidence: 0.95,
        sampleSize: 39,
        evidence: { currentStreak: 5 },
        impact: null,
        mission: ["a", "b"],
      },
    ];
    const ranked = pickPriority(raw, EMPTY_MEMORY);
    expect(ranked.map((i) => i.priority)).toEqual([1, 2]);
  });
});
