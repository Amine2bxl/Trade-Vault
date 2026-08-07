/**
 * Page ↔ URL — module PUR.
 *
 * Chaque écran authentifié a désormais sa propre URL : `/journal`,
 * `/settings`, `/analytics`… Le tableau de bord vit à la racine `/`.
 *
 * POURQUOI DES CHEMINS ET PLUS `?p=`. Le paramètre de requête était une étape
 * intermédiaire : il apportait le bouton retour et la mesure par écran, mais
 * `/?p=settings` n'est pas une adresse qu'on partage ni qu'on retient. Un
 * chemin l'est, et c'est aussi ce qu'attendent les outils d'analytics, les
 * raccourcis PWA et les liens profonds des emails.
 *
 * COMPATIBILITÉ ASCENDANTE. Les anciennes URL `?p=xxx` continuent de
 * fonctionner : elles sont reconnues puis RÉÉCRITES en chemin propre, sans
 * ajouter d'entrée d'historique (`replaceState`) — un lien partagé hier ne
 * doit pas se transformer en aller-retour aujourd'hui.
 */

import { isPage, type Page } from "../types";

/** Page par défaut — le tableau de bord est l'écran d'accueil, servi à `/`. */
export const DEFAULT_PAGE: Page = "dashboard";

/** Ancien paramètre, conservé UNIQUEMENT pour la reconnaissance des liens. */
export const LEGACY_PAGE_PARAM = "p";

/**
 * Chemin canonique d'une page.
 *
 * Le tableau de bord est à la racine plutôt qu'à `/dashboard` : c'est la page
 * d'accueil de l'application, et une redirection permanente de l'une vers
 * l'autre coûterait un aller-retour à chaque connexion.
 */
export function pathForPage(page: Page): string {
  return page === DEFAULT_PAGE ? "/" : `/${page}`;
}

/**
 * Lit la page depuis un chemin.
 *
 * Renvoie `null` si le chemin ne correspond à aucune page — la route se charge
 * alors d'afficher un 404 plutôt qu'un écran vide.
 */
export function pageFromPath(pathname: string): Page | null {
  const seg = pathname.replace(/^\/+|\/+$/g, "");
  if (seg === "") return DEFAULT_PAGE;
  return isPage(seg) ? seg : null;
}

/** Lit la page depuis l'ANCIEN format `?p=`. Utilisé pour la migration seule. */
export function pageFromLegacySearch(search: string): Page | null {
  try {
    const value = new URLSearchParams(search).get(LEGACY_PAGE_PARAM);
    return isPage(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Construit l'URL complète d'une page en PRÉSERVANT les autres paramètres.
 *
 * Essentiel : les liens de campagne (`?upgrade=1&promo=…`) et de notification
 * (`?report=2026-07`) portent des paramètres que la navigation ne doit pas
 * effacer — les perdre casserait l'attribution marketing et le lien profond au
 * moment précis où l'utilisateur s'en sert. Seul `p` est retiré, puisqu'il est
 * remplacé par le chemin.
 */
export function buildPageUrl(page: Page, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(LEGACY_PAGE_PARAM);
  const qs = params.toString();
  const path = pathForPage(page);
  return qs ? `${path}?${qs}` : path;
}

/**
 * Résout l'URL d'arrivée depuis une adresse quelconque.
 *
 * Rend la page à afficher, et `redirectTo` quand l'URL doit être réécrite
 * (ancien format `?p=`). `null` en page signifie « aucune correspondance » —
 * la route affichera un 404.
 */
export function resolveLocation(
  pathname: string,
  search: string,
): { page: Page | null; redirectTo: string | null } {
  const legacy = pageFromLegacySearch(search);
  // L'ancien format gagne sur le chemin : `/?p=journal` doit mener au journal,
  // pas au tableau de bord. C'est exactement la forme des liens déjà partagés.
  if (legacy) return { page: legacy, redirectTo: buildPageUrl(legacy, search) };
  return { page: pageFromPath(pathname), redirectTo: null };
}
