/**
 * Les seuils au-dessus desquels le produit a le droit de parler.
 *
 * `ECOSYSTEM_WIRING.md` en fait une exigence dure, et la raison est écrite
 * noir sur blanc dans le spec : *un trader qui change de comportement à cause
 * d'une corrélation fausse observée sur douze séances est activement abîmé par
 * le produit*. Ces constantes vivent donc dans un fichier à elles, importées
 * par chaque détecteur, plutôt que recopiées à côté de chaque comparaison — la
 * recopie finit toujours par diverger, et ici diverger veut dire mentir.
 *
 * Trois règles, sans exception :
 *
 * 1. Rien n'est affirmé sous le minimum. En dessous, l'interface dit combien
 *    il en manque, et rien d'autre.
 * 2. Aucune formulation causale. On observe une association sur une variable
 *    déclarative ; on n'établit pas de cause.
 * 3. Toute statistique affichée porte son `n`. Si `n` ne peut pas être rendu à
 *    côté du chiffre, le chiffre ne sort pas.
 */

/** Minimum de trades dans le groupe comparé. */
export const MIN_TRADES = 30;

/** Minimum de séances dans le groupe comparé. */
export const MIN_SESSIONS = 20;

/** Minimum de trades dans CHACUN des deux groupes d'une comparaison. */
export const MIN_GROUP = 10;

/** Un motif écarté ne revient pas avant ce délai. */
export const DISMISS_DAYS = 30;

/**
 * Ce qu'on rend quand il n'y a pas assez de données.
 *
 * `missing` est la seule information utile à ce stade : « il te manque 8
 * séances » est actionnable, « données insuffisantes » ne l'est pas.
 */
export interface NotEnough {
  status: "not_enough";
  /** Ce qui manque : des trades ou des séances. */
  unit: "trades" | "sessions";
  /** Combien on en a. */
  n: number;
  /** Combien il en faut. */
  required: number;
  /** Combien il en manque — jamais négatif. */
  missing: number;
}

export function notEnough(unit: "trades" | "sessions", n: number, required: number): NotEnough {
  return { status: "not_enough", unit, n, required, missing: Math.max(0, required - n) };
}
