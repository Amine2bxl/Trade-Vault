/**
 * Synchronisation page ↔ URL — module PUR.
 *
 * POURQUOI. L'application authentifiée est une seule route : la page courante
 * ne vivait que dans un état React recopié en `sessionStorage`. Trois
 * conséquences réelles :
 *
 *  1. **Le bouton retour quitte l'application.** Sur Android c'est le geste de
 *     navigation principal ; un trader qui ouvre Analytics puis fait « retour »
 *     sort de TradeVault au lieu de revenir au tableau de bord.
 *  2. **Aucune page n'est mesurable.** Toute la navigation se produit sous une
 *     seule URL, donc aucun outil d'analytics ne peut distinguer les écrans :
 *     impossible de savoir quelle page retient, laquelle est ignorée.
 *  3. **Rien n'est partageable ni remis en signet.**
 *
 * CE QUE CE MODULE NE FAIT PAS. Il n'apporte aucun bénéfice SEO, et c'est
 * normal : ces écrans sont derrière authentification, aucun crawler ne les
 * atteint. Le référencement se joue sur les routes publiques, qui ont déjà
 * leurs balises.
 *
 * CHOIX : un paramètre de requête (`?p=journal`) plutôt que 19 routes fichiers.
 * Le routage complet imposerait de déplacer le shell authentifié, la garde
 * d'onboarding et le SSR — un refactor large et risqué pour un gain
 * supplémentaire nul, puisque ces pages n'ont pas vocation à être indexées.
 * Le paramètre donne le bouton retour, la mesure et le partage, sans toucher à
 * l'architecture.
 */

import { isPage, type Page } from "../types";

/** Page par défaut — le tableau de bord est l'écran d'accueil du produit. */
export const DEFAULT_PAGE: Page = "dashboard";

/** Nom du paramètre. Court : il apparaît dans chaque URL partagée. */
export const PAGE_PARAM = "p";

/**
 * Lit la page depuis une URL.
 *
 * Une valeur inconnue (URL trafiquée, page supprimée depuis un partage ancien)
 * retombe sur le défaut au lieu d'afficher un écran vide : `isPage` est la
 * même garde que partout ailleurs, il n'y a pas de seconde liste de pages.
 */
export function pageFromSearch(search: string): Page | null {
  try {
    const value = new URLSearchParams(search).get(PAGE_PARAM);
    return isPage(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Construit l'URL d'une page en PRÉSERVANT les autres paramètres.
 *
 * Essentiel : les liens de campagne (`?upgrade=1&promo=…`) et les
 * notifications (`?report=2026-07`) portent des paramètres que la navigation
 * ne doit pas effacer — les écraser casserait l'attribution marketing et le
 * lien profond au moment précis où l'utilisateur l'utilise.
 *
 * Le tableau de bord étant la page par défaut, son paramètre est OMIS : l'URL
 * d'accueil reste propre.
 */
export function buildPageUrl(pathname: string, search: string, page: Page): string {
  const params = new URLSearchParams(search);
  if (page === DEFAULT_PAGE) params.delete(PAGE_PARAM);
  else params.set(PAGE_PARAM, page);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
