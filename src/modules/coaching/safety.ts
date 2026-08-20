/**
 * Sécurité statistique — le droit de conclure.
 *
 * `docs/PHASE_0_INTELLIGENCE_FOUNDATION.md` §7 en fait une exigence dure : un
 * trader qui change de comportement sur la foi d'un échantillon de 2-3 trades
 * est activement abîmé par le produit. Ce module est la SEULE source du seuil
 * sous lequel Jarvis parle de « signal faible » au lieu d'affirmer.
 *
 * `MIN_SAMPLE` est aligné sur la validation de confiance de l'Insight Engine
 * (`jarvis/insights/confidence.ts`) : la même notion de « assez de données »
 * traverse tout le coaching, sinon deux écrans diraient le contraire sur le
 * même échantillon.
 */

/** Minimum de trades pour conclure (hors comparaison de groupes). */
export const MIN_SAMPLE = 10;

export interface SampleVerdict {
  sufficient: boolean;
  n: number;
  required: number;
  /** Jamais négatif. */
  missing: number;
}

/**
 * Verdict d'échantillon. Un `n` sous le seuil n'interdit pas de PARLER : il
 * interdit d'AFFIRMER. L'appelant doit dire « signal faible, N trades » — c'est
 * la seule information actionnable à ce stade.
 */
export function sampleVerdict(n: number, required: number = MIN_SAMPLE): SampleVerdict {
  return { sufficient: n >= required, n, required, missing: Math.max(0, required - n) };
}
