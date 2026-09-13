import { describe, expect, test } from "bun:test";
import { computeAccountHealth } from "../src/app/utils/accountHealth";
import type { Trade } from "../src/app/types";
import type { AccountRules } from "../src/modules/probability/rules";

/**
 * LA MARGE RESTANTE EST LE CHIFFRE SUR LEQUEL ON DÉCIDE DE COUPER.
 *
 * S'il est faux, il est pire qu'absent : un trader qui lit « il te reste
 * 3 402 $ » prend un trade de plus. D'où ces cas — et surtout celui du compte
 * SANS règle configurée, où le seul comportement acceptable est de ne rien
 * affirmer.
 */

function trade(date: string, pnl: number, entryTime = "09:30"): Trade {
  return {
    id: `${date}-${pnl}-${entryTime}`,
    date,
    symbol: "NQ",
    direction: pnl >= 0 ? "long" : "short",
    pnl,
    riskAmount: 100,
    rMultiple: pnl / 100,
    strategy: "Test",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime,
    exitTime: "10:00",
    confluences: [],
    confidence: 50,
  };
}

describe("sans règle configurée", () => {
  test("aucun plancher, aucun restant, aucun pourcentage — et on le dit par `null`", () => {
    const h = computeAccountHealth([trade("2026-05-12", -300)], 50_000);
    expect(h.floor).toBeNull();
    expect(h.remaining).toBeNull();
    expect(h.target).toBeNull();
    expect(h.progress).toBeNull();
    expect(h.breached).toBe(false);
  });

  test("la courbe et le drawdown restent calculables — ils ne dépendent d'aucune règle", () => {
    const h = computeAccountHealth([trade("2026-05-12", 1000), trade("2026-05-13", -400)], 50_000);
    expect(h.balance).toBe(50_600);
    expect(h.peak).toBe(51_000);
    expect(h.drawdown).toBe(400);
    expect(h.curve.map((p) => p.balance)).toEqual([51_000, 50_600]);
  });
});

describe("drawdown STATIQUE", () => {
  const rules: AccountRules = {
    startingBalance: 50_000,
    maxDrawdown: 2_000,
    drawdownType: "static",
    profitTarget: 3_000,
  };

  test("le plancher ne bouge jamais, même après un gain", () => {
    const h = computeAccountHealth(
      [trade("2026-05-12", 1_500), trade("2026-05-13", 500)],
      50_000,
      rules,
    );
    expect(h.floor).toBe(48_000);
    expect(h.balance).toBe(52_000);
    expect(h.remaining).toBe(4_000);
  });

  test("la cible est le capital PLUS l'objectif, pas l'objectif seul", () => {
    const h = computeAccountHealth([], 50_000, rules);
    expect(h.target).toBe(53_000);
  });

  test("l'avancement se mesure du plancher à la cible", () => {
    // Plancher 48 000, cible 53 000 → bande de 5 000. Solde 50 500 = 50 %.
    const h = computeAccountHealth([trade("2026-05-12", 500)], 50_000, rules);
    expect(h.progress).toBeCloseTo(0.5, 10);
  });

  test("passer sous le plancher est signalé", () => {
    const h = computeAccountHealth([trade("2026-05-12", -2_500)], 50_000, rules);
    expect(h.breached).toBe(true);
    expect(h.remaining).toBeLessThan(0);
  });
});

describe("drawdown TRAILING", () => {
  const rules: AccountRules = {
    startingBalance: 50_000,
    maxDrawdown: 2_000,
    drawdownType: "trailing",
  };

  test("LE PLANCHER SUIT LE PLUS HAUT — c'est ce qui le rend sévère", () => {
    // Monter à 52 000 remonte le plancher à 50 000 : rendre le gain ne le
    // redescend pas. Confondre ce cas avec le statique surestime la marge de
    // 2 000 $, et c'est exactement l'erreur qui coûte un compte.
    const h = computeAccountHealth(
      [trade("2026-05-12", 2_000), trade("2026-05-13", -1_000)],
      50_000,
      rules,
    );
    expect(h.peak).toBe(52_000);
    expect(h.floor).toBe(50_000);
    expect(h.balance).toBe(51_000);
    expect(h.remaining).toBe(1_000);
  });

  test("le plancher tracé sur la courbe monte avec elle", () => {
    const h = computeAccountHealth(
      [trade("2026-05-12", 1_000), trade("2026-05-13", 1_000)],
      50_000,
      rules,
    );
    expect(h.curve.map((p) => p.floor)).toEqual([49_000, 50_000]);
  });
});

describe("le capital du COMPTE fait autorité", () => {
  test("une règle enregistrée pour un autre capital ne déplace pas la courbe", () => {
    // Le scénario a été saisi pour un 100k ; le compte est un 50k. C'est le
    // compte qui décide, sinon le plancher serait calculé sur un capital que
    // ce compte n'a jamais eu.
    const rules: AccountRules = {
      startingBalance: 100_000,
      maxDrawdown: 2_000,
      drawdownType: "static",
    };
    const h = computeAccountHealth([], 50_000, rules);
    expect(h.startingBalance).toBe(50_000);
    expect(h.floor).toBe(48_000);
  });
});

describe("l'agrégation par journée", () => {
  test("plusieurs trades du même jour ne font qu'un point", () => {
    const h = computeAccountHealth(
      [trade("2026-05-12", 100, "09:30"), trade("2026-05-12", -40, "11:00")],
      10_000,
    );
    expect(h.curve.length).toBe(1);
    expect(h.curve[0].balance).toBe(10_060);
  });

  test("les journées sont ordonnées dans le temps, quel que soit l'ordre d'entrée", () => {
    const h = computeAccountHealth(
      [trade("2026-05-20", 10), trade("2026-05-12", 10), trade("2026-05-15", 10)],
      1_000,
    );
    expect(h.curve.map((p) => p.date)).toEqual(["2026-05-12", "2026-05-15", "2026-05-20"]);
  });

  test("sans trade, la courbe est vide et le solde vaut le capital", () => {
    const h = computeAccountHealth([], 25_000);
    expect(h.curve).toEqual([]);
    expect(h.balance).toBe(25_000);
    expect(h.drawdown).toBe(0);
  });
});
