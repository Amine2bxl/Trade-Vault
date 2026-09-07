import { describe, expect, test } from "bun:test";
import type { Trade } from "../src/app/types";
import { planScale, SCALE_MIN_LOSSES } from "../src/app/utils/planScale";

/**
 * LE PRIX MIS À L'ÉCHELLE DU JOURNAL.
 *
 * ── CE QUI EST EN JEU ───────────────────────────────────────────────────────
 *
 * C'est un calcul affiché sur la page où l'on demande de payer. Un chiffre faux
 * y coûte plus cher que partout ailleurs : il transforme un argument honnête en
 * argument de vente douteux, et le trader ne revient pas sur une page de prix
 * pour vérifier.
 *
 * Ces tests portent donc surtout sur les cas où le calcul doit se TAIRE.
 */

let seq = 0;
function trade(pnl: number): Trade {
  seq++;
  return {
    id: `t${seq}`,
    date: "2026-03-01",
    symbol: "EURUSD",
    direction: "long",
    pnl,
    riskAmount: 100,
    rMultiple: pnl / 100,
    strategy: "",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:00",
    exitTime: "10:00",
    confluences: [],
    confidence: 3,
  } as Trade;
}

/** `n` pertes de `montant`, plus quelques gains pour faire un journal réaliste. */
const journal = (n: number, montant: number) => [
  ...Array.from({ length: n }, () => trade(-montant)),
  trade(300),
  trade(150),
];

describe("le calcul", () => {
  test("la perte moyenne ne porte que sur les trades PERDANTS", () => {
    // Inclure les gains ferait fondre la moyenne et gonflerait artificiellement
    // le poids relatif du prix — un chiffre flatteur, donc faux.
    const s = planScale(journal(SCALE_MIN_LOSSES, 80), 15)!;
    expect(s.perteMoyenne).toBe(80);
    expect(s.nLosses).toBe(SCALE_MIN_LOSSES);
  });

  test("le prix est rapporté à cette perte, en pourcentage", () => {
    // 15 € sur une perte moyenne de 75 € = 20 %.
    const s = planScale(journal(SCALE_MIN_LOSSES, 75), 15)!;
    expect(s.partDUnePerte).toBe(20);
  });

  test("les pertes sont prises en valeur absolue", () => {
    // Un P&L est négatif : sans `Math.abs`, la moyenne serait négative et le
    // pourcentage aussi.
    const s = planScale(journal(SCALE_MIN_LOSSES, 120), 15)!;
    expect(s.perteMoyenne).toBeGreaterThan(0);
    expect(s.partDUnePerte).toBeGreaterThan(0);
  });
});

describe("ce qui fait taire le bloc", () => {
  test("sous le seuil de pertes, aucune moyenne n'est publiée", () => {
    // Une « moyenne » sur trois pertes n'est pas une moyenne, et c'est la page
    // où l'on demande de payer.
    expect(planScale(journal(SCALE_MIN_LOSSES - 1, 80), 15)).toBeNull();
  });

  test("un journal sans aucune perte ne dit rien", () => {
    expect(planScale([trade(200), trade(150)], 15)).toBeNull();
  });

  test("un journal vide ne dit rien", () => {
    expect(planScale([], 15)).toBeNull();
  });

  test("un plan gratuit n'a rien à mettre à l'échelle", () => {
    // Rapporter 0 € à une perte donnerait « 0 % », qui se lirait comme un
    // argument alors que ce n'en est pas un.
    expect(planScale(journal(SCALE_MIN_LOSSES, 80), 0)).toBeNull();
  });

  test("`null`, jamais un objet à zéro", () => {
    // « 0 % » se lirait « ça ne coûte rien » ; la vérité est « on ne sait pas
    // encore ». Les deux ne s'affichent pas pareil.
    const s = planScale(journal(2, 80), 15);
    expect(s).toBeNull();
  });
});
