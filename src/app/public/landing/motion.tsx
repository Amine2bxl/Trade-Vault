import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import type Lenis from "lenis";
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
      options={{
        autoRaf: false,
        smoothWheel: !reduit,
        /* LE `lerp` EST UNE DÉCROISSANCE EXPONENTIELLE, par construction :
           chaque image parcourt la même FRACTION du chemin restant, donc la
           vitesse s'effondre vite puis rampe indéfiniment vers la cible.
           Plus il est bas, plus cette traîne est longue — et une traîne
           longue ne se lit pas comme de la douceur, elle se lit comme un
           défilement qui colle et qui n'arrive jamais.
           0.15 raccourcit la traîne au point qu'elle ne se remarque plus :
           il reste le lissage entre deux crans de molette, sans le sirop.
           (0.08, essayé avant, était l'erreur inverse.) */
        lerp: 0.15,
        /* Plein régime. Réduire ce facteur fait moins avancer la page à
           chaque cran : ce qu'on gagne en finesse, on le perd en sensation
           de résistance — exactement ce qu'on cherche à retirer. */
        wheelMultiplier: 1,
      }}
      ref={lenisRef}
    >
      <SynchroScrollTrigger />
      {children}
    </ReactLenis>
  );
}

/**
 * LE DÉFILEMENT NE PASSE PLUS PAR REACT.
 *
 * ── CE QUI SACCADAIT ──────────────────────────────────────────────────────
 *
 * La position de défilement vivait dans un `useState`, posé à CHAQUE
 * évènement `scroll`. Sous Lenis, cet évènement part à chaque image : la
 * vitrine entière — héros, cinq sections, quatre captures, la FAQ — se
 * reconstruisait soixante fois par seconde pour déplacer deux éléments.
 * Le scrollspy mesurait en plus quatre sections par évènement, juste après
 * ce rendu : une mesure qui suit une invalidation force le navigateur à
 * refaire la mise en page sur-le-champ. Deux fois par image.
 *
 * C'est ce cycle — rendu, invalidation, mesure forcée — qui donnait
 * l'impression que la page accrochait, et non le lissage de Lenis.
 *
 * ── CE QUI LE REMPLACE ────────────────────────────────────────────────────
 *
 * Une seule fonction par image, qui écrit directement dans le DOM les deux
 * `transform` concernés. Aucun rendu React : l'état ne remonte que quand la
 * barre FRANCHIT son seuil de densité, soit deux fois par visite.
 *
 * `transform` seul, donc composité : ces écritures ne coûtent ni mise en
 * page ni repeint.
 */
export function useDefilementSansRendu({
  jauge,
  parallaxe,
  surCollee,
  reduit,
}: {
  /** La jauge de progression de la barre. `scaleX(0→1)`. */
  jauge: RefObject<HTMLElement | null>;
  /** La capture du héros, qui monte un peu moins vite que la page. */
  parallaxe: RefObject<HTMLElement | null>;
  /** Appelé au franchissement du seuil, pas à chaque image. */
  surCollee: (collee: boolean) => void;
  reduit: boolean;
}) {
  const collee = useRef<boolean | null>(null);
  useEffect(() => {
    let demande = 0;
    const ecrire = () => {
      demande = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (jauge.current) {
        jauge.current.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      }
      if (parallaxe.current) {
        /* Plafonnée à 60px : au-delà, la capture se décroche du texte
           qu'elle illustre et on lit deux blocs qui glissent l'un contre
           l'autre. Neutralisée si le visiteur a demandé moins de mouvement. */
        parallaxe.current.style.transform = reduit
          ? ""
          : `translate3d(0,${-Math.min(y * 0.06, 60)}px,0)`;
      }
      const seuil = y > 10;
      if (seuil !== collee.current) {
        collee.current = seuil;
        surCollee(seuil);
      }
    };
    /* Au plus une écriture par image, même si l'évènement part plus souvent. */
    const auDefilement = () => {
      if (!demande) demande = requestAnimationFrame(ecrire);
    };
    ecrire();
    window.addEventListener("scroll", auDefilement, { passive: true });
    window.addEventListener("resize", auDefilement, { passive: true });
    return () => {
      window.removeEventListener("scroll", auDefilement);
      window.removeEventListener("resize", auDefilement);
      cancelAnimationFrame(demande);
    };
  }, [jauge, parallaxe, surCollee, reduit]);
}

/**
 * LE TRAJET D'UNE ANCRE — la barre de navigation, sans le décollage.
 *
 * Le défaut de Lenis est une exponentielle sortante : vitesse maximale dès
 * la première image, puis décélération. Sur trois écrans de haut, ça se lit
 * comme un lancement de fusée — la page part d'un coup et on perd le fil de
 * ce qu'on traverse.
 *
 * Deux corrections :
 *   • une courbe SYMÉTRIQUE (`easeInOutCubic`) : le départ est aussi doux
 *     que l'arrivée, il n'y a plus de coup de pied initial ;
 *   • une durée PROPORTIONNELLE à la distance, plafonnée. Sauter à la
 *     section suivante reste vif ; traverser toute la page prend le temps
 *     qu'il faut pour qu'on voie ce qui défile.
 */
const VITESSE_DE_CROISIERE = 2200; // px par seconde
const DUREE_MIN = 0.7; // s — en deçà, un saut court redevient sec
const DUREE_MAX = 2.0; // s — au-delà, on attend l'animation au lieu de lire

/* Ce que ça donne sur les distances réelles de la barre : « Problème » à
   ~900px part à 0,7s ; « Produit » à ~2500px prend 1,14s ; la FAQ, huit
   écrans plus bas, est plafonnée à 2s — soit ~4 250px/s de moyenne, contre
   ~7 000px/s atteints dès la première image avec le réglage d'origine. */

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Emmène `cible` en haut de la fenêtre et rend la durée du trajet, en
 * millisecondes — l'appelant s'en sert pour savoir quand relâcher son
 * verrou de scrollspy, plutôt que de deviner une constante.
 */
export function allerVers(lenis: { scrollTo: Lenis["scrollTo"] }, cible: HTMLElement): number {
  const distance = Math.abs(cible.getBoundingClientRect().top);
  const duree = Math.min(DUREE_MAX, Math.max(DUREE_MIN, distance / VITESSE_DE_CROISIERE));
  /* `lerp: 0` N'EST PAS DÉCORATIF. Lenis hérite du `lerp` de l'instance pour
     un `scrollTo`, et son moteur d'animation ignore `duration` et `easing`
     dès qu'un `lerp` est posé (`if (this.lerp)`). Sans ce zéro, la courbe
     ci-dessous n'est jamais lue et le trajet garde son profil d'origine. */
  lenis.scrollTo(cible, { duration: duree, easing: easeInOutCubic, lerp: 0 });
  return duree * 1000;
}

/**
 * LES APPARITIONS AU DÉFILEMENT.
 *
 * ── POURQUOI UN VOCABULAIRE, ET PAS UN GESTE ──────────────────────────────
 *
 * Un seul fondu-montée posé sur tout ce qui porte `.reveal` produit
 * exactement la sensation générique qu'on cherche à éviter : la page répond
 * la même chose à un paragraphe de transition et à la capture d'un écran du
 * produit. Or ces deux blocs ne disent pas la même chose.
 *
 * Trois gestes, choisis d'après ce que le bloc CONTIENT — donc sans une
 * seule classe ajoutée au balisage :
 *
 *   SCÈNE    un bloc qui porte une capture. Il vient de plus loin (32px) et
 *            d'un peu plus bas en échelle (0.985), et met presque une
 *            seconde à se poser. C'est le moment où le produit se présente :
 *            la plaque avance vers le lecteur au lieu de simplement exister.
 *   CHAPITRE un bloc de texte qui ouvre une section (il porte un titre).
 *            Course moyenne, durée moyenne.
 *   LIGNE    tout le reste — une phrase, une carte dans une grille de sœurs.
 *            Course courte, durée courte : ça ne doit pas se remarquer.
 *
 * ── LA PROFONDEUR VIENT DE L'ÉCART, PAS DE LA DISTANCE ────────────────────
 *
 * Dans un bloc, les enfants directs montent AUSSI, de 10px seulement, et
 * légèrement après leur parent. Les deux translations s'additionnent : le
 * texte et la plaque ne parcourent alors pas le même chemin, ce que l'œil
 * lit comme de la profondeur. C'est ce décalage — et non une course plus
 * longue — qui fait la différence entre « ça apparaît » et « ça se présente ».
 *
 * Trois règles tiennent la page honnête :
 *   • ce qui est DÉJÀ à l'écran au montage n'est jamais masqué — le contenu
 *     rendu par le serveur ne clignote pas à l'hydratation ;
 *   • on anime l'opacité, pas la visibilité : un bloc pas encore apparu reste
 *     atteignable au clavier, et le focus le fait apparaître aussitôt ;
 *   • `.reveal-visible` est toujours posée : le tracé de `.tv-draw-path` s'y
 *     accroche.
 *
 * `transform` et `opacity` uniquement, conformément à `.claude/skills/motion`.
 */

/** L'easing maison — l'équivalent GSAP de `cubic-bezier(0.16, 1, 0.3, 1)`. */
const EASE_ENTREE = "expo.out";

interface Geste {
  y: number;
  echelle: number;
  duree: number;
}
const SCENE: Geste = { y: 32, echelle: 0.985, duree: 0.95 };
const CHAPITRE: Geste = { y: 22, echelle: 1, duree: 0.8 };
const LIGNE: Geste = { y: 14, echelle: 1, duree: 0.62 };

/**
 * `.shot-frame` / `<picture>` sont le harnais des captures du produit, et
 * RIEN d'autre n'y passe : viser `img` ou `svg` ferait basculer en scène la
 * moindre carte portant une icône de 20px, ce qui rendrait au vocabulaire
 * l'uniformité qu'on vient de lui retirer.
 */
function gesteDu(bloc: HTMLElement): Geste {
  if (bloc.querySelector(".shot-frame, picture")) return SCENE;
  if (bloc.querySelector("h1, h2, h3")) return CHAPITRE;
  return LIGNE;
}

/**
 * Les enfants directs qui valent d'être décalés. En dessous de deux il n'y a
 * rien à décaler ; au-delà de six l'escalier se voit et le lecteur attend
 * (`.claude/skills/motion` : « un moment, pas un par carte »).
 */
function lignesDu(bloc: HTMLElement): HTMLElement[] {
  const enfants = Array.from(bloc.children) as HTMLElement[];
  return enfants.length >= 2 && enfants.length <= 6 ? enfants : [];
}

export function useApparitions(
  scope: RefObject<HTMLElement | null>,
  /**
   * `true` quand la page vient d'un changement de langue. Les blocs sont
   * alors montrés d'un coup, sans cascade : le visiteur relit une page qu'il
   * connaît, dans l'autre langue. Lui rejouer dix-neuf entrées échelonnées,
   * c'est deux secondes pendant lesquelles le contenu monte et se décale —
   * exactement ce qu'on lit comme un à-coup. Le fondu d'ensemble
   * (`lang-entree`) suffit à dire que quelque chose a changé.
   */
  sansCascade = false,
) {
  useGSAP(
    () => {
      const racine = scope.current;
      if (!racine) return;
      const blocs = gsap.utils.toArray<HTMLElement>(".reveal", racine);
      const montrer = (els: Element[]) => els.forEach((el) => el.classList.add("reveal-visible"));

      const entree = (els: Element[]) => {
        montrer(els);
        els.forEach((el, i) => {
          const bloc = el as HTMLElement;
          const g = gesteDu(bloc);
          const lignes = lignesDu(bloc);
          /* Le décalage entre blocs SŒURS (trois cartes d'une même grille),
             plafonné : au quatrième cran l'attente devient perceptible. */
          const tl = gsap.timeline({ delay: Math.min(i, 3) * 0.075 });
          tl.to(bloc, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: g.duree,
            ease: EASE_ENTREE,
            overwrite: "auto",
            clearProps: "opacity,transform,transition",
          });
          if (lignes.length) {
            tl.fromTo(
              lignes,
              { y: 10, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: g.duree * 0.7,
                ease: EASE_ENTREE,
                stagger: 0.06,
                overwrite: "auto",
                clearProps: "opacity,transform",
              },
              /* Après le départ du parent, pas avec lui : c'est cet écart
                 qui donne la profondeur. */
              0.09,
            );
          }
        });
      };

      /**
       * Les sections sous la ligne de flottaison sont chargées en différé
       * (`MOTION_AND_PERF.md` §B2) : elles n'existent PAS quand ce hook
       * s'exécute. Sans le `MutationObserver` plus bas, trois blocs sur
       * dix-neuf entraient sans un geste — ils se contentaient d'être là,
       * ce qui est précisément la rupture qu'on remarque.
       */
      const traites = new WeakSet<HTMLElement>();
      /** Rend le nombre de blocs nouvellement pris en charge. */
      const enroler = (candidats: HTMLElement[]): number => {
        const nouveaux = candidats.filter((el) => !traites.has(el));
        if (!nouveaux.length) return 0;
        nouveaux.forEach((el) => traites.add(el));

        const seuil = window.innerHeight * 0.9;
        const aVenir = nouveaux.filter((el) => el.getBoundingClientRect().top > seuil);
        /* Ce qui est déjà dans le cadre est montré tel quel : un bloc rendu
           par le serveur ne doit pas clignoter à l'hydratation. */
        montrer(nouveaux.filter((el) => !aVenir.includes(el)));
        if (!aVenir.length) return nouveaux.length;

        /* `transition: none` le temps de l'entrée : certaines cartes ont une
           transition CSS sur `transform` (survol) qui lisserait chaque image
           de GSAP et ferait traîner l'animation. */
        aVenir.forEach((el) => {
          const g = gesteDu(el);
          gsap.set(el, { opacity: 0, y: g.y, scale: g.echelle, transition: "none" });
        });
        /* `top 86%` plutôt qu'au ras du bord : le bloc est franchement dans
           le cadre quand il commence à monter, donc on le VOIT arriver au
           lieu de le découvrir déjà posé. */
        ScrollTrigger.batch(aVenir, { start: "top 86%", once: true, onEnter: entree });
        return nouveaux.length;
      };

      if (sansCascade) {
        montrer(blocs);
        /* Les sections différées arrivent après : elles sont montrées au
           passage, toujours sans cascade. */
        const mo = new MutationObserver(() =>
          montrer(gsap.utils.toArray<HTMLElement>(".reveal", racine)),
        );
        mo.observe(racine, { childList: true, subtree: true });
        return () => mo.disconnect();
      }

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        enroler(blocs);

        const auFocus = (ev: FocusEvent) => {
          const bloc = (ev.target as Element | null)?.closest(".reveal");
          if (bloc && !bloc.classList.contains("reveal-visible")) entree([bloc]);
        };
        racine.addEventListener("focusin", auFocus);

        /* Une seule reprise pour les deux causes, groupée sur une image :
           une capture qui arrive change la hauteur de la page (donc la
           position de tous les déclencheurs), et une section chargée en
           différé apporte en plus des blocs à enrôler.

           `ScrollTrigger.refresh()` remesure TOUS les déclencheurs : c'est
           une remise en page forcée, et l'appeler sur un accordéon qui
           s'ouvre ou un onglet qui change serait précisément le genre
           d'à-coup qu'on vient de retirer ailleurs. On ne le déclenche donc
           que si la hauteur de la page a réellement bougé, ou si de
           nouveaux blocs viennent d'être enrôlés. */
        let attente = 0;
        let hauteurConnue = racine.scrollHeight;
        const revoirLaPage = () => {
          cancelAnimationFrame(attente);
          attente = requestAnimationFrame(() => {
            const nouveaux = enroler(gsap.utils.toArray<HTMLElement>(".reveal", racine));
            const hauteur = racine.scrollHeight;
            if (!nouveaux && hauteur === hauteurConnue) return;
            hauteurConnue = hauteur;
            ScrollTrigger.refresh();
          });
        };
        const ro = new ResizeObserver(revoirLaPage);
        ro.observe(racine);
        const mo = new MutationObserver(revoirLaPage);
        mo.observe(racine, { childList: true, subtree: true });

        return () => {
          racine.removeEventListener("focusin", auFocus);
          ro.disconnect();
          mo.disconnect();
          cancelAnimationFrame(attente);
        };
      });
      mm.add(MOINS_DE_MOUVEMENT, () => {
        montrer(blocs);
        /* Même raison : `.reveal-visible` porte aussi le tracé de la ligne,
           et les sections tardives y ont droit comme les autres. */
        const mo = new MutationObserver(() =>
          montrer(gsap.utils.toArray<HTMLElement>(".reveal", racine)),
        );
        mo.observe(racine, { childList: true, subtree: true });
        return () => mo.disconnect();
      });
    },
    { scope, dependencies: [sansCascade] },
  );
}
