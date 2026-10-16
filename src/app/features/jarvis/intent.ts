import { routeQuestion, type UiIntent } from "@/modules/ai/router/route";

/**
 * DE QUOI PARLE LA QUESTION — pour que Jarvis annonce CE QU'IL FAIT.
 *
 * Pendant l'analyse, Jarvis affichait toujours les mêmes quatre étapes, quelle
 * que soit la question. Une question sur un trade, sur la performance du mois,
 * sur le risque ou sur un concept de trading ne se prépare pas de la même
 * façon : les étapes affichées disent maintenant ce que Jarvis va réellement
 * consulter. Une classification simple et déterministe — pas de tirage au
 * hasard dans une liste de phrases.
 */
export type JarvisIntent = UiIntent;

/**
 * L'intention AFFICHÉE, dérivée du routeur unifié (`modules/ai/router/route.ts`).
 *
 * Ce fichier tenait son propre lexique ; la mémoire en tenait un autre, et le
 * routage d'agents un troisième — trois lectures de la même question qui ne
 * s'accordaient pas. Il n'y en a plus qu'une : celle qui décide aussi des
 * données lues et du modèle choisi. Les étapes affichées disent donc ce que
 * Jarvis consulte réellement.
 */
export function classifyQuestion(q: string): JarvisIntent {
  return routeQuestion(q).uiIntent;
}

/** Les clés d'étapes par intention (textes dans les dictionnaires i18n). */
export const INTENT_STEPS: Record<JarvisIntent, readonly string[]> = {
  trade: ["jarvis.think.trade.1", "jarvis.think.trade.2", "jarvis.think.trade.3"],
  day: ["jarvis.think.day.1", "jarvis.think.day.2", "jarvis.think.day.3"],
  performance: ["jarvis.think.perf.1", "jarvis.think.perf.2", "jarvis.think.perf.3"],
  risk: ["jarvis.think.risk.1", "jarvis.think.risk.2", "jarvis.think.risk.3"],
  psychology: ["jarvis.think.psy.1", "jarvis.think.psy.2", "jarvis.think.psy.3"],
  goal: ["jarvis.think.goal.1", "jarvis.think.goal.2", "jarvis.think.goal.3"],
  general: ["jarvis.think.general.1", "jarvis.think.general.2"],
};
