import { describe, expect, test } from "bun:test";
import type { Trade } from "@/domain/trade";
import {
  canLock,
  dayFacts,
  emptyDay,
  entryBlockers,
  gateQuestions,
  gateVerdict,
  missingFields,
  normalizeDay,
  parseAmount,
  planFromSnapshot,
  planHistory,
  reduceDay,
  toSnapshot,
  tradeBreaches,
  type SessionDay,
  type SessionPlan,
} from "../sessionPlan";

const DEF = { risk: "250", maxTrades: 1 };
const DATE = "2026-10-30";

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
  bias: "short",
  target: "21 450 EQL",
  entry: "FVG 21 520",
  invalidation: "21 580",
  risk: "250",
  maxTrades: 1,
};

/** Une journée prête à verrouiller. */
function readyDay(plan: SessionPlan = SHORT_PLAN): SessionDay {
  let d = emptyDay(DEF);
  d = reduceDay(d, { type: "setPlan", patch: plan });
  return reduceDay(d, { type: "setMood", mood: "calm" });
}

describe("le plan s'écrit, il ne se coche pas", () => {
  test("une journée vide liste tout ce qui manque, dans l'ordre", () => {
    const d = emptyDay(DEF);
    expect(missingFields({ ...d.plan, risk: "" }, null)).toEqual([
      "bias",
      "target",
      "entry",
      "invalidation",
      "risk",
      "mood",
    ]);
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
    const plan: SessionPlan = { ...SHORT_PLAN, bias: "none", target: "", entry: "", risk: "" };
    expect(missingFields(plan, null)).toEqual(["mood"]);
    expect(canLock(plan, "focused")).toBe(true);
  });

  test("`checked` reflète l'avancement réel du plan (contrat du tableau de bord)", () => {
    let d = emptyDay(DEF);
    expect(d.checked).toEqual([false, false, false, false, true, false]);
    d = reduceDay(d, { type: "setPlan", patch: { bias: "long", target: "EQH" } });
    expect(d.checked.filter(Boolean).length).toBe(3);
    expect(readyDay().checked.every(Boolean)).toBe(true);
  });
});

describe("le verrou", () => {
  test("un plan incomplet ne se verrouille pas", () => {
    const d = reduceDay(emptyDay(DEF), { type: "lock", at: "09:20" });
    expect(d.phase).toBe("plan");
    expect(d.locked).toBe(false);
  });

  test("verrouiller passe en séance et date le verrou", () => {
    const d = reduceDay(readyDay(), { type: "lock", at: "09:20" });
    expect(d.phase).toBe("live");
    expect(d.locked).toBe(true);
    expect(d.lockedAt).toBe("09:20");
  });

  test("en séance, le plan et l'état sont gelés", () => {
    const live = reduceDay(readyDay(), { type: "lock", at: "09:20" });
    expect(reduceDay(live, { type: "setPlan", patch: { bias: "long" } })).toBe(live);
    expect(reduceDay(live, { type: "setMood", mood: "anxious" })).toBe(live);
  });

  test("rouvrir le plan en séance ne l'efface pas et laisse une trace horodatée", () => {
    const live = reduceDay(readyDay(), { type: "lock", at: "09:20" });
    const reopened = reduceDay(live, { type: "reopenPlan", at: "09:52" });
    expect(reopened.phase).toBe("plan");
    expect(reopened.locked).toBe(false);
    expect(reopened.plan).toEqual(live.plan);
    expect(reopened.planChanges).toEqual(["09:52"]);
    // Et la modification est alors possible, puis se reverrouille.
    const flipped = reduceDay(reopened, { type: "setPlan", patch: { bias: "long" } });
    const relocked = reduceDay(flipped, { type: "lock", at: "09:53" });
    expect(relocked.phase).toBe("live");
    expect(relocked.plan.bias).toBe("long");
    expect(relocked.planChanges).toEqual(["09:52"]);
  });
});

describe("fin de séance et bilan", () => {
  const live = () => reduceDay(readyDay(), { type: "lock", at: "09:20" });

  test("une fin de séance passe au bilan avec sa raison", () => {
    const r = reduceDay(live(), { type: "end", reason: "missed", at: "10:05" });
    expect(r.phase).toBe("review");
    expect(r.endReason).toBe("missed");
    expect(r.locked).toBe(true);
  });

  test("on ne clôt pas sans avoir répondu « plan respecté ? »", () => {
    const r = reduceDay(live(), { type: "end", reason: "done", at: "10:05" });
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
    let r = reduceDay(live(), { type: "end", reason: "done", at: "10:05" });
    r = reduceDay(r, { type: "setReview", patch: { respected: false, breaches: ["size"] } });
    r = reduceDay(r, { type: "setReview", patch: { respected: true } });
    expect(r.review.breaches).toEqual([]);
  });

  test("un bilan clos se rouvre pour correction", () => {
    let r = reduceDay(live(), { type: "end", reason: "done", at: "10:05" });
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

  test("aller-retour stockage sans perte", () => {
    let d = reduceDay(readyDay(), { type: "lock", at: "09:20" });
    d = reduceDay(d, { type: "end", reason: "invalidated", at: "09:58" });
    const back = normalizeDay(JSON.parse(JSON.stringify(d)), DEF);
    expect(back).toEqual(d);
  });

  test("une séance stockée avec un plan incomplet revient en préparation", () => {
    const bad = { ...readyDay(), phase: "live", plan: { ...SHORT_PLAN, target: "" } };
    expect(normalizeDay(bad, DEF).phase).toBe("plan");
  });

  test("seule une séance verrouillée livre son plan à l'historique", () => {
    expect(planFromSnapshot(toSnapshot(readyDay()))).toBeNull();
    const live = reduceDay(readyDay(), { type: "lock", at: "09:20" });
    expect(planFromSnapshot(toSnapshot(live))?.bias).toBe("short");
    expect(planFromSnapshot({ checked: [true] })).toBeNull();
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

describe("historique dans le plan / hors plan", () => {
  test("aucun chiffre sous l'échantillon minimum, mais le n est toujours rendu", () => {
    const trades = [mkTrade({ pnl: 1200 }), mkTrade({ direction: "long", pnl: -500 })];
    const h = planHistory([{ date: DATE, plan: { ...SHORT_PLAN, maxTrades: 2 } }], trades);
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
      days.map((date) => ({ date, plan: SHORT_PLAN })),
      trades,
    );
    expect(h.inPlan.n).toBe(5);
    expect(h.inPlan.avgR).toBeCloseTo(2);
    expect(h.offPlan.n).toBe(5);
    expect(h.offPlan.avgR).toBeCloseTo(-1);
  });

  test("un trade sans risque mesuré n'entre dans aucun groupe", () => {
    const h = planHistory([{ date: DATE, plan: SHORT_PLAN }], [mkTrade({ riskAmount: 0 })]);
    expect(h.inPlan.n + h.offPlan.n).toBe(0);
  });
});

describe("la porte d'entrée", () => {
  const qs = gateQuestions(["Setup A+ ?", "  "]);

  test("quatre questions tirées du plan, puis les critères personnels non vides", () => {
    expect(qs.map((q) => q.kind)).toEqual(["direction", "entry", "stop", "size", "custom"]);
  });

  test("un seul « non » ferme la porte", () => {
    expect(gateVerdict(qs, { direction: true, entry: false })).toBe("no");
  });

  test("tout « oui » ouvre, sinon on attend", () => {
    const all = Object.fromEntries(qs.map((q) => [q.id, true]));
    expect(gateVerdict(qs, all)).toBe("go");
    expect(gateVerdict(qs, { direction: true })).toBe("pending");
  });
});
