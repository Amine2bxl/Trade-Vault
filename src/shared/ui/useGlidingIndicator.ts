import { useLayoutEffect, useState, type CSSProperties } from "react";

/**
 * LA PILULE QUI GLISSE — l'état actif d'un contrôle segmenté, façon iOS.
 *
 * La languette du rail (`Sidebar`) a montré le geste : une seule pièce, qui
 * glisse vers l'entrée choisie au lieu que chaque entrée se repeigne. Ce hook
 * le généralise aux contrôles horizontaux — onglets de section, `SubNav`,
 * périodes du tableau de bord.
 *
 * ── LA MESURE ──
 * L'élément actif est l'enfant direct de la piste qui porte
 * `aria-selected="true"` ou `aria-pressed="true"` : c'est déjà ce que lit un
 * lecteur d'écran, il n'y a pas de seconde vérité à tenir. On mesure
 * `offsetLeft`/`offsetWidth` (relatifs à la piste, qui doit être
 * `position: relative`) : la pilule vit DANS la piste, elle défile avec elle
 * quand la rangée déborde.
 *
 * ── LE PREMIER RENDU NE GLISSE PAS ──
 * La mesure est posée avant la peinture (`useLayoutEffect`), et la transition
 * n'est armée qu'après la première image : à l'arrivée sur une page, la
 * pilule est déjà à sa place, elle ne vient pas de la gauche.
 *
 * ── CE QUI LA REPLACE ──
 * Un `ResizeObserver` sur la piste ET sur chaque onglet : une traduction plus
 * longue, une police chargée en retard ou le pli du rail changent une largeur
 * sans changer l'onglet actif.
 *
 * Sans JavaScript (rendu serveur), rien n'est mesuré : l'onglet actif garde
 * son propre fond (voir `.tv-glide-on` dans styles.css).
 */
export interface GlidingIndicator<T extends HTMLElement> {
  /** À poser en `ref` sur la piste (le parent direct des onglets). Une ref
   *  « fonction » : une piste montée plus tard (après un squelette) est
   *  mesurée dès qu'elle arrive. */
  trackRef: (el: T | null) => void;
  /** La piste, une fois montée. */
  track: T | null;
  /** Vrai dès que la pilule est mesurée : la piste prend `.tv-glide-on`. */
  on: boolean;
  /** Le style de la pilule (`<span data-glide className="tv-glide">`), ou
   *  `null` tant qu'elle n'est pas mesurée. */
  style: CSSProperties | null;
  /** Vrai après la première image : la pilule peut glisser. */
  ready: boolean;
}

const ACTIVE = ':scope > [aria-selected="true"], :scope > [aria-pressed="true"]';

export function useGlidingIndicator<T extends HTMLElement = HTMLDivElement>(
  activeKey: unknown,
): GlidingIndicator<T> {
  const [track, trackRef] = useState<T | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!track) return;
    const place = () => {
      const el = track.querySelector<HTMLElement>(ACTIVE);
      if (!el || el.offsetWidth === 0) return setBox(null);
      const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      // PERF — un nouvel état seulement si la pilule BOUGE (même règle que la
      // languette du rail : l'observateur se déclenche souvent pour rien).
      setBox((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
          ? prev
          : next,
      );
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(track);
    // La pilule elle-même (`[data-glide]`) n'est pas observée : sa largeur
    // s'anime, et chaque image relancerait une mesure pour rien.
    for (const child of Array.from(track.children)) {
      if (!(child as HTMLElement).dataset.glide) ro.observe(child);
    }
    return () => ro.disconnect();
  }, [activeKey, track]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return {
    trackRef,
    track,
    on: box !== null,
    ready,
    style: box
      ? { width: box.w, height: box.h, transform: `translate3d(${box.x}px, ${box.y}px, 0)` }
      : null,
  };
}
