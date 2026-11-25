import { describe, expect, test } from "bun:test";
import { normalizeExtraction } from "@/domain/capture";
import { enrichCapture } from "@/domain/captureEnrich";
import {
  applyLearning,
  applyProposals,
  coerceMissed,
  correctionsOf,
  ESSENTIAL_TRADE_FIELDS,
  learnedRemaps,
  missedProposals,
  missingFields,
  tradeProposals,
} from "@/app/features/capture/capturePrefill";

const f = (value: unknown, confidence = "high") => ({ value, confidence });
const raw = {
  date: f("2026-11-20"),
  symbol: f("NQ1!"),
  direction: f("long"),
  timeframe: f("5"),
  chartTimezone: f("America/New_York"),
  entryPrice: f(21000),
  stopPrice: f(20990, "low"),
  targetPrice: f(21030),
  exitPrice: f(21020),
  quantity: f(2),
  entryTime: f("09:47"),
  exitTime: f("10:02", "medium"),
  setup: f("silver bullet"),
  confluences: [
    { key: "fvg", state: "visual_confirmed" },
    { key: "mss", state: "probable" },
    { key: "order_block", state: "not_detected" },
  ],
};
const x = normalizeExtraction(raw, { target: "trade", note: null, today: "2026-11-24" });
const d = enrichCapture(x);
const ctx = { strategies: ["Silver Bullet", "Scalping"], confluences: ["fvg"] };

const pristine = {
  date: "2026-11-24",
  symbol: "",
  direction: "long" as const,
  entryTime: "09:30",
  exitTime: "10:00",
  entryPrice: "",
  exitPrice: "",
  initialStop: "",
  initialTarget: "",
  quantity: "",
  riskAmount: "",
  rMultiple: "",
  strategy: "Scalping",
  confluences: [] as string[],
};

describe("tradeProposals", () => {
  const props = tradeProposals(x, d, ctx);
  const by = (field: string) => props.find((p) => p.field === field);

  test("chaque champ porte sa nature", () => {
    expect(by("symbol")).toMatchObject({ value: "NQ", kind: "detected" });
    expect(by("exitTime")).toMatchObject({ kind: "estimated" });
    expect(by("initialStop")).toMatchObject({ kind: "needs_review" });
    // Le risque dépend du stop douteux : il est à revoir, pas « calculé » d'office.
    expect(by("riskAmount")?.kind).toBe("needs_review");
  });

  test("setup proposé seulement s'il existe chez le trader, avec SON orthographe", () => {
    expect(by("strategy")?.value).toBe("Silver Bullet");
    const other = tradeProposals(
      normalizeExtraction(
        { ...raw, setup: f("Turtle soup") },
        { target: "trade", note: null, today: "2026-11-24" },
      ),
      d,
      ctx,
    );
    expect(other.find((p) => p.field === "strategy")).toBeUndefined();
  });

  test("confluences : vues ou probables seulement, dans le vocabulaire du trader", () => {
    expect(by("confluences")?.value).toEqual(["fvg", "MSS"]);
    expect(by("confluences")?.kind).toBe("estimated");
  });

  test("informations manquantes listées", () => {
    const missing = missingFields(
      tradeProposals(
        normalizeExtraction(
          { symbol: f("NQ") },
          { target: "trade", note: null, today: "2026-11-24" },
        ),
        enrichCapture(
          normalizeExtraction(
            { symbol: f("NQ") },
            { target: "trade", note: null, today: "2026-11-24" },
          ),
        ),
        ctx,
      ),
      ESSENTIAL_TRADE_FIELDS,
    );
    expect(missing).toContain("entryPrice");
    expect(missing).not.toContain("symbol");
  });
});

describe("applyProposals", () => {
  const props = tradeProposals(x, d, ctx);

  test("remplit les champs vides ou par défaut, jamais ce qui a été saisi", () => {
    const form = { ...pristine, symbol: "ES", confluences: ["Killzone"] };
    const r = applyProposals(form, pristine, props);
    expect(r.next.symbol).toBe("ES");
    expect(r.conflicts.map((c) => c.field)).toContain("symbol");
    expect(r.next.entryPrice).toBe("21000");
    expect(r.next.entryTime).toBe("09:47"); // 09:30 était la valeur par défaut
    expect(r.next.strategy).toBe("Silver Bullet"); // « Scalping » par défaut
    expect(r.next.confluences).toEqual(["Killzone", "fvg", "MSS"]);
  });

  test("une proposition à revoir n'est appliquée que sur demande", () => {
    const r = applyProposals(pristine, pristine, props);
    expect(r.next.initialStop).toBe("");
    const forced = applyProposals(pristine, pristine, props, { includeReview: true });
    expect(forced.next.initialStop).toBe("20990");
  });

  test("« Remplacer » force un conflit", () => {
    const form = { ...pristine, symbol: "ES" };
    const r = applyProposals(
      form,
      pristine,
      props.filter((p) => p.field === "symbol"),
      { force: true },
    );
    expect(r.next.symbol).toBe("NQ");
  });

  test("le formulaire d'origine n'est jamais muté", () => {
    const form = { ...pristine };
    applyProposals(form, pristine, props);
    expect(form.entryPrice).toBe("");
  });
});

describe("setup manqué", () => {
  test("prix convertis en nombres, issue seulement si cible ou stop touché", () => {
    const mx = normalizeExtraction(
      { ...raw, outcome: f("target") },
      { target: "missed", note: null, today: "2026-11-24" },
    );
    const props = missedProposals(mx, enrichCapture(mx));
    const m = {
      date: "2026-11-24",
      symbol: "",
      direction: null,
      entryPrice: null,
      stopPrice: null,
      targetPrice: null,
      outcome: null,
    };
    const r = applyProposals(m, { date: "2026-11-24" }, props, { coerce: coerceMissed });
    expect(r.next.entryPrice).toBe(21000);
    expect(r.next.outcome).toBe("target");
    expect(r.next.stopPrice).toBeNull(); // stop douteux : à revoir

    const open = normalizeExtraction(
      { ...raw, outcome: f("open") },
      { target: "missed", note: null, today: "2026-11-24" },
    );
    expect(
      missedProposals(open, enrichCapture(open)).find((p) => p.field === "outcome"),
    ).toBeUndefined();
  });
});

describe("apprentissage par correction", () => {
  test("une correction récurrente devient une habitude ; une contradiction l'annule", () => {
    const fix = { symbol: { detected: "NQ", saved: "MNQ" } };
    expect(learnedRemaps([fix])).toEqual({});
    expect(learnedRemaps([fix, fix])).toEqual({ symbol: { nq: "MNQ" } });
    expect(learnedRemaps([fix, fix, { symbol: { detected: "NQ", saved: "NQ1" } }])).toEqual({});
    // Les prix ne s'apprennent jamais.
    expect(
      learnedRemaps([
        { entryPrice: { detected: "1", saved: "2" } },
        { entryPrice: { detected: "1", saved: "2" } },
      ]),
    ).toEqual({});
  });

  test("la proposition ajustée n'est plus qu'estimée et dit pourquoi", () => {
    const props = applyLearning(tradeProposals(x, d, ctx), { symbol: { nq: "MNQ" } });
    expect(props.find((p) => p.field === "symbol")).toMatchObject({
      value: "MNQ",
      kind: "estimated",
      evidence: "learned:NQ",
    });
  });

  test("corrections = ce que le trader a changé dans un champ rempli", () => {
    const props = tradeProposals(x, d, ctx);
    const applied = applyProposals(pristine, pristine, props).applied;
    const saved = { ...pristine, symbol: "MNQ", entryPrice: "21000" };
    expect(correctionsOf(applied, saved)).toMatchObject({
      symbol: { detected: "NQ", saved: "MNQ" },
    });
    expect(correctionsOf(applied, saved).entryPrice).toBeUndefined();
  });
});
