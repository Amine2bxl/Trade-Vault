import { describe, expect, it } from "bun:test";
import { contextBlocks } from "../context";

describe("blocs intent / reflection / edge / session (6I)", () => {
  it("intention + réflexion → bloc BEFORE/AFTER présent avec les chiffres exacts", () => {
    const text = contextBlocks({
      intent: [
        {
          tradeId: "a1",
          symbol: "NQ",
          confidence: 85,
          plannedRisk: 100,
          plan: "wait for confirmation",
          emotion: "calm",
        },
      ],
      reflection: [
        { tradeId: "a1", planRespected: "no", reason: "early_entry", note: "jumped in" },
      ],
    });
    expect(text).toContain("TRADE INTENT & REFLECTION");
    expect(text).toContain("BEFORE →");
    expect(text).toContain("85% confidence");
    expect(text).toContain("planned risk 100");
    expect(text).toContain("plan respected=no");
    expect(text).toContain('reason "early_entry"');
  });

  it("aucune intention/réflexion → aucun bloc inventé", () => {
    const text = contextBlocks({ stats: { totalPnl: 100 } });
    expect(text).not.toContain("TRADE INTENT");
  });

  it("edge présent → bloc EDGE SCORE avec période et sous-scores", () => {
    const text = contextBlocks({
      edge: {
        score: 72,
        weakest: "risk",
        windowDays: 10,
        subs: { risk: { value: 40, detail: "8/20" } },
      },
    });
    expect(text).toContain("EDGE SCORE");
    expect(text).toContain("72");
    expect(text).toContain("10 traded days");
    expect(text).toContain("risk=40");
  });

  it("edge null → pas de bloc EDGE SCORE", () => {
    const text = contextBlocks({ edge: { score: null, weakest: null, windowDays: 10 } });
    expect(text).not.toContain("EDGE SCORE");
  });

  it("session présente → bloc CURRENT SESSION avec les dérivés du jour", () => {
    const text = contextBlocks({
      session: {
        date: "2026-05-01",
        emotionalState: "calm",
        readinessScore: 80,
        disciplineScore: 90,
        tradesToday: 2,
        pnlToday: 50,
      },
    });
    expect(text).toContain("CURRENT SESSION");
    expect(text).toContain("tradesToday=2");
    expect(text).toContain("pnlToday=50");
  });

  it("contexte vide → rien ne tombe en panne, pas de bloc", () => {
    expect(contextBlocks({})).toBe("");
  });
});
