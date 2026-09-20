import type { ReactNode } from "react";
import { ShotOuVisuel } from "./ProductShot";
import { shot } from "./shots";
import { useLandingT, type LandingKey } from "./i18n";

/**
 * LA VISITE DU PRODUIT — cinq temps, cinq compositions, un seul fil.
 *
 * ── CE QUI N'ALLAIT PAS ───────────────────────────────────────────────────
 *
 * Six rangées RIGOUREUSEMENT identiques : titre, phrase, capture pleine
 * largeur, vignette téléphone qui alterne de coin. La disposition était
 * bonne une fois ; répétée six fois elle devient un gabarit, et un gabarit
 * se saute. Passé la deuxième rangée on ne lit plus, on défile - la page
 * avait beau montrer six écrans réels, elle n'en faisait regarder que deux.
 *
 * Et rien ne reliait ces six écrans entre eux. C'était un CATALOGUE, pas un
 * parcours : six fonctionnalités posées côte à côte, dans un ordre qui
 * aurait pu être n'importe lequel.
 *
 * ── CE QU'ELLE FAIT MAINTENANT ────────────────────────────────────────────
 *
 * Elle raconte le trajet d'un trade dans le produit, et chaque temps a sa
 * propre forme :
 *
 *   1. Journal    — texte à gauche, capture à droite qui déborde du cadre.
 *                   C'est l'entrée : le trade arrive.
 *   2. Analytics  — capture à gauche, texte à droite. L'œil retraverse.
 *   3. Erreurs    — pleine largeur, titre centré au-dessus. Le moment le
 *                   plus large de la page, parce que c'est l'argument le
 *                   plus singulier.
 *   4. Les quatre — une grille compacte. Quatre écrans réels qui méritent
 *                   d'être VUS sans mériter chacun une rangée entière.
 *   5. Jarvis     — resserré, centré, avec la vignette téléphone. Le
 *                   dénouement : on a montré la matière, voici ce qui la lit.
 *
 * Les compositions varient, le SYSTÈME ne varie pas : même cadre, même
 * lueur, même échelle typographique, même rythme vertical.
 *
 * ── LE FIL ────────────────────────────────────────────────────────────────
 *
 * Un trait d'un pixel dans la gouttière gauche, avec un point numéroté par
 * temps. Ce n'est pas un schéma : c'est la seule chose qui dise « ces cinq
 * écrans sont le même trajet » sans l'écrire. Il s'arrête net après le
 * dernier point - une ligne qui continue dans le vide promet une suite.
 *
 * ── LA LISIBILITÉ RESTE LA CONTRAINTE ─────────────────────────────────────
 *
 * Une capture dans une demi-colonne tombe à ~600px sur un écran de 1440
 * alors que sa mise en page est calculée sur 1352 : échelle 0,45, texte du
 * produit à 6px. Les deux rangées en deux colonnes gardent donc la capture
 * en position DÉBORDANTE (elle sort de sa colonne vers le bord), ce qui lui
 * rend ~250px, et la rangée pleine largeur est là pour l'écran qui a le plus
 * besoin de place. La grille de quatre assume l'échelle réduite : on n'y
 * lit pas les chiffres, on y reconnaît des écrans - et chaque tuile dit en
 * une ligne ce qu'on y verrait.
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

/** Une tuile de la grille compacte : une capture, une ligne. */
export interface EcranSecondaire {
  nom: string;
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

/** La rangée pleine largeur : titre centré au-dessus, capture en dessous. */
function RangeePleine({ e, n, retard }: { e: EcranProduit; n: number; retard: number }) {
  const { t } = useLandingT();
  return (
    <div className="tour-etape tour-pleine reveal">
      <Numero n={n} />
      <div className="tour-pleine-texte">
        <h3 className="tour-titre">{t(e.titre)}</h3>
        <p className="tour-phrase mx-auto">{t(e.texte)}</p>
      </div>
      <ShotOuVisuel
        nom={e.nom}
        alt={t(e.alt)}
        repli={e.repli}
        retardFlottement={retard}
        className="tour-shot mt-9"
      />
    </div>
  );
}

/**
 * La grille compacte. Quatre écrans réels, une ligne chacun.
 *
 * Ils portent chacun un argument que rien d'autre ne porte — le seul moment
 * qui agit AVANT le trade, la seule chose qui parle de ce qui n'est pas
 * encore arrivé, les occasions que personne ne compte, le calendrier macro.
 * Leur donner une rangée entière chacun aurait rallongé la page de quatre
 * écrans ; les taire aurait laissé croire que le produit s'arrête au
 * journal.
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
          <figure key={e.nom} className="tour-case">
            <ShotOuVisuel
              nom={e.nom}
              alt={t(e.alt)}
              repli={null}
              retardFlottement={i * 1.4}
              className="tour-case-shot"
            />
            <figcaption>
              <span className="tour-case-titre">{t(e.titre)}</span>
              <span className="tour-case-texte">{t(e.texte)}</span>
            </figcaption>
          </figure>
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
  erreurs,
  secondaires,
  jarvis,
}: {
  journal: EcranProduit;
  analytics: EcranProduit;
  erreurs: EcranProduit;
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
          <RangeePleine e={erreurs} n={3} retard={3.4} />
          <GrilleSecondaire ecrans={secondaires} n={4} />
          <RangeeFinale e={jarvis} n={5} retard={5.2} />
        </div>
      </div>
    </section>
  );
}
