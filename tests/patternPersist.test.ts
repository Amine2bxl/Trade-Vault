import { describe, expect, it } from "bun:test";
import { planWrites, toSessionLikes, toTradeLikes, windowStart } from "@/modules/patterns/persist";
import type { DetectedPattern } from "@/modules/patterns/detectors";

/**
 * La traduction base → détecteurs. Ce qui compte ici : une donnée absente ne
 * doit jamais devenir un zéro. Un zéro inventé ne fait pas échouer un test, il
 * fabrique un motif faux avec un `n` rassurant.
 */

describe("toTradeLikes", () => {
  it("lit les numeric rendus en chaîne par PostgREST", () => {
    const out = toTradeLikes([
      { trade_date: "2026-01-05", pnl: "-120.5", r_multiple: "-1.2", mistakes: ["fomo"] },
    ]);
    expect(out).toEqual([
      {
        date: "2026-01-05",
        pnl: -120.5,
        rMultiple: -1.2,
        mistakes: ["fomo"],
        entryTime: null,
      },
    ]);
  });

  it("écarte un trade sans R plutôt que de compter 0", () => {
    const out = toTradeLikes([
      { trade_date: "2026-01-05", pnl: 100, r_multiple: null },
      { trade_date: "2026-01-06", pnl: 100, r_multiple: 1 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-01-06");
  });

  it("écarte un trade sans P&L et un trade sans date", () => {
    expect(
      toTradeLikes([
        { trade_date: "2026-01-05", pnl: null, r_multiple: 1 },
        { trade_date: null, pnl: 10, r_multiple: 1 },
      ]),
    ).toEqual([]);
  });

  it("écarte une valeur non numérique au lieu de propager NaN", () => {
    expect(toTradeLikes([{ trade_date: "2026-01-05", pnl: "n/a", r_multiple: 1 }])).toEqual([]);
  });

  it("garde `mistakes` et `entry_time` tels quels", () => {
    const out = toTradeLikes([
      { trade_date: "2026-01-05", pnl: 1, r_multiple: 1, mistakes: null, entry_time: "09:30" },
    ]);
    expect(out[0].mistakes).toBeNull();
    expect(out[0].entryTime).toBe("09:30");
  });
});

describe("toSessionLikes", () => {
  it("garde une séance sans score, avec `null`", () => {
    const out = toSessionLikes([
      { session_date: "2026-01-05", readiness_score: null },
      { session_date: "2026-01-06", readiness_score: "72" },
    ]);
    expect(out).toEqual([
      { sessionDate: "2026-01-05", readinessScore: null },
      { sessionDate: "2026-01-06", readinessScore: 72 },
    ]);
  });

  it("écarte une séance sans date", () => {
    expect(toSessionLikes([{ session_date: null, readiness_score: 50 }])).toEqual([]);
  });
});

describe("windowStart", () => {
  it("recule de 90 jours et rend une date", () => {
    expect(windowStart(new Date("2026-04-01T12:00:00Z"))).toBe("2026-01-01");
  });

  it("traverse un changement d'année sans se casser", () => {
    expect(windowStart(new Date("2026-01-10T00:00:00Z"), 30)).toBe("2025-12-11");
  });
});

function pattern(over: Partial<DetectedPattern> = {}): DetectedPattern {
  return {
    status: "found",
    kind: "cluster_concentration",
    clusterId: "fomo",
    evidence: {
      n: 40,
      comparisonN: null,
      metric: "loss_share",
      value: 0.5,
      baseline: 0.25,
      comparisons: 4,
    },
    impactR: -0.6,
    ...over,
  };
}

describe("planWrites", () => {
  it("met à jour la ligne existante plutôt que d'en empiler une", () => {
    const writes = planWrites(
      [pattern()],
      [{ id: "row-1", kind: "cluster_concentration", cluster_id: "fomo", dismissed_at: null }],
    );
    expect(writes[0].id).toBe("row-1");
  });

  it("insère quand la famille diffère", () => {
    const writes = planWrites(
      [pattern()],
      [{ id: "row-1", kind: "cluster_concentration", cluster_id: "risk", dismissed_at: null }],
    );
    expect(writes[0].id).toBeNull();
  });

  it("rapproche un motif sans famille sur `cluster_id` nul", () => {
    const writes = planWrites(
      [pattern({ kind: "after_loss", clusterId: null })],
      [{ id: "row-2", kind: "after_loss", cluster_id: null, dismissed_at: null }],
    );
    expect(writes[0].id).toBe("row-2");
  });

  it("recopie les preuves sans les toucher", () => {
    const p = pattern();
    expect(planWrites([p], [])[0]).toEqual({
      id: null,
      kind: "cluster_concentration",
      cluster_id: "fomo",
      evidence: p.evidence,
      impact_r: -0.6,
    });
  });
});
