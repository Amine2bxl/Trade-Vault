import { describe, it, expect } from "bun:test";
import { computeRuleAdherence } from "../ruleAdherence";
import type { TradingRule } from "../tradingRules";
import type { Trade } from "../../types";

/**
 * Adhérence aux règles — non-régression.
 *
 * Ce module dit au trader s'il tient ses engagements. Une erreur ici ne
 * provoque pas de crash : elle produit une félicitation imméritée ou un
 * reproche injustifié. Les deux détruisent la confiance dans le coach, et
 * aucune ne se voit sans test.
 */

const REF = "2026-08-05";

function daysBefore(n: number): string {
  const d = new Date(REF + "T12:00:00");
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function trade(date: string, entryTime: string, pnl = 100, riskAmount = 100): Trade {
  return {
    id: `${date}-${entryTime}-${Math.random()}`,
    date,
    symbol: "NAS100",
    direction: pnl >= 0 ? "long" : "short",
    entryTime,
    exitTime: "",
    pnl,
    rMultiple: pnl / 100,
    riskAmount,
    strategy: "breakout",
    notes: "",
    mistakes: [],
    screenshots: [],
    confluences: [],
    confidence: 70,
    setupQuality: 3,
  } as unknown as Trade;
}

const rule = (over: Partial<TradingRule> = {}): TradingRule => ({
  id: "r1",
  kind: "no_trade_after",
  value: "16:00",
  text: "Pas de trade après 16h",
  enabled: true,
  ...over,
});

describe("computeRuleAdherence", () => {
  it("mesure la tenue : 3 respects sur 4", () => {
    const trades = [
      trade(daysBefore(1), "10:00"),
      trade(daysBefore(2), "11:00"),
      trade(daysBefore(3), "14:00"),
      trade(daysBefore(4), "17:30"), // violation
    ];
    const [a] = computeRuleAdherence(trades, [rule()], 25000);
    expect(a.applicable).toBe(4);
    expect(a.kept).toBe(3);
    expect(a.ratePct).toBe(75);
  });

  it("EXCLUT les règles custom — un texte libre n'est pas vérifiable", () => {
    // Afficher « tenue 100 % » pour un engagement que personne ne peut
    // contrôler serait une flatterie mensongère.
    const trades = [trade(daysBefore(1), "10:00")];
    const custom = rule({ kind: "custom", text: "Rester patient", value: "" });
    expect(computeRuleAdherence(trades, [custom], 25000)).toEqual([]);
  });

  it("IGNORE les règles désactivées", () => {
    const trades = [trade(daysBefore(1), "17:30")];
    expect(computeRuleAdherence(trades, [rule({ enabled: false })], 25000)).toEqual([]);
  });

  it("OMET une règle jamais éprouvée plutôt que de la créditer", () => {
    // Fenêtre vide = rien n'a été testé, donc rien à créditer. On force le cas
    // avec une fenêtre de 0 jour : la dernière date tradée sert d'ancre, donc
    // un trade isolé tomberait toujours dans une fenêtre non nulle.
    const trades = [trade(daysBefore(1), "10:00")];
    expect(computeRuleAdherence(trades, [rule()], 25000, 0)).toEqual([]);
  });

  it("un trader EN PAUSE ne voit pas une adhérence artificielle", () => {
    // La fenêtre s'adosse à la dernière date TRADÉE, pas à aujourd'hui : ne
    // plus trader ne doit pas produire un bilan flatteur.
    const trades = [
      trade("2026-01-10", "10:00"),
      trade("2026-01-11", "17:30"), // violation
    ];
    const [a] = computeRuleAdherence(trades, [rule()], 25000);
    expect(a.applicable).toBe(2);
    expect(a.ratePct).toBe(50);
  });

  it("classe la règle la MOINS tenue en premier", () => {
    // Un bilan qui ouvre sur les réussites laisse le problème invisible.
    const trades = [
      trade(daysBefore(1), "17:30", 100, 5000), // viole l'heure ET le risque
      trade(daysBefore(2), "10:00", 100, 100),
    ];
    const rules = [
      rule({ id: "heure", kind: "no_trade_after", value: "16:00", text: "Pas après 16h" }),
      rule({ id: "risque", kind: "max_risk_pct", value: "1", text: "Max 1% par trade" }),
    ];
    const out = computeRuleAdherence(trades, rules, 25000);
    expect(out.length).toBe(2);
    expect(out[0].ratePct).toBeLessThanOrEqual(out[1].ratePct);
  });

  it("aucune règle, aucun trade : aucune exception", () => {
    expect(computeRuleAdherence([], [rule()], 25000)).toEqual([]);
    expect(computeRuleAdherence([trade(daysBefore(1), "10:00")], [], 25000)).toEqual([]);
  });
});
