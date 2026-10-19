import { useEffect, useState } from "react";

/**
 * Vrai tant que la fenêtre est plus étroite que `md` (le point de rupture du
 * produit, 768px).
 *
 * Il sert aux réglages qu'une media-query CSS ne peut pas atteindre : ce qu'un
 * graphe SVG calcule en JavaScript — la largeur réservée à un axe, le format
 * d'une graduation — n'a pas de feuille de style où se laisser corriger.
 *
 * Il part sur `false` et se corrige au montage, pas avant : le rendu serveur
 * n'a pas de fenêtre, et supposer « large » évite de peindre une version
 * mobile sur un écran de bureau à la première frame.
 */
export function useIsNarrow(query = "(max-width: 767px)"): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return narrow;
}

/**
 * Même mesure, lue DÈS LE PREMIER RENDU — réservée aux surfaces qui n'existent
 * qu'après un geste (une modale ouverte d'un toucher) et ne passent donc
 * jamais par le rendu serveur. Partir sur `false` y ferait voir la version
 * bureau une image avant la version mobile.
 */
export function useIsNarrowNow(query = "(max-width: 767px)"): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return narrow;
}
