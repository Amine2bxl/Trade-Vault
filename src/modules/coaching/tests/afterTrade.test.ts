import { describe, expect, it } from "bun:test";
import type { Trade } from "@/domain";
import {
  afterTradeCopy,
  buildAfterTradeObservation,
  classifyPriority,
  type AfterTradeInput,
} from "../afterTrade";

function trade(id: string, opts: Partial<Trade> = {}): Trade {
  return {
    id,
    date: opts.date ?? "2026-05-01",
    symbol: "NQ",
    direction: "long",
    pnl: opts.pnl ?? 0,
    riskAmount: 100,
    rMultiple: 1,
    strategy: "Scalping",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: opts.entryTime ?? "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: opts.confidence ?? 70,
  };
}

describe("classifyPriority (6G)", () => {
  it("plan non respecté + raison revenge → HIGH", () => {
    expect(classifyPriority("no", "revenge", null, 1)).toBe("high");
  });
  it("plan non respecté + émotion frustré → HIGH", () => {
    expect(classifyPriority("no", null, "frustrated", 1)).toBe("high");
  });
  it("plan non respecté sans tilt → MEDIUM", () => {
    expect(classifyPriority("no", "early_entry", null, 1)).toBe("medium");
  });
  it("plan partiellement respecté → MEDIUM", () => {
    expect(classifyPriority("partial", null, null, 1)).toBe("medium");
  });
  it("3 pertes consécutives → HIGH quel que soit le reste", () => {
    expect(classifyPriority(null, null, null, 3)).toBe("high");
  });
  it("raison d'exécution seule → MEDIUM", () => {
    expect(classifyPriority(null, "wrong_risk", null, 1)).toBe("medium");
  });
  it("simple émotion sans écart → LOW", () => {
    expect(classifyPriority(null, null, "tired", 1)).toBe("low");
  });
  it("rien → null", () => {
    expect(classifyPriority(null, null, null, 0)).toBeNull();
  });
});

describe("buildAfterTradeObservation (6B)", () => {
  const base: AfterTradeInput = {
    trade: trade("a", { pnl: -250, confidence: 85 }),
    intent: { emotion: "focused", reasoning: "confirmation", plan: "attendre confirmation" },
    reflection: { planRespected: "no", reason: "early_entry", note: null },
    previousTrades: [],
  };

  it("détecte l'écart intention vs exécution", () => {
    const obs = buildAfterTradeObservation(base);
    expect(obs).not.toBeNull();
    expect(obs!.kind).toBe("intent_execution_gap");
    expect(obs!.evidence.planRespected).toBe("no");
    expect(obs!.evidence.confidence).toBe(85);
    expect(obs!.affectedTradeIds).toEqual(["a"]);
  });

  it("un plan respecté sans rien d'autre ne produit rien", () => {
    const obs = buildAfterTradeObservation({
      trade: trade("b", { pnl: 100 }),
      intent: null,
      reflection: { planRespected: "yes", reason: null, note: null },
      previousTrades: [],
    });
    expect(obs).toBeNull();
  });

  it("sans intention ni réflexion, rien n'est inventé", () => {
    const obs = buildAfterTradeObservation({
      trade: trade("c", { pnl: -50 }),
      intent: null,
      reflection: null,
      previousTrades: [],
    });
    expect(obs).toBeNull();
  });

  it("3 pertes consécutives → perte d'affilée signalée + récurrence", () => {
    const prev = [
      trade("p1", { pnl: -40, entryTime: "09:00" }),
      trade("p2", { pnl: -60, entryTime: "09:15" }),
    ];
    const obs = buildAfterTradeObservation({
      trade: trade("cur", { pnl: -70, entryTime: "09:30" }),
      intent: null,
      reflection: { planRespected: null, reason: null, note: null },
      previousTrades: prev,
    });
    expect(obs).not.toBeNull();
    expect(obs!.priority).toBe("high");
    expect(obs!.kind).toBe("loss_streak");
    expect(obs!.evidence.consecutiveLossesToday).toBe(3);
    expect(obs!.recurrence).toEqual({ count: 3, lowSample: false });
    expect(obs!.affectedTradeIds).toEqual(["p1", "p2", "cur"]);
  });

  it("2 pertes consécutives avec plan non respecté → récurrence signal faible", () => {
    const obs = buildAfterTradeObservation({
      trade: trade("cur2", { pnl: -70, entryTime: "09:30" }),
      intent: null,
      reflection: { planRespected: "no", reason: "early_entry", note: null },
      previousTrades: [trade("p1", { pnl: -40, entryTime: "09:00" })],
    });
    expect(obs).not.toBeNull();
    expect(obs!.recurrence).toEqual({ count: 2, lowSample: true });
    expect(obs!.priority).toBe("medium");
  });

  it("2 pertes consécutives sans réflexion → rien (le coded rule gère ≥3)", () => {
    const obs = buildAfterTradeObservation({
      trade: trade("cur3", { pnl: -70, entryTime: "09:30" }),
      intent: null,
      reflection: null,
      previousTrades: [trade("p1", { pnl: -40, entryTime: "09:00" })],
    });
    expect(obs).toBeNull();
  });

  it("un gain rompt la série de pertes", () => {
    const obs = buildAfterTradeObservation({
      trade: trade("win", { pnl: 100, entryTime: "09:30" }),
      intent: null,
      reflection: { planRespected: null, reason: null, note: null },
      previousTrades: [
        trade("p1", { pnl: -40, entryTime: "09:00" }),
        trade("p2", { pnl: -60, entryTime: "09:15" }),
      ],
    });
    expect(obs).toBeNull();
  });
});

describe("afterTradeCopy (6B)", () => {
  it("copie localisée sans chiffre inventé", () => {
    const obs = buildAfterTradeObservation({
      trade: trade("x", { pnl: -250, confidence: 85 }),
      intent: { emotion: "focused", reasoning: null, plan: "attendre confirmation" },
      reflection: { planRespected: "no", reason: "early_entry", note: null },
      previousTrades: [],
    })!;
    const fr = afterTradeCopy(obs, true);
    expect(fr.title).toBe("Ce trade mérite ton attention");
    expect(fr.body).toContain("-250 $");
    expect(fr.body).toContain("85 %");
    const en = afterTradeCopy(obs, false);
    expect(en.title).toBe("This trade deserves your attention");
    expect(en.body).toContain("-250");
  });
});
