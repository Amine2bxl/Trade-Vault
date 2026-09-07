import { describe, expect, test } from "bun:test";
import type { Trade } from "../src/app/types";
import {
  buildMistakePlan,
  computeAfterLoss,
  computeCleanStreak,
  computeIncidentRate,
} from "../src/app/utils/mistakePlan";

/**
 * LE PLAN DE CORRECTION.
 *
 * ── POURQUOI CE FICHIER ─────────────────────────────────────────────────────
 *
 * Trois voies — à bannir, à travailler, arrêtées — qui se partagent les mêmes
 * erreurs. Le mode d'échec est SILENCIEUX : une erreur qui ne tombe dans aucune
 * des trois disparaît de la page alors qu'elle est journalisée, et rien ne le
 * signale. Un trader ne peut pas remarquer l'absence de ce qu'il n'a jamais vu.
 *
 * Ces tests fixent donc d'abord une partition, ensuite les cas qui décident du
 * sens : une erreur qui recule sans disparaître, une fenêtre sans passé, un
 * trader à l'arrêt.
 */

let seq = 0;
function trade(date: string, mistakes: string[], entryTime = "09:00"): Trade {
  seq++;
  return {
    id: `t${seq}`,
    date,
    symbol: "EURUSD",
    direction: "long",
    pnl: -100,
    riskAmount: 100,
    rMultiple: -1,
    strategy: "",
    mistakes,
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime,
    exitTime: "10:00",
    confluences: [],
    confidence: 3,
  } as Trade;
}

/** Les fenêtres sont ancrées sur le dernier trade : ces dates sont relatives. */
const RECENT = "2026-03-01"; // à l'intérieur des 30 derniers jours
const AVANT = "2026-01-25"; // fenêtre précédente
const ANCRE = "2026-03-10"; // le dernier trade, qui pose l'ancre

describe("les trois voies du plan", () => {
  const trades = [
    // Grave, encore présente → à bannir.
    trade(AVANT, ["No stop loss"]),
    trade(RECENT, ["No stop loss"]),
    // Moyenne, encore présente → à travailler.
    trade(AVANT, ["FOMO entry"]),
    trade(RECENT, ["FOMO entry"]),
    // Présente avant, absente depuis → arrêtée.
    trade(AVANT, ["Revenge trade"]),
    trade(ANCRE, []),
  ];
  const plan = buildMistakePlan(trades);

  test("la gravité décide de la voie d'une erreur encore commise", () => {
    expect(plan.banish.map((i) => i.mistake)).toEqual(["No stop loss"]);
    expect(plan.work.map((i) => i.mistake)).toEqual(["FOMO entry"]);
  });

  test("une erreur absente de la fenêtre récente est un PROGRÈS, pas une tâche", () => {
    // C'est la seule information de la page qui récompense quelque chose.
    expect(plan.stopped.map((i) => i.mistake)).toEqual(["Revenge trade"]);
  });

  test("aucune erreur journalisée ne tombe hors des trois voies", () => {
    // L'invariant qui compte : une erreur oubliée par les filtres disparaît de
    // l'écran sans que rien ne l'indique.
    const classees = [...plan.banish, ...plan.work, ...plan.stopped].map((i) => i.mistake);
    expect(classees.sort()).toEqual(["FOMO entry", "No stop loss", "Revenge trade"]);
  });
});

describe("ce que la comparaison affirme, et ce qu'elle tait", () => {
  test("une erreur qui RECULE sans disparaître reste une tâche", () => {
    // Trois fois avant, une fois depuis : c'est un progrès réel, et l'erreur
    // est encore commise. La ranger dans « arrêtées » féliciterait pour une
    // faute en cours.
    const trades = [
      trade(AVANT, ["Overtrading"]),
      trade(AVANT, ["Overtrading"]),
      trade(AVANT, ["Overtrading"]),
      trade(RECENT, ["Overtrading"]),
      trade(ANCRE, []),
    ];
    const plan = buildMistakePlan(trades);
    expect(plan.stopped).toEqual([]);
    expect(plan.work.map((i) => i.mistake)).toEqual(["Overtrading"]);
    // Le recul est porté PAR la tâche, pas ailleurs.
    expect(plan.work[0].deltaPct).toBe(-67);
  });

  test("sans fenêtre précédente, aucune variation n'est affirmée", () => {
    // Un trader qui débute n'a pas de passé à comparer. « +100 % » serait une
    // mesure inventée.
    const plan = buildMistakePlan([trade(RECENT, ["FOMO entry"]), trade(ANCRE, [])]);
    expect(plan.hasPrevious).toBe(false);
    expect(plan.work[0].deltaPct).toBeNull();
  });

  test("un trader à l'arrêt ne voit pas ses erreurs « reculer » toutes seules", () => {
    // L'ancre est le DERNIER TRADE, pas aujourd'hui. Sans ça, il suffirait de
    // ne plus trader pendant deux mois pour que la page annonce un sans-faute.
    const trades = [trade("2025-06-01", ["No stop loss"]), trade("2025-06-02", ["No stop loss"])];
    const plan = buildMistakePlan(trades);
    expect(plan.banish.map((i) => i.mistake)).toEqual(["No stop loss"]);
    expect(plan.stopped).toEqual([]);
  });
});

describe("la série propre", () => {
  test("elle se compte depuis le trade le PLUS RÉCENT", () => {
    const s = computeCleanStreak([
      trade("2026-03-01", []),
      trade("2026-03-02", ["FOMO entry"]),
      trade("2026-03-03", []),
      trade("2026-03-04", []),
    ]);
    expect(s.current).toBe(2);
    expect(s.total).toBe(4);
  });

  test("elle retient le RECORD, même rompu depuis", () => {
    // Sans le record, la série ne dit que l'instant : on ne saurait pas qu'on a
    // déjà fait mieux, donc qu'on peut le refaire.
    const s = computeCleanStreak([
      trade("2026-03-01", []),
      trade("2026-03-02", []),
      trade("2026-03-03", []),
      trade("2026-03-04", ["Revenge trade"]),
      trade("2026-03-05", []),
    ]);
    expect(s.best).toBe(3);
    expect(s.current).toBe(1);
  });

  test("l'ordre vient des dates, pas de l'ordre de la liste", () => {
    // Les trades arrivent triés du plus récent au plus ancien dans le produit.
    // Compter la série dans cet ordre-là donnerait la série la plus ANCIENNE.
    const s = computeCleanStreak([
      trade("2026-03-05", []),
      trade("2026-03-04", []),
      trade("2026-03-03", ["FOMO entry"]),
      trade("2026-03-02", []),
    ]);
    expect(s.current).toBe(2);
  });

  test("un journal sans erreur donne une série égale au nombre de trades", () => {
    const s = computeCleanStreak([trade("2026-03-01", []), trade("2026-03-02", [])]);
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });
});

describe("le rythme des erreurs", () => {
  test("il se compte PAR TRADE, pas en valeur absolue", () => {
    // Fenêtre précédente : 2 trades, 2 erreurs → 1,0 par trade.
    // Fenêtre récente : 4 trades, 2 erreurs → 0,5 par trade.
    // Le compte brut est IDENTIQUE (2 et 2) : sans normalisation, la page
    // dirait « aucun changement » alors que le trader a divisé son taux par
    // deux.
    const trades = [
      trade(AVANT, ["FOMO entry"]),
      trade(AVANT, ["Overtrading"]),
      trade(RECENT, ["FOMO entry"]),
      trade(RECENT, ["Overtrading"]),
      trade(RECENT, []),
      trade(ANCRE, []),
    ];
    const r = computeIncidentRate(trades);
    expect(r.recent).toEqual({ incidents: 2, trades: 4 });
    expect(r.previous).toEqual({ incidents: 2, trades: 2 });
    expect(r.deltaPct).toBe(-50);
  });

  test("une fenêtre sans trade ne produit aucun rythme", () => {
    const r = computeIncidentRate([trade(RECENT, ["FOMO entry"]), trade(ANCRE, [])]);
    expect(r.previous).toBeNull();
    expect(r.deltaPct).toBeNull();
  });

  test("un journal vide ne dit rien plutôt que zéro", () => {
    // Zéro erreur par trade sur zéro trade se lirait comme un sans-faute.
    const r = computeIncidentRate([]);
    expect(r).toEqual({ recent: null, previous: null, deltaPct: null });
  });
});

describe("ce qui se passe juste après une perte", () => {
  test("les deux groupes sont comptés séparément, et le PREMIER trade n'en fait partie d'aucun", () => {
    // Le premier trade n'a pas de précédent : le ranger quelque part
    // reviendrait à inventer ce qui l'a précédé.
    //
    // Séquence (P = perdant, G = gagnant, ✗ = erreur cochée) :
    //   P  G✗ G  G  G  G  P  P✗ P✗ P  P
    //   ^ hors décompte
    // Suivent une PERTE : les trades 2, 8, 9, 10, 11 → 5 trades, 2 avec erreur.
    // Suivent un GAIN  : les trades 3, 4, 5, 6, 7   → 5 trades, 0 avec erreur.
    const G = (d: string, m: string[] = []) => ({ ...trade(d, m), pnl: 200 });
    const trades = [
      trade("2026-03-01", []), // P — premier, hors décompte
      G("2026-03-02", ["FOMO entry"]), // suit une perte, AVEC erreur
      G("2026-03-03"),
      G("2026-03-04"),
      G("2026-03-05"),
      G("2026-03-06"),
      trade("2026-03-07", []), // suit un gain
      trade("2026-03-08", ["Revenge trade"]), // suit une perte, AVEC erreur
      trade("2026-03-09", []),
      trade("2026-03-10", []),
      trade("2026-03-11", []),
    ];
    const r = computeAfterLoss(trades)!;
    expect(r).not.toBeNull();
    expect(r.apres).toEqual({ avecErreur: 2, total: 5 });
    expect(r.autres).toEqual({ avecErreur: 0, total: 5 });
    // Les deux groupes couvrent exactement les trades SAUF le premier.
    expect(r.apres.total + r.autres.total).toBe(trades.length - 1);
  });

  test("un gain range le trade suivant dans l'AUTRE groupe", () => {
    const gagnant = (d: string) => ({ ...trade(d, []), pnl: 200 });
    const trades = [
      gagnant("2026-03-01"),
      trade("2026-03-02", ["FOMO entry"]), // suit un GAIN
      gagnant("2026-03-03"),
      gagnant("2026-03-04"),
      gagnant("2026-03-05"),
      gagnant("2026-03-06"),
      gagnant("2026-03-07"),
    ];
    const r = computeAfterLoss(trades);
    // Aucun trade ne suit une perte → le groupe « après » est vide, donc on ne
    // publie rien plutôt qu'une comparaison à un seul côté.
    expect(r).toBeNull();
  });

  test("sous cinq trades dans un groupe, rien n'est affirmé", () => {
    // Deux trades sur trois font 67 % — un chiffre qui a l'air d'un fait et
    // n'en est pas un.
    const r = computeAfterLoss([
      trade("2026-03-01", []),
      trade("2026-03-02", ["FOMO entry"]),
      trade("2026-03-03", []),
    ]);
    expect(r).toBeNull();
  });

  test("un journal vide ne produit rien", () => {
    expect(computeAfterLoss([])).toBeNull();
  });
});
