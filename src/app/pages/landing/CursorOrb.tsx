import { useEffect, useRef } from "react";

/**
 * L'ORBE QUI SUIT LE CURSEUR.
 *
 * ── CE QU'ELLE EST, ET CE QU'ELLE N'EST PAS ────────────────────────────────
 *
 * Une lueur très faible, en retard sur le pointeur. Elle ne remplace pas le
 * curseur — le curseur système reste visible et cliquable. Masquer le vrai
 * curseur pour le remplacer par un dessin est le travers classique de cet
 * effet : on gagne trois secondes d'effet, on perd l'affordance de chaque
 * bouton et l'accessibilité avec.
 *
 * ── POURQUOI ELLE EST EN RETARD ────────────────────────────────────────────
 *
 * Collée au pointeur, elle serait invisible (elle vivrait sous le curseur) et
 * donnerait un effet de calque sale. Un suivi amorti — la lueur rattrape 12 %
 * de la distance par image — produit une traîne qui se lit comme de la masse.
 * C'est ce retard qui fait « objet », pas la taille ni la luminosité.
 *
 * ── CE QUI GARANTIT QUE ÇA NE COÛTE RIEN ───────────────────────────────────
 *
 *  • Une seule boucle `requestAnimationFrame`, qui S'ARRÊTE quand le pointeur
 *    ne bouge plus (plus aucune image calculée au repos).
 *  • `transform` uniquement : le compositeur s'en charge, aucune remise en
 *    page, aucun repeint.
 *  • `pointer-events: none` : elle ne peut intercepter aucun clic.
 *  • Rien du tout si le visiteur a demandé moins de mouvement, ou s'il n'a pas
 *    de pointeur fin — sur un écran tactile, il n'y a pas de curseur à suivre,
 *    et l'orbe resterait figée dans un coin.
 */
export function CursorOrb() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Pointeur grossier (doigt) ou mouvement réduit : on ne monte rien.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cibleX = window.innerWidth / 2;
    let cibleY = window.innerHeight / 2;
    let x = cibleX;
    let y = cibleY;
    let frame = 0;
    let vivant = false;

    const boucle = () => {
      const dx = cibleX - x;
      const dy = cibleY - y;
      x += dx * 0.12;
      y += dy * 0.12;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      // Sous un demi-pixel d'écart, l'œil ne distingue plus rien : on rend la
      // main au navigateur plutôt que de tourner indéfiniment.
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        vivant = false;
        return;
      }
      frame = requestAnimationFrame(boucle);
    };

    const onMove = (e: PointerEvent) => {
      cibleX = e.clientX;
      cibleY = e.clientY;
      el.style.opacity = "1";
      if (!vivant) {
        vivant = true;
        frame = requestAnimationFrame(boucle);
      }
    };
    // Sortie de fenêtre : l'orbe s'éteint au lieu de rester collée à un bord.
    const onLeave = () => {
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="cursor-orb" aria-hidden />;
}
