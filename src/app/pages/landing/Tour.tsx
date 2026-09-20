import type { ReactNode } from "react";
import { ShotOuVisuel } from "./ProductShot";
import { useLandingT, type LandingKey } from "./i18n";

/**
 * LA VISITE DU PRODUIT — cinq écrans, une phrase chacun.
 *
 * ── CE QUE CETTE SECTION REMPLACE ──────────────────────────────────────────
 *
 * Six sections séparées, chacune avec son titre, son sous-titre, son
 * paragraphe et sa grille de trois cartes : 4 300 px pour dire ce que le
 * produit fait. Le visiteur qui défile n'en lisait aucune en entier — et deux
 * d'entre elles répétaient un argument déjà donné plus haut.
 *
 * Ici, chaque écran a DROIT À UNE PHRASE et à une seule. Si la capture ne se
 * suffit pas avec une phrase, ce n'est pas la phrase qui manque : c'est que
 * l'écran n'avait rien à faire sur une page de vente.
 *
 * ── L'ALTERNANCE ───────────────────────────────────────────────────────────
 *
 * La capture change de côté à chaque rangée. Ce n'est pas décoratif : cinq
 * blocs identiques empilés se lisent comme une liste qu'on saute, alors que
 * l'alternance oblige l'œil à traverser la page et marque la séparation entre
 * deux écrans sans avoir besoin d'un filet.
 */

export interface EcranProduit {
  /** Le nom du fichier dans `src/assets/product/`, sans extension. */
  nom: string;
  titre: LandingKey;
  texte: LandingKey;
  alt: LandingKey;
  /** L'illustration tant que la capture n'est pas déposée. */
  repli: ReactNode;
}

function Rangee({ e, index }: { e: EcranProduit; index: number }) {
  const { t } = useLandingT();
  // Les rangées impaires renvoient la capture à droite.
  const inverse = index % 2 === 1;

  /* L'ALTERNANCE SE JOUE EN CSS, PAS EN CLASSES UTILITAIRES.
   *
   * La première version combinait `order-*` et `col-start-*` sur les mêmes
   * éléments : deux mécanismes de placement de grille qui se contredisent, et
   * la capture sortait de sa colonne. Surtout, déplacer la capture en colonne
   * 2 la faisait atterrir dans la piste ÉTROITE (0.85fr) — l'alternance
   * changeait donc sa taille d'une rangée à l'autre.
   *
   * `.tour-row--flip` inverse le GABARIT de colonnes en même temps que
   * l'ordre : la capture garde sa largeur, quel que soit son côté. */
  return (
    <div className={`tour-row reveal${inverse ? " tour-row--flip" : ""}`}>
      <div className="tour-shot-col">
        <ShotOuVisuel
          nom={e.nom}
          alt={t(e.alt)}
          /* Pas de légende : le titre de la rangée, à côté, dit déjà ce que
             l'écran montre. Deux textes pour une image, c'est un de trop. */
          repli={e.repli}
          className="tour-shot"
        />
      </div>
      <div className="tour-text-col">
        <h3 className="font-display text-[clamp(1.35rem,2.4vw,1.75rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-white">
          {t(e.titre)}
        </h3>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-7 text-slate-400">{t(e.texte)}</p>
      </div>
    </div>
  );
}

export function TourProduit({ ecrans }: { ecrans: EcranProduit[] }) {
  const { t } = useLandingT();
  return (
    <section id="product" className="relative section-divider py-11 sm:py-16 lg:py-24">
      <div className="lp-container">
        <h2 className="reveal mx-auto max-w-2xl text-center font-display text-[clamp(1.75rem,3.4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
          {t("v2.tour.title.a")}{" "}
          <span className="text-[var(--tv-text-secondary)]">{t("v2.tour.title.b")}</span>
        </h2>
        <div className="mt-10 space-y-12 sm:mt-14 sm:space-y-16 lg:mt-20 lg:space-y-24">
          {ecrans.map((e, i) => (
            <Rangee key={e.nom} e={e} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
