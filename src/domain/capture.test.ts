import { describe, expect, test } from "bun:test";
import { hasAnyValue, normalizeExtraction, parseTimeframe, parseTimezone } from "./capture";
import { candleSpan, enrichCapture, wallTimeToUtc } from "./captureEnrich";
import { findTradeMatches } from "./captureMatch";

const ctx = { target: "trade" as const, note: null, today: "2026-11-24" };
const f = (value: unknown, confidence = "high", extra: Record<string, unknown> = {}) => ({
  value,
  confidence,
  ...extra,
});

/** Une capture TradingView nette : long NQ 5m, heure de New York lisible. */
const clean = {
  date: f("2026-11-20"),
  symbol: f("CME_MINI:NQ1!"),
  direction: f("long"),
  timeframe: f("5"),
  chartTimezone: f("America/New_York"),
  entryPrice: f(21000),
  stopPrice: f(20990),
  targetPrice: f(21030),
  exitPrice: f(21030),
  quantity: f(2),
  entryTime: f("09:47"),
  exitTime: f("10:12"),
  outcome: f("target"),
  confluences: [
    { key: "fvg", state: "visual_confirmed", evidence: "FVG box" },
    { key: "mss", state: "probable" },
    { key: "nonsense", state: "probable" },
  ],
};

describe("normalizeExtraction", () => {
  test("screenshot net : valeurs gardées, contrat normalisé, aucune alerte", () => {
    const x = normalizeExtraction(clean, ctx);
    expect(x.symbol.value).toBe("NQ");
    expect(x.timeframe.value).toBe("5m");
    expect(x.direction.value).toBe("long");
    expect(x.entryPrice.confidence).toBe("high");
    expect(x.warnings).toEqual([]);
    expect(x.confluences.map((c) => c.key)).toEqual(["fvg", "mss"]);
  });

  test("l'IA ne peut jamais déclarer une valeur « vérifiée »", () => {
    const x = normalizeExtraction({ symbol: f("NQ", "verified") }, ctx);
    expect(x.symbol.confidence).toBe("unknown");
    expect(normalizeExtraction({ symbol: f("NQ", "low") }, ctx).symbol.confidence).toBe(
      "needs_review",
    );
  });

  test("screenshot flou / illisible : tout inconnu, rien d'inventé", () => {
    const x = normalizeExtraction({ entryPrice: f("~21k"), date: f("hier") }, ctx);
    expect(x.entryPrice.value).toBeNull();
    expect(x.date.value).toBeNull();
    expect(hasAnyValue(x)).toBe(false);
    expect(hasAnyValue(normalizeExtraction("not json", ctx))).toBe(false);
  });

  test("image sans heure : pas d'heure, pas d'alerte de fuseau", () => {
    const x = normalizeExtraction({ ...clean, entryTime: undefined, exitTime: undefined }, ctx);
    expect(x.entryTime.value).toBeNull();
    expect(x.warnings).not.toContain("timezone_unknown");
  });

  test("heure lue sans fuseau : signalée", () => {
    const x = normalizeExtraction({ ...clean, chartTimezone: undefined }, ctx);
    expect(x.warnings).toContain("timezone_unknown");
  });

  test("short avec un stop sous l'entrée : niveaux à revoir", () => {
    const x = normalizeExtraction({ ...clean, direction: f("short") }, ctx);
    expect(x.warnings).toContain("levels_incoherent");
    expect(x.stopPrice.confidence).toBe("needs_review");
    expect(x.targetPrice.confidence).toBe("needs_review");
  });

  test("date future refusée", () => {
    const x = normalizeExtraction({ date: f("2027-01-02") }, ctx);
    expect(x.date.value).toBeNull();
    expect(x.warnings).toContain("future_date");
  });

  test("plusieurs unités de temps visibles : unité à revoir", () => {
    const x = normalizeExtraction({ ...clean, multipleTimeframes: true }, ctx);
    expect(x.timeframe.confidence).toBe("needs_review");
    expect(x.warnings).toContain("multiple_timeframes");
  });

  test("note : un champ sans citation exacte est rejeté", () => {
    const note = "Long NQ à 9h47, risque 250 dollars, j'ai anticipé mon MSS";
    const x = normalizeExtraction(
      {
        direction: f("long", "high", { source: "note", evidence: "Long NQ" }),
        entryTime: f("09:47", "high", { source: "note", evidence: "à 9h47" }),
        exitPrice: f(21100, "high", { source: "note", evidence: "sortie à 21100" }),
      },
      { ...ctx, note },
    );
    expect(x.direction.value).toBe("long");
    expect(x.direction.origin).toBe("note");
    expect(x.entryTime.value).toBe("09:47");
    expect(x.exitPrice.value).toBeNull();
    expect(x.warnings).toContain("note_evidence_missing");
  });

  test("symbole inconnu (CFD) : gardé, à revoir", () => {
    const x = normalizeExtraction({ symbol: f("NAS100") }, ctx);
    expect(x.symbol.value).toBe("NAS100");
    expect(x.symbol.confidence).toBe("needs_review");
  });
});

describe("parseurs", () => {
  test("unités de temps TradingView", () => {
    expect(parseTimeframe("15")).toBe("15m");
    expect(parseTimeframe("1H")).toBe("1h");
    expect(parseTimeframe("D")).toBe("1d");
    expect(parseTimeframe("7m")).toBeNull();
  });
  test("fuseaux", () => {
    expect(parseTimezone("UTC-5")).toBe("Etc/GMT+5");
    expect(parseTimezone("UTC")).toBe("UTC");
    expect(parseTimezone("Europe/Brussels")).toBe("Europe/Brussels");
    expect(parseTimezone("Mars/Olympus")).toBeNull();
  });
});

describe("enrichCapture", () => {
  test("long NQ : risque, R visé, R réalisé, gain, session, bougies", () => {
    const d = enrichCapture(normalizeExtraction(clean, ctx), { plannedRiskDollars: 250 });
    expect(d.contract?.pointValue).toBe(20);
    expect(d.stopPoints.value).toBe(10);
    expect(d.stopTicks.value).toBe(40);
    expect(d.riskDollars.value).toBe(400); // 10 pts × 20 $ × 2
    expect(d.plannedRiskDollars.value).toBe(250);
    expect(d.plannedR.value).toBe(3);
    expect(d.realizedR.value).toBe(3);
    expect(d.rewardDollars.value).toBe(1200);
    expect(d.grossPnl.value).toBe(1200);
    expect(d.grossPnl.confidence).toBe("estimated"); // frais inconnus
    expect(d.session.value).toBe("newyork");
    expect(d.entryTimeEt.value).toBe("09:47");
    expect(d.elapsedMinutes.value).toBe(25);
    // 09:45, 09:50 … 10:10 : six bougies de 5 minutes touchées.
    expect(d.theoreticalCandles.value).toBe(6);
    expect(d.actualCandles.value).toBeNull();
  });

  test("contrat différent (MES) : autre valeur du point", () => {
    const d = enrichCapture(
      normalizeExtraction(
        {
          ...clean,
          symbol: f("MES"),
          entryPrice: f(6000),
          stopPrice: f(5995),
          targetPrice: f(6010),
        },
        ctx,
      ),
    );
    expect(d.contract?.symbol).toBe("MES");
    expect(d.riskDollars.value).toBe(50); // 5 pts × 5 $ × 2
  });

  test("short : R calculé du bon côté", () => {
    const d = enrichCapture(
      normalizeExtraction(
        {
          ...clean,
          direction: f("short"),
          stopPrice: f(21010),
          targetPrice: f(20970),
          exitPrice: f(20990),
        },
        ctx,
      ),
    );
    expect(d.plannedR.value).toBe(3);
    expect(d.realizedR.value).toBe(1);
  });

  test("quantité invisible : contrats que le risque prévu autorise", () => {
    const d = enrichCapture(normalizeExtraction({ ...clean, quantity: undefined }, ctx), {
      plannedRiskDollars: 450,
    });
    expect(d.riskDollars.value).toBeNull();
    expect(d.contractsForPlannedRisk.value).toBe(2); // 450 / (10 × 20)
  });

  test("graphique en heure de Bruxelles : converti en heure de New York", () => {
    const d = enrichCapture(
      normalizeExtraction(
        {
          ...clean,
          chartTimezone: f("Europe/Brussels"),
          entryTime: f("15:47"),
          exitTime: f("16:12"),
        },
        ctx,
      ),
    );
    expect(d.entryTimeEt.value).toBe("09:47");
    expect(d.session.value).toBe("newyork");
  });

  test("stop à revoir : le risque calculé l'est aussi", () => {
    const d = enrichCapture(normalizeExtraction({ ...clean, stopPrice: f(20990, "low") }, ctx));
    expect(d.riskDollars.confidence).toBe("needs_review");
  });
});

describe("candleSpan", () => {
  const utc = (date: string, hhmm: string) => wallTimeToUtc(date, hhmm, "America/New_York");

  test("la pause CME 17:00–18:00 n'a pas de bougie", () => {
    // Mercredi 16:30 → 18:30 ET en 15m : 16:30, 16:45, puis 18:00, 18:15, 18:30.
    const s = candleSpan(utc("2026-11-18", "16:30"), utc("2026-11-18", "18:30"), 15, "cme_globex");
    expect(s?.elapsedMinutes).toBe(120);
    expect(s?.marketMinutes).toBe(60);
    expect(s?.theoreticalCandles).toBe(5);
  });

  test("week-end exclu, crypto continue", () => {
    const fri = utc("2026-11-20", "16:00");
    const sun = utc("2026-11-22", "19:00");
    expect(candleSpan(fri, sun, 60, "cme_globex")?.marketMinutes).toBe(120);
    expect(candleSpan(fri, sun, 60, "continuous")?.marketMinutes).toBe(51 * 60);
  });

  test("passage à l'heure d'hiver : instants exacts", () => {
    // 2026-11-01 : New York revient à UTC-5.
    expect(wallTimeToUtc("2026-10-30", "09:30", "America/New_York")).toBe(
      Date.UTC(2026, 9, 30, 13, 30),
    );
    expect(wallTimeToUtc("2026-11-02", "09:30", "America/New_York")).toBe(
      Date.UTC(2026, 10, 2, 14, 30),
    );
  });

  test("sortie avant l'entrée ou laps démesuré : rien", () => {
    expect(candleSpan(120_000, 0, 5, "continuous")).toBeNull();
    expect(candleSpan(0, 8 * 86_400_000, 5, "continuous")).toBeNull();
  });
});

describe("findTradeMatches", () => {
  const trades = [
    {
      id: "a",
      date: "2026-11-20",
      symbol: "NQ",
      direction: "long" as const,
      entryTime: "09:48",
      entryPrice: 21000.25,
    },
    {
      id: "b",
      date: "2026-11-20",
      symbol: "MNQ",
      direction: "long" as const,
      entryTime: "11:30",
      entryPrice: 21080,
    },
    { id: "c", date: "2026-11-20", symbol: "ES", direction: "long" as const, entryTime: "09:47" },
    { id: "d", date: "2026-11-19", symbol: "NQ", direction: "long" as const, entryTime: "09:47" },
    { id: "e", date: "2026-11-20", symbol: "NQ", direction: "short" as const, entryTime: "09:47" },
  ];
  const probe = {
    date: "2026-11-20",
    symbol: "NQ",
    direction: "long" as const,
    entryTime: "09:47",
    entryPrice: 21000,
  };

  test("trade déjà existant : rapproché « exact », les autres écartés", () => {
    const m = findTradeMatches(probe, trades);
    expect(m[0]).toMatchObject({ id: "a", level: "exact" });
    expect(m.map((x) => x.id)).not.toContain("c"); // autre contrat
    expect(m.map((x) => x.id)).not.toContain("d"); // autre jour
    expect(m.map((x) => x.id)).not.toContain("e"); // autre sens
  });

  test("NQ sur le graphique, MNQ au journal : même famille, moins sûr", () => {
    const m = findTradeMatches({ ...probe, entryTime: "11:31", entryPrice: 21080 }, trades);
    expect(m[0]?.id).toBe("b");
    expect(m[0]?.reasons).toContain("same_family");
  });

  test("sans date, aucun rapprochement", () => {
    expect(findTradeMatches({ ...probe, date: null }, trades)).toEqual([]);
  });
});

describe("sortie déduite du résultat", () => {
  test("cible touchée sans prix de sortie : sortie = cible, estimée, R réalisé calculé", () => {
    const x = normalizeExtraction(
      { ...clean, exitPrice: undefined, outcome: f("target") },
      { target: "trade", note: null, today: "2026-11-24" },
    );
    const d = enrichCapture(x);
    expect(d.impliedExit).toMatchObject({ value: 21030, confidence: "estimated" });
    expect(d.realizedR).toMatchObject({ value: 3, confidence: "estimated" });
  });
  test("prix de sortie lu : rien n'est déduit", () => {
    const d = enrichCapture(
      normalizeExtraction(clean, { target: "trade", note: null, today: "2026-11-24" }),
    );
    expect(d.impliedExit.value).toBeNull();
  });
  test("issue inconnue : pas de sortie inventée", () => {
    const x = normalizeExtraction(
      { ...clean, exitPrice: undefined, outcome: undefined },
      { target: "trade", note: null, today: "2026-11-24" },
    );
    expect(enrichCapture(x).realizedR.value).toBeNull();
  });
});
