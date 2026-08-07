import { describe, it, expect } from "bun:test";
import {
  computeQuantStats,
  getSession,
  getMacroEvents,
  statsBySession,
  statsByHour,
  dayHourMatrix,
  winRateOf,
} from "../src/app/utils/quantStats";
import type { Trade } from "../src/app/types";

function mkTrade(over: Partial<Trade>): Trade {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    date: "2026-07-01",
    symbol: "NQ",
    direction: "long",
    pnl: 0,
    riskAmount: 100,
    rMultiple: 0,
    strategy: "Silver Bullet",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: 70,
    ...over,
  };
}

describe("getSession", () => {
  it("maps ET times to ICT sessions", () => {
    expect(getSession("03:15")).toBe("london");
    expect(getSession("02:00")).toBe("london");
    expect(getSession("08:00")).toBe("newyork");
    expect(getSession("09:30")).toBe("newyork");
    expect(getSession("16:29")).toBe("newyork");
    expect(getSession("16:30")).toBe("asia");
    expect(getSession("20:00")).toBe("asia");
    expect(getSession("00:30")).toBe("asia");
  });
  it("returns null for missing/invalid time", () => {
    expect(getSession("")).toBeNull();
    expect(getSession("xx")).toBeNull();
  });
});

describe("getMacroEvents", () => {
  it("flags NFP on the first Friday of the month", () => {
    expect(getMacroEvents("2026-07-03")).toContain("NFP"); // Fri July 3rd 2026
    expect(getMacroEvents("2026-07-10")).not.toContain("NFP"); // second Friday
    expect(getMacroEvents("2026-07-01")).not.toContain("NFP"); // Wednesday
  });
  it("flags FOMC decision days", () => {
    expect(getMacroEvents("2026-07-29")).toContain("FOMC");
    expect(getMacroEvents("2026-07-28")).not.toContain("FOMC");
  });
});

describe("computeQuantStats", () => {
  it("returns nulls/zeros on empty input", () => {
    const q = computeQuantStats([]);
    expect(q.expectancy).toBe(0);
    expect(q.sharpe).toBeNull();
    expect(q.kelly).toBeNull();
  });

  it("computes expectancy in $ and R", () => {
    const q = computeQuantStats([
      mkTrade({ pnl: 200, riskAmount: 100 }),
      mkTrade({ pnl: -100, riskAmount: 100 }),
    ]);
    expect(q.expectancy).toBe(50); // (200-100)/2
    expect(q.expectancyR).toBeCloseTo(0.5); // (2R + -1R)/2
  });

  it("kelly = W - (1-W)/R", () => {
    // W=0.5, R=2 → 0.5 - 0.5/2 = 0.25.
    // L'échantillon compte 40 trades décisifs : ce test vérifiait auparavant la
    // formule sur QUATRE trades, ce qui validait au passage l'affichage d'une
    // recommandation de taille de position sur un échantillon dénué de sens.
    const q = computeQuantStats([
      ...Array(20)
        .fill(null)
        .map(() => mkTrade({ pnl: 200 })),
      ...Array(20)
        .fill(null)
        .map(() => mkTrade({ pnl: -100 })),
    ]);
    expect(q.kelly).toBeCloseTo(0.25);
  });

  it("kelly is null with no losses", () => {
    expect(computeQuantStats([mkTrade({ pnl: 100 })]).kelly).toBeNull();
  });

  it("sharpe/sortino need >= 10 trading days", () => {
    const nine = Array.from({ length: 9 }, (_, i) =>
      mkTrade({ date: `2026-07-0${i + 1}`, pnl: 100 + i }),
    );
    expect(computeQuantStats(nine).sharpe).toBeNull();

    const eleven = Array.from({ length: 11 }, (_, i) =>
      mkTrade({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, pnl: i % 2 === 0 ? 150 : -50 }),
    );
    const q = computeQuantStats(eleven);
    expect(q.sharpe).not.toBeNull();
    expect(q.sharpe!).toBeGreaterThan(0);
    expect(q.sortino).not.toBeNull();
  });

  it("sortino caps at 99 when no losing day", () => {
    const days = Array.from({ length: 12 }, (_, i) =>
      mkTrade({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, pnl: 50 + i }),
    );
    expect(computeQuantStats(days).sortino).toBe(99);
  });

  it("maxDrawdownPct uses starting balance + peak", () => {
    const trades = [
      mkTrade({ date: "2026-07-01", pnl: 500 }),
      mkTrade({ date: "2026-07-02", pnl: -700 }),
    ];
    // maxDD 700, peak 500, base 10000+500 → 700/10500
    const q = computeQuantStats(trades, 10000);
    expect(q.maxDrawdownPct).toBeCloseTo(700 / 10500);
    expect(computeQuantStats(trades, 0).maxDrawdownPct).toBeNull();
  });

  it("recovery: -1 while still in drawdown, days once recovered", () => {
    const still = computeQuantStats([
      mkTrade({ date: "2026-07-01", pnl: 500 }),
      mkTrade({ date: "2026-07-02", pnl: -300 }),
    ]);
    expect(still.recoveryDays).toBe(-1);

    const recovered = computeQuantStats([
      mkTrade({ date: "2026-07-01", pnl: 500 }),
      mkTrade({ date: "2026-07-02", pnl: -300 }),
      mkTrade({ date: "2026-07-05", pnl: 400 }),
    ]);
    expect(recovered.recoveryDays).toBe(3); // 07-02 → 07-05
  });

  it("consistency: best day share of total profit", () => {
    const q = computeQuantStats([
      mkTrade({ date: "2026-07-01", pnl: 800 }),
      mkTrade({ date: "2026-07-02", pnl: 200 }),
    ]);
    expect(q.bestDayShare).toBeCloseTo(0.8);
    expect(q.consistencyScore).toBeCloseTo(20);
    expect(computeQuantStats([mkTrade({ pnl: -100 })]).consistencyScore).toBeNull();
  });

  // Nommé `cleanTrades`, et non « adhérence au plan » : cet indicateur mesure
  // ce que le trader s'est lui-même reproché, pas ce que le moteur de
  // discipline constate (`ruleAdherence.ts`). Les deux portaient le même
  // libellé et affichaient des valeurs différentes.
  it("cleanTrades = part des trades sans erreur cochée", () => {
    const q = computeQuantStats([
      mkTrade({ mistakes: [] }),
      mkTrade({ mistakes: ["FOMO entry"] }),
      mkTrade({ mistakes: [] }),
      mkTrade({ mistakes: [] }),
    ]);
    expect(q.cleanTrades).toBeCloseTo(0.75);
  });
});

describe("breakdowns", () => {
  it("statsBySession buckets by entry time", () => {
    const s = statsBySession([
      mkTrade({ entryTime: "03:00", pnl: 100 }),
      mkTrade({ entryTime: "09:30", pnl: -50 }),
      mkTrade({ entryTime: "09:45", pnl: 75 }),
      mkTrade({ entryTime: "21:00", pnl: 25 }),
    ]);
    expect(s.london.count).toBe(1);
    expect(s.newyork.count).toBe(2);
    expect(s.newyork.pnl).toBe(25);
    expect(s.asia.count).toBe(1);
  });

  it("statsByHour regroupe par heure d'entrée", () => {
    const byHour = statsByHour([
      mkTrade({ entryTime: "09:30", pnl: 100 }),
      mkTrade({ entryTime: "09:55", pnl: -60 }),
      mkTrade({ entryTime: "10:05", pnl: 40 }),
      mkTrade({ entryTime: "09:10", pnl: 0, direction: "be" }),
    ]);
    expect(byHour[9].count).toBe(3);
    expect(byHour[10].count).toBe(1);
  });

  it("winRateOf EXCLUT les break-even du dénominateur", () => {
    const byHour = statsByHour([
      ...Array(3)
        .fill(null)
        .map(() => mkTrade({ entryTime: "09:30", pnl: 100 })),
      ...Array(3)
        .fill(null)
        .map(() => mkTrade({ entryTime: "09:40", pnl: -60 })),
      mkTrade({ entryTime: "09:10", pnl: 0, direction: "be" }),
    ]);
    expect(winRateOf(byHour[9])).toBeCloseTo(0.5); // 3W/3L, le BE ne compte pas
  });

  it("winRateOf REFUSE de produire un taux sous l'échantillon minimum", () => {
    // Un total reste vrai à toute taille ; un TAUX sur trois trades ne veut
    // rien dire, et invite pourtant à « ma meilleure heure est 9 h ».
    const byHour = statsByHour([
      mkTrade({ entryTime: "09:30", pnl: 100 }),
      mkTrade({ entryTime: "09:55", pnl: -60 }),
    ]);
    expect(winRateOf(byHour[9])).toBeNull();
  });

  it("dayHourMatrix keys are dow-hour", () => {
    const m = dayHourMatrix([mkTrade({ date: "2026-07-01", entryTime: "09:30", pnl: 10 })]);
    expect(m["3-9"].count).toBe(1); // 2026-07-01 = Wednesday
  });
});

describe("Kelly — plancher d'échantillon", () => {
  // Kelly ne DÉCRIT pas le passé, il RECOMMANDE une taille de position.
  // Il s'affichait dès deux trades : trois trades chanceux donnaient un Kelly
  // de plusieurs dizaines de pourcents, et un trader qui le suit fait sauter
  // son compte. « Indicatif uniquement » ne protège personne.
  it("ne s'affiche PAS sous 30 trades décisifs", () => {
    const few = [
      ...Array(5)
        .fill(null)
        .map(() => mkTrade({ pnl: 200 })),
      ...Array(2)
        .fill(null)
        .map(() => mkTrade({ pnl: -50 })),
    ];
    expect(computeQuantStats(few).kelly).toBeNull();
  });

  it("s'affiche une fois l'échantillon suffisant", () => {
    const many = [
      ...Array(20)
        .fill(null)
        .map(() => mkTrade({ pnl: 200 })),
      ...Array(15)
        .fill(null)
        .map(() => mkTrade({ pnl: -100 })),
    ];
    const k = computeQuantStats(many).kelly;
    expect(k).not.toBeNull();
    expect(k!).toBeGreaterThan(0);
  });

  it("les break-even ne comptent pas dans l'échantillon", () => {
    // Même convention que le win rate : un BE n'est pas une décision tranchée.
    const padded = [
      ...Array(5)
        .fill(null)
        .map(() => mkTrade({ pnl: 200 })),
      ...Array(2)
        .fill(null)
        .map(() => mkTrade({ pnl: -50 })),
      ...Array(40)
        .fill(null)
        .map(() => mkTrade({ pnl: 0, direction: "be" })),
    ];
    expect(computeQuantStats(padded).kelly).toBeNull();
  });
});
