import { describe, expect, test } from "bun:test";
import type { Trade } from "@/domain/trade";
import {
  dayFacts,
  emptyDay,
  emptyPlan,
  entryBlockers,
  normalizeDay,
  reduceDay,
  toSnapshot,
} from "../sessionPlan";
import { behaviorSignals, enforcementOf, sessionState, splitLimits } from "../sessionState";

const DEF = { risk: "250", maxTrades: 2, maxLoss: "500" };

const tr = (pnl: number, entryTime: string, riskAmount = 250): Trade =>
  ({
    id: entryTime,
    date: "2026-11-20",
    symbol: "NQ",
    direction: "short",
    pnl,
    riskAmount,
    rMultiple: pnl / riskAmount,
    strategy: "ICT",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime,
    exitTime: entryTime,
    confluences: [],
    confidence: 70,
  }) as Trade;

function liveDay() {
  let d = emptyDay(DEF);
  d = reduceDay(d, {
    type: "setPlan",
    patch: {
      ...emptyPlan(DEF),
      bias: "short",
      narrative: "Sous les opens",
      target: "21 450",
      entry: "21 520",
      invalidation: "21 560",
    },
  });
  d = reduceDay(d, { type: "setMood", mood: "calm" });
  return reduceDay(d, { type: "lock", at: "09:10" });
}

describe("limites de la séance", () => {
  test("la perte max du jour verrouille", () => {
    const facts = dayFacts([tr(-250, "09:40"), tr(-260, "10:05")], "2026-11-20");
    const reached = entryBlockers({
      plan: liveDay().plan,
      facts,
      window: "open",
      stopAfterLosses: 0,
    });
    expect(reached).toContain("dailyLoss");
    expect(reached).toContain("maxTrades");
  });

  test("risque pris au-dessus du plan : constaté, averti par défaut", () => {
    const facts = dayFacts([tr(100, "09:40", 400)], "2026-11-20");
    const reached = entryBlockers({
      plan: liveDay().plan,
      facts,
      window: "open",
      stopAfterLosses: 0,
    });
    expect(reached).toEqual(["riskBreach"]);
    expect(splitLimits(reached, undefined, [])).toEqual({
      blocking: [],
      warnings: ["riskBreach"],
      overridden: [],
    });
  });

  test("bloque ou avertit, au choix ; l'observation bloque toujours", () => {
    expect(enforcementOf("dailyLoss", { dailyLoss: "warn" })).toBe("warn");
    expect(enforcementOf("observation", {})).toBe("block");
  });

  test("une dérogation exige un motif et ne vaut qu'une fois par limite", () => {
    let d = liveDay();
    expect(
      reduceDay(d, { type: "override", limit: "dailyLoss", reason: "court", at: "10:30" }),
    ).toBe(d);
    d = reduceDay(d, {
      type: "override",
      limit: "dailyLoss",
      reason: "Le stop était une erreur de saisie",
      at: "10:30",
    });
    expect(d.overrides).toHaveLength(1);
    expect(
      reduceDay(d, {
        type: "override",
        limit: "dailyLoss",
        reason: "encore une fois, voilà",
        at: "10:40",
      }).overrides,
    ).toHaveLength(1);
    expect(splitLimits(["dailyLoss"], undefined, d.overrides).overridden).toEqual(["dailyLoss"]);
    // Écrite dans l'instantané et relue.
    const back = normalizeDay(toSnapshot(d), DEF);
    expect(back.overrides).toEqual(d.overrides);
    expect(back.plan.maxLoss).toBe("500");
  });
});

describe("état de la séance", () => {
  const now = Date.parse("2026-11-20T15:00:00Z");
  const base = { window: "open" as const, blocking: [], pausedUntil: null, nowMs: now };

  test("les six états", () => {
    expect(sessionState({ ...base, phase: "plan" })).toBe("preparation");
    expect(sessionState({ ...base, phase: "live", window: "before" })).toBe("ready");
    expect(sessionState({ ...base, phase: "live" })).toBe("active");
    expect(sessionState({ ...base, phase: "live", pausedUntil: "2026-11-20T15:05:00Z" })).toBe(
      "paused",
    );
    expect(sessionState({ ...base, phase: "live", blocking: ["dailyLoss"] })).toBe("locked");
    expect(sessionState({ ...base, phase: "review" })).toBe("completed");
  });

  test("une pause écoulée ne compte plus", () => {
    expect(sessionState({ ...base, phase: "live", pausedUntil: "2026-11-20T14:50:00Z" })).toBe(
      "active",
    );
  });
});

describe("signaux de comportement", () => {
  test("deux pertes de suite, ou une envie déclarée", () => {
    expect(
      behaviorSignals({ trades: [tr(-1, "09:40"), tr(-1, "10:00")], lastReentryUrge: null }),
    ).toEqual(["lossStreak"]);
    expect(
      behaviorSignals({ trades: [tr(-1, "09:40"), tr(5, "10:00")], lastReentryUrge: true }),
    ).toEqual(["reentryUrge"]);
    expect(behaviorSignals({ trades: [], lastReentryUrge: false })).toEqual([]);
  });
});
