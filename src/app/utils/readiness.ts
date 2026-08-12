/**
 * Score de préparation d'une séance — DÉRIVÉ, jamais demandé.
 *
 * POURQUOI CE MODULE EXISTE. La tentation naturelle est un curseur « note ta
 * préparation de 0 à 100 ». Elle produit une variable morte : l'auto-évaluation
 * s'ancre (le même 70 chaque matin), elle suit l'humeur plutôt que la
 * préparation, et toute corrélation calculée dessus ensuite ne mesure rien.
 * `ECOSYSTEM_WIRING.md` l'interdit explicitement, et c'est la seule raison pour
 * laquelle ce fichier est un moteur et pas un champ de formulaire.
 *
 * Le score se compose de trois faits OBSERVABLES, dont deux ne dépendent pas du
 * tout du jugement du trader :
 *
 * - la part de la checklist réellement cochée (60 points) — un fait ;
 * - l'existence de règles de risque actives (20 points) — un fait ;
 * - l'état émotionnel déclaré (20 points) — déclaratif, mais catégoriel : on
 *   choisit parmi six mots, pas un nombre sur une échelle. Un mot s'ancre
 *   beaucoup moins qu'un curseur, et il reste lisible dans une revue.
 *
 * Le module est PUR : aucune IO, aucun accès réseau, aucune date implicite.
 * Il rend le score ET ses entrées, parce qu'un score dont on ne peut pas
 * reconstituer le calcul six mois plus tard n'est pas auditable — et un chiffre
 * non auditable est exactement ce que `GO-LIVE.md` recense sous « chiffre
 * juste, interprétation fausse ».
 */

/** Les six états proposés. Catégoriel et fermé : pas d'échelle, pas de curseur. */
export const EMOTIONAL_STATES = [
  "calm",
  "focused",
  "tired",
  "anxious",
  "frustrated",
  "overconfident",
] as const;

export type EmotionalState = (typeof EMOTIONAL_STATES)[number];

export function isEmotionalState(value: unknown): value is EmotionalState {
  return typeof value === "string" && (EMOTIONAL_STATES as readonly string[]).includes(value);
}

/**
 * Poids des états.
 *
 * `overconfident` vaut moins que `tired` : la fatigue se remarque et incite à
 * la prudence, l'excès de confiance ne se remarque pas et fait grossir les
 * tailles. Ces poids sont un jugement produit assumé, pas une mesure — d'où
 * leur présence ici, en un seul endroit, plutôt que dispersés dans l'UI.
 */
const STATE_POINTS: Record<EmotionalState, number> = {
  focused: 20,
  calm: 18,
  tired: 8,
  anxious: 5,
  frustrated: 2,
  overconfident: 2,
};

export interface ReadinessInputs {
  /** Nombre d'items cochés dans la checklist du jour. */
  checklistDone: number;
  /** Nombre total d'items de la checklist du jour. */
  checklistTotal: number;
  /** État émotionnel déclaré, ou `null` s'il n'a pas été renseigné. */
  emotionalState: EmotionalState | null;
  /** Nombre de règles de risque actives au moment de l'ouverture. */
  activeRuleCount: number;
}

export interface Readiness {
  /** 0–100, ou `null` quand il n'y a rien à mesurer (voir `computeReadiness`). */
  score: number | null;
  /** Les entrées exactes du calcul, à stocker avec le score. */
  inputs: ReadinessInputs;
  /** Décomposition, pour que l'interface puisse expliquer le chiffre. */
  parts: { checklist: number; emotion: number; rules: number };
}

const CHECKLIST_MAX = 60;
const RULES_MAX = 20;

/**
 * Calcule le score de préparation.
 *
 * Rend `null` — et pas 0 — quand la séance ne contient AUCUNE des trois
 * entrées : pas d'items de checklist, pas d'état déclaré, pas de règle. Zéro
 * signifierait « préparation nulle, mesurée » ; `null` signifie « rien n'a été
 * mesuré ». La différence compte : c'est celle entre un fait et une absence, et
 * c'est elle qui empêche les séances reprises de l'historique de peser dans une
 * moyenne à laquelle elles n'ont jamais participé.
 */
export function computeReadiness(inputs: ReadinessInputs): Readiness {
  const total = Math.max(0, Math.trunc(inputs.checklistTotal));
  const done = Math.min(Math.max(0, Math.trunc(inputs.checklistDone)), total);
  const ruleCount = Math.max(0, Math.trunc(inputs.activeRuleCount));
  const state = inputs.emotionalState;

  const normalized: ReadinessInputs = {
    checklistDone: done,
    checklistTotal: total,
    emotionalState: state,
    activeRuleCount: ruleCount,
  };

  const nothingMeasured = total === 0 && state === null && ruleCount === 0;
  if (nothingMeasured) {
    return { score: null, inputs: normalized, parts: { checklist: 0, emotion: 0, rules: 0 } };
  }

  const checklist = total > 0 ? Math.round((done / total) * CHECKLIST_MAX) : 0;
  const emotion = state ? STATE_POINTS[state] : 0;
  // Une seule règle active vaut déjà la moitié des points : le saut qui compte
  // est celui de « aucune règle » à « au moins une ». Trois règles suffisent à
  // atteindre le maximum ; au-delà, en ajouter n'est pas se préparer davantage.
  const rules = ruleCount === 0 ? 0 : Math.min(RULES_MAX, 10 + (ruleCount - 1) * 5);

  const score = Math.max(0, Math.min(100, checklist + emotion + rules));
  return { score, inputs: normalized, parts: { checklist, emotion, rules } };
}
