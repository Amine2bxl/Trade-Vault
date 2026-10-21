/**
 * LES TRADES, EN MULTIPLES DE R — l'entrée de la simulation Monte-Carlo.
 *
 * Ce module ne simule plus rien : le moteur vit dans `simulation.ts` (dix mille
 * tirages par tranches, tableaux typés) et l'edge dans `strategy.ts`. Il reste
 * ici les deux opérations que le journal et l'import CSV partagent : lire un
 * trade comme un multiple de R, et DÉRIVER ce multiple quand un export de
 * courtier ne le porte pas.
 */

export interface RMultipleSample {
  r: number; // multiple de R signé : +2.4, -1.0, 0 pour un neutre
  pnl: number; // P&L en devise
  isWin: boolean;
  isLoss: boolean;
  isBE: boolean;
}

export function extractRSamples(
  trades: { pnl: number; rMultiple: number; direction: "long" | "short" | "be" }[],
): RMultipleSample[] {
  return trades.map((t) => ({
    r: t.rMultiple,
    pnl: t.pnl,
    isWin: t.direction !== "be" && t.pnl > 0,
    isLoss: t.direction !== "be" && t.pnl < 0,
    isBE: t.direction === "be",
  }));
}

/**
 * DÉRIVER UN MULTIPLE R À PARTIR DU SEUL P&L.
 *
 * Un export de courtier ne porte presque jamais de multiple R : il donne un
 * P&L, et rien qui dise ce que le trade RISQUAIT. `rMultiple` retombe alors à
 * 0 sur chaque ligne — et une simulation nourrie de zéros ne bouge pas :
 * soixante trades lus, une courbe parfaitement plate, 0 % de réussite quels
 * que soient les réglages. Le fichier est bien importé, la page ne dit rien.
 *
 * L'unité de risque est donc lue DANS le fichier : la PERTE MÉDIANE. C'est ce
 * qu'un trader risque typiquement par trade, c'est robuste aux quelques pertes
 * énormes qui fausseraient une moyenne, et ça rend le R d'un CSV comparable à
 * celui du journal.
 *
 * Ne touche à rien si le fichier porte déjà des R, ou s'il ne contient aucune
 * perte (aucune unité à en tirer) : rendre les trades inchangés vaut mieux que
 * d'inventer une échelle.
 *
 * Extrait de la page, où il vivait inline — donc intestable, pour la seule
 * branche d'import que personne ne peut vérifier à l'œil. Le journal y passe
 * aussi : un journal importé d'un courtier ne porte pas toujours de R.
 */
export function deriveRFromPnl<T extends { pnl: number; rMultiple: number }>(trades: T[]): T[] {
  if (trades.some((t) => t.rMultiple !== 0)) return trades;

  const pertes = trades
    .filter((t) => t.pnl < 0)
    .map((t) => Math.abs(t.pnl))
    .sort((a, b) => a - b);
  if (pertes.length === 0) return trades;

  const unite = pertes[Math.floor(pertes.length / 2)];
  if (unite <= 0) return trades;

  return trades.map((t) => ({ ...t, rMultiple: Math.round((t.pnl / unite) * 100) / 100 }));
}
