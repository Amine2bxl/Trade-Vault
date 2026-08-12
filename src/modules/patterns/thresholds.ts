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
 * ── PLANCHER D'EFFET : la garde que `n` ne fournit PAS ─────────────────────
 *
 * Un `n` suffisant protège d'un petit échantillon. Il ne protège en RIEN d'un
 * grand nombre de comparaisons. Quatre détecteurs qui balaient chacun
 * plusieurs tranches — familles, créneaux horaires, jours — finissent par en
 * trouver une qui paraît extrême par le seul jeu du hasard. Remonter la plus
 * forte revient alors à publier le maximum d'un bruit, pas un motif.
 *
 * Deux réponses, toutes deux ici :
 *
 * 1. Un écart MINIMUM en valeur absolue. Une famille à 26 % des pertes quand
 *    la référence est 25 % franchit tous les seuils de taille et ne veut rien
 *    dire. Sous ces planchers, le détecteur se tait.
 * 2. `Evidence.comparisons` — le nombre de tranches examinées voyage AVEC le
 *    résultat. Un écart trouvé en regardant vingt tranches ne se lit pas comme
 *    le même écart trouvé en en regardant une.
 *
 * Ce que ces constantes ne remplacent pas : l'interdiction des filtres
 * empilés. « Jeudi, après une perte, entre 14 h et 16 h, setup X » est une
 * recherche libre à quatre dimensions ; aucun plancher ne rattrape ça. Les
 * détecteurs restent à UNE dimension, et c'est une règle d'architecture, pas
 * un réglage.
 */

/** Écart minimum sur une PART (0–1) : 15 points de pourcentage au-dessus de la
 *  référence pour qu'une famille soit signalée. */
export const MIN_SHARE_DELTA = 0.15;

/** Écart minimum sur un R moyen. En dessous, la différence entre deux groupes
 *  n'est pas distinguable du bruit d'un journal ordinaire. */
export const MIN_R_DELTA = 0.25;

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
