import { describe, expect, test } from "bun:test";
import { assessDataQuality } from "../src/domain/dataQuality";
import type { Trade } from "../src/domain/trade";

/**
 * Le rapport de qualité COMPTE ce que les statistiques écartent — il ne
 * corrige rien et n'invente rien.
 */

function trade(id: string, over: Partial<Trade> = {}): Trade {
  return {
    id,
    date: "2026-10-21",
    symbol: "NQ",
    direction: "long",
    pnl: 100,
    riskAmount: 50,
    rMultiple: 2,
    strategy: "ORB",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "09:45",
    confluences: [],
    confidence: 50,
    accountId: "acc",
    ...over,
  };
}

describe("qualité des données", () => {
  test("chaque exclusion est comptée une fois, à sa vraie raison", () => {
    const q = assessDataQuality(
      [
        trade("ok"),
        trade("pending", { broker: "tradovate", reviewPending: true, fees: 2 }),
        trade("no-risk", { riskAmount: 0 }),
        trade("default", { broker: "tradovate", riskSource: "broker_default", fees: null }),
        trade("no-time", { entryTime: "" }),
      ],
      { snapshots: [], cash: [] },
    );
    expect(q.trades).toBe(5);
    expect(q.pendingReview).toBe(1);
    // Le forfait broker et le risque absent : hors des statistiques en R.
    expect(q.riskUnmeasured).toBe(2);
    expect(q.feesUnknown).toBe(1);
    // Import non relu et broker sans instant : heure non certifiée ; saisie
    // sans heure : aucune heure.
    expect(q.clockUnproven).toBe(3);
    // Sans aucun solde observé, aucun solde historique n'est reconstruit.
    expect(q.balance).toEqual({ verified: 0, partial: 0, unknown: 5 });
    expect(q.reconciliation).toEqual([]);
  });

  test("un snapshot déclaré donne des estimations, pas des preuves", () => {
    const q = assessDataQuality([trade("t", { date: "2026-10-22" })], {
      snapshots: [
        { accountId: "acc", balance: 10_000, observedAt: "2026-10-20T21:00:00Z", source: "user" },
      ],
      cash: [],
    });
    expect(q.balance).toEqual({ verified: 0, partial: 1, unknown: 0 });
  });
});
