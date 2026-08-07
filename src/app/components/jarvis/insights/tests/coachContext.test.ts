import { describe, it, expect } from "bun:test";
import { computeBehaviorSignals, type SignalBucket } from "../../../../utils/behaviorSignals";
import { slimSignals, keepExtremes, SIGNALS_CAP } from "../../../../utils/signalContext";
import { makeTrade } from "./fixtures";
import type { Trade } from "../../../../types";

/**
 * Sélection des signaux envoyés au coach — non-régression.
 *
 * Les buckets sont triés par P&L croissant en amont. Une troncature naïve
 * (`slice(0, n)`) ne garde donc que les perdants : le contraste disparaît et,
 * pour les setups, le meilleur est purement supprimé. Ces tests verrouillent le
 * comportement attendu : les DEUX extrémités survivent, et le plafond qui
 * protège le serveur (12 KB Zod) reste respecté.
 */

/** Semaine type : lundi→jeudi gagnants, vendredis perdants. 3 trades minimum
 *  par jour — seuil d'émission de `computeBehaviorSignals`. */
function weekdayTrader(): Trade[] {
  const trades: Trade[] = [];
  const winners = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"]; // lun→jeu
  const fridays = ["2026-08-07", "2026-08-14"];
  for (const d of winners) for (let i = 0; i < 3; i++) trades.push(makeTrade(d, 120));
  for (const d of fridays) for (let i = 0; i < 3; i++) trades.push(makeTrade(d, -140));
  return trades;
}

describe("keepExtremes", () => {
  it("conserve les deux extrémités d'une liste triée", () => {
    expect(keepExtremes([1, 2, 3, 4, 5, 6, 7, 8], 2)).toEqual([1, 2, 7, 8]);
  });

  it("ne touche pas une liste déjà courte", () => {
    expect(keepExtremes([1, 2, 3], 2)).toEqual([1, 2, 3]);
  });
});

describe("slimSignals — qualité du contexte", () => {
  it("conserve le jour perdant ET les jours gagnants (le contraste survit)", () => {
    const out = slimSignals(computeBehaviorSignals(weekdayTrader()));
    const byWeekday = out.byWeekday as SignalBucket[];

    expect(Array.isArray(byWeekday)).toBe(true);
    // Le sujet du diagnostic : le jour perdant.
    expect(byWeekday.map((b) => b.key)).toContain("Friday");
    // La référence qui rend le diagnostic percutant (« vs 64 % en semaine »).
    expect(byWeekday.filter((b) => b.pnl > 0).length).toBeGreaterThan(0);
  });

  it("ne tronque plus les jours de semaine à 4 buckets", () => {
    const out = slimSignals(computeBehaviorSignals(weekdayTrader()));
    const byWeekday = out.byWeekday as SignalBucket[];
    // 5 jours distincts atteignent le seuil — une troncature à 4 en perdrait un.
    expect(byWeekday.length).toBe(5);
  });

  it("respecte le plafond qui protège le serveur (12 KB Zod)", () => {
    const trades: Trade[] = [];
    for (let week = 0; week < 60; week++) {
      for (const day of ["03", "04", "05", "06", "07"]) {
        for (let i = 0; i < 3; i++) {
          trades.push(makeTrade(`2026-08-${day}`, week % 2 ? 80 : -60));
        }
      }
    }
    const out = slimSignals(computeBehaviorSignals(trades));
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(SIGNALS_CAP);
  });

  it("laisse intactes les sections non tabulaires", () => {
    const out = slimSignals(computeBehaviorSignals(weekdayTrader()));
    // `disciplinePct` est un scalaire : il ne doit jamais être transformé.
    if ("disciplinePct" in out) expect(typeof out.disciplinePct).toBe("number");
  });
});
