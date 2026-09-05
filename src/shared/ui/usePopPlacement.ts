import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * OÙ POSER UN PANNEAU FLOTTANT — à gauche ou à droite, dessous ou dessus.
 *
 * Un panneau ancré bêtement à gauche déborde dès que son champ est du côté
 * droit de son conteneur ; ancré à droite, il déborde du côté gauche. Aucun
 * choix STATIQUE n'est bon, et le débordement ne se voit pas : le panneau est
 * ROGNÉ par le premier ancêtre qui masque son débordement — dans une modale,
 * la colonne de défilement. Le calendrier perd alors sa dernière colonne, et
 * rien ne l'annonce.
 *
 * Ce hook mesure APRÈS la première peinture (le panneau doit exister pour
 * qu'on lise sa taille), compare au CADRE RÉEL — le premier ancêtre qui rogne,
 * la fenêtre à défaut — et rend l'alignement qui tient. Une seule mesure par
 * ouverture : le panneau ne bouge pas ensuite, donc rien ne clignote.
 */
export interface PopPlacement {
  /** `end` = aligné sur le bord droit du champ. */
  align: "start" | "end";
  /** `top` = déployé vers le haut. */
  side: "bottom" | "top";
}

const MARGE = 8;

/** Le premier ancêtre qui rogne — celui qui décide vraiment de la place. */
function cadreDe(el: HTMLElement): DOMRect {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const s = getComputedStyle(p);
    if (s.overflow !== "visible" || s.overflowX !== "visible" || s.overflowY !== "visible") {
      return p.getBoundingClientRect();
    }
    p = p.parentElement;
  }
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

export function usePopPlacement(ref: RefObject<HTMLElement | null>, ouvert: boolean): PopPlacement {
  const [pose, setPose] = useState<PopPlacement>({ align: "start", side: "bottom" });

  useLayoutEffect(() => {
    if (!ouvert) {
      setPose({ align: "start", side: "bottom" });
      return;
    }
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cadre = cadreDe(el);
    setPose({
      align: r.right > cadre.right - MARGE && r.width < cadre.width ? "end" : "start",
      // On ne bascule vers le haut que s'il y a VRAIMENT plus de place au-dessus :
      // sinon on échange un rognage par le bas contre un rognage par le haut.
      side:
        r.bottom > cadre.bottom - MARGE && r.top - cadre.top > cadre.bottom - r.bottom
          ? "top"
          : "bottom",
    });
  }, [ouvert, ref]);

  return pose;
}
