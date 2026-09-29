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
export type JarvisIntent =
  | "trade"
  | "day"
  | "performance"
  | "risk"
  | "psychology"
  | "goal"
  | "general";

const RULES: [JarvisIntent, RegExp][] = [
  [
    "day",
    /\b(hier|yesterday|aujourd'?hui|today|lundi|mardi|mercredi|jeudi|vendredi|monday|tuesday|wednesday|thursday|friday|semaine derni|last week|\d{1,2}\/\d{1,2}|le \d{1,2}\b|note)/i,
  ],
  [
    "trade",
    /\b(ce trade|this trade|dernier trade|last trade|mon trade|my trade|entr[ée]e|entry|sortie|exit|setup)/i,
  ],
  [
    "risk",
    /\b(risque|risk|stop|taille|size|lot|levier|leverage|ruine|ruin|drawdown|perte max|max loss)/i,
  ],
  [
    "psychology",
    /\b(erreur|mistake|[ée]motion|tilt|revenge|fomo|discipline|stress|peur|fear|confiance|confidence)/i,
  ],
  ["goal", /\b(objectif|goal|target|cible|challenge|prop|funded|pass)/i],
  [
    "performance",
    /\b(performance|win ?rate|p&l|pnl|profit|r[ée]sultat|stat|edge|mois|month|semaine|week|progress|am[ée]lior)/i,
  ],
];

export function classifyQuestion(q: string): JarvisIntent {
  for (const [intent, re] of RULES) if (re.test(q)) return intent;
  return "general";
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
