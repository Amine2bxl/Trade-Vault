import { describe, expect, test } from "bun:test";
import type { Trade } from "@/domain/trade";
import {
  activePlan,
  canLock,
  dayFacts,
  emptyDay,
  emptyPlan,
  entryBlockers,
  fillGate,
  gateQuestions,
  gateVerdict,
  levelPrice,
  MIN_CHANGE_REASON,
  missingFields,
  normalizeDay,
  parseAmount,
  planHistory,
  planRR,
  planWarnings,
  reduceDay,
  sessionFromSnapshot,
  sessionMemory,
  toSnapshot,
  tradeBreaches,
  type Breach,
  type PastSession,
  type SessionDay,
  type SessionPlan,
} from "../sessionPlan";

const DEF = { risk: "250", maxTrades: 1 };
const DATE = "2026-10-30";
const REASON = "Clôture M15 au-dessus de l'invalidation";

function mkTrade(over: Partial<Trade>): Trade {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    date: DATE,
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
  };
}

const SHORT_PLAN: SessionPlan = {
  ...emptyPlan(DEF),
  bias: "short",
  narrative: "Au-dessus de toutes les opens, DoL sell-side en discount",
  target: "21 450 EQL",
  entry: "FVG 21 520",
  invalidation: "21 580",
  risk: "250",
  maxTrades: 1,
};

const WITH_B: SessionPlan = {
  ...SHORT_PLAN,
  alt: {
    condition: "Clôture M15 au-dessus de 21 600",
    bias: "long",
    target: "21 700 EQH",
    entry: "",
  },
};

/** Une journée prête à verrouiller. */
function readyDay(plan: SessionPlan = SHORT_PLAN): SessionDay {
  let d = emptyDay(DEF);
  d = reduceDay(d, { type: "setPlan", patch: plan });
  return reduceDay(d, { type: "setMood", mood: "calm" });
}
const liveDay = (plan?: SessionPlan) => reduceDay(readyDay(plan), { type: "lock", at: "09:20" });

describe("le plan s'écrit, il ne se coche pas", () => {
  test("une journée vide liste tout ce qui manque, dans l'ordre", () => {
    const d = emptyDay(DEF);
    expect(missingFields({ ...d.plan, bias: "short", risk: "" }, null)).toEqual([
      "narrative",
      "target",
      "entry",
      "invalidation",
      "risk",
      "mood",
    ]);
    expect(missingFields(d.plan, null)).toEqual(["bias", "mood"]);
  });

  test("le pourquoi est obligatoire pour un biais directionnel", () => {
    expect(missingFields({ ...SHORT_PLAN, narrative: "  " }, "calm")).toEqual(["narrative"]);
  });

  test("le risque doit être un montant strictement positif", () => {
    expect(parseAmount("250")).toBe(250);
    expect(parseAmount("1 000")).toBe(1000);
    expect(parseAmount("250,5")).toBe(250.5);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(missingFields({ ...SHORT_PLAN, risk: "0" }, "calm")).toEqual(["risk"]);
  });

  test("une journée d'observation ne demande que le choix et l'état", () => {
    const plan: SessionPlan = { ...emptyPlan(DEF), bias: "none", risk: "" };
    expect(missingFields(plan, null)).toEqual(["mood"]);
    expect(canLock(plan, "focused")).toBe(true);
  });

  test("un scénario B commencé doit être complet", () => {
    const half = { ...SHORT_PLAN, alt: { ...SHORT_PLAN.alt, bias: "long" as const } };
    expect(missingFields(half, "calm")).toEqual(["altCondition", "altTarget"]);
    expect(missingFields(WITH_B, "calm")).toEqual([]);
  });

  test("`checked` reflète l'avancement réel du plan (contrat du tableau de bord)", () => {
    let d = emptyDay(DEF);
    expect(d.checked).toEqual([false, false, false, false, false, true, false]);
    d = reduceDay(d, { type: "setPlan", patch: { bias: "long", target: "EQH" } });
    expect(d.checked.filter(Boolean).length).toBe(3);
    expect(readyDay().checked.every(Boolean)).toBe(true);
  });
});

describe("les niveaux écrits se lisent", () => {
  test("le premier prix d'un niveau, quelle que soit l'écriture", () => {
    expect(levelPrice("FVG 21 520")).toBe(21520);
    expect(levelPrice("21,450 EQL")).toBe(21450);
    expect(levelPrice("1.0850")).toBe(1.085);
    expect(levelPrice("1,5")).toBe(1.5);
    expect(levelPrice("EQH")).toBeNull();
  });

  test("le R:R que promettent les niveaux", () => {
    // Entrée 21 520, invalidation 21 580 (60 pts), cible 21 450 (70 pts).
    expect(planRR(SHORT_PLAN)).toBeCloseTo(70 / 60);
    expect(planRR({ ...SHORT_PLAN, target: "EQL" })).toBeNull();
  });

  test("niveaux du mauvais côté : signalés, jamais bloquants", () => {
    const flipped = { ...SHORT_PLAN, target: "21 700", invalidation: "21 400" };
    expect(planWarnings(flipped, null)).toEqual(["targetSide", "invSide"]);
    expect(canLock(flipped, "calm")).toBe(true);
  });

  test("R:R sous le minimum du plan de trading", () => {
    expect(planWarnings(SHORT_PLAN, 2.2)).toEqual(["rrLow"]);
    expect(planWarnings({ ...SHORT_PLAN, target: "21 380" }, 2.2)).toEqual([]);
    expect(planWarnings(SHORT_PLAN, null)).toEqual([]);
  });
});

describe("le verrou", () => {
  test("un plan incomplet ne se verrouille pas", () => {
    const d = reduceDay(emptyDay(DEF), { type: "lock", at: "09:20" });
    expect(d.phase).toBe("plan");
    expect(d.locked).toBe(false);
  });

  test("verrouiller passe en séance et date le verrou", () => {
    const d = liveDay();
    expect(d.phase).toBe("live");
    expect(d.locked).toBe(true);
    expect(d.lockedAt).toBe("09:20");
  });

  test("en séance, le plan, le B et l'état sont gelés", () => {
    const live = liveDay(WITH_B);
    expect(reduceDay(live, { type: "setPlan", patch: { bias: "long" } })).toBe(live);
    expect(reduceDay(live, { type: "setAlt", patch: { bias: "short" } })).toBe(live);
    expect(reduceDay(live, { type: "setMood", mood: "anxious" })).toBe(live);
  });

  test("rouvrir le plan exige un motif écrit", () => {
    const live = liveDay();
    expect(reduceDay(live, { type: "reopenPlan", at: "09:52", reason: "" })).toBe(live);
    const tooShort = "x".repeat(MIN_CHANGE_REASON - 1);
    expect(reduceDay(live, { type: "reopenPlan", at: "09:52", reason: tooShort })).toBe(live);
  });

  test("rouvrir ne l'efface pas et garde le motif horodaté", () => {
    const live = liveDay();
    const reopened = reduceDay(live, { type: "reopenPlan", at: "09:52", reason: REASON });
    expect(reopened.phase).toBe("plan");
    expect(reopened.locked).toBe(false);
    expect(reopened.plan).toEqual(live.plan);
    expect(reopened.planChanges).toEqual([{ at: "09:52", reason: REASON }]);
    const flipped = reduceDay(reopened, { type: "setPlan", patch: { bias: "long" } });
    const relocked = reduceDay(flipped, { type: "lock", at: "09:53" });
    expect(relocked.phase).toBe("live");
    expect(relocked.plan.bias).toBe("long");
  });
});

describe("le scénario B : prévu, donc immédiat", () => {
  test("il s'active sans motif, une fois, seulement s'il était écrit", () => {
    expect(reduceDay(liveDay(), { type: "switchScenario", at: "10:01" }).scenario).toBe("A");
    const b = reduceDay(liveDay(WITH_B), { type: "switchScenario", at: "10:01" });
    expect(b.scenario).toBe("B");
    expect(b.scenarioAt).toBe("10:01");
    expect(b.planChanges).toEqual([]);
    expect(reduceDay(b, { type: "switchScenario", at: "10:05" })).toBe(b);
  });

  test("le plan en vigueur prend le sens, la cible — et la zone A si B n'en a pas", () => {
    const b = reduceDay(liveDay(WITH_B), { type: "switchScenario", at: "10:01" });
    const p = activePlan(b);
    expect(p.bias).toBe("long");
    expect(p.target).toBe("21 700 EQH");
    expect(p.entry).toBe("FVG 21 520");
  });

  test("une fois le B actif, ses deux sens sont dans le plan", () => {
    const long = mkTrade({ direction: "long" });
    expect(tradeBreaches(long, 0, WITH_B, "A")).toEqual(["direction"]);
    expect(tradeBreaches(long, 0, WITH_B, "B")).toEqual([]);
  });

  test("rouvrir le plan repart du scénario A", () => {
    const b = reduceDay(liveDay(WITH_B), { type: "switchScenario", at: "10:01" });
    const reopened = reduceDay(b, { type: "reopenPlan", at: "10:10", reason: REASON });
    expect(reopened.scenario).toBe("A");
    expect(reopened.scenarioAt).toBeNull();
  });
});

describe("fin de séance et bilan", () => {
  test("une fin de séance passe au bilan avec sa raison", () => {
    const r = reduceDay(liveDay(), { type: "end", reason: "missed", at: "10:05" });
    expect(r.phase).toBe("review");
    expect(r.endReason).toBe("missed");
    expect(r.locked).toBe(true);
  });

  test("on ne clôt pas sans avoir répondu « plan respecté ? »", () => {
    const r = reduceDay(liveDay(), { type: "end", reason: "done", at: "10:05" });
    expect(reduceDay(r, { type: "close" }).phase).toBe("review");
    const answered = reduceDay(r, {
      type: "setReview",
      patch: { respected: false, breaches: ["direction", "chased"] },
    });
    const closed = reduceDay(answered, { type: "close" });
    expect(closed.phase).toBe("closed");
    expect(closed.review.breaches).toEqual(["direction", "chased"]);
  });

  test("répondre « respecté » efface les écarts déclarés", () => {
    let r = reduceDay(liveDay(), { type: "end", reason: "done", at: "10:05" });
    r = reduceDay(r, { type: "setReview", patch: { respected: false, breaches: ["size"] } });
    r = reduceDay(r, { type: "setReview", patch: { respected: true } });
    expect(r.review.breaches).toEqual([]);
  });

  test("un bilan clos se rouvre pour correction", () => {
    let r = reduceDay(liveDay(), { type: "end", reason: "done", at: "10:05" });
    r = reduceDay(r, { type: "setReview", patch: { respected: true } });
    r = reduceDay(reduceDay(r, { type: "close" }), { type: "reopenReview" });
    expect(r.phase).toBe("review");
    expect(r.review.respected).toBe(true);
  });
});

describe("persistance", () => {
  test("l'ancien format (motivations, FOMO) repart d'un plan vide", () => {
    const legacy = { checked: [true, true], fomo: 1, motiv: 0, locked: true };
    const d = normalizeDay(legacy, DEF);
    expect(d.phase).toBe("plan");
    expect(d.locked).toBe(false);
  });

  test("aller-retour stockage sans perte, scénario B compris", () => {
    let d = reduceDay(liveDay(WITH_B), { type: "switchScenario", at: "10:01" });
    d = reduceDay(d, { type: "end", reason: "invalidated", at: "10:08" });
    const back = normalizeDay(JSON.parse(JSON.stringify(d)), DEF);
    expect(back).toEqual(d);
  });

  test("les changements de la première version (heure seule) restent lisibles", () => {
    const raw = { ...JSON.parse(JSON.stringify(liveDay())), planChanges: ["09:58"] };
    expect(normalizeDay(raw, DEF).planChanges).toEqual([{ at: "09:58", reason: "" }]);
  });

  test("une séance stockée avec un plan incomplet revient en préparation", () => {
    const bad = { ...readyDay(), phase: "live", plan: { ...SHORT_PLAN, target: "" } };
    expect(normalizeDay(bad, DEF).phase).toBe("plan");
  });

  test("seule une séance verrouillée entre dans l'historique ; le bilan, une fois clos", () => {
    expect(sessionFromSnapshot(DATE, toSnapshot(readyDay()))).toBeNull();
    const live = liveDay();
    expect(sessionFromSnapshot(DATE, toSnapshot(live))?.review).toBeNull();
    let closed = reduceDay(live, { type: "end", reason: "done", at: "10:05" });
    closed = reduceDay(closed, { type: "setReview", patch: { respected: true, note: "Patience" } });
    closed = reduceDay(closed, { type: "close" });
    expect(sessionFromSnapshot(DATE, toSnapshot(closed))?.review?.note).toBe("Patience");
    expect(sessionFromSnapshot(DATE, { checked: [true] })).toBeNull();
  });
});

describe("faits du jour", () => {
  test("trades du jour triés, exemples exclus, pertes comptées", () => {
    const f = dayFacts(
      [
        mkTrade({ id: "b", entryTime: "10:01", pnl: 1200 }),
        mkTrade({ id: "a", entryTime: "09:50", pnl: -500 }),
        mkTrade({ id: "x", isExample: true }),
        mkTrade({ id: "old", date: "2026-10-29" }),
      ],
      DATE,
    );
    expect(f.trades.map((t) => t.id)).toEqual(["a", "b"]);
    expect(f.losses).toBe(1);
    expect(f.r).toBeCloseTo(1.4);
  });

  test("un risque inconnu rend le R du jour inconnu, pas nul", () => {
    const f = dayFacts([mkTrade({ pnl: 100, riskAmount: 0 })], DATE);
    expect(f.r).toBeNull();
  });

  test("les blocages se lisent dans les faits", () => {
    const facts = dayFacts([mkTrade({ pnl: -500 })], DATE);
    expect(
      entryBlockers({ plan: SHORT_PLAN, facts, windowOpen: false, stopAfterLosses: 1 }),
    ).toEqual(["maxTrades", "stopAfterLosses", "window"]);
    const none = dayFacts([], DATE);
    expect(
      entryBlockers({ plan: SHORT_PLAN, facts: none, windowOpen: true, stopAfterLosses: 0 }),
    ).toEqual([]);
    expect(
      entryBlockers({
        plan: { ...SHORT_PLAN, bias: "none" },
        facts: none,
        windowOpen: true,
        stopAfterLosses: 0,
      }),
    ).toEqual(["observation"]);
  });
});

describe("conformité au plan écrit", () => {
  test("un long un jour de plan short est hors plan", () => {
    expect(tradeBreaches(mkTrade({ direction: "long" }), 0, SHORT_PLAN)).toEqual(["direction"]);
    expect(tradeBreaches(mkTrade({ direction: "short" }), 0, SHORT_PLAN)).toEqual([]);
  });

  test("le trade au-delà du maximum est hors plan", () => {
    expect(tradeBreaches(mkTrade({}), 1, SHORT_PLAN)).toEqual(["extra"]);
  });

  test("tout trade d'une journée d'observation est hors plan", () => {
    expect(tradeBreaches(mkTrade({}), 0, { ...SHORT_PLAN, bias: "none" })).toEqual(["observation"]);
  });
});

const past = (date: string, plan: SessionPlan, review: PastSession["review"] = null) =>
  ({ date, plan, scenario: "A", review }) as PastSession;

describe("historique dans le plan / hors plan", () => {
  test("aucun chiffre sous l'échantillon minimum, mais le n est toujours rendu", () => {
    const trades = [mkTrade({ pnl: 1200 }), mkTrade({ direction: "long", pnl: -500 })];
    const h = planHistory([past(DATE, { ...SHORT_PLAN, maxTrades: 2 })], trades);
    expect(h.inPlan).toEqual({ n: 1, avgR: null });
    expect(h.offPlan).toEqual({ n: 1, avgR: null });
  });

  test("au-delà de l'échantillon, le R moyen de chaque groupe", () => {
    const days = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];
    const trades = days.flatMap((date) => [
      mkTrade({ date, entryTime: "09:50", pnl: 1000 }), // dans le plan : +2R
      mkTrade({ date, entryTime: "09:55", pnl: -500 }), // au-delà du max : −1R
    ]);
    const h = planHistory(
      days.map((date) => past(date, SHORT_PLAN)),
      trades,
    );
    expect(h.inPlan.n).toBe(5);
    expect(h.inPlan.avgR).toBeCloseTo(2);
    expect(h.offPlan.n).toBe(5);
    expect(h.offPlan.avgR).toBeCloseTo(-1);
  });

  test("un trade sans risque mesuré n'entre dans aucun groupe", () => {
    const h = planHistory([past(DATE, SHORT_PLAN)], [mkTrade({ riskAmount: 0 })]);
    expect(h.inPlan.n + h.offPlan.n).toBe(0);
  });
});

describe("la mémoire des séances", () => {
  const review = (note: string, breaches: Breach[]) => ({
    respected: breaches.length === 0,
    breaches,
    note,
  });

  test("la dernière leçon écrite remonte, la plus récente d'abord", () => {
    const m = sessionMemory([
      past("2026-10-27", SHORT_PLAN, review("Ne pas chasser", [])),
      past("2026-10-29", SHORT_PLAN, review("", [])),
      past("2026-10-28", SHORT_PLAN, review("Garder la DoL", ["direction"])),
      past("2026-10-30", SHORT_PLAN, null),
    ]);
    expect(m.lastLesson).toEqual({ date: "2026-10-28", note: "Garder la DoL" });
  });

  test("l'écart le plus fréquent n'apparaît qu'à partir de l'échantillon minimum", () => {
    const four = [1, 2, 3, 4].map((i) =>
      past(`2026-10-1${i}`, SHORT_PLAN, review("", ["direction"])),
    );
    expect(sessionMemory(four).topBreach).toBeNull();
    const five = [...four, past("2026-10-15", SHORT_PLAN, review("", ["chased"]))];
    expect(sessionMemory(five).topBreach).toEqual({ breach: "direction", count: 4, sessions: 5 });
  });
});

describe("la porte d'entrée", () => {
  const values = {
    bias: "SHORT",
    target: "21 450 EQL",
    entry: "FVG 21 520",
    inv: "21 580",
    risk: "250",
  };

  test("les variables prennent les valeurs du plan, un champ vide devient un tiret", () => {
    expect(fillGate("Prix dans ta zone : {entry} ?", values)).toBe(
      "Prix dans ta zone : FVG 21 520 ?",
    );
    expect(fillGate("{bias} vers {target}", values)).toBe("SHORT vers 21 450 EQL");
    expect(fillGate("Stop {inv}", { ...values, inv: " " })).toBe("Stop —");
    expect(fillGate("{inconnue} reste", values)).toBe("{inconnue} reste");
  });

  const qs = gateQuestions(["A ?", "  ", "B ?"]);

  test("les questions vides disparaissent", () => {
    expect(qs.map((q) => q.text)).toEqual(["A ?", "B ?"]);
  });

  test("un seul « non » ferme la porte", () => {
    expect(gateVerdict(qs, { [qs[0].id]: true, [qs[1].id]: false })).toBe("no");
  });

  test("tout « oui » ouvre, sinon on attend", () => {
    const all = Object.fromEntries(qs.map((q) => [q.id, true]));
    expect(gateVerdict(qs, all)).toBe("go");
    expect(gateVerdict(qs, { [qs[0].id]: true })).toBe("pending");
  });
});
