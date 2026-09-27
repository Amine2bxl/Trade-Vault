import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "lenis/dist/lenis.css";

/**
 * LE MOUVEMENT DE LA VITRINE — défilement doux et apparitions au défilement.
 *
 * ── PÉRIMÈTRE ─────────────────────────────────────────────────────────────
 *
 * Ce module n'est importé QUE par la landing. Lenis est monté par `Landing`,
 * jamais par `__root` ni par `App` : dès que le visiteur se connecte, la
 * landing est démontée, Lenis est détruit, et l'application retrouve le
 * défilement natif. Un défilement lissé sur les tableaux du produit y
 * casserait la lecture ligne à ligne et les listes à défilement interne.
 *
 * ── UNE SEULE BOUCLE ──────────────────────────────────────────────────────
 *
 * Lenis n'a pas sa propre boucle (`autoRaf: false`) : c'est le ticker de GSAP
 * qui le fait avancer, et chaque défilement de Lenis prévient ScrollTrigger.
 * Deux boucles désynchronisées font trembler tout déclencheur lié au scroll.
 *
 * ── MOINS DE MOUVEMENT ────────────────────────────────────────────────────
 *
 * Un visiteur qui a demandé moins de mouvement garde le défilement natif
 * (`smoothWheel: false`) et voit le contenu directement, sans apparition.
 */

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MOINS_DE_MOUVEMENT = "(prefers-reduced-motion: reduce)";

/**
 * « Moins de mouvement », suivi en direct.
 *
 * Au rendu serveur `matchMedia` n'existe pas : on part donc de `false` et on
 * corrige au montage. Partir de `true` serait plus prudent en apparence, mais
 * produirait un saut visible chez la majorité des visiteurs, qui n'ont rien
 * demandé.
 */
export function usePrefereMoinsDeMouvement() {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOINS_DE_MOUVEMENT);
    setReduit(mq.matches);
    const on = () => setReduit(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduit;
}

/** Monté DANS `<ReactLenis>` : chaque défilement de Lenis met ScrollTrigger à
    jour, et l'abonnement tombe tout seul au démontage. */
function SynchroScrollTrigger() {
  useLenis(ScrollTrigger.update);
  return null;
}

/** Le défilement doux, limité à la vitrine. */
export function DefilementDoux({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const reduit = usePrefereMoinsDeMouvement();

  useEffect(() => {
    // L'instance est lue à chaque image : elle n'existe pas encore au premier passage.
    function avance(temps: number) {
      lenisRef.current?.lenis?.raf(temps * 1000);
    }
    gsap.ticker.add(avance);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(avance);
      // Réglage global de GSAP : on rend les valeurs par défaut en partant.
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, []);

  return (
    <ReactLenis
      root
      /* Un changement d'options recrée l'instance, pas les enfants. */
      options={{ autoRaf: false, smoothWheel: !reduit, lerp: 0.1 }}
      ref={lenisRef}
    >
      <SynchroScrollTrigger />
      {children}
    </ReactLenis>
  );
}

/**
 * LES APPARITIONS AU DÉFILEMENT — fondu et montée de 18px, en cascade douce.
 *
 * Remplace l'`IntersectionObserver` + transitions CSS : même déclencheur
 * (`.reveal`), mais les blocs qui entrent ensemble partent en décalé
 * (`ScrollTrigger.batch`), au lieu de tous en même temps.
 *
 * Trois règles tiennent la page honnête :
 *   • ce qui est DÉJÀ à l'écran au montage n'est jamais masqué — le contenu
 *     rendu par le serveur ne clignote pas à l'hydratation ;
 *   • on anime l'opacité, pas la visibilité : un bloc pas encore apparu reste
 *     atteignable au clavier, et le focus le fait apparaître aussitôt ;
 *   • `.reveal-visible` est toujours posée : le tracé de `.tv-draw-path` s'y
 *     accroche.
 */
export function useApparitions(scope: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const racine = scope.current;
      if (!racine) return;
      const blocs = gsap.utils.toArray<HTMLElement>(".reveal", racine);
      const montrer = (els: Element[]) => els.forEach((el) => el.classList.add("reveal-visible"));
      const entree = (els: Element[]) => {
        montrer(els);
        gsap.to(els, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: true,
          clearProps: "opacity,transform,transition",
        });
      };

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const seuil = window.innerHeight * 0.92;
        const aVenir = blocs.filter((el) => el.getBoundingClientRect().top > seuil);
        montrer(blocs.filter((el) => !aVenir.includes(el)));
        if (!aVenir.length) return;

        /* `transition: none` le temps de l'entrée : certaines cartes ont une
           transition CSS sur `transform` (survol) qui lisserait chaque image
           de GSAP et ferait traîner l'animation. */
        gsap.set(aVenir, { opacity: 0, y: 18, transition: "none" });
        ScrollTrigger.batch(aVenir, { start: "top 92%", once: true, onEnter: entree });

        const auFocus = (ev: FocusEvent) => {
          const bloc = (ev.target as Element | null)?.closest(".reveal");
          if (
            bloc &&
            aVenir.includes(bloc as HTMLElement) &&
            !bloc.classList.contains("reveal-visible")
          ) {
            entree([bloc]);
          }
        };
        racine.addEventListener("focusin", auFocus);

        /* Les captures chargées en différé changent la hauteur de la page :
           les positions des déclencheurs doivent suivre. */
        let attente = 0;
        const ro = new ResizeObserver(() => {
          cancelAnimationFrame(attente);
          attente = requestAnimationFrame(() => ScrollTrigger.refresh());
        });
        ro.observe(racine);

        return () => {
          racine.removeEventListener("focusin", auFocus);
          ro.disconnect();
          cancelAnimationFrame(attente);
        };
      });
      mm.add(MOINS_DE_MOUVEMENT, () => montrer(blocs));
    },
    { scope },
  );
}
