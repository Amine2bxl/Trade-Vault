import { describe, expect, test } from "bun:test";
import {
  analyzeDimension,
  benjaminiHochberg,
  chronologicalSplit,
  outOfSample,
  sessionBlockBootstrap,
  stopAfterLossesScenario,
  type EdgeTrade,
  type ScenarioTrade,
} from "../index";

/**
 * LOT 2 — critères de sortie du moteur de recherche (handoff §6, « Tests /
 * exit L2 »).
 */

// Jours ouvrés consécutifs à partir du lundi 5 janvier 2026.
function day(i: number): string {
  const d = new Date(Date.UTC(2026, 0, 5));
  let added = 0;
  while (added < i) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) added++;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

let seq = 0;
function trade(over: Partial<EdgeTrade>): EdgeTrade {
  seq++;
  return {
    id: `t${seq}`,
    date: day(0),
    pnl: 0,
    riskAmount: 100,
    symbol: "NQ",
    strategy: "ORB",
    entryTime: "09:35",
    accountId: "acc",
    ...over,
  };
}

/** `sessions` séances × `perSession` trades d'un setup, P&L tiré d'un motif fixe. */
function setup(strategy: string, sessions: number, perSession: number, pnl: (k: number) => number) {
  const out: EdgeTrade[] = [];
  let k = 0;
  for (let s = 0; s < sessions; s++)
    for (let j = 0; j < perSession; j++) out.push(trade({ strategy, date: day(s), pnl: pnl(k++) }));
  return out;
}

describe("bootstrap par séances", () => {
  const sessions = [[100, -50], [80], [-20, 40, 10], [60], [-30, -10], [90, 5]];

  test("même graine, même résultat au chiffre près", () => {
    const a = sessionBlockBootstrap(sessions, { seed: 42, iterations: 1000 });
    const b = sessionBlockBootstrap(sessions, { seed: 42, iterations: 1000 });
    expect(a).toEqual(b);
    expect(a?.method).toBe("session-block-percentile");
    expect(a?.blocks).toBe(6);
  });

  test("autre graine : l'intervalle bouge un peu, l'estimation pas du tout", () => {
    const a = sessionBlockBootstrap(sessions, { seed: 1, iterations: 2000 })!;
    const b = sessionBlockBootstrap(sessions, { seed: 2, iterations: 2000 })!;
    expect(a.estimate).toBe(b.estimate);
    expect(a.low).not.toBe(b.low);
    expect(Math.abs(a.low - b.low)).toBeLessThan(25);
  });

  test("un seul bloc ne se rééchantillonne pas", () => {
    expect(sessionBlockBootstrap([[1, 2, 3]], { seed: 1 })).toBeNull();
  });
});

describe("Benjamini-Hochberg", () => {
  test("valeurs de référence", () => {
    // p triés 0.01, 0.02, 0.03, 0.04, 0.05 → q = 0.05 partout (m = 5).
    const q = benjaminiHochberg([0.05, 0.01, 0.03, 0.02, 0.04]);
    for (const v of q) expect(v).toBeCloseTo(0.05, 10);
    expect(benjaminiHochberg([0.001, 0.5, null])).toEqual([0.002, 0.5, null]);
  });
});

describe("EdgeLab", () => {
  test("sous le minimum : aucun verdict, aucun intervalle — même avec un gros P&L", () => {
    const r = analyzeDimension(
      setup("A", 3, 3, () => 500),
      "strategy",
    );
    expect(r.cells[0]).toMatchObject({ key: "A", n: 9, sessions: 3, verdict: "insufficient" });
    expect(r.cells[0].bootstrap).toBeNull();
    expect(r.tests).toBe(0);
  });

  test("un écart observé est corrigé pour les tests multiples, et jamais appelé « meilleur »", () => {
    const strong = setup("STRONG", 25, 2, (k) => (k % 5 === 0 ? -40 : 90));
    const noise = setup("NOISE", 25, 2, (k) => (k % 2 === 0 ? 50 : -50));
    const r = analyzeDimension([...strong, ...noise], "strategy", { iterations: 1500 });
    const s = r.cells.find((c) => c.key === "STRONG")!;
    const n = r.cells.find((c) => c.key === "NOISE")!;
    expect(r.tests).toBe(2);
    expect(s.verdict).toBe("positive_observed");
    expect(s.q).not.toBeNull();
    expect(s.q!).toBeGreaterThanOrEqual(s.bootstrap!.p);
    expect(n.verdict).toBe("indistinguishable");
    expect(s.fragile).toBe(false);
  });

  test("un seul gros gain ne fait pas une condition : l'écart est déclaré fragile", () => {
    const lucky = setup("LUCKY", 25, 2, (k) => (k === 7 ? 50_000 : k % 2 === 0 ? 10 : -12));
    const r = analyzeDimension(lucky, "strategy", { iterations: 1500 });
    const c = r.cells[0];
    if (c.verdict === "positive_observed") expect(c.fragile).toBe(true);
    else expect(c.verdict).toBe("indistinguishable");
  });

  test("stress des frais : un coût par trade peut faire disparaître l'écart", () => {
    const thin = setup("THIN", 25, 2, (k) => (k % 4 === 0 ? -5 : 12));
    const base = analyzeDimension(thin, "strategy", { iterations: 1500 });
    const stressed = analyzeDimension(thin, "strategy", {
      iterations: 1500,
      extraCostPerTrade: 10,
    });
    expect(base.cells[0].netExpectancy - stressed.cells[0].netExpectancy).toBeCloseTo(10, 10);
    expect(stressed.extraCostPerTrade).toBe(10);
    expect(stressed.cells[0].verdict).not.toBe("positive_observed");
  });

  test("une dimension inconnue n'est rangée nulle part : couverture rendue", () => {
    const trades = [
      ...setup("A", 2, 1, () => 10),
      trade({ strategy: "B", reviewPending: true, pnl: 5 }),
      trade({ broker: "tradovate", entryTime: "09:30", pnl: 5 }),
    ];
    expect(analyzeDimension(trades, "strategy").unknown).toBe(1);
    // L'heure d'un import broker sans instant prouvé n'est pas une session NY.
    const s = analyzeDimension(trades, "session");
    expect(s.unknown).toBe(2);
    expect(s.coverage).toBeCloseTo(2 / 4, 10);
  });

  test("le R moyen a son propre n — un forfait broker n'en fait pas partie", () => {
    const trades = setup("A", 30, 1, () => 50).map((t, i) =>
      i % 2 === 0 ? { ...t, broker: "tradovate", riskSource: "broker_default" as const } : t,
    );
    const c = analyzeDimension(trades, "strategy").cells[0];
    expect(c.nR).toBe(15);
    expect(c.expectancyR).toBeNull();
  });
});

describe("validation chronologique", () => {
  test("découpe par séances, jamais au milieu d'un jour, holdout = la période la plus récente", () => {
    const trades = setup("A", 10, 3, () => 1);
    const s = chronologicalSplit(trades);
    expect(s.train).toHaveLength(6);
    expect(s.validation).toHaveLength(2);
    expect(s.holdout).toHaveLength(2);
    expect(s.train.at(-1)! < s.validation[0]).toBe(true);
    expect(s.validation.at(-1)! < s.holdout[0]).toBe(true);
  });

  test("le holdout ne sert JAMAIS à choisir : le changer ne change pas la sélection", () => {
    const history = setup("STRONG", 60, 2, (k) => (k % 5 === 0 ? -40 : 90));
    const split = chronologicalSplit(history);
    const holdoutDays = new Set(split.holdout);
    const flipped = history.map((t) =>
      holdoutDays.has(t.date) ? { ...t, pnl: -Math.abs(t.pnl) } : t,
    );
    const a = outOfSample(history, "strategy", { iterations: 800 });
    const b = outOfSample(flipped, "strategy", { iterations: 800 });
    expect(a.cells.map((c) => c.key)).toEqual(b.cells.map((c) => c.key));
    expect(a.cells[0].holdout).toBe("confirmed");
    // Le même écart, contredit hors échantillon, est dit NON confirmé.
    expect(b.cells[0].holdout).toBe("not_confirmed");
  });
});

describe("sélection hors holdout", () => {
  test("un écart qui n'existe QUE dans le holdout n'est jamais sélectionné", () => {
    // 60 séances : bruit pur pendant les 48 premières, gain massif ensuite.
    const late = setup("LATE", 60, 2, (k) => (k >= 96 ? 400 : k % 2 === 0 ? 30 : -30));
    const r = outOfSample(late, "strategy", { iterations: 800 });
    expect(r.cells).toEqual([]);
    // Sur l'historique ENTIER, le même setup ressortirait : c'est bien la
    // période de sélection qui protège, pas l'absence d'écart.
    expect(analyzeDimension(late, "strategy", { iterations: 800 }).cells[0].verdict).toBe(
      "positive_observed",
    );
  });
});

describe("BehaviorLab — scénario hypothétique", () => {
  const s = (o: Partial<ScenarioTrade>): ScenarioTrade => ({
    id: `s${++seq}`,
    date: "2026-01-06",
    pnl: 0,
    entryTime: "09:30",
    exitTime: "09:40",
    accountId: "acc",
    ...o,
  });

  test("retire ce qui a suivi N pertes, et le dit HYPOTHÉTIQUE", () => {
    const r = stopAfterLossesScenario(
      [
        s({ pnl: -100, entryTime: "09:30", exitTime: "09:40" }),
        s({ pnl: -100, entryTime: "09:45", exitTime: "09:50" }),
        s({ pnl: -200, entryTime: "10:00", exitTime: "10:10" }),
        s({ pnl: 150, entryTime: "10:20", exitTime: "10:30" }),
      ],
      2,
    );
    expect(r.label).toBe("hypothetical");
    expect(r.sessionsEvaluated).toBe(1);
    expect(r.sessionsTriggered).toBe(1);
    expect(r.tradesRemoved).toBe(2);
    expect(r.removedPnl).toBe(-50);
    expect(r.actualPnl).toBe(-250);
    expect(r.hypotheticalPnl).toBe(-200);
  });

  test("ordre non prouvé : la séance est écartée et comptée, jamais rejouée", () => {
    const r = stopAfterLossesScenario(
      [
        s({ pnl: -100, entryTime: "09:30", exitTime: "09:40" }),
        s({ pnl: -100, entryTime: "09:31", exitTime: "09:40" }),
        s({ pnl: 300, entryTime: "", exitTime: "" }),
      ],
      2,
    );
    expect(r.sessionsEvaluated).toBe(0);
    expect(r.sessionsUnknown).toBe(1);
    expect(r.hypotheticalPnl).toBe(0);
  });

  test("une position déjà ouverte au moment de l'arrêt n'est pas retirée", () => {
    const r = stopAfterLossesScenario(
      [
        s({ pnl: -100, entryTime: "09:30", exitTime: "09:40" }),
        s({ pnl: 80, entryTime: "09:35", exitTime: "09:55" }),
        s({ pnl: -100, entryTime: "09:41", exitTime: "09:50" }),
      ],
      1,
    );
    expect(r.tradesRemoved).toBe(1);
    expect(r.removedPnl).toBe(-100);
  });
});
