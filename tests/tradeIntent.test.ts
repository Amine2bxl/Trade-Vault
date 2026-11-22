/**
 * L'intention d'un trade : le PRÉVU est figé à la création.
 *
 * Défaut corrigé : l'ancien upsert réécrivait `planned_risk` (et le setup, la
 * confiance) à chaque enregistrement — le « risque prévu » suivait le risque
 * édité, et tout écart prévu / réalisé se comparait à lui-même.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Trade } from "../src/domain/trade";

type Row = Record<string, unknown>;
let table: Row[] = [];
let legacySchema = false;

// Une base d'avant la migration ne connaît que `planned_risk` parmi ces colonnes.
const isNewColumn = (k: string) =>
  (k.startsWith("planned_") && k !== "planned_risk") || k.startsWith("initial_");

function reject(row: Row) {
  if (!legacySchema) return null;
  const col = Object.keys(row).find(isNewColumn);
  return col
    ? { code: "PGRST204", message: `Could not find the '${col}' column of 'trade_intent'` }
    : null;
}

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert: (row: Row, opts: { ignoreDuplicates?: boolean }) => {
        const error = reject(row);
        if (error) return Promise.resolve({ error });
        const i = table.findIndex((r) => r.trade_id === row.trade_id);
        if (i < 0) table.push({ ...row });
        else if (!opts?.ignoreDuplicates) table[i] = { ...table[i], ...row };
        return Promise.resolve({ error: null });
      },
      update: (patch: Row) => {
        const filters: Row = {};
        const chain = {
          eq: (k: string, v: unknown) => {
            filters[k] = v;
            if (Object.keys(filters).length < 2) return chain;
            const error = reject(patch);
            if (error) return Promise.resolve({ error });
            for (const r of table) {
              if (Object.entries(filters).every(([fk, fv]) => r[fk] === fv))
                Object.assign(r, patch);
            }
            return Promise.resolve({ error: null });
          },
        };
        return chain;
      },
    }),
  },
}));

const { saveTradeIntent, isIntentEmpty } = await import("../src/app/store/tradeIntel");

const trade = (riskAmount: number): Trade =>
  ({
    id: "t1",
    date: "2026-11-20",
    symbol: "NQ",
    direction: "short",
    pnl: 0,
    riskAmount,
    rMultiple: 0,
    strategy: "ICT",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:40",
    exitTime: "10:05",
    confluences: [],
    confidence: 70,
  }) as Trade;

const planned = {
  direction: "short" as const,
  entry: 21520,
  stop: 21560,
  target: 21450,
  scenario: "A" as const,
};

beforeEach(() => {
  table = [];
  legacySchema = false;
});

describe("saveTradeIntent", () => {
  test("le prévu ne bouge plus après la création", async () => {
    await saveTradeIntent("u1", trade(200), {
      emotion: "calm",
      reasoning: "SSL",
      plan: null,
      planned,
    });
    await saveTradeIntent("u1", trade(450), {
      emotion: "anxious",
      reasoning: "SSL puis MSS",
      plan: null,
      planned: { ...planned, entry: 99999 },
      initialStop: 21565,
    });
    expect(table).toHaveLength(1);
    const row = table[0];
    expect(row.planned_risk).toBe(200);
    expect(row.planned_entry).toBe(21520);
    expect(row.planned_scenario).toBe("A");
    // Le corrigeable suit la dernière saisie.
    expect(row.emotion).toBe("anxious");
    expect(row.reasoning).toBe("SSL puis MSS");
    expect(row.initial_stop).toBe(21565);
  });

  test("base sans la migration : l'intention de base s'écrit quand même", async () => {
    legacySchema = true;
    const ok = await saveTradeIntent("u1", trade(200), {
      emotion: "focused",
      reasoning: null,
      plan: "short sous 21 520",
      planned,
      initialStop: 21560,
    });
    expect(ok).toBe(true);
    expect(table[0].planned_risk).toBe(200);
    expect(table[0].plan).toBe("short sous 21 520");
    expect(table[0].planned_entry).toBeUndefined();
  });

  test("un stop posé seul suffit à garder l'intention", () => {
    expect(isIntentEmpty({ emotion: null, reasoning: null, plan: null })).toBe(true);
    expect(isIntentEmpty({ emotion: null, reasoning: null, plan: null, initialStop: 21560 })).toBe(
      false,
    );
    expect(isIntentEmpty({ emotion: null, reasoning: " ", plan: null, planned })).toBe(false);
  });
});
