import type { ReactNode } from "react";
import { ShotOuVisuel } from "./ProductShot";
import { shot } from "./shots";
import { useLandingT, type LandingKey } from "./i18n";

/**
 * LA VISITE DU PRODUIT - cinq écrans, une phrase chacun.
 *
 * ── POURQUOI LA CAPTURE EST PASSÉE EN PLEINE LARGEUR ──────────────────────
 *
 * Elle vivait dans une colonne, en alternance gauche/droite. C'était joli et
 * illisible : mesurée, la capture tombait à 602px sur un écran de 1440 alors
 * que sa mise en page avait été calculée sur 1352px. Échelle 0,45 - le texte
 * du produit passait de 13px à 6px. Une capture qu'on ne déchiffre pas ne
 * prouve rien ; elle fait une texture entre deux paragraphes.
 *
 * Le titre et sa phrase montent donc AU-DESSUS, et la capture prend toute la
 * largeur en dessous (~1200px, échelle 0,89). C'est la disposition de toutes
 * les vitrines qui vendent un logiciel visuel, et c'est la seule qui laisse
 * lire ce qu'on montre.
 *
 * ── LE CHEVAUCHEMENT ──────────────────────────────────────────────────────
 *
 * La capture TÉLÉPHONE du même écran se pose sur le coin de la capture de
 * bureau. Ce n'est pas un ornement : les deux sont des captures RÉELLES du
 * même produit, et les voir ensemble dit « ça marche aussi dans ta poche »
 * sans une ligne de texte. Rien n'est redessiné, rien n'est simulé.
 *
 * Elle ne s'affiche qu'à partir de `lg` : en dessous, elle recouvrirait la
 * capture qu'elle est censée compléter.
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
  const tel = shot(`${e.nom}-m`);
  /* Le chevauchement change de côté d'une rangée à l'autre. Cinq vignettes au
     même coin se liraient comme un gabarit ; en alternant, l'œil retraverse
     la page à chaque écran. */
  const aDroite = index % 2 === 0;

  return (
    <div className="tour-bloc reveal">
      <div className="tour-entete">
        <span className="tour-num" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="font-display text-[clamp(1.45rem,2.8vw,2.05rem)] font-semibold leading-[1.12] tracking-[-0.028em] text-white">
          {t(e.titre)}
        </h3>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-7 text-slate-400">{t(e.texte)}</p>
      </div>

      <div className="tour-scene">
        <ShotOuVisuel nom={e.nom} alt={t(e.alt)} repli={e.repli} className="tour-shot" />
        {tel && (
          /* `alt=""` : cette vignette ne dit rien que la capture principale ne
             dise déjà, et la doubler dans un lecteur d'écran serait du bruit.
             C'est le cas prévu pour une image décorative. */
          <img
            src={tel}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className={`tour-tel ${aDroite ? "tour-tel--droite" : "tour-tel--gauche"}`}
          />
        )}
      </div>
    </div>
  );
}

export function TourProduit({ ecrans }: { ecrans: EcranProduit[] }) {
  const { t } = useLandingT();
  return (
    <section id="product" className="section-divider relative py-11 sm:py-16 lg:py-24">
      <div className="lp-container">
        <h2 className="reveal mx-auto max-w-2xl text-center font-display text-[clamp(1.75rem,3.4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
          {t("v2.tour.title.a")}{" "}
          <span className="text-[var(--tv-text-secondary)]">{t("v2.tour.title.b")}</span>
        </h2>
        <div className="mt-12 space-y-16 lg:mt-20 lg:space-y-28">
          {ecrans.map((e, i) => (
            <Rangee key={e.nom} e={e} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
