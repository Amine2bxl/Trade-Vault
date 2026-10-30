import { describe, expect, test } from "bun:test";
import {
  balanceBeforeEntry,
  reconcileSnapshots,
  verifiedBalances,
  type BalanceLedger,
  type BalanceSnapshot,
  type BalanceTrade,
  type CashMovement,
} from "../src/domain/balanceAtEntry";

/**
 * SOLDE AVANT L'ENTRÉE (lot 1) — VERIFIED seulement avec toutes les preuves,
 * PARTIAL quand un montant s'estime sans se prouver, UNKNOWN sinon.
 */

const A = "acc-a";

function snap(
  balance: number,
  observedAt: string,
  source: BalanceSnapshot["source"] = "broker",
): BalanceSnapshot {
  return { accountId: A, balance, observedAt, source };
}

function trade(id: string, over: Partial<BalanceTrade> = {}): BalanceTrade {
  return { id, accountId: A, date: "2026-10-21", pnl: 0, fees: 2, broker: "tradovate", ...over };
}

function cash(
  amount: number,
  occurredAt: string,
  source: CashMovement["source"] = "broker",
): CashMovement {
  return { accountId: A, amount, occurredAt, source };
}

// Lundi 19 → mercredi 21 octobre 2026 (heure d'été : New York = UTC−4).
const before = trade("before", {
  date: "2026-10-20",
  pnl: 300,
  entryAt: "2026-10-20T13:35:00Z",
  exitAt: "2026-10-20T13:50:00Z",
});
const target = trade("target", {
  pnl: -150,
  entryAt: "2026-10-21T14:00:00Z",
  exitAt: "2026-10-21T14:20:00Z",
});
const after = trade("after", {
  pnl: 50,
  entryAt: "2026-10-21T15:00:00Z",
  exitAt: "2026-10-21T15:10:00Z",
});

function ledger(over: Partial<BalanceLedger> = {}): BalanceLedger {
  return {
    // 50 000 lundi soir ; mardi +300 ; retrait −1 000 mardi soir ; mercredi
    // −150 puis +50 → 49 200 observés mercredi soir.
    snapshots: [snap(50_000, "2026-10-19T21:00:00Z"), snap(49_200, "2026-10-21T21:00:00Z")],
    cash: [cash(-1_000, "2026-10-20T22:00:00Z")],
    trades: [before, target, after],
    ...over,
  };
}

describe("VERIFIED : toutes les preuves, et l'intervalle réconcilié", () => {
  test("snapshot broker + trades horodatés + retrait broker, rapprochés au cent", () => {
    const b = balanceBeforeEntry(target, ledger());
    expect(b).toEqual({ status: "VERIFIED", balance: 49_300, gaps: [] });
    // Le trade suivant voit la perte du précédent, déjà clôturée.
    expect(balanceBeforeEntry(after, ledger()).balance).toBe(49_150);
  });

  test("verifiedBalances ne rend que les soldes VERIFIED", () => {
    const map = verifiedBalances([before, target, after], ledger());
    expect(map.get("target")).toBe(49_300);
    expect(map.get("before")).toBe(50_000);
  });
});

describe("PARTIAL : un montant, jamais un verdict", () => {
  test("snapshot sans le retrait historique : l'écart à la réconciliation l'empêche d'être vérifié", () => {
    // Le retrait de 1 000 $ n'a jamais été saisi : le snapshot suivant ne
    // se rapproche plus. Le solde estimé (50 300) est FAUX — il le dit.
    const b = balanceBeforeEntry(target, ledger({ cash: [] }));
    expect(b.status).toBe("PARTIAL");
    expect(b.balance).toBe(50_300);
    expect(b.gaps).toEqual(["interval_unreconciled"]);
    expect(verifiedBalances([target], ledger({ cash: [] })).has("target")).toBe(false);
  });

  test("aucun snapshot après l'entrée : rien ne prouve qu'aucun mouvement ne manque", () => {
    const b = balanceBeforeEntry(
      target,
      ledger({ snapshots: [snap(50_000, "2026-10-19T21:00:00Z")] }),
    );
    expect(b.status).toBe("PARTIAL");
    expect(b.gaps).toContain("interval_unreconciled");
  });

  test("un solde DÉCLARÉ par le trader n'est pas une observation", () => {
    const b = balanceBeforeEntry(
      target,
      ledger({
        snapshots: [
          snap(50_000, "2026-10-19T21:00:00Z", "user"),
          snap(49_200, "2026-10-21T21:00:00Z"),
        ],
      }),
    );
    expect(b.status).toBe("PARTIAL");
    expect(b.gaps).toContain("declared_snapshot");
  });

  test("un retrait déclaré à la main reste une déclaration", () => {
    const b = balanceBeforeEntry(
      target,
      ledger({ cash: [cash(-1_000, "2026-10-20T22:00:00Z", "user")] }),
    );
    expect(b.status).toBe("PARTIAL");
    expect(b.gaps).toContain("declared_cashflow");
  });

  test("des frais broker inconnus font du P&L un brut", () => {
    const gross = { ...before, fees: null };
    const b = balanceBeforeEntry(target, ledger({ trades: [gross, target, after] }));
    expect(b.status).toBe("PARTIAL");
    expect(b.gaps).toContain("fees_unknown");
  });

  test("une entrée sans instant se place au jour seulement", () => {
    const manual = trade("manual", { pnl: 10, broker: null, entryAt: null, exitAt: null });
    const b = balanceBeforeEntry(manual, ledger({ trades: [before, manual] }));
    expect(b.status).toBe("PARTIAL");
    expect(b.gaps).toContain("entry_time_unproven");
    // Lundi soir 50 000 + mardi 300 − 1 000 de retrait mardi soir.
    expect(b.balance).toBe(49_300);
  });
});

describe("UNKNOWN : rien d'honnête à dire", () => {
  test("aucun snapshot avant l'entrée", () => {
    expect(
      balanceBeforeEntry(target, ledger({ snapshots: [snap(49_200, "2026-10-21T21:00:00Z")] })),
    ).toEqual({ status: "UNKNOWN", balance: null, gaps: ["no_snapshot"] });
  });

  test("le solde de départ du compte n'est PAS un snapshot", () => {
    expect(balanceBeforeEntry(target, { snapshots: [], cash: [], trades: [target] }).status).toBe(
      "UNKNOWN",
    );
  });

  test("un trade du même jour, sans heure prouvée, ne se place ni avant ni après", () => {
    const manual = trade("m", { pnl: 10, broker: null, entryAt: null, exitAt: null });
    const sameDay = trade("s", { pnl: 99, broker: null, entryAt: null, exitAt: null });
    const b = balanceBeforeEntry(manual, ledger({ trades: [manual, sameDay] }));
    expect(b).toEqual({ status: "UNKNOWN", balance: null, gaps: ["order_unproven"] });
  });

  test("un trade sans compte", () => {
    expect(balanceBeforeEntry({ ...target, accountId: null }, ledger()).status).toBe("UNKNOWN");
  });
});

describe("rapprochement des snapshots", () => {
  test("rapproché au cent, ou l'écart chiffré", () => {
    expect(reconcileSnapshots(ledger())[0]).toMatchObject({
      status: "reconciled",
      expected: 49_200,
      gap: 0,
    });
    const missing = reconcileSnapshots(ledger({ cash: [] }))[0];
    expect(missing.status).toBe("gap");
    expect(missing.gap).toBe(-1_000);
  });

  test("indéterminé quand un trade de l'intervalle n'est pas placé", () => {
    const unplaced = trade("u", { date: "2026-10-21", pnl: 5, entryAt: null, exitAt: null });
    expect(reconcileSnapshots(ledger({ trades: [before, unplaced] }))[0].status).toBe(
      "undetermined",
    );
  });
});
