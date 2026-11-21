import { describe, expect, test } from "bun:test";
import type { Trade } from "@/domain/trade";
import { computeEvolution, projectSessions, runScenario } from "../index";

/** Simulation et évolution : trois natures distinctes, règles qui ne s'appliquent qu'au prouvé. */

let n = 0;
function trade(over: Partial<Trade> = {}): Trade {
  n++;
  return {
    id: `s${n}`,
    date: "2026-03-02",
    symbol: "NQ",
    direction: "long",
    pnl: 100,
    riskAmount: 100,
    rMultiple: 1,
    strategy: "ORB",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "09:40",
    confluences: [],
    confidence: 70,
    accountId: "acc",
    ...over,
  };
}
const day = (i: number) => {
  const d = new Date(Date.UTC(2026, 0, 5));
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
};

describe("scénarios hypothétiques", () => {
  const session = [
    trade({ date: day(1), entryTime: "09:30", exitTime: "09:40", pnl: -100 }),
    trade({
      date: day(1),
      entryTime: "09:50",
      exitTime: "10:00",
      pnl: -100,
      mistakes: ["FOMO entry"],
    }),
    trade({ date: day(1), entryTime: "10:10", exitTime: "10:20", pnl: 300 }),
    trade({ date: day(2), entryTime: "", exitTime: "", pnl: -50 }),
  ];

  test("retirer une erreur : la courbe reste à plat là où le trade est retiré", () => {
    const r = runScenario(session, [{ kind: "exclude_mistake", mistake: "fomo entry" }]);
    expect(r.label).toBe("hypothetical");
    expect(r.removed).toBe(1);
    expect(r.scenario.net).toBe(150);
    expect(r.actual.net).toBe(50);
    expect(r.scenarioPath).toEqual([-100, -100, 200, 150]);
  });

  test("arrêt après deux pertes : appliqué aux séances prouvées, les autres comptées", () => {
    const r = runScenario(session, [{ kind: "stop_after_losses", losses: 2 }]);
    expect(r.removed).toBe(1);
    expect(r.scenario.net).toBe(-250);
    expect(r.unprovenSessions).toBe(1);
  });

  test("plafond par séance et mise à l'échelle du risque mesuré seulement", () => {
    const cap = runScenario(session, [{ kind: "cap_per_session", max: 1 }]);
    expect(cap.removed).toBe(2);
    const half = runScenario(
      [...session, trade({ date: day(3), riskAmount: 0, pnl: 80 })],
      [{ kind: "risk_scale", factor: 0.5 }],
    );
    expect(half.scaled).toBe(4);
    expect(half.unscaled).toBe(1);
    expect(half.scenario.net).toBe(0.5 * 50 + 80);
  });

  test("un réglage hors bornes est ramené dans le sens", () => {
    const r = runScenario(session, [{ kind: "cap_per_session", max: -3 }]);
    expect(r.rules).toEqual([{ kind: "cap_per_session", max: 1 }]);
  });

  test("plan seulement : les trades notés hors plan sont retirés", () => {
    const r = runScenario(session, [{ kind: "plan_only" }], {
      planRespected: { [session[0].id]: "no" },
    });
    expect(r.removed).toBe(1);
  });
});

describe("simulation statistique", () => {
  const trades = Array.from({ length: 30 }, (_, i) =>
    trade({ date: day(i), pnl: i % 3 === 0 ? -150 : 100 }),
  );
  test("reproductible, éventail ordonné, étiquetée statistique", () => {
    const a = projectSessions(trades, (id) => trades.find((t) => t.id === id)!.pnl, { seed: 7 })!;
    const b = projectSessions(trades, (id) => trades.find((t) => t.id === id)!.pnl, { seed: 7 })!;
    expect(a).toEqual(b);
    expect(a.label).toBe("statistical");
    const last = a.horizon - 1;
    expect(a.p5[last]).toBeLessThanOrEqual(a.p50[last]);
    expect(a.p50[last]).toBeLessThanOrEqual(a.p95[last]);
    expect(a.samples.length).toBe(24);
  });
  test("sous dix séances : aucun éventail", () => {
    expect(projectSessions(trades.slice(0, 9), () => 1)).toBeNull();
  });
});

describe("évolution", () => {
  test("une erreur présente avant et absente depuis est « résolue »", () => {
    const list = Array.from({ length: 40 }, (_, i) =>
      trade({ date: day(i), mistakes: i < 20 && i % 2 === 0 ? ["Overtrading"] : [] }),
    );
    const evo = computeEvolution(list);
    const t = evo.trends.find((x) => x.key === "tag:Overtrading");
    expect(t?.status).toBe("resolved");
    expect(evo.windows.length).toBeGreaterThan(0);
    expect(evo.windows[0].rates["tag:Overtrading"]).toBeGreaterThan(0);
  });
  test("trop peu de séances : aucune tendance affirmée", () => {
    const evo = computeEvolution([trade({ mistakes: ["FOMO entry"] })]);
    expect(evo.trends).toEqual([]);
  });
});
