import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * La largeur d'un segment. Glisse donne à tous les segments la même largeur
 * (`--lg-tab-width`, 84 px par défaut) : c'est ce qui fait glisser la pastille
 * d'un cran exact. On la cale sur le libellé le plus long, traductions
 * comprises (l'observateur la recalcule quand la langue, la police ou la
 * largeur change), sans dépasser la place disponible : sur un téléphone, un
 * libellé trop long se termine par « … » au lieu de faire déborder la page.
 * Pas de cadre défilant : la lentille doit pouvoir déborder de la piste.
 */
export function useSegmentWidth(wrapRef: RefObject<HTMLDivElement | null>, count: number): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      // La largeur NATURELLE d'un libellé : la somme de ses morceaux (icône,
      // texte entier — `scrollWidth` ignore les « … » —, cadenas) et de leurs
      // espacements. Mesurer le libellé lui-même rendrait sa largeur rognée,
      // et la mesure suivante rognerait encore.
      let natural = 0;
      wrap.querySelectorAll<HTMLElement>(".tv-seg-label").forEach((el) => {
        const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
        const parts = Array.from(el.children) as HTMLElement[];
        const sum = parts.reduce(
          (total, part) => total + Math.max(part.scrollWidth, part.getBoundingClientRect().width),
          0,
        );
        natural = Math.max(natural, sum + gap * Math.max(0, parts.length - 1));
      });
      if (!natural) return;
      // La borne est l'ÉCRAN (moins ses marges), pas le parent : un parent
      // qui s'ajuste à son contenu rendrait la mesure circulaire, et les
      // libellés rétréciraient à chaque passage.
      const room = window.innerWidth - SCREEN_GUTTER;
      const fit = room > 0 ? Math.floor(room / count) : Infinity;
      const next = Math.max(SEGMENT_MIN, Math.min(Math.ceil(natural) + SEGMENT_PAD, fit));
      setWidth((prev) => (prev === next ? prev : next));
    };
    const ro = new ResizeObserver(measure);
    // Les libellés arrivent APRÈS ce premier passage (Glisse est monté un
    // rendu plus tard, voir `WhenShown`) : on les guette, on les mesure dès
    // qu'ils sont là, et on suit ensuite leur taille (police, langue).
    const watch = () => {
      wrap.querySelectorAll(".tv-seg-label").forEach((el) => ro.observe(el));
      measure();
    };
    const mo = new MutationObserver(watch);
    mo.observe(wrap, { childList: true, subtree: true });
    watch();
    window.addEventListener("resize", measure);
    return () => {
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [wrapRef, count]);
  return width;
}
/** Marge du libellé dans son segment, et plus petit segment lisible. */
const SEGMENT_PAD = 28;
const SEGMENT_MIN = 64;
/** Les marges de page d'un téléphone (16 px de chaque côté). */
const SCREEN_GUTTER = 32;
