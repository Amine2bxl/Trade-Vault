import { describe, it, expect } from "bun:test";
import { computeBehavioral, TREND_WINDOW_DAYS } from "../behavioral";
import type { Trade } from "../../types";

/**
 * Tendance PAR ERREUR — non-régression.
 *
 * La tendance agrégée (`weeklyTrend`) existait déjà, mais elle ne dit pas
 * LAQUELLE des erreurs s'améliore. Or « mon sur-trading a reculé de 40 % » est
 * la seule information de cette page qui donne envie d'y revenir.
 *
 * Ces tests verrouillent surtout ce que le produit refuse d'affirmer : pas de
 * tendance sans point de comparaison, et pas de fausse amélioration pour un
 * trader en pause.
 */

function trade(date: string, mistakes: string[], pnl = -100): Trade {
  return {
    id: `${date}-${mistakes.join("-")}-${Math.random()}`,
    date,
    symbol: "NAS100",
    direction: "long",
    entryTime: "10:00",
    pnl,
    rMultiple: -1,
    riskAmount: 100,
    strategy: "breakout",
    notes: "",
    mistakes,
  } as unknown as Trade;
}

/** Jour ISO décalé de `n` jours avant la référence. */
function daysBefore(ref: string, n: number): string {
  const d = new Date(ref + "T12:00:00");
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const REF = "2026-08-05";

describe("tendance par erreur", () => {
  it("détecte un RECUL et le rapporte en pourcentage", () => {
    const trades = [
      // Fenêtre précédente : 4 occurrences
      ...[40, 45, 50, 55].map((n) => trade(daysBefore(REF, n), ["Overtrading"])),
      // Fenêtre récente : 1 occurrence
      trade(daysBefore(REF, 5), ["Overtrading"]),
    ];
    const row = computeBehavioral(trades).rows.find((r) => r.mistake === "Overtrading");
    expect(row?.trend).toEqual({ recent: 1, previous: 4, deltaPct: -75 });
  });

  it("rapporte une AGGRAVATION telle quelle, sans adoucissement", () => {
    const trades = [
      trade(daysBefore(REF, 45), ["Revenge trading"]),
      ...[2, 4, 6].map((n) => trade(daysBefore(REF, n), ["Revenge trading"])),
    ];
    const row = computeBehavioral(trades).rows.find((r) => r.mistake === "Revenge trading");
    expect(row?.trend?.deltaPct).toBe(200);
  });

  it("null quand la fenêtre précédente est VIDE — une erreur nouvelle n'a pas de tendance", () => {
    // Sans ce garde-fou, une erreur apparue cette semaine afficherait une
    // variation inventée à partir d'une division par zéro.
    const trades = [trade(daysBefore(REF, 3), ["FOMO entry"])];
    const row = computeBehavioral(trades).rows.find((r) => r.mistake === "FOMO entry");
    expect(row?.trend).toBeNull();
  });

  it("un trader EN PAUSE ne voit pas ses erreurs « reculer » artificiellement", () => {
    // Les fenêtres s'adossent à la dernière date JOURNALISÉE, pas à aujourd'hui.
    // Sinon, ne plus trader suffirait à afficher une amélioration.
    const old = "2026-01-15";
    const trades = [
      ...[0, 2, 4].map((n) => trade(daysBefore(old, n), ["Overtrading"])),
      ...[35, 37].map((n) => trade(daysBefore(old, n), ["Overtrading"])),
    ];
    const row = computeBehavioral(trades).rows.find((r) => r.mistake === "Overtrading");
    expect(row?.trend).toEqual({ recent: 3, previous: 2, deltaPct: 50 });
  });

  it("ignore ce qui précède les deux fenêtres", () => {
    const trades = [
      // Bien au-delà de 2 × la fenêtre : ne doit compter dans aucune des deux.
      trade(daysBefore(REF, TREND_WINDOW_DAYS * 2 + 30), ["Overtrading"]),
      trade(daysBefore(REF, 40), ["Overtrading"]),
      trade(daysBefore(REF, 5), ["Overtrading"]),
    ];
    const row = computeBehavioral(trades).rows.find((r) => r.mistake === "Overtrading");
    expect(row?.trend).toEqual({ recent: 1, previous: 1, deltaPct: 0 });
  });

  it("aucun trade = aucune ligne, aucune exception", () => {
    expect(computeBehavioral([]).rows).toEqual([]);
  });
});
