import { MISTAKE_OPTIONS } from "../types";
import type { TKey } from "../i18n/translations";

/**
 * Familles d'erreurs — la couche d'interprétation posée SUR les douze erreurs
 * existantes.
 *
 * POURQUOI DES FAMILLES. « FOMO entry » et « Chased entry » décrivent le même
 * défaut vu sous deux angles ; comptées séparément, chacune reste sous le seuil
 * où l'on peut dire quoi que ce soit, et le trader ne voit jamais que sa
 * première cause de pertes est l'impatience. Regroupées, la fuite devient
 * visible et mesurable.
 *
 * CE QUI N'EST PAS FAIT, DÉLIBÉRÉMENT. Aucune ligne de `trades` n'est
 * modifiée : `trades.mistakes` reste un `text[]` des libellés d'origine. Une
 * migration de données ferait perdre ce que le trader a réellement coché, pour
 * un regroupement qui peut se calculer à la lecture — et qui changera d'avis
 * plus d'une fois. La correspondance vit ici et en base ; les données brutes ne
 * bougent pas.
 *
 * LE TEST QUI COMPTE. `tests/mistakeClusters.test.ts` échoue si une entrée de
 * `MISTAKE_OPTIONS` n'a pas de famille. Ajouter une erreur sans la classer
 * casse la CI plutôt que de produire, six mois plus tard, un tableau dont la
 * somme ne fait pas le total.
 */

export const MISTAKE_CLUSTERS = [
  { id: "fomo", labelKey: "cluster.fomo", severity: 3 },
  { id: "plan_violation", labelKey: "cluster.planViolation", severity: 3 },
  { id: "risk", labelKey: "cluster.risk", severity: 4 },
  { id: "exit", labelKey: "cluster.exit", severity: 2 },
] as const satisfies readonly { id: string; labelKey: TKey; severity: number }[];

export type MistakeClusterId = (typeof MISTAKE_CLUSTERS)[number]["id"];

export type Mistake = (typeof MISTAKE_OPTIONS)[number];

/**
 * Une erreur → une famille. `Record<Mistake, …>` : oublier une erreur ne
 * compile pas, ce qui rend le test ci-dessous redondant côté TypeScript — mais
 * le test protège aussi la table SQL, que le compilateur ne voit pas.
 */
export const MISTAKE_TO_CLUSTER: Record<Mistake, MistakeClusterId> = {
  "FOMO entry": "fomo",
  "Chased entry": "fomo",
  "Ignored market conditions": "fomo",

  "Ignored plan": "plan_violation",
  "Size too large": "plan_violation",
  "Averaged down": "plan_violation",

  "No stop loss": "risk",
  Overtrading: "risk",
  "Revenge trade": "risk",
  "Low liquidity": "risk",

  "Premature exit": "exit",
  "Holding too long": "exit",
};

/** La famille d'une erreur, ou `null` si la valeur ne vient pas du produit. */
export function clusterOf(mistake: string): MistakeClusterId | null {
  return (MISTAKE_TO_CLUSTER as Record<string, MistakeClusterId | undefined>)[mistake] ?? null;
}

/**
 * Répartition des erreurs d'une liste de trades par famille.
 *
 * Rend TOUJOURS les quatre familles, y compris à zéro : une famille absente du
 * résultat serait lue comme « pas de données » alors qu'elle signifie « aucune
 * erreur de ce type », deux choses différentes. Rend aussi `n`, le nombre de
 * trades observés — aucun affichage ne doit pouvoir montrer une part sans sa
 * taille d'échantillon.
 */
export function clusterBreakdown(trades: { mistakes?: string[] | null }[]): {
  n: number;
  counts: Record<MistakeClusterId, number>;
  unmapped: number;
} {
  const counts = { fomo: 0, plan_violation: 0, risk: 0, exit: 0 } as Record<
    MistakeClusterId,
    number
  >;
  let unmapped = 0;
  for (const trade of trades) {
    for (const mistake of trade.mistakes ?? []) {
      const cluster = clusterOf(mistake);
      if (cluster) counts[cluster] += 1;
      // Une erreur inconnue est comptée à part plutôt qu'ignorée : un total qui
      // ne se boucle pas doit être visible, pas silencieux.
      else unmapped += 1;
    }
  }
  return { n: trades.length, counts, unmapped };
}
