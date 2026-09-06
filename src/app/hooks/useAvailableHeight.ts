import { useEffect, useRef, useState, type RefObject } from "react";

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
export function useAvailableHeight(): {
  boxRef: RefObject<HTMLDivElement | null>;
  height: number | undefined;
} {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const mesurer = () => {
      const haut = el.getBoundingClientRect().top;
      // Mobile : en plus des 84px de widgets fixes (nav + sous-comptes + dock),
      // le `<main>` réserve ~140px de padding bas pour ne jamais masquer de
      // contenu. On rend la page dans ce qui reste réellement visible.
      const basse = window.innerWidth < 768 ? 172 : 16;
      setHeight(Math.max(360, Math.round(window.innerHeight - haut - basse)));
    };

    // Trois mesures, comme la page Jarvis : la première tombe avant que
    // `usePageLead`/`usePageActions` n'aient garni la barre de tête ; la trame
    // et le filet à 200 ms rattrapent une fois la barre remplie.
    mesurer();
    const trame = requestAnimationFrame(mesurer);
    const filet = setTimeout(mesurer, 200);
    window.addEventListener("resize", mesurer);
    return () => {
      cancelAnimationFrame(trame);
      clearTimeout(filet);
      window.removeEventListener("resize", mesurer);
    };
  }, []);

  return { boxRef, height };
}