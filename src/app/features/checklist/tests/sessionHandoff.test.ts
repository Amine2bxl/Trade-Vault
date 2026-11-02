import { describe, expect, test } from "bun:test";
import type { Trade } from "@/domain/trade";
import { handOff, takeHandoff } from "@/app/utils/handoff";
import { MISTAKE_OPTIONS } from "@/app/types";
import {
  defaultConfigFor,
  GATE_TEMPLATES,
  GATE_VERSION,
  migrateConfig,
  planQuestions,
  templateItems,
} from "../checklistDefaults";
import { hydrateConfig } from "../helpers";
import {
  BREACH_TO_MISTAKE,
  lastTrade,
  missedPrefill,
  tradePrefill,
  tradeReviewPrefill,
} from "../sessionHandoff";
import {
  BREACHES,
  emptyDay,
  emptyPlan,
  GATE_TOKENS,
  reduceDay,
  type SessionDay,
} from "../sessionPlan";

const DEF = { risk: "250", maxTrades: 1 };

function closedDay(respected: boolean, note = "Garder la DoL"): SessionDay {
  let d = emptyDay(DEF);
  d = reduceDay(d, {
    type: "setPlan",
    patch: {
      ...emptyPlan(DEF),
      bias: "short",
      narrative: "Au-dessus des opens",
      target: "21 450",
      entry: "21 520",
      invalidation: "21 580",
    },
  });
  d = reduceDay(d, { type: "setMood", mood: "focused" });
  d = reduceDay(d, { type: "lock", at: "09:20" });
  d = reduceDay(d, { type: "end", reason: "missed", at: "10:05" });
  d = reduceDay(d, {
    type: "setReview",
    patch: { respected, breaches: respected ? [] : ["chased", "planChanged"], note },
  });
  return reduceDay(d, { type: "close" });
}

const trade = (over: Partial<Trade>): Trade =>
  ({
    id: Math.random().toString(36),
    date: "2026-10-29",
    symbol: "MNQ",
    direction: "short",
    pnl: 0,
    riskAmount: 500,
    rMultiple: 0,
    strategy: "Scalping",
    mistakes: [],
    setupQuality: 4,
    notes: "",
    screenshots: [],
    entryTime: "09:50",
    exitTime: "10:00",
    confluences: [],
    confidence: 80,
    ...over,
  }) as Trade;

describe("le relais entre écrans", () => {
  test("une valeur, lue une seule fois", () => {
    handOff("missed", { symbol: "MNQ" });
    expect(takeHandoff("missed")).toEqual({ symbol: "MNQ" });
    expect(takeHandoff("missed")).toBeNull();
  });

  test("chaque formulaire a son propre relais", () => {
    handOff("trade", { symbol: "NQ" });
    expect(takeHandoff("missed")).toBeNull();
    expect(takeHandoff("trade")).toEqual({ symbol: "NQ" });
  });
});

describe("du bilan au formulaire de trade", () => {
  test("le trade arrive avec sens, risque, état, plan et pourquoi", () => {
    const p = tradePrefill({
      day: closedDay(true),
      date: "2026-10-30",
      now: "10:12",
      last: trade({ symbol: "MNQ", strategy: "Scalping" }),
      planLine: "SHORT → 21 450",
      withReview: false,
    });
    expect(p).toMatchObject({
      date: "2026-10-30",
      symbol: "MNQ",
      strategy: "Scalping",
      direction: "short",
      riskAmount: "250",
      entryTime: "10:12",
      intentEmotion: "focused",
      intentPlan: "SHORT → 21 450",
      intentReasoning: "Au-dessus des opens",
    });
    expect(p.reflectionPlan).toBeUndefined();
  });

  test("depuis le bilan, la réflexion et les erreurs suivent", () => {
    const p = tradePrefill({
      day: closedDay(false),
      date: "2026-10-30",
      now: "10:12",
      last: null,
      planLine: "x",
      withReview: true,
    });
    expect(p.reflectionPlan).toBe("no");
    expect(p.reflectionReason).toBe("late_entry");
    expect(p.reflectionNote).toBe("Garder la DoL");
    expect(p.mistakes).toEqual(["Chased entry", "Ignored plan"]);
  });

  test("chaque écart pointe vers une erreur qui existe dans le journal", () => {
    for (const b of BREACHES) {
      const m = BREACH_TO_MISTAKE[b];
      if (m !== null) expect(MISTAKE_OPTIONS).toContain(m);
    }
  });
});

describe("du bilan au setup manqué", () => {
  test("le R estimé est celui que promettaient les niveaux", () => {
    const p = missedPrefill({
      day: closedDay(false),
      date: "2026-10-30",
      last: trade({ symbol: "MNQ" }),
      planLine: "SHORT → 21 450",
      reasonText: "Entrée chassée",
    });
    // Entrée 21 520, invalidation 21 580 (60), cible 21 450 (70) : 1,2R.
    expect(p).toMatchObject({
      date: "2026-10-30",
      symbol: "MNQ",
      estimatedR: 1.2,
      reasonNotTaken: "Entrée chassée",
      whatHappened: "SHORT → 21 450",
      lessonLearned: "Garder la DoL",
    });
  });
});

test("le dernier trade du journal, exemples exclus", () => {
  const a = trade({ date: "2026-10-29", entryTime: "10:00", symbol: "NQ" });
  const b = trade({ date: "2026-10-30", entryTime: "09:50", symbol: "MNQ" });
  const ex = trade({ date: "2026-10-31", isExample: true, symbol: "ES" });
  expect(lastTrade([a, ex, b])?.symbol).toBe("MNQ");
  expect(lastTrade([])).toBeNull();
});

describe("les questions d'entrée", () => {
  test("chaque modèle commence par les questions du plan, dans les deux langues", () => {
    for (const lang of ["fr", "en"]) {
      const plan = planQuestions(lang).map((q) => q.title);
      for (const id of GATE_TEMPLATES) {
        const items = templateItems(id, lang).map((q) => q.title);
        expect(items.slice(0, plan.length)).toEqual(plan);
        expect(items.length).toBeGreaterThan(plan.length);
      }
    }
  });

  test("les questions du plan n'utilisent que des variables connues", () => {
    for (const lang of ["fr", "en"]) {
      for (const q of planQuestions(lang)) {
        for (const m of q.title.matchAll(/\{(\w+)\}/g)) {
          expect(GATE_TOKENS as readonly string[]).toContain(m[1]);
        }
      }
    }
  });

  test("une config d'avant le plan de séance reçoit les questions du plan", () => {
    const old = {
      ...defaultConfigFor("fr"),
      gateV: undefined,
      items: [
        { title: "Heure de début atteinte", desc: "" },
        { title: "Setup qualité ≥ 4 confirmé", desc: "" },
      ],
    };
    const m = migrateConfig(old, "fr");
    expect(m.gateV).toBe(GATE_VERSION);
    expect(m.items.map((i) => i.title)).toEqual([
      ...planQuestions("fr").map((q) => q.title),
      // L'heure est vérifiée par l'écran : retirée. Un critère de setup : gardé.
      "Setup qualité ≥ 4 confirmé",
    ]);
    expect(migrateConfig(m, "fr")).toBe(m);
  });

  test("la relecture du stockage migre une liste sans version, pas les défauts", () => {
    const stored = JSON.stringify({ items: [{ title: "Mon critère", desc: "" }] });
    expect(hydrateConfig(stored, "en").items.map((i) => i.title)).toEqual([
      ...planQuestions("en").map((q) => q.title),
      "Mon critère",
    ]);
    const noItems = JSON.stringify({ startTime: "09:30" });
    expect(hydrateConfig(noItems, "en").items).toEqual(defaultConfigFor("en").items);
  });
});

describe("le bilan ajouté à un trade déjà au journal", () => {
  test("un trade contre le biais : « non », erreurs observées puis déclarées", () => {
    const p = tradeReviewPrefill({
      day: closedDay(false),
      trade: trade({ id: "t1", direction: "long" }),
      index: 0,
      planLine: "SHORT → 21 450",
    });
    expect(p.tradeId).toBe("t1");
    expect(p.reflectionPlan).toBe("no");
    expect(p.reflectionReason).toBe("wrong_setup");
    expect(p.mistakes).toEqual(["Ignored plan", "Chased entry"]);
    expect(p.reflectionNote).toBe("Garder la DoL");
    expect(p.intentPlan).toBe("SHORT → 21 450");
  });

  test("un trade conforme dans une séance mal tenue : « partiellement »", () => {
    const p = tradeReviewPrefill({
      day: closedDay(false),
      trade: trade({ direction: "short" }),
      index: 0,
      planLine: "x",
    });
    expect(p.reflectionPlan).toBe("partial");
    expect(p.reflectionReason).toBe("late_entry");
  });

  test("un trade conforme, plan respecté : « oui », aucune erreur", () => {
    const p = tradeReviewPrefill({
      day: closedDay(true),
      trade: trade({ direction: "short" }),
      index: 0,
      planLine: "x",
    });
    expect(p.reflectionPlan).toBe("yes");
    expect(p.mistakes).toEqual([]);
    expect(p.reflectionReason).toBeNull();
  });

  test("le trade au-delà du maximum porte le surtrading", () => {
    const p = tradeReviewPrefill({
      day: closedDay(true),
      trade: trade({ direction: "short" }),
      index: 1,
      planLine: "x",
    });
    expect(p.mistakes).toEqual(["Overtrading"]);
    expect(p.reflectionPlan).toBe("no");
  });
});

test("chaque relais est rendu une fois, au bon formulaire", () => {
  handOff("tradeReview", { tradeId: "t1" });
  expect(takeHandoff("trade")).toBeNull();
  expect(takeHandoff("tradeReview")?.tradeId).toBe("t1");
  expect(takeHandoff("tradeReview")).toBeNull();
});
