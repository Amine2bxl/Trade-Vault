import { describe, expect, test } from "bun:test";
import type { Trade } from "../src/domain/trade";
import { hasMeasuredRisk, measuredR, totalMeasuredR } from "../src/domain/trade";
import {
  computeStats,
  toInsightTradesPayload,
  withPnlFromRiskAndR,
} from "../src/domain/tradeCalcs";
import { computeQuantStats } from "../src/domain/quantStats";
import { buildMonthlyReport } from "../src/domain/monthlyReport";
import { dayTone } from "../src/app/features/calendar/calendarTone";
import { toTradeLikes } from "../src/modules/patterns/persist";

/**
 * UN SEUL « R MESURÉ » DANS TOUT LE PRODUIT (lot 0).
 *
 * Jeu de référence calculé À LA MAIN, sans appeler les fonctions testées :
 *
 *   a  manuel, risque 100, P&L +200          → +2R
 *   b  manuel, risque 100, P&L −100          → −1R
 *   c  manuel, risque 200, P&L −200          → −1R
 *   d  manuel, risque 0 (inconnu), P&L +300  → R inconnu (pas 0R)
 *   e  broker relu, risque 50, P&L +150      → R inconnu (provenance du risque)
 *   f  CSV non relu, risque 100, P&L +100    → R inconnu (pas confirmé)
 *
 * R mesuré : {+2, −1, −1} → n = 3, moyenne 0R, gains 2R, pertes −1R.
 * Couverture : 3 / 6 = 50 %. Total R : inconnu (trois trades sans R).
 */

function trade(id: string, over: Partial<Trade>): Trade {
  return {
    id,
    date: "2026-03-02",
    symbol: "NQ",
    direction: "long",
    pnl: 0,
    riskAmount: 0,
    rMultiple: 0,
    strategy: "ORB",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "",
    exitTime: "",
    confluences: [],
    confidence: 50,
    ...over,
  };
}

const ledger: Trade[] = [
  trade("a", { pnl: 200, riskAmount: 100, rMultiple: 2, entryTime: "09:30", exitTime: "09:40" }),
  trade("b", {
    pnl: -100,
    riskAmount: 100,
    rMultiple: -1,
    entryTime: "10:00",
    exitTime: "10:10",
    direction: "short",
  }),
  trade("c", { pnl: -200, riskAmount: 200, rMultiple: -1, entryTime: "10:30", exitTime: "10:40" }),
  // R stocké à 0 par compatibilité : la base n'a pas de « null » pour r_multiple.
  trade("d", { pnl: 300, riskAmount: 0, rMultiple: 0, entryTime: "11:00", exitTime: "11:10" }),
  trade("e", {
    pnl: 150,
    riskAmount: 50,
    rMultiple: 3,
    broker: "tradovate",
    entryTime: "11:30",
    exitTime: "11:40",
  }),
  trade("f", {
    pnl: 100,
    riskAmount: 100,
    rMultiple: 1,
    reviewPending: true,
    entryTime: "12:00",
    exitTime: "12:10",
  }),
];

describe("définition unique du R mesuré", () => {
  test("seuls les trades au risque saisi ou relu, hors broker, ont un R", () => {
    expect(ledger.map(measuredR)).toEqual([2, -1, -1, null, null, null]);
    expect(ledger.map(hasMeasuredRisk)).toEqual([true, true, true, false, false, false]);
  });

  test("le R vient du P&L net, pas de la colonne stockée", () => {
    // P&L net après frais : 195 $ pour un risque de 100 = 1,95R, même si 2 est stocké.
    expect(measuredR(trade("x", { pnl: 195, riskAmount: 100, rMultiple: 2 }))).toBe(1.95);
  });

  test("un total R n'existe que si chaque trade a un R mesuré", () => {
    expect(totalMeasuredR(ledger)).toBeNull();
    expect(totalMeasuredR(ledger.slice(0, 3))).toBe(0);
    expect(totalMeasuredR([])).toBeNull();
  });
});

describe("tous les consommateurs lisent le même R", () => {
  test("statistiques, quant et rapport mensuel concordent avec la référence", () => {
    const stats = computeStats(ledger);
    expect(stats.avgRR).toBe(0);
    expect(stats.rSampleSize).toBe(3);
    expect(stats.rCoveragePct).toBe(50);
    expect(stats.avgWinR).toBe(2);
    expect(stats.avgLossR).toBe(-1);

    expect(computeQuantStats(ledger).expectancyR).toBe(0);
    expect(buildMonthlyReport("2026-03", ledger, [], 25_000).expectancyR).toBe(0);
  });

  test("sans aucun R mesuré, le R moyen est inconnu, pas 0", () => {
    const unknown = ledger.slice(3);
    expect(computeStats(unknown).avgRR).toBeNull();
    expect(computeQuantStats(unknown).expectancyR).toBeNull();
  });

  test("la teinte du calendrier retombe sur le P&L dès qu'un trade n'a pas de R", () => {
    expect(dayTone(ledger.slice(0, 3)).unit).toBe("R");
    expect(dayTone(ledger).unit).toBe("pnl");
  });

  test("les motifs nocturnes et le contexte de Jarvis reçoivent la même vérité", () => {
    const rows = ledger.map((t) => ({
      trade_date: t.date,
      pnl: t.pnl,
      risk_amount: t.riskAmount,
      r_multiple: t.rMultiple,
      broker: t.broker ?? null,
      review_pending: !!t.reviewPending,
    }));
    expect(toTradeLikes(rows).map((t) => t.rMultiple)).toEqual([2, -1, -1, null, null, null]);

    const payload = toInsightTradesPayload(ledger);
    expect(payload.map((t) => t.rMultiple)).toEqual([2, -1, -1, null, null, null]);
    // La qualité par défaut d'un import non relu n'est pas une note du trader.
    expect(payload.map((t) => t.setupQuality)).toEqual([3, 3, 3, 3, 3, null]);
  });
});

describe("le P&L observé n'est jamais réécrit par une édition du risque", () => {
  test("saisir le risque d'un trade importé sans risque garde le P&L et en déduit le R", () => {
    const imported = trade("i", { pnl: 300, riskAmount: 0, rMultiple: 0 });
    const next = withPnlFromRiskAndR(imported, { riskAmount: 150 });
    expect(next.pnl).toBe(300);
    expect(next.rMultiple).toBe(2);
  });

  test("le P&L net d'un trade broker survit à une correction du risque", () => {
    const broker = trade("k", {
      pnl: 312.5,
      riskAmount: 100,
      rMultiple: 3.125,
      broker: "tradovate",
    });
    const next = withPnlFromRiskAndR(broker, { riskAmount: 125 });
    expect(next.pnl).toBe(312.5);
    expect(next.rMultiple).toBe(2.5);
  });

  test("un import non relu garde son P&L de fichier", () => {
    const pending = trade("p", { pnl: 87.4, riskAmount: 40, rMultiple: 2.19, reviewPending: true });
    expect(withPnlFromRiskAndR(pending, { riskAmount: 50 }).pnl).toBe(87.4);
  });

  test("un R saisi sans risque n'efface pas le P&L", () => {
    const unknown = trade("u", { pnl: 300, riskAmount: 0, rMultiple: 0 });
    expect(withPnlFromRiskAndR(unknown, { rMultiple: 2 }).pnl).toBe(300);
  });

  test("la convention d'une saisie manuelle reste « P&L = risque × R »", () => {
    const manual = trade("m", { pnl: 200, riskAmount: 100, rMultiple: 2 });
    expect(withPnlFromRiskAndR(manual, { riskAmount: 150 }).pnl).toBe(300);
    expect(withPnlFromRiskAndR(manual, { rMultiple: 3 }).pnl).toBe(300);
    expect(withPnlFromRiskAndR({ ...manual, direction: "be" }, {}).pnl).toBe(0);
  });
});
