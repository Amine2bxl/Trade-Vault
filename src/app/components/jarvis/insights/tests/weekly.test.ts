import { describe, expect, it } from "bun:test";
import type { Trade } from "../../../../types";
import { computeStats } from "../../../../utils/tradeCalcs";
import { computeBehaviorSignals } from "../../../../utils/behaviorSignals";
import { buildWeeklyEvolution, type WeeklyInput } from "../weekly/build";
import { weeklyToBlocks } from "../weekly/toBlocks";

let counter = 0;
function mk(date: string, pnl: number, opts: Partial<Trade> = {}): Trade {
  counter += 1;
  return {
    id: `w-${counter}`,
    date,
    symbol: "NQ",
    direction: pnl >= 0 ? "long" : "short",
    pnl,
    riskAmount: opts.riskAmount ?? 100,
    rMultiple: pnl >= 0 ? 1 : -1,
    strategy: opts.strategy ?? "Scalping",
    mistakes: opts.mistakes ?? [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: opts.confidence ?? 70,
  };
}

// Semaine de test : lundi 18/05/2026 → dimanche 24/05/2026.
// `now` = mercredi 20/05/2026 ; lundi = 18/05 ; semaine précédente = 11/05.
const NOW = new Date(2026, 4, 20);
const THIS = "2026-05-18";
const PREV = "2026-05-11";

function input(overrides: Partial<WeeklyInput> = {}): WeeklyInput {
  const trades = overrides.trades ?? [];
  return {
    trades,
    stats: computeStats(trades),
    signals: computeBehaviorSignals(trades),
    adherence: [],
    edge: {
      score: 72,
      weakest: "risk",
      subs: { risk: { value: 40, detail: "8/20" } },
      tradedDays: 0,
      cleanDays: 0,
    },
    now: NOW,
    ...overrides,
  };
}

describe("buildWeeklyEvolution (Step 7)", () => {
  it("aucun trade cette semaine → status empty (pas de fabrication)", () => {
    const ev = buildWeeklyEvolution(input({ trades: [] }));
    expect(ev.status).toBe("empty");
    expect(ev.sections).toEqual([]);
  });

  it("échantillon insuffisant → pas de comparaison conclue, statut learning", () => {
    const trades = [mk(THIS, 100), mk(THIS, 50), mk(THIS, -20)];
    const ev = buildWeeklyEvolution(input({ trades }));
    expect(ev.status).toBe("learning");
    expect(ev.sections.some((s) => s.id === "improved")).toBe(false);
    expect(ev.sections.some((s) => s.id === "worse")).toBe(false);
  });

  it("comparaison précédente : amélioration détectée avec preuve et deep-link", () => {
    // 12 trades gagnants cette semaine (>= MIN_SAMPLE), 12 perdants la semaine
    // précédente -> win rate et PnL en hausse.
    const trades = [
      ...Array.from({ length: 12 }, () => mk(THIS, 100)),
      ...Array.from({ length: 12 }, () => mk(PREV, -50)),
    ];
    const ev = buildWeeklyEvolution(input({ trades }));
    expect(ev.status).toBe("ready");
    const improved = ev.sections.find((s) => s.id === "improved");
    expect(improved).toBeDefined();
    const e = improved!.evidence![0];
    expect(e.sampleSize).toBe(12);
    expect(e.compare).not.toBeNull();
    expect(e.compare!.previous).not.toBeNull();
    expect(e.filter).toEqual({ trades: trades.filter((t) => t.date >= THIS).map((t) => t.id) });
    expect(e.page).toBe("journal");
    // Claim sans evidence interdit : chaque claim porte sample + période.
    expect(improved!.lines.every((l) => l.fr.length > 0)).toBe(true);
  });

  it("régression : wording prudent, jamais de causalité affirmée", () => {
    // 12 perdants cette semaine vs 12 gagnants la semaine précédente.
    const trades = [
      ...Array.from({ length: 12 }, () => mk(PREV, 100)),
      ...Array.from({ length: 12 }, () => mk(THIS, -50)),
    ];
    const ev = buildWeeklyEvolution(input({ trades }));
    const worse = ev.sections.find((s) => s.id === "worse");
    expect(worse).toBeDefined();
    expect(
      worse!.lines.some((l) => /cautions|prudente|coïncide|coincides/.test(l.fr + " " + l.en)),
    ).toBe(true);
  });

  it("pattern faible (setup < MIN_SAMPLE) → aucune section edge déclarée", () => {
    // 5 trades sur un seul setup cette semaine : insuffisant pour déclarer un
    // « meilleur setup ».
    const trades = Array.from({ length: 5 }, () => mk(THIS, 100, { strategy: "Momentum" }));
    const ev = buildWeeklyEvolution(input({ trades }));
    expect(ev.sections.some((s) => s.id === "edge")).toBe(false);
  });

  it("intent/reflection absentes → section intent absente", () => {
    const trades = Array.from({ length: 12 }, () => mk(THIS, 80));
    const ev = buildWeeklyEvolution(input({ trades }));
    expect(ev.sections.some((s) => s.id === "intent")).toBe(false);
  });

  it("intent/reflection présentes + sample suffisant → plan respecté compté", () => {
    const trades = Array.from({ length: 12 }, (_, i) =>
      mk(THIS, i % 2 === 0 ? 60 : -30, { riskAmount: 100 }),
    );
    const intents: Record<
      string,
      {
        tradeId: string;
        plannedRisk: number | null;
        confidence: number | null;
        emotion: string | null;
        reasoning: string | null;
        plan: string | null;
        setup: string | null;
      }
    > = {};
    const reflections: Record<
      string,
      {
        tradeId: string;
        planRespected: "yes" | "partial" | "no" | null;
        reason: string | null;
        note: string | null;
      }
    > = {};
    for (const t of trades) {
      intents[t.id] = {
        tradeId: t.id,
        plannedRisk: 100,
        confidence: 70,
        emotion: "focused",
        reasoning: null,
        plan: null,
        setup: null,
      };
      reflections[t.id] = { tradeId: t.id, planRespected: "yes", reason: null, note: null };
    }
    const ev = buildWeeklyEvolution(input({ trades, intents, reflections }));
    const intent = ev.sections.find((s) => s.id === "intent");
    expect(intent).toBeDefined();
    expect(intent!.lines.some((l) => l.fr.includes("12/12") || l.fr.includes("12/12"))).toBe(true);
  });

  it("goals absents → pas de section goals, et aucun objectif modifié automatiquement", () => {
    const trades = Array.from({ length: 12 }, () => mk(THIS, 50));
    const ev = buildWeeklyEvolution(input({ trades }));
    expect(ev.sections.some((s) => s.id === "goals")).toBe(false);
  });

  it("goals présents → progression affichée, jamais modifiée", () => {
    const trades = Array.from({ length: 12 }, () => mk(THIS, 50));
    const ev = buildWeeklyEvolution(
      input({ trades, goals: [{ kind: "win_rate", target: 60, current: 50 }] }),
    );
    const goals = ev.sections.find((s) => s.id === "goals");
    expect(goals).toBeDefined();
    expect(goals!.lines[0].fr).toContain("50 / 60");
  });

  it("missed absents → pas de section missed", () => {
    const trades = Array.from({ length: 12 }, () => mk(THIS, 50));
    const ev = buildWeeklyEvolution(input({ trades, missed: [] }));
    expect(ev.sections.some((s) => s.id === "missed")).toBe(false);
  });

  it("missed présents → faits uniquement (jamais un résultat garanti)", () => {
    const trades = Array.from({ length: 12 }, () => mk(THIS, 50));
    const ev = buildWeeklyEvolution(
      input({
        trades,
        missed: [
          {
            id: "m1",
            date: THIS,
            symbol: "ES",
            reasonNotTaken: "",
            whatHappened: "",
            lessonLearned: "",
            nextTimePlan: "",
            estimatedR: 2,
            screenshots: [],
          },
          {
            id: "m2",
            date: THIS,
            symbol: "NQ",
            reasonNotTaken: "",
            whatHappened: "",
            lessonLearned: "",
            nextTimePlan: "",
            estimatedR: 3,
            screenshots: [],
          },
        ],
      }),
    );
    const missed = ev.sections.find((s) => s.id === "missed");
    expect(missed).toBeDefined();
    expect(missed!.lines[1].fr).toContain("pas un gain certain");
  });

  it("edge absent → pas de crash, score null", () => {
    const trades = Array.from({ length: 12 }, () => mk(THIS, 50));
    const ev = buildWeeklyEvolution(input({ trades, edge: null }));
    expect(ev.score).toBeNull();
    expect(ev.sections.length).toBeGreaterThan(0);
  });

  it("max 3 priorités dans Next Week, missions issues des priorités", () => {
    // 12 trades cette semaine, tous avec l'erreur « Revenge trade » ; 10 perdants
    // et 2 gagnants -> l'erreur est NETTEMENT négative (fuite détectée).
    const trades = [
      ...Array.from({ length: 10 }, () => mk(THIS, -100, { mistakes: ["Revenge trade"] })),
      ...Array.from({ length: 2 }, () => mk(THIS, 50, { mistakes: ["Revenge trade"] })),
    ];
    const ev = buildWeeklyEvolution(input({ trades }));
    const next = ev.sections.find((s) => s.id === "next");
    expect(next).toBeDefined();
    // Le leak (fuite) donne la priorité n°1 ; au plus 3 priorités.
    expect(next!.lines.length).toBeLessThanOrEqual(3);
    const blocks = weeklyToBlocks(ev, "fr");
    const mission = blocks.find((b) => b.type === "mission");
    expect(mission).toBeDefined();
  });

  it("aucune donnée ne fait planter le générateur ni les blocs", () => {
    const ev = buildWeeklyEvolution(input({ trades: [] }));
    expect(() => weeklyToBlocks(ev, "fr")).not.toThrow();
  });

  it("chaque insight important porte claim + sample + période + deep-link", () => {
    const trades = Array.from({ length: 12 }, () => mk(THIS, 80));
    const ev = buildWeeklyEvolution(input({ trades }));
    for (const s of ev.sections) {
      if (s.evidence) {
        for (const e of s.evidence) {
          expect(e.claim.length).toBeGreaterThan(0);
          expect(e.sampleSize).toBeGreaterThan(0);
          expect(e.period).toBe(THIS);
          expect(e.filter).toBeDefined();
        }
      }
    }
  });
});
