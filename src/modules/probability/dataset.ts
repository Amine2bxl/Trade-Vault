/**
 * Dataset de simulation — le contrat d'ENTRÉE du moteur probabiliste.
 *
 * POURQUOI CETTE COUCHE. Le moteur ne doit connaître ni `Trade`, ni Supabase,
 * ni le format du CSV d'origine. Il consomme une série de résultats et rien
 * d'autre. Cette frontière est ce qui permet de le tester sans base de
 * données, de le faire tourner dans un Web Worker, et de lui donner demain
 * des trades venus d'un import qu'on n'a pas encore imaginé.
 *
 * ── DEUX UNITÉS, ET POURQUOI LES DEUX ──────────────────────────────────────
 * Chaque résultat est exprimé en DOLLARS et, quand c'est possible, en R.
 *
 * Le R est l'unité honnête pour simuler un changement de risque : « et si je
 * risquais 0,5 % au lieu de 1 % ? » se répond en multipliant le risque par
 * 0,5, pas en inventant un P&L. Le dollar reste nécessaire pour confronter la
 * trajectoire aux règles du compte, qui sont en dollars (drawdown max, perte
 * journalière).
 *
 * Un trade sans risque renseigné n'a PAS de R. On ne le fabrique pas : le
 * champ reste `null` et toute analyse qui en dépend se désactive en le
 * disant. Inventer un R à partir d'un risque supposé produirait des
 * probabilités qui ont l'air rigoureuses et ne le sont pas — c'est exactement
 * le genre de chiffre qui détruit la confiance quand le trader s'en aperçoit.
 *
 * ── CE QU'ON NE FAIT PAS ───────────────────────────────────────────────────
 * Aucune statistique n'est recalculée ici. Win rate, expectancy, profit
 * factor et drawdown ont déjà leurs moteurs canoniques (`tradeCalcs`,
 * `quantStats`) ; en écrire une seconde version produirait deux chiffres
 * différents pour la même grandeur, ce que le projet interdit.
 */

/** Un résultat de trade, réduit à ce dont la simulation a besoin. */
export interface SimTrade {
  /** Résultat en devise du compte. Toujours présent. */
  pnl: number;
  /** Résultat en R. `null` quand le risque n'était pas renseigné. */
  r: number | null;
  /** Jour de bourse (`YYYY-MM-DD`) — sert à reconstruire les pertes
   *  journalières et la fréquence de trading. */
  day: string;
}

/** L'échantillon historique dans lequel le moteur rééchantillonne. */
export interface SimDataset {
  trades: SimTrade[];
  /** Nombre de jours de bourse distincts couverts par l'historique. */
  tradingDays: number;
  /** Trades par jour de bourse — sert à convertir « 30 jours » en nombre de
   *  trades. `null` si l'historique ne couvre aucun jour. */
  tradesPerDay: number | null;
  /** Part des trades qui portent un R exploitable. En dessous de 1, les
   *  scénarios exprimés en R ne couvrent pas tout l'historique et l'UI doit
   *  le dire. */
  rCoverage: number;
}

/** Entrée minimale acceptée : n'importe quel objet portant un P&L et une date. */
export interface TradeLike {
  pnl: number;
  date: string;
  riskAmount?: number | null;
  rMultiple?: number | null;
}

/**
 * Construit le dataset à partir de trades quelconques.
 *
 * Le R n'est retenu que si le trade portait un risque STRICTEMENT positif :
 * un `rMultiple` stocké alors que `riskAmount` vaut 0 est une valeur par
 * défaut du formulaire, pas une mesure. La retenir ferait entrer des zéros
 * dans la distribution des R et écraserait l'expectancy vers le bas.
 */
export function buildDataset(trades: readonly TradeLike[]): SimDataset {
  const out: SimTrade[] = [];
  const days = new Set<string>();
  let withR = 0;

  for (const t of trades) {
    if (!Number.isFinite(t.pnl)) continue;
    const day = typeof t.date === "string" ? t.date.slice(0, 10) : "";
    const hasRisk = typeof t.riskAmount === "number" && t.riskAmount > 0;
    const r = hasRisk && Number.isFinite(t.rMultiple) ? (t.rMultiple as number) : null;
    if (r !== null) withR++;
    if (day) days.add(day);
    out.push({ pnl: t.pnl, r, day });
  }

  const tradingDays = days.size;
  return {
    trades: out,
    tradingDays,
    tradesPerDay: tradingDays > 0 ? out.length / tradingDays : null,
    rCoverage: out.length > 0 ? withR / out.length : 0,
  };
}

/**
 * Applique un changement de risque à un résultat.
 *
 * `riskMultiplier` de 0,5 signifie « je risque la moitié ». Le résultat en
 * dollars est mis à l'échelle ; le R, lui, NE CHANGE PAS — c'est un ratio.
 * Risquer 250 pour gagner 500 ou 125 pour gagner 250, c'est le même trade :
 * 2R. C'est précisément ce qui rend la question « et si je risquais moins ? »
 * simulable honnêtement : le comportement est supposé identique, seule la
 * taille de position change.
 *
 * LIMITE ASSUMÉE, à dire au trader : ce modèle suppose que réduire le risque
 * ne change pas la qualité des décisions. C'est faux pour beaucoup de traders
 * — certains tiennent mieux leurs stops quand l'enjeu est plus petit. La
 * simulation répond « à comportement identique », jamais « ce qui va se
 * passer ».
 */
export function scaleRisk(trade: SimTrade, riskMultiplier: number): SimTrade {
  if (riskMultiplier === 1) return trade;
  return { ...trade, pnl: trade.pnl * riskMultiplier };
}

/**
 * Nombre de trades correspondant à un horizon exprimé en jours de bourse.
 *
 * Rend `null` quand l'historique ne permet pas d'estimer une fréquence :
 * l'appelant doit alors demander un horizon en trades plutôt que d'inventer
 * une cadence. Un trader qui a tout journalisé le même jour n'a pas de
 * fréquence mesurable.
 */
export function tradesForDays(
  dataset: SimDataset,
  days: number,
  overridePerDay?: number | null,
): number | null {
  const perDay = overridePerDay ?? dataset.tradesPerDay;
  if (!perDay || perDay <= 0 || days <= 0) return null;
  return Math.max(1, Math.round(perDay * days));
}
