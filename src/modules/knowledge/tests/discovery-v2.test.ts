import { describe, expect, test } from "bun:test";
import type { Trade } from "@/domain/trade";
import { makeRng } from "@/modules/probability/rng";
import { buildKnowledgeGraph, detectSignatures, runDiscoveries, sequence } from "../index";

/** Neural Brain v2 : chaque détecteur trouve un signal net, et se tait sur du bruit. */

let seq = 0;
function trade(over: Partial<Trade> = {}): Trade {
  seq++;
  return {
    id: `v${seq}`,
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
    entryTime: "09:35",
    exitTime: "09:45",
    confluences: [],
    confidence: 70,
    accountId: "acc",
    ...over,
  };
}

function day(i: number): string {
  const d = new Date(Date.UTC(2026, 0, 5));
  let added = 0;
  while (added < i) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

const noise = (i: number, k = 0) => (((i + 3) * 7919 + k * 104729) % 41) - 20;
const find = (trades: Trade[], id: string, extra = {}) =>
  runDiscoveries({ trades, ...extra }).discoveries.find((d) => d.id === id);

describe("séquences et signatures", () => {
  test("le précédent n'est retenu que dans la même séance, ordre prouvé", () => {
    const a = trade({ id: "a", date: day(1), entryTime: "09:30", exitTime: "09:40", pnl: -50 });
    const b = trade({ id: "b", date: day(1), entryTime: "09:50", exitTime: "10:00" });
    const c = trade({ id: "c", date: day(2), entryTime: "09:30", exitTime: "09:40" });
    const s = sequence([c, b, a]);
    expect(s.find((x) => x.trade.id === "b")?.prev?.id).toBe("a");
    expect(s.find((x) => x.trade.id === "c")?.prev).toBeNull();
    expect(s.find((x) => x.trade.id === "b")?.rank).toBe(1);
  });

  test("revenge : entrée dans les 30 minutes d'une perte ; au-delà, non", () => {
    const list = [
      trade({ id: "l", date: day(1), entryTime: "09:30", exitTime: "09:40", pnl: -80 }),
      trade({ id: "r", date: day(1), entryTime: "09:55", exitTime: "10:05" }),
      trade({ id: "late", date: day(1), entryTime: "11:00", exitTime: "11:05" }),
    ];
    const sigs = detectSignatures(list);
    expect(sigs.get("revenge")).toEqual(["r"]);
  });

  test("surdimension relative à la médiane, jamais sans assez de risques mesurés", () => {
    const list = Array.from({ length: 12 }, (_, i) =>
      trade({ id: `o${i}`, date: day(i), riskAmount: i === 11 ? 350 : 100 }),
    );
    expect(detectSignatures(list).get("oversize")).toEqual(["o11"]);
    expect(detectSignatures(list.slice(0, 4)).get("oversize")).toBeUndefined();
  });

  test("le graphe porte la signature comme hypothèse, reliée à la case déclarée", () => {
    const list = [
      trade({ id: "l", date: day(1), entryTime: "09:30", exitTime: "09:40", pnl: -80 }),
      trade({
        id: "r",
        date: day(1),
        entryTime: "09:55",
        exitTime: "10:05",
        mistakes: ["Revenge trade"],
      }),
    ];
    const g = buildKnowledgeGraph({ trades: list, now: "2026-04-01T00:00:00Z" });
    expect(g.edges.get("exhibits|trade:r|error_pattern:revenge")?.provenance.validation).toBe(
      "hypothesis",
    );
    expect(g.edges.has("declared_as|error_pattern:revenge|mistake:Revenge trade")).toBe(true);
  });
});

describe("détecteurs v2 — signal net", () => {
  test("après une perte, le trade suivant rend moins (conditionné sur le précédent)", () => {
    const list: Trade[] = [];
    for (let i = 0; i < 40; i++) {
      const first = i % 2 ? -100 : 120;
      list.push(
        trade({ date: day(i), entryTime: "09:30", exitTime: "09:40", pnl: first + noise(i) }),
        trade({
          date: day(i),
          entryTime: "10:00",
          exitTime: "10:10",
          pnl: (first < 0 ? -150 : 90) + noise(i, 1),
        }),
      );
    }
    const d = find(list, "after_loss_outcome");
    expect(d?.direction).toBe("lower");
    expect(d?.evidence.high ?? 0).toBeLessThan(0);
    expect(d?.impact).toBeLessThan(0);
    expect(["strong", "moderate", "tentative"]).toContain(d!.confidence);
  });

  test("une erreur qui porte l'essentiel des pertes", () => {
    const list: Trade[] = [];
    for (let i = 0; i < 40; i++)
      list.push(
        trade({
          date: day(i),
          pnl: i % 4 === 0 ? -400 : 60 + noise(i),
          mistakes: i % 4 === 0 ? ["FOMO entry"] : [],
        }),
      );
    const d = find(list, "loss_concentration:mistake:FOMO entry");
    expect(d?.evidence.value).toBeGreaterThan(0.9);
    expect(d?.impact).toBe(-4000);
    expect(d?.confidence).toBe("descriptive");
  });

  test("un taux de réussite élevé qui cache une espérance plus faible", () => {
    const list: Trade[] = [];
    for (let i = 0; i < 40; i++) {
      list.push(
        trade({
          date: day(i),
          strategy: "Scalp",
          pnl: i % 5 === 0 ? -300 + noise(i) : 30 + noise(i, 2),
        }),
        trade({
          date: day(i),
          strategy: "Swing",
          entryTime: "11:00",
          exitTime: "12:00",
          pnl: i % 2 ? -60 + noise(i, 3) : 200 + noise(i, 4),
        }),
      );
    }
    const d = find(list, "winrate_trap:strategy:Scalp");
    expect(d).toBeDefined();
    expect(Number(d!.params.winRate)).toBeGreaterThan(Number(d!.params.winRateRest));
  });

  test("deux conditions réunies, publiées seulement si confirmées sur les séances récentes", () => {
    const list: Trade[] = [];
    for (let i = 0; i < 60; i++) {
      list.push(
        trade({ date: day(i), entryTime: "03:30", exitTime: "03:45", pnl: -120 + noise(i) }), // ORB à Londres
        trade({ date: day(i), entryTime: "09:40", exitTime: "09:55", pnl: 110 + noise(i, 5) }), // ORB à New York
      );
    }
    const run = runDiscoveries({ trades: list });
    const combo = run.discoveries.find((d) => d.id === "combo:strategy:ORB:session:london");
    expect(combo?.validation).toBe("confirmed");
    expect(combo?.direction).toBe("lower");
  });

  test("le risque monte quand la qualité du setup baisse", () => {
    const list: Trade[] = [];
    for (let i = 0; i < 40; i++) {
      const q = (i % 5) + 1;
      list.push(trade({ date: day(i), setupQuality: q, riskAmount: 320 - q * 50 + noise(i) }));
    }
    const d = find(list, "risk_vs_quality");
    expect(d?.evidence.value).toBeLessThan(-0.5);
    expect(d?.evidence.unit).toBe("rho");
  });

  test("processus propre contre processus signalé ; plan tenu contre plan renié", () => {
    const list: Trade[] = [];
    const planRespected: Record<string, "yes" | "no"> = {};
    for (let i = 0; i < 40; i++) {
      const clean = trade({ date: day(i), setupQuality: 5, pnl: 150 + noise(i) });
      const flagged = trade({
        date: day(i),
        entryTime: "11:00",
        exitTime: "11:10",
        setupQuality: 3,
        pnl: -120 + noise(i, 6),
        mistakes: ["Chased entry"],
      });
      planRespected[clean.id] = "yes";
      planRespected[flagged.id] = "no";
      list.push(clean, flagged);
    }
    const run = runDiscoveries({ trades: list, behavior: { planRespected } });
    expect(run.discoveries.find((d) => d.id === "process_outcome")?.direction).toBe("higher");
    expect(run.discoveries.find((d) => d.id === "plan_adherence")?.direction).toBe("lower");
  });

  test("une erreur qui recule : comparée aux séances plus anciennes", () => {
    const list: Trade[] = [];
    for (let i = 0; i < 50; i++)
      list.push(trade({ date: day(i), mistakes: i < 25 && i % 2 === 0 ? ["Overtrading"] : [] }));
    const d = find(list, "mistake_trend:Overtrading");
    expect(d?.direction).toBe("lower");
    expect(d?.category).toBe("unexpected_strength");
  });

  test("risque pris au-dessus du risque prévu, signature observée non déclarée", () => {
    const list: Trade[] = [];
    const plannedRisk: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      const loss = trade({ date: day(i), entryTime: "09:30", exitTime: "09:40", pnl: -100 });
      const next = trade({ date: day(i), entryTime: "09:50", exitTime: "10:00", riskAmount: 150 });
      plannedRisk[next.id] = 100;
      plannedRisk[loss.id] = 100;
      list.push(loss, next);
    }
    const run = runDiscoveries({ trades: list, behavior: { plannedRisk } });
    expect(run.discoveries.find((d) => d.id === "planned_risk")?.evidence.value).toBeGreaterThan(
      1.1,
    );
    const untagged = run.discoveries.find((d) => d.id === "untagged_signature:revenge");
    expect(untagged?.evidence.n).toBe(20);
    expect(untagged?.evidence.value).toBe(0);
  });

  test("décisions de ne pas trader : hypothétique, compté", () => {
    const missed = Array.from({ length: 12 }, (_, i) => ({
      id: `m${i}`,
      date: day(i),
      symbol: "NQ",
      reasonNotTaken: "",
      whatHappened: "",
      lessonLearned: "",
      nextTimePlan: "",
      estimatedR: i < 10 ? -1 : 2,
      screenshots: [],
    }));
    const d = runDiscoveries({ trades: [], missed }).discoveries.find(
      (x) => x.id === "missed_avoided",
    );
    expect(d?.hypothetical).toBe(true);
    expect(d?.evidence.value).toBe(-10);
  });
});

describe("détecteurs v2 — bruit", () => {
  test("aucune découverte testée sur un journal sans structure", () => {
    // Un vrai générateur pseudo-aléatoire, variables INDÉPENDANTES : une suite
    // arithmétique modulo n'est pas du bruit (elle relie un trade au suivant).
    const rng = makeRng(20261121);
    const u = (a: number, b: number) => a + (b - a) * rng();
    const list: Trade[] = [];
    const planRespected: Record<string, "yes" | "no"> = {};
    for (let i = 0; i < 80; i++) {
      const t = trade({
        date: day(Math.floor(i / 2)),
        entryTime: i % 2 ? "10:30" : "09:30",
        exitTime: i % 2 ? "10:40" : "09:40",
        pnl: Math.round(u(-200, 200)),
        strategy: rng() < 0.4 ? "ORB" : "Breakout",
        setupQuality: 1 + Math.floor(u(0, 5)),
        riskAmount: Math.round(u(80, 120)),
        mistakes: rng() < 0.15 ? ["FOMO entry"] : [],
      });
      planRespected[t.id] = rng() < 0.3 ? "no" : "yes";
      list.push(t);
    }
    const tested = runDiscoveries({ trades: list, behavior: { planRespected } }).discoveries.filter(
      (d) => d.evidence.q !== null,
    );
    expect(tested.map((d) => d.id)).toEqual([]);
  });
});
