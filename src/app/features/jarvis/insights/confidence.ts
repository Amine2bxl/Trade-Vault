import type { JarvisConfidence, JarvisInsight } from "./types";

/**
 * Validation de confiance (Phase 1).
 *
 * Chaque insight embarque une confidence (0..1) et un sampleSize. Le seuil de
 * confiance décide si Jarvis CONCLUT ou passe en « mode apprentissage » :
 * si le sample ou la confiance est insuffisant, Jarvis ne conclut pas.
 */

export const MIN_SAMPLE = 10;
export const MIN_CONFIDENCE = 0.55;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 0..1 — contribution de la taille d'échantillon (asymptotique vers 1 à 30). */
export const sampleScore = (n: number): number => Math.min(1, n / 30);

/** 0..1 — clamp d'un facteur d'effet quelconque. */
export const effectFactor = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * Confidence composite : la taille d'échantillon pèse 60 %, la force de
 * l'effet 40 %. Plafonnée à 0.95 (jamais 100 % de certitude).
 */
export function confidenceFrom(sample: number, effect: number): number {
  return round2(Math.min(0.95, 0.6 * sampleScore(sample) + 0.4 * effectFactor(effect)));
}

/** Résultat de validation : `validated` (conclu) ou `learning` (pas de conclusion). */
export function validateInsight(insight: JarvisInsight): JarvisConfidence {
  if (insight.sampleSize < MIN_SAMPLE || insight.confidence < MIN_CONFIDENCE) {
    return { status: "learning", sampleSize: insight.sampleSize, pattern: insight.pattern };
  }
  return { status: "validated", insight };
}
