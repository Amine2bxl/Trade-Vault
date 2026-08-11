/**
 * Qualité du jeu de données — module PUR.
 *
 * POURQUOI. Un journal peut contenir 300 trades et rester incapable de
 * répondre aux questions qui comptent : sans risque saisi, pas de R, donc pas
 * de « et si je risquais moitié moins ? » ; sans stratégie, pas de comparaison
 * de setups ; sans heures, pas d'analyse de session.
 *
 * L'application le sait déjà, champ par champ, mais ne le DIT nulle part. Le
 * trader découvre le trou au moment où une analyse se désactive, sans savoir
 * quoi remplir pour la débloquer. Ce module transforme cette information en
 * une liste d'actions : « 62 % de tes trades n'ont pas de risque — c'est ce
 * qui bloque l'analyse en R ».
 *
 * CE QU'IL NE FAIT PAS. Aucune statistique de performance n'est calculée ici,
 * et rien n'est jamais complété : un champ vide reste vide. Le module compte
 * ce qui est présent, il ne devine pas ce qui manque.
 */

import type { Trade } from "../types";

/** Une dimension d'analyse, et ce qu'elle débloque. */
export type QualityDimension = "risk" | "direction" | "strategy" | "times" | "screenshots";

export interface DimensionCoverage {
  dimension: QualityDimension;
  /** Part des trades renseignés, 0..1. */
  coverage: number;
  filled: number;
  total: number;
}

export interface DatasetQuality {
  total: number;
  /** Score global sur 100, pondéré par l'importance analytique des champs. */
  score: number;
  dimensions: DimensionCoverage[];
  /** Dimensions sous le seuil, de la plus pénalisante à la moins — c'est la
   *  liste d'actions à afficher, pas un simple diagnostic. */
  gaps: DimensionCoverage[];
}

/**
 * Poids relatif de chaque dimension dans le score.
 *
 * Le risque pèse le plus lourd parce qu'il conditionne le R, donc l'expectancy
 * normalisée, le dimensionnement et toute simulation de changement de risque.
 * Les captures d'écran pèsent le moins : elles aident la revue, jamais le
 * calcul.
 */
const WEIGHTS: Record<QualityDimension, number> = {
  risk: 4,
  direction: 2,
  strategy: 2,
  times: 1,
  screenshots: 1,
};

/** En dessous, la dimension est signalée comme un manque exploitable. */
export const GAP_THRESHOLD = 0.8;

function isFilled(trade: Trade, dimension: QualityDimension): boolean {
  switch (dimension) {
    // Un risque à 0 n'est pas un risque saisi : c'est la valeur par défaut du
    // formulaire. Le compter comme rempli gonflerait le score exactement là
    // où le trader croirait pouvoir se fier au R.
    case "risk":
      return typeof trade.riskAmount === "number" && trade.riskAmount > 0;
    case "direction":
      return trade.direction === "long" || trade.direction === "short";
    case "strategy":
      return typeof trade.strategy === "string" && trade.strategy.trim() !== "";
    case "times":
      return !!trade.entryTime && !!trade.exitTime;
    case "screenshots":
      return Array.isArray(trade.screenshots) && trade.screenshots.length > 0;
  }
}

const DIMENSIONS: QualityDimension[] = ["risk", "direction", "strategy", "times", "screenshots"];

export function assessDataset(trades: readonly Trade[]): DatasetQuality {
  const total = trades.length;
  if (total === 0) {
    return {
      total: 0,
      score: 0,
      dimensions: DIMENSIONS.map((dimension) => ({
        dimension,
        coverage: 0,
        filled: 0,
        total: 0,
      })),
      gaps: [],
    };
  }

  const dimensions: DimensionCoverage[] = DIMENSIONS.map((dimension) => {
    let filled = 0;
    for (const t of trades) if (isFilled(t, dimension)) filled++;
    return { dimension, coverage: filled / total, filled, total };
  });

  let weighted = 0;
  let weightSum = 0;
  for (const d of dimensions) {
    const w = WEIGHTS[d.dimension];
    weighted += d.coverage * w;
    weightSum += w;
  }

  return {
    total,
    score: Math.round((weighted / weightSum) * 100),
    dimensions,
    // Trié par coût réel : une dimension très incomplète ET très pondérée
    // passe devant une dimension un peu incomplète et secondaire.
    gaps: dimensions
      .filter((d) => d.coverage < GAP_THRESHOLD)
      .sort(
        (a, b) => (1 - b.coverage) * WEIGHTS[b.dimension] - (1 - a.coverage) * WEIGHTS[a.dimension],
      ),
  };
}
