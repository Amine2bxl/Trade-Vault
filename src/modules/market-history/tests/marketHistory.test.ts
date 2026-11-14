import { describe, expect, test } from "bun:test";
import {
  fetchAssetHistory,
  lastClosedMonth,
  parseFredDaily,
  parseStooqMonthly,
  parseYahooMonthly,
  seriesAgree,
  validateSeries,
  type Fetchers,
  type MonthlyClose,
} from "..";

const NOW = new Date("2026-11-14T12:00:00Z");

function months(n: number, start = 100, step = 0.01): MonthlyClose[] {
  return Array.from({ length: n }, (_, i) => {
    const y = 2020 + Math.floor(i / 12);
    const m = (i % 12) + 1;
    return { month: `${y}-${String(m).padStart(2, "0")}`, close: start * (1 + step) ** i };
  });
}

describe("parseurs", () => {
  test("le mois en cours n'est jamais une clôture", () => {
    expect(lastClosedMonth(NOW)).toBe("2026-10");
    expect(lastClosedMonth(new Date("2026-01-03T00:00:00Z"))).toBe("2025-12");
  });

  test("Yahoo : adjclose prioritaire, nulls ignorés, mois en cours retiré", () => {
    const ts = (iso: string) => Date.parse(iso) / 1000;
    const json = {
      chart: {
        result: [
          {
            timestamp: [
              ts("2026-09-01T00:00:00Z"),
              ts("2026-10-01T00:00:00Z"),
              ts("2026-11-01T00:00:00Z"),
            ],
            indicators: {
              quote: [{ close: [1, 2, 3] }],
              adjclose: [{ adjclose: [10, null, 30] }],
            },
          },
        ],
      },
    };
    expect(parseYahooMonthly(json, NOW)).toEqual([{ month: "2026-09", close: 10 }]);
    expect(parseYahooMonthly({ chart: { result: null } }, NOW)).toEqual([]);
    // Londres en heure d'été : la barre d'octobre est horodatée le 30/09 à 23 h UTC.
    const london = {
      chart: {
        result: [
          {
            timestamp: [ts("2026-08-31T23:00:00Z"), ts("2026-09-30T23:00:00Z")],
            indicators: { quote: [{ close: [1.1, 1.2] }] },
          },
        ],
      },
    };
    expect(parseYahooMonthly(london, NOW).map((x) => x.month)).toEqual(["2026-09", "2026-10"]);
  });

  test("Stooq : CSV mensuel", () => {
    const csv =
      "Date,Open,High,Low,Close,Volume\n2026-08-31,1,1,1,100.5,0\n2026-09-30,1,1,1,101,0\n";
    expect(parseStooqMonthly(csv, NOW)).toEqual([
      { month: "2026-08", close: 100.5 },
      { month: "2026-09", close: 101 },
    ]);
    expect(parseStooqMonthly("No data", NOW)).toEqual([]);
  });

  test("FRED : la dernière cotation du mois, « . » ignoré", () => {
    const csv =
      "observation_date,SP500\n2026-09-29,10\n2026-09-30,.\n2026-09-28,9\n2026-10-01,11\n2026-10-30,12\n";
    // Lignes chronologiques en vrai ; ici le 28 après le 29 prouve qu'on garde la DERNIÈRE ligne lue.
    expect(parseFredDaily(csv, NOW)).toEqual([
      { month: "2026-09", close: 9 },
      { month: "2026-10", close: 12 },
    ]);
  });
});

describe("validation", () => {
  test("trop courte, trou, mouvement aberrant", () => {
    expect(validateSeries(months(20), "indices")).toBe("too_short");
    const gap = months(40).filter((_, i) => i !== 10);
    expect(validateSeries(gap, "indices")).toBe("gap");
    const spike = months(40).map((x, i) => (i === 20 ? { ...x, close: x.close * 3 } : x));
    expect(validateSeries(spike, "indices")).toBe("outlier");
    expect(validateSeries(spike, "crypto")).toBeNull();
    expect(validateSeries(months(40), "forex")).toBeNull();
  });

  test("concordance entre deux sources", () => {
    const a = months(40);
    expect(
      seriesAgree(
        a,
        a.map((x) => ({ ...x, close: x.close * 1.01 })),
      ),
    ).toBe(true);
    expect(
      seriesAgree(
        a,
        a.map((x) => ({ ...x, close: x.close * 1.2 })),
      ),
    ).toBe(false);
    expect(seriesAgree(a, a.slice(0, 5))).toBe(false);
  });
});

describe("chaîne de fournisseurs", () => {
  const asset = {
    symbol: "SPX",
    name: "S&P 500",
    category: "indices" as const,
    yahoo: "^GSPC",
    stooq: "^spx",
    fred: "SP500",
  };
  const ok = (s: MonthlyClose[]) => async () => s;
  const ko = async () => {
    throw new Error("down");
  };

  test("première source valide + témoin concordant = vérifié", async () => {
    const f: Fetchers = { yahoo: ok(months(40)), stooq: ok(months(40)), fred: ko };
    const h = await fetchAssetHistory(asset, f);
    expect(h?.source).toBe("yahoo");
    expect(h?.verified).toBe(true);
    expect(h?.witness).toBe("stooq");
  });

  test("bascule : Yahoo en panne, Stooq prend le relais, FRED témoigne", async () => {
    const f: Fetchers = { yahoo: ko, stooq: ok(months(40)), fred: ok(months(40)) };
    const h = await fetchAssetHistory(asset, f);
    expect(h?.source).toBe("stooq");
    expect(h?.witness).toBe("fred");
    expect(h?.failures[0]).toContain("yahoo");
  });

  test("une série invalide passe la main ; un seul survivant = non vérifié", async () => {
    const f: Fetchers = { yahoo: ok(months(10)), stooq: ko, fred: ok(months(40)) };
    const h = await fetchAssetHistory(asset, f);
    expect(h?.source).toBe("fred");
    expect(h?.verified).toBe(false);
  });

  test("un trou ancien : on garde la période récente continue", async () => {
    const gappy = [...months(60).slice(0, 10), ...months(60).slice(11)];
    const f: Fetchers = { yahoo: ok(gappy), stooq: ko, fred: ko };
    const h = await fetchAssetHistory(asset, f);
    expect(h?.series.length).toBe(49);
    expect(h?.series[0].month).toBe(months(60)[11].month);
  });

  test("tout en panne : rien (la base garde la dernière série)", async () => {
    expect(await fetchAssetHistory(asset, { yahoo: ko, stooq: ko, fred: ko })).toBeNull();
  });
});
