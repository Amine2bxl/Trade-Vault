import { confidenceFrom } from "../confidence";
import type { Detector } from "./types";

/**
 * costliest_mistake — l'erreur qui coûte le plus.
 *
 * Depuis `stats.mistakeStats`, le pattern le plus coûteux (totalPnl le plus
 * négatif). L'effet mesure si les trades marqués de cette erreur perdent plus
 * que la perte moyenne — plus l'écart est grand, plus l'erreur est un vrai
 * trou dans le process (et pas juste un sample).
 */
export const costliestMistakeDetector: Detector = (data) => {
  const entries = Object.entries(data.stats.mistakeStats)
    .map(([name, v]) => ({ name, ...v }))
    .filter((m) => m.totalPnl < 0)
    .sort((a, b) => a.totalPnl - b.totalPnl);
  const worst = entries[0];
  if (!worst) return null;

  const expectedLoss = Math.max(1, Math.abs(data.stats.avgLoss) * worst.count);
  const effect = Math.abs(worst.totalPnl) / expectedLoss;

  return {
    moment: "brief",
    pattern: "costliest_mistake",
    priority: 0,
    confidence: confidenceFrom(worst.count, effect),
    sampleSize: worst.count,
    evidence: { mistake: worst.name, count: worst.count, totalPnl: worst.totalPnl },
    impact: { label: "Coût de cette erreur", amount: Math.abs(worst.totalPnl), unit: "$" },
    mission: [`Éliminer : ${worst.name}`, "Noter l'erreur dès qu'elle apparaît"],
  };
};
