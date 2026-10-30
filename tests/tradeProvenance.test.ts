import { describe, expect, test } from "bun:test";
import {
  isMissingProvenanceColumn,
  provenanceAfterEdit,
  provenanceColumns,
  provenanceFromRow,
  selectWithProvenance,
} from "../src/domain/tradeProvenance";
import { measuredR } from "../src/domain/trade";
import { loadTradesWithMeta } from "../src/backend/ai-tools/trades";
import { serviceClient } from "../src/backend/billing.server";
import { generateReportForUser } from "../src/backend/monthly-reports.server";
import { withFakePostgrest, type Row } from "./helpers/fakePostgrest";

/**
 * PROVENANCE EN BASE (lot 1) — ce qui s'écrit, ce qui se lit, et ce qui se
 * passe quand la base n'a pas encore les colonnes.
 */

describe("écriture : seulement ce qui est connu", () => {
  test("une valeur inconnue n'écrase jamais une valeur en base", () => {
    expect(provenanceColumns({ source: null, riskSource: null, importKey: null })).toEqual({});
    expect(provenanceColumns({ source: "csv", riskSource: "user" })).toEqual({
      source: "csv",
      risk_source: "user",
    });
  });

  test("un instant `null` EXPLICITE s'efface, un instant absent ne bouge pas", () => {
    expect(provenanceColumns({ entryAt: null, exitAt: null })).toEqual({
      entry_at: null,
      exit_at: null,
    });
    expect(provenanceColumns({})).toEqual({});
  });
});

describe("lecture : une valeur hors liste est inconnue", () => {
  test("rien n'est deviné", () => {
    expect(provenanceFromRow({ source: "fax", risk_source: "guess" })).toEqual({
      source: null,
      riskSource: null,
      sourceTimezone: null,
      entryAt: null,
      exitAt: null,
      importKey: null,
    });
  });
});

describe("base antérieure à la migration", () => {
  test("reconnaît le refus d'une colonne de provenance — et seulement celui-là", () => {
    expect(
      isMissingProvenanceColumn({
        code: "PGRST204",
        message: "Could not find the 'entry_at' column of 'trades' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingProvenanceColumn({
        code: "42703",
        message: "column trades.risk_source does not exist",
      }),
    ).toBe(true);
    expect(
      isMissingProvenanceColumn({ code: "42703", message: "column trades.fees does not exist" }),
    ).toBe(false);
    expect(isMissingProvenanceColumn({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingProvenanceColumn(null)).toBe(false);
  });

  test("la lecture est rejouée sans les colonnes, une seule fois", async () => {
    const seen: string[] = [];
    const res = await selectWithProvenance(async (extra) => {
      seen.push(extra);
      return extra
        ? { data: null, error: { code: "42703", message: "column trades.entry_at does not exist" } }
        : { data: [1], error: null };
    });
    expect(seen).toEqual([
      ", source, risk_source, source_timezone, entry_at, exit_at, import_key",
      "",
    ]);
    expect(res.data).toEqual([1]);
  });

  test("une autre erreur n'est pas maquillée en repli", async () => {
    let calls = 0;
    const res = await selectWithProvenance(async () => {
      calls++;
      return { data: null, error: { code: "XX000", message: "boom" } };
    });
    expect(calls).toBe(1);
    expect(res.error).toEqual({ code: "XX000", message: "boom" });
  });
});

describe("le formulaire du trade", () => {
  const base = {
    date: "2026-10-21",
    entryTime: "09:30",
    exitTime: "09:45",
    riskAmount: 100,
    source: "broker" as const,
    riskSource: "broker_default" as const,
    sourceTimezone: "Europe/Paris",
    entryAt: "2026-10-21T13:30:00.000Z",
    exitAt: "2026-10-21T13:45:00.000Z",
    importKey: null,
  };

  test("une saisie neuve est manuelle ; son risque est déclaré par le trader", () => {
    expect(provenanceAfterEdit(null, { ...base, riskAmount: 50 })).toMatchObject({
      source: "manual",
      riskSource: "user",
      entryAt: null,
    });
    expect(provenanceAfterEdit(null, { ...base, riskAmount: 0 }).riskSource).toBeNull();
  });

  test("enregistrer sans toucher au risque n'en fait pas une déclaration", () => {
    const p = provenanceAfterEdit(base, base);
    expect(p.riskSource).toBe("broker_default");
    expect(p.entryAt).toBe(base.entryAt);
    expect(p.sourceTimezone).toBe("Europe/Paris");
  });

  test("un risque ressaisi devient celui du trader — et mesure un R une fois relu", () => {
    const p = provenanceAfterEdit(base, { ...base, riskAmount: 80 });
    expect(p.riskSource).toBe("user");
    expect(
      measuredR({ pnl: 160, riskAmount: 80, broker: "tradovate", reviewPending: false, ...p }),
    ).toBe(2);
  });

  test("une heure corrigée retire les instants qui ne la prouvent plus", () => {
    const p = provenanceAfterEdit(base, { ...base, entryTime: "09:31" });
    expect(p.entryAt).toBeNull();
    expect(p.exitAt).toBeNull();
    // …et `null` explicite les efface en base.
    expect(provenanceColumns(p)).toMatchObject({ entry_at: null, exit_at: null });
  });
});

function row(i: number, over: Row = {}): Row {
  return {
    id: `t${String(i).padStart(6, "0")}`,
    user_id: "u1",
    account_id: "acc1",
    trade_date: "2026-09-15",
    symbol: "NQ",
    direction: "long",
    pnl: 100,
    risk_amount: 50,
    r_multiple: 2,
    strategy: "ORB",
    mistakes: [],
    setup_quality: 3,
    entry_time: "09:35",
    exit_time: "10:05",
    confluences: [],
    confidence: 3,
    mae: null,
    mfe: null,
    broker: null,
    review_pending: false,
    ...over,
  };
}

describe("chargeur serveur (Jarvis, rapports)", () => {
  test("lit la provenance : un trade broker à stop observé garde son R côté serveur", async () => {
    const rows = [
      row(1, { broker: "tradovate", risk_source: "broker_stop", entry_at: "2026-09-15T13:35:00Z" }),
    ];
    await withFakePostgrest({ trades: rows }, async (db) => {
      const { trades } = await loadTradesWithMeta(serviceClient()!, "u1");
      expect(trades[0].riskSource).toBe("broker_stop");
      expect(trades[0].entryAt).toBe("2026-09-15T13:35:00Z");
      expect(measuredR(trades[0])).toBe(2);
      expect(db.callsTo("trades")[0].params.select).toContain("risk_source");
    });
  });

  test("base sans la migration : l'historique se lit quand même, provenance inconnue", async () => {
    await withFakePostgrest(
      { trades: [row(1, { broker: "tradovate", risk_source: "broker_stop" })] },
      async (db) => {
        const { trades } = await loadTradesWithMeta(serviceClient()!, "u1");
        expect(trades).toHaveLength(1);
        const calls = db.callsTo("trades");
        expect(calls).toHaveLength(2);
        expect(calls[1].params.select).not.toContain("risk_source");
      },
      { missingColumns: ["entry_at"] },
    );
  });

  test("le rapport mensuel lit TOUT le mois, au-delà de 1 000 trades", async () => {
    // L'ancienne lecture, sans `.range()`, s'arrêtait en silence à 1 000.
    const rows = Array.from({ length: 1_500 }, (_, i) => row(i));
    await withFakePostgrest(
      { trades: rows, profiles: [{ id: "u1", starting_balance: 50_000, language: "fr" }] },
      async (db) => {
        const report = await generateReportForUser(serviceClient()!, "u1", "2026-09", {
          withAi: false,
        });
        expect(report?.trades).toBe(1_500);
        expect(db.writes.filter((w) => w.table === "monthly_reports")).toHaveLength(1);
      },
      { acceptWrites: ["monthly_reports"], maxRows: 1_000 },
    );
  });
});
