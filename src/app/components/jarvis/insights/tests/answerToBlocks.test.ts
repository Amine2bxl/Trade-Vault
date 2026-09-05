import { describe, it, expect } from "bun:test";
import { answerToBlocks, splitAnswer, selectEvidence } from "../answerToBlocks";
import type { BehaviorSignals } from "../../../../utils/behaviorSignals";

const signals: BehaviorSignals = {
  byWeekday: [
    // `tradeIds` est ce qui permet de REMONTER du chiffre aux trades qui le
    // produisent — c'est la promesse de traçabilité du produit. Le champ avait
    // été ajouté au type `SignalBucket` sans que cette fixture suive, et
    // `tsc` le signalait sans que personne ne le voie.
    { key: "Monday", trades: 12, winRatePct: 64, pnl: 1200, avgPnl: 100, tradeIds: ["t1", "t2"] },
    { key: "Friday", trades: 8, winRatePct: 38, pnl: -640, avgPnl: -80, tradeIds: ["t3"] },
  ],
  riskAfterLoss: {
    avgRiskNormal: 100,
    avgRiskAfterLoss: 142,
    driftPct: 42,
    tradesAfterLoss: 18,
    pnlAfterLoss: -900,
    afterLossTradeIds: ["t3"],
  },
  overtrading: {
    medianTradesPerDay: 2,
    busyDayThreshold: 4,
    pnlOnBusyDays: -300,
    pnlOnCalmDays: 800,
    avgPnlPerTradeBusy: -25,
    avgPnlPerTradeCalm: 60,
  },
};

const mistakes = [
  { name: "FOMO", count: 9, totalPnl: -720 },
  { name: "No stop", count: 3, totalPnl: -200 },
];

describe("splitAnswer — prose → analyse + plan", () => {
  it("sépare sur un marqueur **Plan**", () => {
    const { intro, plan } = splitAnswer(
      "Tu perds le vendredi.\n\n**Plan**\n- Taille fixe\n- Max 2 trades\n- Stop après 1 perte",
    );
    expect(intro).toBe("Tu perds le vendredi.");
    expect(plan).toEqual(["Taille fixe", "Max 2 trades", "Stop après 1 perte"]);
  });

  it("capte une liste à puces terminale sans marqueur", () => {
    const { plan } = splitAnswer("Diagnostic ici.\n- Point A\n- Point B");
    expect(plan).toEqual(["Point A", "Point B"]);
  });

  it("sans plan : intro = toute la réponse, plan vide", () => {
    const { intro, plan } = splitAnswer("Juste un paragraphe.");
    expect(intro).toBe("Juste un paragraphe.");
    expect(plan).toEqual([]);
  });
});

describe("selectEvidence — preuve chiffrée réelle", () => {
  it("question vendredi → performance par jour avec les vrais chiffres", () => {
    const ev = selectEvidence({
      answer: "",
      question: "Pourquoi je perds le vendredi ?",
      lang: "fr",
      signals,
    });
    expect(ev?.patternLabel).toBe("Performance par jour");
    expect(ev?.metrics.some((m) => m.value.includes("38%"))).toBe(true);
    expect(ev?.ruleText.toLowerCase()).toContain("vendredi");
  });

  it("question risque après perte → drift +42%", () => {
    const ev = selectEvidence({
      answer: "",
      question: "Est-ce que j'augmente mon risque après une perte ?",
      lang: "fr",
      signals,
    });
    expect(ev?.patternLabel).toContain("Revenge");
    expect(ev?.metrics.some((m) => m.value === "+42%")).toBe(true);
  });

  it("aucune donnée → null (jamais de preuve inventée)", () => {
    const ev = selectEvidence({ answer: "", question: "n'importe quoi", lang: "en" });
    expect(ev).toBeNull();
  });
});

describe("answerToBlocks — interface vivante", () => {
  it("produit analyse + preuve + plan + action exécutable", () => {
    const { blocks, tool } = answerToBlocks({
      answer: "Tu perds le vendredi.\n\n**Plan**\n- Taille fixe\n- Max 2 trades",
      question: "Pourquoi je perds le vendredi ?",
      lang: "fr",
      signals,
      mistakes,
    });
    expect(blocks.map((b) => b.type)).toEqual(["markdown", "insight", "mission", "tool"]);
    expect(tool?.tool).toBe("createChecklist");
    expect(typeof tool?.payload?.ruleText).toBe("string");
  });

  it("repli gracieux : sans preuve ni plan → au moins le bloc markdown", () => {
    const { blocks } = answerToBlocks({
      answer: "Réponse simple.",
      question: "bonjour",
      lang: "en",
    });
    expect(blocks[0].type).toBe("markdown");
  });

  it("n'invente jamais de plan : le plan du modèle prime", () => {
    const { blocks } = answerToBlocks({
      answer: "Diag.\n\n**Plan**\n- Règle du modèle",
      question: "mon risque après une perte",
      lang: "fr",
      signals,
    });
    const mission = blocks.find((b) => b.type === "mission");
    if (mission?.type !== "mission") throw new Error("expected mission");
    expect(mission.items).toEqual(["Règle du modèle"]);
  });
});
