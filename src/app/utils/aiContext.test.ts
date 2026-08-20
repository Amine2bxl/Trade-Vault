import { describe, expect, it } from "bun:test";
import { buildCoachV1Payload } from "./aiContext";
import type { Trade } from "../types";

function mk(id: string, date: string, opts: Partial<Trade> = {}): Trade {
  return {
    id,
    date,
    symbol: "NQ",
    direction: "long",
    pnl: 0,
    riskAmount: opts.riskAmount ?? 100,
    rMultiple: 1,
    strategy: "Scalping",
    mistakes: opts.mistakes ?? [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: opts.confidence ?? 70,
    ...opts,
  };
}

describe("buildCoachV1Payload (6I)", () => {
  it("fait passer intention et réflexion telles quelles", () => {
    const trades = [mk("a", "2026-05-01")];
    const payload = buildCoachV1Payload({
      trades,
      intent: [
        { tradeId: "a", confidence: 85, plannedRisk: 100, emotion: "focused", plan: "wait" },
      ],
      reflection: [{ tradeId: "a", planRespected: "no", reason: "early_entry", note: "jumped in" }],
    });
    expect(payload.intent).toHaveLength(1);
    expect(payload.intent![0].tradeId).toBe("a");
    expect(payload.intent![0].confidence).toBe(85);
    expect(payload.reflection![0].planRespected).toBe("no");
  });

  it("dérive tradesToday/pnlToday depuis la session et les trades (représentation, pas nouveau moteur)", () => {
    const trades = [
      mk("a", "2026-05-01", { pnl: 100 }),
      mk("b", "2026-05-01", { pnl: -50 }),
      mk("c", "2026-05-02", { pnl: 200 }),
    ];
    const payload = buildCoachV1Payload({
      trades,
      session: { date: "2026-05-01", emotionalState: "calm" },
    });
    expect(payload.session).toBeDefined();
    expect(payload.session!.tradesToday).toBe(2);
    expect(payload.session!.pnlToday).toBe(50);
  });

  it("sans session, aucun bloc session n'est fabriqué", () => {
    const payload = buildCoachV1Payload({ trades: [] });
    expect(payload.session).toBeUndefined();
  });

  it("sans intent/reflection/edge, les champs sont absents (pas de panne)", () => {
    const payload = buildCoachV1Payload({ trades: [] });
    expect(payload.intent).toBeUndefined();
    expect(payload.reflection).toBeUndefined();
    expect(payload.edge).toBeUndefined();
  });

  it("edge passe en canal dédié (plus fusionné dans les signals)", () => {
    const payload = buildCoachV1Payload({
      trades: [],
      edge: { score: 72, weakest: "risk", windowDays: 10, subs: {} },
    });
    expect(payload.edge?.score).toBe(72);
    expect(payload.signals).toBeUndefined();
  });

  it("aucune donnée ne fait planter le payload", () => {
    expect(() => buildCoachV1Payload({ trades: [], language: "fr" })).not.toThrow();
  });
});
