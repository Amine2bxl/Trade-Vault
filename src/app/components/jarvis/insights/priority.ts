import type { JarvisInsight, JarvisMemory } from "./types";

/**
 * Sélection de la priorité UNIQUE du Hero.
 *
 * Critères (pondérés) :
 *  - confiance (45 %) — plus le pattern est fiable, plus il a de poids ;
 *  - impact réel (35 %) — la magnitude monétaire de l'insight ;
 *  - actionnabilité (20 %) — la mission est-elle claire et immédiate ?
 *  - bonus « warning » (+0.1) — un danger prend le pas sur un constat ;
 *  - pénalité anti-répétition (×0.55) — ne pas répéter le dernier pattern.
 *
 * Retourne la liste triée ; l'élément[0] porte priority = 1 (le Hero).
 */

const impactScore = (insight: JarvisInsight): number =>
  Math.min(1, Math.abs(insight.impact?.amount ?? 0) / 400);

const actionability = (insight: JarvisInsight): number =>
  0.5 + Math.min(0.5, insight.mission.length * 0.25);

export function pickPriority(candidates: JarvisInsight[], memory: JarvisMemory): JarvisInsight[] {
  const scored = candidates.map((insight) => {
    let score =
      0.45 * insight.confidence + 0.35 * impactScore(insight) + 0.2 * actionability(insight);
    if (insight.moment === "warning") score += 0.1;
    if (insight.pattern === memory.lastPattern) score *= 0.55;
    return { insight, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, i) => ({ ...s.insight, priority: i + 1 }));
}
