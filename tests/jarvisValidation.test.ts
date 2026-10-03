import { describe, expect, test } from "bun:test";
import {
  extractFigures,
  parseWrittenNumber,
  repairInstruction,
  unverifiedNotice,
  validateAnswer,
} from "../src/modules/ai/validation";

/**
 * LOT 2 — LA VALIDATION DES CHIFFRES.
 *
 * Chaque chiffre « de donnée » d'une réponse doit se retrouver dans ce que
 * Jarvis a reçu. Ces tests fixent les deux côtés de la ligne : ce qui DOIT
 * être refusé (un chiffre inventé, une part calculée par le modèle) et ce qui
 * ne doit PAS l'être (arrondi d'affichage, signe, pourcentage d'une fraction,
 * dates, instruments, conseils) — un faux positif coûte un appel de réparation
 * et dégrade une bonne réponse.
 */

const DATA = JSON.stringify({
  totalPnl: -1243.5,
  winRatePct: 42.67,
  winRate: 0.4267,
  totalTrades: 87,
  profitFactor: 0.91,
  avgRR: 1.38,
  expectancyR: -0.12,
  mistakes: [{ name: "FOMO", count: 14, netPnl: -812.4 }],
});

describe("lecture des nombres écrits", () => {
  const CASES: [raw: string, values: number[], decimals: number][] = [
    ["1 234,50", [1234.5], 2],
    ["1,234.50", [1234.5], 2],
    ["1.234,50", [1234.5], 2],
    ["42,7", [42.7], 1],
    ["12", [12], 0],
  ];
  for (const [raw, values, decimals] of CASES) {
    test(`« ${raw} »`, () => {
      const p = parseWrittenNumber(raw);
      expect(p.values).toEqual(values);
      expect(p.decimals).toBe(decimals);
    });
  }

  test("« 1,234 » est ambigu : les deux lectures sont gardées", () => {
    expect(parseWrittenNumber("1,234").values.sort((a, b) => a - b)).toEqual([1.234, 1234]);
  });
});

describe("extraction", () => {
  test("dates, heures, années, instruments et puces ne sont pas des chiffres de donnée", () => {
    const figs = extractFigures(
      "1. Le 2026-09-12 à 09:35, sur GER40 et US30, en septembre 2026, le 12 septembre.",
    );
    expect(figs).toEqual([]);
  });

  test("unités et nature : %, devise, R, k", () => {
    const figs = extractFigures(
      "Tu as perdu 1 243,50 €, soit -0,12R par trade, win rate 42,7 %, 5k de gains.",
    );
    expect(figs.map((f) => f.strict)).toEqual([true, true, true, true]);
    expect(figs.find((f) => f.percent)?.values).toEqual([42.7]);
    expect(figs.find((f) => f.raw.includes("5k"))?.values).toEqual([5000]);
  });
});

describe("validateAnswer", () => {
  test("une réponse fidèle passe — signe, arrondi et fraction compris", () => {
    const r = validateAnswer(
      "Sur 87 trades, ton P&L est de -1 243,50 €, avec un win rate de 42,7 % et un profit factor de 0,91. " +
        "Le FOMO revient 14 fois et pèse une perte de 812 €.",
      DATA,
    );
    expect(r.unsupported).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test("un chiffre inventé est refusé", () => {
    const r = validateAnswer("Ton win rate est de 61 % sur 87 trades.", DATA);
    expect(r.ok).toBe(false);
    expect(r.unsupported.map((f) => f.raw)).toEqual(["61 %"]);
  });

  test("une part calculée par le modèle n'est pas acceptée, même juste", () => {
    // 812,4 / 1 243,5 ≈ 65,3 % : un moteur doit le calculer, pas le modèle.
    const r = validateAnswer("Le FOMO représente 65,3 % de ta perte nette.", DATA);
    expect(r.ok).toBe(false);
  });

  test("les conseils et les illustrations ne sont pas vérifiés comme des mesures", () => {
    const r = validateAnswer(
      "Limite ton risque à 0,5 % par trade. Par exemple, un ratio de 2,5 suffit à rester rentable.",
      DATA,
    );
    expect(r.checked).toBe(0);
    expect(r.ok).toBe(true);
  });

  test("les petits entiers sans unité sont signalés sans déclencher de réparation", () => {
    const r = validateAnswer("Tu as 3 règles actives.", DATA);
    expect(r.ok).toBe(true);
    expect(r.softUnsupported.map((f) => f.raw)).toEqual(["3"]);
  });

  test("les chiffres de la question elle-même sont admis", () => {
    const r = validateAnswer(
      "Avec 2 500 € de risque max par semaine, tu es dans les clous.",
      `${DATA}\nquestion: et si je risque 2 500 € par semaine ?`,
    );
    expect(r.ok).toBe(true);
  });
});

describe("montants qui ressemblent à une année", () => {
  const corpus = JSON.stringify({ totalPnl: 1950.37, maxDrawdown: -2019.83, avgWin: 2044.67 });

  test.each([
    "Ton P&L net est de 1950,37 €.",
    "Ton drawdown max est de $2019.83.",
    "Ton gain moyen : 2044,67 €.",
  ])("« %s » cité tel quel n'est pas signalé", (answer) => {
    expect(validateAnswer(answer, corpus).ok).toBe(true);
  });

  test("les vraies années restent ignorées, un montant inventé reste refusé", () => {
    expect(validateAnswer("Depuis 2024, ton P&L net est de 1950,37 €.", corpus).ok).toBe(true);
    expect(extractFigures("en 2025 et depuis 2023, fin 2024.")).toEqual([]);
    expect(validateAnswer("Ton P&L net est de 1850,37 €.", corpus).ok).toBe(false);
  });
});

describe("jours du mois en français", () => {
  test("« le 12 », « du 3 au 10 » sont des dates, pas des mesures", () => {
    expect(extractFigures("Le 12, tu as perdu 50 €.").map((f) => f.raw)).toEqual(["50 €"]);
    expect(extractFigures("du 3 au 10, ton P&L a reculé")).toEqual([]);
    expect(
      validateAnswer("Une perte de 50 € le 12 a pesé sur le mois.", '{"avgLoss":-50}').ok,
    ).toBe(true);
  });

  test("avec une unité, ce sont toujours des chiffres vérifiés", () => {
    expect(extractFigures("le 12 % de tes trades").map((f) => f.raw)).toEqual(["12 %"]);
    expect(extractFigures("le 15 trades").map((f) => f.raw)).toEqual(["15"]);
  });
});

describe("réparation et mention honnête", () => {
  test("la consigne nomme les chiffres et interdit d'en recalculer", () => {
    const r = validateAnswer("Ton win rate est de 61 %.", DATA);
    const msg = repairInstruction(r.unsupported, "fr");
    expect(msg).toContain('"61 %"');
    expect(msg).toContain("do not compute new shares, sums or differences");
    expect(msg).toContain("French");
  });

  test("la mention suit la langue du trader", () => {
    expect(unverifiedNotice("fr")).toContain("n'ont pas pu être vérifiés");
    expect(unverifiedNotice("en")).toContain("could not be verified");
  });
});
