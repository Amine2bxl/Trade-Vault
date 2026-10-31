import { describe, expect, test } from "bun:test";
import { parseCsv, guessMapping, mapRowsToTrades } from "../src/app/features/journal/csvImport";
import { readStrategyCsv } from "../src/app/features/monte-carlo/strategyCsv";
import {
  historicalModel,
  projectStrategy,
  type StrategyConfig,
} from "../src/modules/probability/strategy";

/**
 * « LE CSV DONNE UNE SIMULATION PLATE. »
 *
 * Un export courtier ne fournit presque jamais de multiple R. Rejouer des R
 * nuls dessinait une droite au solde de départ. La chaîne CANONIQUE
 * (`readStrategyCsv` → `historicalModel` → `projectStrategy`, celle que la
 * page Monte Carlo exécute) prend la perte médiane comme unité ESTIMÉE,
 * comptée à part (`estimated`), jamais présentée comme un R mesuré.
 *
 * Lot 6 : ces tests visaient l'ancien moteur `monteCarloEngine`, retiré ;
 * ils portent désormais sur la chaîne réellement montée.
 */

const CSV_COURTIER = [
  "Date,Symbol,Side,P&L",
  "2026-01-05,EURUSD,Buy,-100",
  "2026-01-06,EURUSD,Sell,250",
  "2026-01-07,GBPUSD,Buy,-100",
  "2026-01-08,GBPUSD,Sell,-50",
  "2026-01-09,EURUSD,Buy,400",
  "2026-01-12,US30,Sell,-100",
  "2026-01-13,US30,Buy,180",
  "2026-01-14,EURUSD,Sell,-200",
  "2026-01-15,GBPUSD,Buy,320",
  "2026-01-16,US30,Sell,-100",
].join("\n");

describe("la lecture du fichier", () => {
  test("les colonnes d'un export courtier sont devinées", () => {
    const { headers, rows } = parseCsv(CSV_COURTIER);
    const mapping = guessMapping(headers);
    expect(mapping.date).toBe(0);
    expect(mapping.symbol).toBe(1);
    expect(mapping.pnl).toBe(3);
    const { valid } = mapRowsToTrades(rows, mapping);
    expect(valid.length).toBe(10);
    // Le point de départ du bug : le courtier ne fournit aucun R.
    expect(valid.every((t) => t.rMultiple === 0)).toBe(true);
  });
});

describe("l'unité de risque d'un fichier sans R", () => {
  test("tirée de la perte MÉDIANE, et signalée comme estimée", () => {
    const model = readStrategyCsv(CSV_COURTIER);
    // Pertes du fichier : 50, 100, 100, 100, 200 → médiane 100.
    // −100 vaut donc exactement −1 R, et +250 vaut +2,5 R.
    expect(model.values).toContain(-1);
    expect(model.values).toContain(2.5);
    expect(model.sampleSize).toBe(10);
    expect(model.estimated).toBe(10);
  });

  test("des R déjà déclarés ne sont pas retouchés", () => {
    // Écraser des R fournis serait pire que de n'en dériver aucun : on
    // remplacerait une mesure par une estimation.
    const model = historicalModel([
      { pnl: -100, rMultiple: -1 },
      { pnl: 300, rMultiple: 3 },
    ]);
    expect(model.values).toEqual([-1, 3]);
    expect(model.estimated).toBe(0);
  });

  test("sans aucune perte, aucune échelle n'est inventée", () => {
    const model = historicalModel([
      { pnl: 100, rMultiple: 0 },
      { pnl: 250, rMultiple: 0 },
    ]);
    expect(model.values).toEqual([]);
    expect(model.estimated).toBe(0);
  });
});

describe("ce que la simulation en fait", () => {
  const config: StrategyConfig = {
    balance: 10000,
    risk: 100,
    trades: 30,
    perDay: 2,
    extraCost: 0,
    target: 1000,
    lossLimit: 1000,
    dailyLimit: 0,
    drawdownType: "static",
    seed: 7182,
  };

  test("un CSV courtier produit une simulation VIVANTE", () => {
    const r = projectStrategy(readStrategyCsv(CSV_COURTIER), config, 200);
    // Le symptôme exact du bug : tous les chemins finissaient au solde de départ.
    const fin = r.capital.at(-1)!;
    expect(fin.p95).toBeGreaterThan(fin.p5);
    expect(fin.p50).not.toBe(config.balance);
    expect(r.passProbability + r.failProbability).toBeLessThanOrEqual(1);
    expect(r.passProbability).toBeGreaterThan(0);
  });
});
