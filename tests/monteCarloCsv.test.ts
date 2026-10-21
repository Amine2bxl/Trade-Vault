import { describe, expect, test } from "bun:test";
import { parseCsv, guessMapping, mapRowsToTrades } from "../src/app/features/journal/csvImport";
import { deriveRFromPnl, extractRSamples } from "../src/app/features/monte-carlo/monteCarloEngine";
import { modelFromSamples, poolsFromSamples } from "../src/app/features/monte-carlo/strategy";
import { simulateAll, summarize } from "../src/app/features/monte-carlo/simulation";

/**
 * L'IMPORT CSV DE MONTE-CARLO, DE BOUT EN BOUT.
 *
 * ── POURQUOI CE FICHIER ─────────────────────────────────────────────────────
 *
 * C'est la branche que PERSONNE ne peut vérifier à l'œil. Le journal et la
 * saisie manuelle produisent des trades dont on connaît la forme ; un export de
 * courtier, non. Et son mode d'échec est silencieux : le fichier est lu, le
 * nombre de trades s'affiche, les graphes se dessinent — parfaitement plats.
 *
 * La cause : un export de courtier ne porte presque jamais de multiple R. Il
 * donne un P&L et rien qui dise ce que le trade RISQUAIT, donc `rMultiple`
 * retombe à 0 sur chaque ligne. Or Monte-Carlo rejoue des R : nourri de zéros,
 * il ne bouge pas. Soixante trades importés, une courbe droite, 0 % de
 * réussite quels que soient les réglages — et rien à l'écran qui dise
 * pourquoi.
 *
 * `deriveRFromPnl` répare ça en lisant l'unité de risque DANS le fichier (la
 * perte médiane). Ces tests vérifient la chaîne complète, du texte brut au
 * résultat simulé.
 */

/** Un export de courtier typique : des dates, des symboles, un P&L. Aucun R. */
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
    expect(headers.length).toBeGreaterThan(0);
    expect(rows.length).toBe(10);

    const { valid } = mapRowsToTrades(rows, guessMapping(headers));
    // Le seuil de la page est de 5 : en dessous, elle refuse le fichier.
    expect(valid.length).toBeGreaterThanOrEqual(5);
    expect(valid.some((t) => t.pnl !== 0)).toBe(true);
  });
});

describe("la dérivation du multiple R", () => {
  test("un fichier sans R en reçoit un, tiré de sa perte MÉDIANE", () => {
    const { headers, rows } = parseCsv(CSV_COURTIER);
    const { valid } = mapRowsToTrades(rows, guessMapping(headers));

    // Le point de départ du bug : le courtier ne fournit aucun R.
    expect(valid.every((t) => t.rMultiple === 0)).toBe(true);

    const normalises = deriveRFromPnl(valid);
    expect(normalises.some((t) => t.rMultiple !== 0)).toBe(true);

    // Pertes du fichier : 50, 100, 100, 100, 200 → médiane 100.
    // Un trade à −100 vaut donc exactement −1 R, et un trade à +250 vaut +2,5 R.
    const perte100 = normalises.find((t) => t.pnl === -100);
    const gain250 = normalises.find((t) => t.pnl === 250);
    expect(perte100?.rMultiple).toBe(-1);
    expect(gain250?.rMultiple).toBe(2.5);
  });

  test("un fichier qui porte DÉJÀ des R n'est pas retouché", () => {
    // Écraser des R fournis par le courtier serait pire que de n'en dériver
    // aucun : on remplacerait une mesure par une estimation.
    const avecR = [
      { pnl: -100, rMultiple: -1 },
      { pnl: 300, rMultiple: 3 },
    ];
    expect(deriveRFromPnl(avecR)).toEqual(avecR);
  });

  test("un fichier SANS aucune perte est rendu tel quel", () => {
    // Aucune perte = aucune unité de risque à en tirer. Inventer une échelle
    // vaudrait moins que de ne rien faire.
    const queDesGains = [
      { pnl: 100, rMultiple: 0 },
      { pnl: 250, rMultiple: 0 },
    ];
    expect(deriveRFromPnl(queDesGains)).toEqual(queDesGains);
  });
});

describe("ce que la simulation en fait", () => {
  /** La chaîne complète, telle que la page l'exécute. */
  function lireCsv(csv: string) {
    const { headers, rows } = parseCsv(csv);
    const { valid } = mapRowsToTrades(rows, guessMapping(headers));
    return valid;
  }
  function simulerDepuisCsv(csv: string) {
    const samples = extractRSamples(deriveRFromPnl(lireCsv(csv)));
    const pools = poolsFromSamples(samples);
    if (!pools) throw new Error("aucune forme");
    return simulateAll({
      model: modelFromSamples(samples),
      pools,
      balance: 10000,
      risk: 100,
      tradesPerDay: 2,
      days: 30,
      targetPct: 10,
      limitPct: 10,
      runs: 200,
      seed: 1,
    });
  }

  test("un CSV normalisé produit une simulation VIVANTE", () => {
    const sim = simulerDepuisCsv(CSV_COURTIER);
    expect(sim.done).toBe(200);

    // Le symptôme exact du bug : tous les chemins finissent au solde de départ,
    // parce qu'on rejouait des R nuls.
    const finaux = new Set(Array.from(sim.final, (b) => Math.round(b)));
    expect(finaux.size).toBeGreaterThan(1);
    expect([...finaux].some((b) => b !== 10000)).toBe(true);

    // Et les trois issues somment bien à 1 : c'est ce que les chiffres de la
    // page affichent.
    const r = summarize(sim);
    const somme = r.passRate + r.failRate + r.openRate;
    expect(somme).toBeGreaterThan(0.999);
    expect(somme).toBeLessThan(1.001);
  });

  test("SANS la dérivation, aucune forme à rejouer — la régression, nommée", () => {
    // Ce test documente le bug plutôt que de le corriger : il montre ce que
    // donne la chaîne quand on retire `deriveRFromPnl`. Des R nuls ne laissent
    // ni gain ni perte exploitable : la page refuserait le fichier (avant, elle
    // l'acceptait et simulait une courbe plate à 0 %).
    const brut = extractRSamples(lireCsv(CSV_COURTIER));
    expect(brut.every((s) => s.r === 0)).toBe(true);
    expect(poolsFromSamples(brut)).toBeNull();
  });

  test("le modèle du fichier est exploitable", () => {
    // C'est lui qui préremplit le plan : taux de réussite, gain et perte moyens.
    const samples = extractRSamples(deriveRFromPnl(lireCsv(CSV_COURTIER)));
    expect(samples.length).toBeGreaterThanOrEqual(5);
    const m = modelFromSamples(samples);
    expect(m.winRate).toBeGreaterThan(0);
    expect(m.avgWinR).toBeGreaterThan(0);
    // Pertes du fichier en R : 1, 1, 0,5, 1, 2, 1 → moyenne 6,5 / 6.
    expect(m.avgLossR).toBeCloseTo(6.5 / 6, 6);
  });
});
