import { describe, expect, test } from "bun:test";
import {
  parseCsv,
  parseDateTime,
  guessMapping,
  mapRowsToTrades,
  MC_REQUIRED,
} from "../src/app/utils/csvImport";
import { deriveRFromPnl, extractRSamples } from "../src/app/utils/monteCarlo";

/**
 * « LE CSV NE MARCHE PAS. »
 *
 * ── CE QUI A ÉTÉ MESURÉ ─────────────────────────────────────────────────────
 *
 * Cinq exports de courtiers réalistes passés dans la chaîne exacte de la page
 * Monte-Carlo. QUATRE sur cinq rendaient ZÉRO trade — et l'écran n'affichait
 * qu'un « trop peu de trades (0) » qui ne dit ni quelle colonne manque ni
 * pourquoi.
 *
 * Trois causes distinctes, chacune vérifiée ici :
 *
 *   1. LE SYMBOLE ÉTAIT OBLIGATOIRE. `REQUIRED` vaut date + symbole + P&L —
 *      juste pour le JOURNAL, où un trade sans instrument n'a pas de sens.
 *      Monte-Carlo, lui, rejoue des gains et des pertes : le symbole ne lui
 *      sert à rien, et l'exiger rejetait tout export « date + résultat », le
 *      plus courant des exports simples.
 *   2. DES EN-TÊTES DE DATE TRÈS RÉPANDUS N'ÉTAIENT PAS RECONNUS —
 *      « Heure » (MT5 français), « Timestamp » (Tradovate), « Trade Date ».
 *      Sans colonne date, chaque ligne était rejetée.
 *   3. LE FORMAT DE DATE MT4/MT5 `2026.01.05 09:12` n'était lu par aucune des
 *      deux expressions de `parseDateTime`.
 *
 * Ces tests reproduisent les fichiers, pas les fonctions : c'est le fichier
 * réel qui échouait, et c'est lui qu'il faut voir passer.
 */

/** Les cinq fichiers de la mesure, tels quels. */
const EXPORTS: Record<string, string> = {
  /* Un export « résultat seul » : aucune colonne d'instrument. */
  pnlSeul: [
    "Date,Profit",
    "2026-01-05,-100",
    "2026-01-06,250",
    "2026-01-07,-100",
    "2026-01-08,-50",
    "2026-01-09,400",
    "2026-01-12,-100",
  ].join("\n"),

  /* MetaTrader 5, interface française : « Heure », « Symbole », « Profit »,
     et le format de date à points. */
  mt5fr: [
    "Heure,Symbole,Type,Volume,Profit",
    "2026.01.05 09:12,EURUSD,buy,0.5,-100",
    "2026.01.06 10:01,EURUSD,sell,0.5,250",
    "2026.01.07 11:20,GBPUSD,buy,0.3,-100",
    "2026.01.08 09:05,GBPUSD,sell,0.3,-50",
    "2026.01.09 14:00,EURUSD,buy,1,400",
    "2026.01.12 08:30,US30,sell,1,-100",
  ].join("\n"),

  /* Tradovate : « Timestamp » au lieu de « Date ». */
  tradovate: [
    "Timestamp,Contract,B/S,Realized P&L",
    "01/05/2026 09:12,ESH6,Buy,-100",
    "01/06/2026 10:01,ESH6,Sell,250",
    "01/07/2026 11:20,NQH6,Buy,-100",
    "01/08/2026 09:05,NQH6,Sell,-50",
    "01/09/2026 14:00,ESH6,Buy,400",
    "01/12/2026 08:30,ESH6,Sell,-100",
  ].join("\n"),

  /* En-têtes verbeux, comme en produisent les plateformes propriétaires. */
  verbeux: [
    "Trade Date,Instrument Name,Net Result (USD)",
    "2026-01-05,EUR/USD,-100",
    "2026-01-06,EUR/USD,250",
    "2026-01-07,GBP/USD,-100",
    "2026-01-08,GBP/USD,-50",
    "2026-01-09,EUR/USD,400",
    "2026-01-12,US30,-100",
  ].join("\n"),

  /* Celui qui passait déjà : il doit continuer. */
  devise: [
    "Date,Symbol,P/L",
    '2026-01-05,EURUSD,"-$100.00"',
    '2026-01-06,EURUSD,"$250.00"',
    '2026-01-07,GBPUSD,"-$100.00"',
    '2026-01-08,GBPUSD,"-$50.00"',
    '2026-01-09,EURUSD,"$400.00"',
    '2026-01-12,US30,"-$100.00"',
  ].join("\n"),
};

/** La chaîne exacte que la page Monte-Carlo exécute sur un fichier déposé. */
function lireCommeMonteCarlo(csv: string) {
  const { headers, rows } = parseCsv(csv);
  return mapRowsToTrades(rows, guessMapping(headers), { required: MC_REQUIRED });
}

describe("les formats de date des courtiers", () => {
  test("MetaTrader écrit ses dates avec des POINTS", () => {
    // `2026.01.05 09:12` — ni l'ISO ni le format US ne l'attrapaient, donc
    // chaque ligne d'un export MT4/MT5 était rejetée pour date illisible.
    expect(parseDateTime("2026.01.05 09:12")).toEqual({ date: "2026-01-05", time: "09:12" });
    expect(parseDateTime("2026.01.05")).toEqual({ date: "2026-01-05", time: "" });
  });

  test("la barre oblique en ordre ISO est lue comme une date ISO", () => {
    expect(parseDateTime("2026/01/05 14:30")).toEqual({ date: "2026-01-05", time: "14:30" });
  });

  test("ce qui marchait continue de marcher", () => {
    expect(parseDateTime("2026-01-05T09:12")).toEqual({ date: "2026-01-05", time: "09:12" });
    expect(parseDateTime("01/05/2026 2:30 PM")).toEqual({ date: "2026-01-05", time: "14:30" });
    expect(parseDateTime("pas une date")).toBeNull();
  });
});

describe("les en-têtes que les courtiers utilisent vraiment", () => {
  const casDate: [string, string][] = [
    ["MT5 français", "Heure"],
    ["Tradovate", "Timestamp"],
    ["verbeux", "Trade Date"],
    ["générique", "Time"],
  ];
  for (const [courtier, entete] of casDate) {
    test(`« ${entete} » (${courtier}) est reconnu comme la date`, () => {
      const map = guessMapping([entete, "Symbol", "P&L"]);
      expect(map.date).toBe(0);
    });
  }

  test("« Net Result (USD) » est reconnu comme le P&L", () => {
    const map = guessMapping(["Trade Date", "Instrument Name", "Net Result (USD)"]);
    expect(map.pnl).toBe(2);
  });

  test("une colonne d'heure NE VOLE PAS la colonne de date", () => {
    // « Time » vient d'entrer dans les synonymes de `date`. Sur un fichier qui
    // porte les DEUX, la vraie date doit gagner — sinon on aurait réparé un
    // format en cassant tous les autres.
    const map = guessMapping(["Date", "Time", "Symbol", "P&L"]);
    expect(map.date).toBe(0);
  });
});

describe("ce que Monte-Carlo exige d'un fichier", () => {
  test("le symbole n'est PAS exigé — Monte-Carlo rejoue des résultats", () => {
    // La cause n°1 : `REQUIRED` (date + symbole + P&L) sert le JOURNAL, où un
    // trade sans instrument n'a pas de sens. Ici, exiger un symbole rejetait
    // l'export le plus simple qui soit.
    expect(MC_REQUIRED).not.toContain("symbol");
    expect(MC_REQUIRED).toContain("pnl");
  });

  test("le journal, lui, continue d'exiger date + symbole + P&L", () => {
    // La souplesse de Monte-Carlo ne doit pas déteindre sur l'import du
    // journal : un trade sans instrument y serait inexploitable.
    const { headers, rows } = parseCsv(EXPORTS.pnlSeul);
    const { valid } = mapRowsToTrades(rows, guessMapping(headers));
    expect(valid.length).toBe(0);
  });

  test("les cinq exports produisent tous des trades", () => {
    // La mesure d'origine : quatre sur cinq rendaient zéro.
    for (const [nom, csv] of Object.entries(EXPORTS)) {
      const { valid } = lireCommeMonteCarlo(csv);
      expect(`${nom}: ${valid.length}`).toBe(`${nom}: 6`);
    }
  });

  test("et chacun produit une simulation exploitable", () => {
    // Lire le fichier ne suffit pas : sans multiple R, Monte-Carlo rejoue des
    // zéros et dessine une droite. Le bout de la chaîne, donc.
    for (const [nom, csv] of Object.entries(EXPORTS)) {
      const { valid } = lireCommeMonteCarlo(csv);
      const samples = extractRSamples(deriveRFromPnl(valid));
      expect(`${nom}: ${samples.length >= 5}`).toBe(`${nom}: true`);
      expect(`${nom}: ${samples.some((s) => s.r !== 0)}`).toBe(`${nom}: true`);
    }
  });
});
