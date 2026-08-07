import { confidenceFrom } from "../confidence";
import type { Detector } from "./types";

/**
 * rule_kept — « tu l'as tenue 11 fois sur 12 ».
 *
 * POURQUOI CE DÉTECTEUR EXISTE. C'est littéralement la phrase que la
 * documentation produit désigne comme la boucle centrale de TradeVault, et
 * aucun détecteur ne la produisait. Le moteur d'adhérence calculait la tenue
 * des règles, le payload l'envoyait au LLM — mais rien ne la faisait remonter
 * PROACTIVEMENT. Le trader devait penser à demander.
 *
 * Or c'est exactement l'inverse du problème que le produit adresse : la
 * récompense de la journalisation est différée, et une récompense qu'il faut
 * aller chercher n'en est pas une.
 *
 * CE QU'IL MESURE — et lui seul dans tout le produit : la tenue RÉELLE des
 * règles, constatée par le moteur de discipline. Pas les erreurs auto-cochées
 * (`cleanJournalScore`), pas une série de gains (`disciplineStreak`, qui est un
 * résultat et non une preuve de process).
 */

/**
 * Seuil de célébration. 80 % : assez haut pour que la mention ait du prix,
 * assez bas pour rester atteignable — féliciter à 95 % ne récompenserait
 * presque jamais, et le renforcement positif ne fonctionne que s'il arrive.
 */
const KEPT_RATE_PCT = 80;

/**
 * Trades applicables minimum. Même logique que partout ailleurs : « tu l'as
 * tenue 2 fois sur 2 » n'est pas une discipline, c'est un échantillon.
 */
const MIN_APPLICABLE = 5;

export const ruleKeptDetector: Detector = (data) => {
  const adherence = data.adherence ?? [];
  const eligible = adherence.filter(
    (a) => a.applicable >= MIN_APPLICABLE && a.ratePct >= KEPT_RATE_PCT,
  );
  if (eligible.length === 0) return null;

  // La MIEUX tenue : ce moment est une récompense, il met en avant la réussite
  // la plus nette. Les règles qui glissent ont déjà leur canal — une
  // notification `discipline_warning` dédiée.
  const best = eligible.reduce((a, b) => (b.ratePct > a.ratePct ? b : a));

  return {
    moment: "review",
    pattern: "rule_kept",
    // Priorité basse (3) : une bonne nouvelle ne doit jamais masquer une fuite
    // active. Elle passe quand rien de plus urgent n'a été détecté.
    priority: 3,
    confidence: confidenceFrom(best.applicable, best.ratePct / 100),
    sampleSize: best.applicable,
    evidence: {
      ruleText: best.text,
      kept: best.kept,
      applicable: best.applicable,
      ratePct: best.ratePct,
    },
    // Aucun impact chiffré : convertir une discipline tenue en euros supposerait
    // de savoir ce qui serait arrivé autrement. Le produit ne le sait pas, et
    // l'inventer serait la même faute que les corrections de ce jour.
    impact: null,
    mission: ["keep_rule_streak"],
  };
};
