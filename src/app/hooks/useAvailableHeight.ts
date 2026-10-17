import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

// Mesurer AVANT la peinture (côté client) ; `useEffect` au rendu serveur, où
// `useLayoutEffect` n'a aucun sens et avertit.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * La hauteur VRAIMENT disponible sous la barre de tête — mesurée, pas devinée.
 *
 * Les pages « plein écran » (Monte-Carlo, Calendrier) ne doivent pas défiler :
 * tout doit tenir dans la fenêtre. Une hauteur écrite à la main
 * (`calc(100dvh - 9rem)`) est une hypothèse sur la hauteur de la barre — et
 * elle est fausse dès que la barre change (elle se replie dans la marge quand
 * la section n'a qu'une vue). On lit donc le haut du cadre réel avec
 * `getBoundingClientRect().top`, et on descend jusqu'au bas de la fenêtre,
 * moins une marge basse qui varie : 84px sur mobile (nav + widgets fixes
 * flottent par-dessus), 16px sur desktop.
 */
/**
 * Le haut de l'élément tel qu'il serait SANS défilement.
 *
 * `getBoundingClientRect().top` est relatif à la fenêtre : si `<main>` a déjà
 * défilé de S pixels au moment de la mesure, le haut remonte de S et la
 * hauteur calculée GRANDIT de S. La page s'allonge, on peut défiler plus
 * loin, la mesure suivante (un `resize` : clavier, barre d'outils, rotation)
 * l'allonge encore — la boucle qui faisait « buguer puis planter » les pages
 * plein écran sur mobile quand on descendait assez bas. On rajoute donc le
 * défilement de chaque ancêtre : la mesure ne dépend plus de la position.
 */
export function topAtRest(el: HTMLElement): number {
  const layout = layoutTop(el, null);
  if (layout !== null) return layout;
  let top = el.getBoundingClientRect().top;
  for (let p = el.parentElement; p; p = p.parentElement) top += p.scrollTop;
  return top + (window.scrollY || 0);
}

/**
 * Le haut de l'élément EN MISE EN PAGE, insensible aux transformations.
 *
 * `getBoundingClientRect()` voit les `transform` : mesuré pendant l'entrée
 * d'une page (`.page-in` la fait monter de 10 px), le bloc paraissait plus bas
 * qu'il ne l'est, et sa hauteur calculée trop courte d'autant — sans
 * `ResizeObserver` pour s'en apercevoir, une transformation ne changeant
 * aucune taille. `offsetTop` donne la position de mise en page, transformée
 * ou non, défilée ou non. On remonte la chaîne des `offsetParent` jusqu'à
 * `stop` (la fenêtre de défilement), ou jusqu'au document si `stop` est nul.
 * `null` si la chaîne ne passe pas par `stop` (élément fixe, détaché…).
 */
function layoutTop(el: HTMLElement, stop: HTMLElement | null): number | null {
  let top = 0;
  let n: HTMLElement | null = el;
  while (n && n !== stop) {
    top += n.offsetTop;
    const parent = n.offsetParent as HTMLElement | null;
    if (!parent) return stop ? null : top;
    if (parent !== stop) top += parent.clientTop;
    n = parent;
  }
  return n === stop ? top : null;
}

/**
 * La hauteur de la fenêtre qui ne bouge pas. Sur iOS, `innerHeight` varie
 * avec la barre d'adresse ; `clientHeight` de la racine est la fenêtre de mise
 * en page, stable — la page tient donc aussi quand la barre est dépliée.
 */
export function stableViewportHeight(): number {
  const h = document.documentElement.clientHeight;
  return h > 0 ? Math.min(h, window.innerHeight) : window.innerHeight;
}

/**
 * Observe ce qui, en changeant de taille, déplace le haut du bloc ou le bas de
 * la fenêtre : la fenêtre de défilement et la barre de tête de la page.
 * `ResizeObserver` notifie APRÈS la mise en page mais AVANT la peinture : une
 * barre de tête qui se garnit est donc absorbée dans la même image.
 */
export function observeLayout(el: HTMLElement, onChange: () => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  // `flushSync` : un `setState` venu d'un observateur est sinon rendu plus
  // tard, APRÈS la peinture — une image à l'ancienne hauteur, le saut même
  // qu'on chasse. Forcé ici, le nouveau rendu passe avant la peinture.
  const ro = new ResizeObserver(() => flushSync(onChange));
  const sc = el.closest("main");
  if (sc) ro.observe(sc);
  const head = sc?.querySelector(".app-page-head");
  if (head) ro.observe(head);
  return () => ro.disconnect();
}

export function useAvailableHeight(): {
  boxRef: RefObject<HTMLDivElement | null>;
  height: number | undefined;
} {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  /* ── LE « ZOOM EN DEUX TEMPS » ─────────────────────────────────────────
   *
   * La mesure tombait dans un `useEffect`, donc APRÈS la première peinture :
   * la page s'affichait à sa hauteur naturelle, puis s'étirait à la hauteur
   * mesurée. Et la barre de tête se garnissait elle aussi après coup (voir
   * `usePageActions`) : un filet à 200 ms re-mesurait, et la page bougeait une
   * SECONDE fois. Sur le calendrier, la grille passait de 556 à 688 puis à
   * 698 px — l'effet d'un zoom qui s'y reprend à deux fois.
   *
   * Mesure maintenant avant la peinture, et `ResizeObserver` sur la fenêtre
   * et la barre de tête : la première image est déjà la bonne. */
  useIsomorphicLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const mesurer = () => {
      const sc = el.closest("main");
      if (sc) {
        /* MESURÉ DANS LA FENÊTRE DE DÉFILEMENT, PAS DEVINÉ.
           La marge basse était une constante (16px sur bureau, 172px sur
           téléphone) : une hypothèse sur les paddings qui suivent le bloc.
           Sur bureau, le padding de page en valait 36 — le Journal débordait
           de 20px et `<main>` défilait alors que la page se veut fixe. On
           additionne donc ce qui suit RÉELLEMENT le bloc : les paddings,
           bordures et marges basses de chaque ancêtre jusqu'à `<main>`
           (dont les 140px réservés aux widgets flottants sur téléphone). */
        const posee = layoutTop(el, sc);
        const haut =
          posee !== null
            ? posee + sc.clientTop
            : el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
        let queue = parseFloat(getComputedStyle(el).marginBottom) || 0;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const cs = getComputedStyle(a);
          queue += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
          if (a === sc) break;
          queue += parseFloat(cs.marginBottom) || 0;
        }
        const h = Math.max(360, Math.round(sc.clientHeight - haut - queue));
        setHeight((prev) => (prev === h ? prev : h));
        return;
      }
      const haut = topAtRest(el);
      // Hors de la coquille (aucun `<main>`) : l'ancienne estimation.
      const basse = window.innerWidth < 768 ? 172 : 16;
      setHeight(Math.max(360, Math.round(stableViewportHeight() - haut - basse)));
    };

    mesurer();
    const stop = observeLayout(el, mesurer);
    window.addEventListener("resize", mesurer);
    return () => {
      stop();
      window.removeEventListener("resize", mesurer);
    };
  }, []);

  return { boxRef, height };
}
