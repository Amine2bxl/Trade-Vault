import type { ReactNode } from "react";
import { ShotOuVisuel } from "./ProductShot";
import { shot } from "./shots";
import { useLandingT, type LandingKey } from "./i18n";

/**
 * LA VISITE DU PRODUIT — quatre temps, quatre compositions, un seul fil.
 *
 * ── CE QUI N'ALLAIT PAS ───────────────────────────────────────────────────
 *
 * Six rangées RIGOUREUSEMENT identiques : titre, phrase, capture pleine
 * largeur, vignette téléphone qui alterne de coin. La disposition était
 * bonne une fois ; répétée six fois elle devient un gabarit, et un gabarit
 * se saute. Passé la deuxième rangée on ne lit plus, on défile.
 *
 * Et rien ne reliait ces six écrans. C'était un CATALOGUE, pas un parcours :
 * six fonctionnalités posées côte à côte, dans un ordre qui aurait pu être
 * n'importe lequel.
 *
 * ── CE QU'ELLE FAIT MAINTENANT ────────────────────────────────────────────
 *
 *   1. Journal    — texte à gauche, capture à droite qui déborde du cadre.
 *                   C'est l'entrée : le trade arrive.
 *   2. Analytics  — capture à gauche, texte à droite. L'œil retraverse.
 *   3. Les quatre — quatre CARTES, une par écran, avec le rôle en tête.
 *   4. Jarvis     — resserré, centré, avec la vignette téléphone. Le
 *                   dénouement : on a montré la matière, voici ce qui la lit.
 *
 * Le coût des erreurs a quitté la visite : il sert maintenant de preuve dans
 * la section « problème », bien plus haut, où il fait le contraste entre la
 * douleur nommée et son prix.
 *
 * Les compositions varient, le SYSTÈME ne varie pas : même cadre, même
 * lueur, même échelle typographique, même rythme vertical.
 *
 * ── LE FIL ────────────────────────────────────────────────────────────────
 *
 * Un trait d'un pixel dans la gouttière gauche, avec un point numéroté par
 * temps. Ce n'est pas un schéma : c'est la seule chose qui dise « ces écrans
 * sont le même trajet » sans l'écrire. Il s'éteint aux deux bouts.
 *
 * ── LA LISIBILITÉ RESTE LA CONTRAINTE ─────────────────────────────────────
 *
 * Une capture dans une demi-colonne tombe à ~600px sur un écran de 1440
 * alors que sa mise en page est calculée sur 1352 : échelle 0,45, texte du
 * produit à 6px. Les deux rangées en deux colonnes gardent donc la capture
 * en position DÉBORDANTE, ce qui lui rend ~250px.
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

/** Une carte de la grille : un moment, un titre, une ligne, un écran. */
export interface EcranSecondaire {
  nom: string;
  /** QUAND cet écran sert. C'est ce qui manquait le plus. */
  moment: LandingKey;
  titre: LandingKey;
  texte: LandingKey;
  alt: LandingKey;
}

function Numero({ n }: { n: number }) {
  return (
    <span className="tour-pastille" aria-hidden>
      {String(n).padStart(2, "0")}
    </span>
  );
}

/**
 * Une rangée à deux colonnes. `cote` dit de quel côté vit la capture ; le
 * texte prend l'autre. La capture déborde vers le bord le plus proche —
 * c'est ce débordement qui lui rend la largeur que la colonne lui prend.
 */
function RangeeDeux({
  e,
  n,
  cote,
  retard,
}: {
  e: EcranProduit;
  n: number;
  cote: "droite" | "gauche";
  retard: number;
}) {
  const { t } = useLandingT();
  return (
    <div className={`tour-etape tour-duo tour-duo--${cote} reveal`}>
      <Numero n={n} />
      <div className="tour-duo-texte">
        <h3 className="tour-titre">{t(e.titre)}</h3>
        <p className="tour-phrase">{t(e.texte)}</p>
      </div>
      <div className="tour-duo-scene">
        <ShotOuVisuel
          nom={e.nom}
          alt={t(e.alt)}
          repli={e.repli}
          retardFlottement={retard}
          className="tour-shot"
        />
      </div>
    </div>
  );
}

/* `RangeePleine` a été RETIRÉE. La capture des erreurs, seule rangée qui en
   usait, a déménagé dans la section « problème » : elle y sert de PREUVE au
   coût annoncé, et elle y arrive 2 000px plus tôt. Une composition sans
   appelant est une composition qu'on croit disponible et qui ne l'est plus
   vraiment - elle reviendra le jour où un écran la mérite. */

/**
 * LES QUATRE ÉCRANS SECONDAIRES — des cartes, plus une mosaïque.
 *
 * ── CE QUI N'ALLAIT PAS ───────────────────────────────────────────────────
 *
 * Quatre captures nues, recadrées au même rapport, posées sur le fond. Trois
 * défauts d'un coup :
 *
 *   1. ON NE LES VOYAIT PAS EN ENTIER. Le recadrage en 16/10 avec
 *      `object-fit: cover` coupait le bas de chaque écran. Montrer les trois
 *      quarts d'une page et l'appeler « l'écran » est un demi-mensonge, et
 *      ça se voit.
 *   2. ON NE COMPRENAIT PAS LEUR RÔLE. Un titre et une ligne sous une image,
 *      sans rien qui dise QUAND cet écran sert. « Où ton compte peut
 *      atterrir » ne dit pas que c'est de la projection.
 *   3. ELLES N'ÉTAIENT PAS MISES EN VALEUR. Posées à même le fond, à côté de
 *      trois rangées qui, elles, ont un cadre et une lueur, elles se
 *      lisaient comme un appendice.
 *
 * ── CE QU'ELLES SONT ──────────────────────────────────────────────────────
 *
 * Des cartes. Chacune porte un ÉTIQUETAGE DE MOMENT en tête — avant le
 * trade, après le trade, ce qui n'est pas arrivé, ce qui arrive — puis le
 * titre, la ligne, et l'écran ENTIER en bas. Le moment répond à la question
 * qu'on se pose vraiment devant une capture inconnue : quand est-ce que je
 * m'en sers ?
 *
 * L'image est complète (`contain`) : à cette taille on ne lit pas les
 * chiffres, mais on reconnaît une forme d'écran, et une forme tronquée ne se
 * reconnaît pas. La carte, elle, donne le cadre et la matière qui manquaient.
 */
function GrilleSecondaire({ ecrans, n }: { ecrans: EcranSecondaire[]; n: number }) {
  const { t } = useLandingT();
  const presents = ecrans.filter((e) => shot(e.nom));
  if (!presents.length) return null;
  return (
    <div className="tour-etape tour-grille reveal">
      <Numero n={n} />
      <div className="tour-grille-texte">
        <h3 className="tour-titre">{t("v2.tour.more.t")}</h3>
        <p className="tour-phrase">{t("v2.tour.more.d")}</p>
      </div>
      <div className="tour-grille-cases">
        {presents.map((e, i) => (
          <article key={e.nom} className="tour-carte">
            <p className="tour-carte-moment">{t(e.moment)}</p>
            <h4 className="tour-carte-titre">{t(e.titre)}</h4>
            <p className="tour-carte-texte">{t(e.texte)}</p>
            <div className="tour-carte-scene">
              <ShotOuVisuel
                nom={e.nom}
                alt={t(e.alt)}
                repli={null}
                retardFlottement={i * 1.4}
                className="tour-carte-shot"
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Le dénouement : resserré, centré, avec la vignette téléphone. */
function RangeeFinale({ e, n, retard }: { e: EcranProduit; n: number; retard: number }) {
  const { t } = useLandingT();
  const tel = shot(`${e.nom}-m`);
  return (
    <div className="tour-etape tour-final reveal">
      <Numero n={n} />
      <div className="tour-final-texte">
        <h3 className="tour-titre">{t(e.titre)}</h3>
        <p className="tour-phrase mx-auto">{t(e.texte)}</p>
      </div>
      <div className="tour-final-scene">
        <ShotOuVisuel
          nom={e.nom}
          alt={t(e.alt)}
          repli={e.repli}
          retardFlottement={retard}
          className="tour-shot"
        />
        {tel && (
          /* `alt=""` : cette vignette ne dit rien que la capture principale ne
             dise déjà, et la doubler dans un lecteur d'écran serait du bruit.
             Les deux sont des captures RÉELLES du même écran — les voir
             ensemble dit « ça marche aussi dans ta poche » sans une ligne de
             texte. */
          <img
            src={tel}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="tour-tel tour-tel--droite"
          />
        )}
      </div>
    </div>
  );
}

export function TourProduit({
  journal,
  analytics,
  secondaires,
  jarvis,
}: {
  journal: EcranProduit;
  analytics: EcranProduit;
  secondaires: EcranSecondaire[];
  jarvis: EcranProduit;
}) {
  const { t } = useLandingT();
  return (
    <section id="product" className="section-divider relative py-12 sm:py-16 lg:py-24">
      <div className="lp-container">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="tv-label text-[var(--tv-highlight)]">{t("v2.tour.eyebrow")}</p>
          <h2 className="mt-4 font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
            {t("v2.tour.title.a")}{" "}
            <span className="text-[var(--tv-text-secondary)]">{t("v2.tour.title.b")}</span>
          </h2>
        </div>

        {/* LE FIL. Un trait d'un pixel et cinq points numérotés : la seule
            chose qui dise que ces écrans sont un trajet et non un catalogue.
            Il s'arrête au dernier point. */}
        <div className="tour-fil mt-14 lg:mt-20">
          <RangeeDeux e={journal} n={1} cote="droite" retard={0} />
          <RangeeDeux e={analytics} n={2} cote="gauche" retard={1.8} />
          <GrilleSecondaire ecrans={secondaires} n={3} />
          <RangeeFinale e={jarvis} n={4} retard={4.6} />
        </div>
      </div>
    </section>
  );
}
