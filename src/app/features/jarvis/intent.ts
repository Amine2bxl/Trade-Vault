import { routeQuestion, type UiIntent } from "@/modules/ai/router/route";

/**
 * DE QUOI PARLE LA QUESTION — l'intention, pour l'interface.
 *
 * Les étapes de réflexion ne sont plus affichées (règle « le résultat, jamais
 * le processus », 2026-11-25) : l'intention ne sert plus qu'au rendu.
 */
export type JarvisIntent = UiIntent;

/**
 * L'intention AFFICHÉE, dérivée du routeur unifié (`modules/ai/router/route.ts`).
 *
 * Ce fichier tenait son propre lexique ; la mémoire en tenait un autre, et le
 * routage d'agents un troisième — trois lectures de la même question qui ne
 * s'accordaient pas. Il n'y en a plus qu'une : celle qui décide aussi des
 * données lues et du modèle choisi.
 */
export function classifyQuestion(q: string): JarvisIntent {
  return routeQuestion(q).uiIntent;
}
