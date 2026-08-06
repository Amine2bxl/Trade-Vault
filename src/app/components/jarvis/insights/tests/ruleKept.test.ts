import { describe, it, expect } from "bun:test";
import { ruleKeptDetector } from "../detectors/ruleKept";
import { buildHomeData } from "./fixtures";
import type { JarvisHomeData } from "../types";
import type { RuleAdherence } from "../../../../utils/ruleAdherence";

/**
 * `rule_kept` produit « tu l'as tenue 11 fois sur 12 » — la phrase que la
 * documentation produit désigne comme la boucle centrale de TradeVault.
 *
 * Elle nomme une DISCIPLINE, pas un résultat : contrairement à une série de
 * gains, tenir une règle est entièrement sous le contrôle du trader.
 */

function withAdherence(adherence: RuleAdherence[]): JarvisHomeData {
  return { ...buildHomeData([]), adherence };
}

const rule = (over: Partial<RuleAdherence> = {}): RuleAdherence => ({
  ruleId: "r1",
  text: "Pas de trade après deux pertes",
  applicable: 12,
  kept: 11,
  ratePct: 92,
  ...over,
});

describe("ruleKeptDetector", () => {
  it("félicite une règle réellement tenue, avec les vrais chiffres", () => {
    const insight = ruleKeptDetector(withAdherence([rule()]));
    expect(insight).not.toBeNull();
    expect(insight!.pattern).toBe("rule_kept");
    expect(insight!.evidence.kept).toBe(11);
    expect(insight!.evidence.applicable).toBe(12);
    expect(insight!.sampleSize).toBe(12);
  });

  it("reste SILENCIEUX sous le taux de célébration", () => {
    // Féliciter une règle tenue à 60 % viderait la félicitation de son sens :
    // si tout mérite des éloges, plus rien n'en mérite.
    expect(ruleKeptDetector(withAdherence([rule({ kept: 6, ratePct: 60 })]))).toBeNull();
  });

  it("reste SILENCIEUX sur un échantillon trop mince", () => {
    // « Tu l'as tenue 2 fois sur 2 » n'est pas une discipline, c'est un
    // échantillon — même règle que partout ailleurs dans le produit.
    expect(
      ruleKeptDetector(withAdherence([rule({ applicable: 2, kept: 2, ratePct: 100 })])),
    ).toBeNull();
  });

  it("choisit la règle la MIEUX tenue quand plusieurs qualifient", () => {
    const insight = ruleKeptDetector(
      withAdherence([
        rule({ ruleId: "a", text: "Règle A", ratePct: 85, kept: 17, applicable: 20 }),
        rule({ ruleId: "b", text: "Règle B", ratePct: 95, kept: 19, applicable: 20 }),
      ]),
    );
    expect(insight!.evidence.ruleText).toBe("Règle B");
  });

  it("n'INVENTE aucun impact chiffré", () => {
    // Convertir une discipline tenue en euros supposerait de savoir ce qui
    // serait arrivé autrement. Le produit ne le sait pas.
    expect(ruleKeptDetector(withAdherence([rule()]))!.impact).toBeNull();
  });

  it("ne dit rien sans données d'adhérence — jamais d'exception", () => {
    // Le champ est optionnel : les appelants qui n'ont pas les règles du trader
    // restent valides, le détecteur se tait simplement.
    expect(ruleKeptDetector(buildHomeData([]))).toBeNull();
    expect(ruleKeptDetector(withAdherence([]))).toBeNull();
  });

  it("cède le passage à une fuite active (priorité basse)", () => {
    // Une bonne nouvelle ne doit jamais masquer un problème en cours.
    expect(ruleKeptDetector(withAdherence([rule()]))!.priority).toBeGreaterThan(1);
  });
});
