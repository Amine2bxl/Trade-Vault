import { describe, it, expect } from "bun:test";
import { jarvisHeroCopy, jarvisLearningCopy } from "../copy";
import type { JarvisInsight } from "../types";

const baseInsight: Omit<JarvisInsight, "pattern" | "evidence" | "impact" | "mission"> = {
  moment: "warning",
  priority: 1,
  confidence: 0.69,
  sampleSize: 22,
};

const riskAfterLoss: JarvisInsight = {
  ...baseInsight,
  pattern: "risk_after_loss",
  evidence: { driftPct: 25, avgRiskNormal: 100, avgRiskAfterLoss: 125, pnlAfterLoss: -1100 },
  impact: { label: "Coût estimé après perte", amount: 1100, unit: "$" },
  mission: ["pause_after_loss", "keep_size_after_loss"],
};

const overtrading: JarvisInsight = {
  ...baseInsight,
  pattern: "overtrading",
  evidence: {
    avgPnlPerTradeBusy: -10,
    avgPnlPerTradeCalm: 6,
    pnlOnBusyDays: -180,
    medianTradesPerDay: 2,
  },
  impact: { label: "Coût des journées chargées", amount: 180, unit: "$" },
  mission: ["day_trade_cap", "only_verified_setups"],
};

const disciplineStreak: JarvisInsight = {
  ...baseInsight,
  pattern: "discipline_streak",
  moment: "brief",
  evidence: { currentStreak: 5, currentStreakType: "win" },
  impact: null,
  mission: ["protect_streak", "no_overconfidence"],
};

describe("Copy Layer — risk_after_loss (fr, intermédiaire)", () => {
  const hero = jarvisHeroCopy(riskAfterLoss, { lang: "fr" });

  it("structure : Contexte → Observation → Impact → Action (≤ 5 lignes)", () => {
    expect(hero.lines.map((l) => l.kind)).toEqual(["context", "observation", "impact", "action"]);
    expect(hero.lines.length).toBeLessThanOrEqual(5);
  });

  it("variables correctement injectées, aucun chiffre inventé", () => {
    const text = hero.lines.map((l) => l.text).join(" ");
    expect(text).toContain("22"); // sampleSize
    expect(text).toContain("25%"); // driftPct
    expect(text).toContain("1100 $"); // impact
    expect(text).toContain("Pause de 15 minutes après -1R"); // mission token résolue
    expect(text).not.toContain("42"); // aucun nombre hors données
    expect(text).not.toMatch(/tu peux|crois en toi|bel effort/i);
  });
});

describe("Copy Layer — overtrading", () => {
  it("injecte les PnL par trade et le coût des journées chargées", () => {
    const hero = jarvisHeroCopy(overtrading, { lang: "fr", experience: null });
    const text = hero.lines.map((l) => l.text).join(" ");
    expect(text).toContain("10 $"); // perte par trade (abs)
    expect(text).toContain("+6"); // jour calme
    expect(text).toContain("180 $"); // impact
    expect(text).toContain("Limiter la journée à 3 trades max"); // cap = median+1
  });

  it("mode avancé : observation courte", () => {
    const hero = jarvisHeroCopy(overtrading, { lang: "fr", experience: "advanced" });
    const obs = hero.lines.find((l) => l.kind === "observation");
    expect(obs?.text).toMatch(/^Journées chargées/);
  });
});

describe("Copy Layer — mode learning", () => {
  it("trop peu de données → pas de conclusion", () => {
    const { line } = jarvisLearningCopy(3, { lang: "fr", experience: null });
    expect(line).toContain("pas encore assez de données");
  });

  it("données insuffisantes mais prometteuses → tendance non confirmée", () => {
    const { line } = jarvisLearningCopy(22, { lang: "fr", experience: null });
    expect(line).toContain("commence à détecter une tendance");
    expect(line).not.toContain("25%"); // aucun chiffre de l'insight n'est repris
  });
});

describe("Copy Layer — modes de voix", () => {
  it("débutant : pédagogique, explique le concept", () => {
    const hero = jarvisHeroCopy(riskAfterLoss, { lang: "fr", experience: "beginner" });
    const obs = hero.lines.find((l) => l.kind === "observation");
    expect(obs?.text).toContain("Le risque, c'est la taille");
  });

  it("avancé : court et précis", () => {
    const hero = jarvisHeroCopy(riskAfterLoss, { lang: "fr", experience: "advanced" });
    const obs = hero.lines.find((l) => l.kind === "observation");
    expect(obs?.text).toMatch(/^Pattern : \+25% de risque après une perte\.$/);
  });
});

describe("Copy Layer — absence d'impact", () => {
  it("discipline_streak (impact null) → pas de ligne impact, 3 lignes", () => {
    const hero = jarvisHeroCopy(disciplineStreak, { lang: "fr", experience: null });
    expect(hero.lines.map((l) => l.kind)).toEqual(["context", "observation", "action"]);
    expect(hero.lines.length).toBe(3);
    expect(hero.lines.find((l) => l.kind === "impact")).toBeUndefined();
  });
});

describe("Copy Layer — anglais", () => {
  it("risk_after_loss en anglais : chiffres et mission localisés", () => {
    const hero = jarvisHeroCopy(riskAfterLoss, { lang: "en", experience: null });
    const text = hero.lines.map((l) => l.text).join(" ");
    expect(text).toContain("25%");
    expect(text).toContain("$1100");
    expect(text).toContain("Take a 15-minute break after -1R");
  });
});
