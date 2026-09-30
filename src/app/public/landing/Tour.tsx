import { useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
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
 * LES QUATRE ÉCRANS SECONDAIRES — un seul à la fois, en grand.
 *
 * ── POURQUOI PAS QUATRE CARTES ────────────────────────────────────────────
 *
 * Parce qu'à quatre de front, chaque capture reçoit 490px de large pour
 * montrer 1350px d'interface : 36 % d'échelle, un libellé de 13px réduit à
 * 5px. On ne lisait rien, donc on ne reconnaissait pas l'écran, donc on
 * n'avait aucune raison d'en vouloir plus. Le recadrage sur un détail
 * rendait le texte lisible mais montrait un fragment — et ce qu'on veut
 * voir, c'est la PAGE.
 *
 * Les quatre partagent donc la même place, et on en montre un à la fois.
 * Pleine largeur, la capture est à 80 % d'échelle : on lit les intitulés,
 * les chiffres, les badges. Exactement le traitement qu'ont le journal et
 * les analyses, qui n'ont jamais posé ce problème parce qu'ils étaient
 * grands.
 *
 * La section est même PLUS COURTE qu'avant : un panneau au lieu de deux
 * rangées de cartes.
 *
 * ── LES ONGLETS SONT LES MOMENTS ──────────────────────────────────────────
 *
 * Pas « Checklist / Calendrier / Setups manqués / Monte-Carlo », qui
 * demanderait de connaître le produit pour choisir. « Avant l'ouverture,
 * pendant la séance, après la clôture, avant la suivante » : on choisit un
 * moment de sa propre journée, et l'écran qui va avec apparaît. C'est la
 * même idée que le titre de la section, rendue cliquable.
 *
 * ── LA HAUTEUR NE SAUTE PAS ───────────────────────────────────────────────
 *
 * Les quatre panneaux sont superposés dans la même cellule de grille : la
 * hauteur est celle du plus grand, et changer d'onglet ne fait jamais bondir
 * la page sous le doigt — le défaut classique des panneaux à onglets.
 *
 * ── L'ORDRE EST CELUI DE LA SÉANCE ────────────────────────────────────────
 *
 * Calendrier (avant l'ouverture), checklist (pendant, avant chaque entrée),
 * setups manqués (après la clôture), Monte-Carlo (avant la suivante). C'est
 * `Landing.tsx` qui fixe l'ordre ; ce composant le suit tel quel.
 */
function VitrineSecondaire({ ecrans, n }: { ecrans: EcranSecondaire[]; n: number }) {
  const { t } = useLandingT();
  const presents = ecrans.filter((e) => shot(e.nom));
  const [actif, setActif] = useState(0);
  const onglets = useRef<(HTMLButtonElement | null)[]>([]);
  const liste = useRef<HTMLDivElement>(null);
  const pile = useRef<HTMLDivElement>(null);
  const precedent = useRef(0);
  const enCours = useRef<gsap.core.Timeline | null>(null);
  const courant = Math.min(actif, Math.max(presents.length - 1, 0));

  /* LE PASSAGE D'UN ÉCRAN À L'AUTRE — fondu enchaîné et glissement de 14px.
     Les quatre panneaux sont empilés dans la même cellule : le sortant
     s'efface pendant que l'entrant arrive, sans trou ni saut de hauteur. Un
     changement rapide (flèches maintenues) coupe la transition en cours et
     repart de l'état propre. Moins de mouvement : bascule immédiate. */
  useGSAP(
    () => {
      const avant = precedent.current;
      precedent.current = courant;
      if (avant === courant || !pile.current) return;

      /* Sur téléphone la barre d'onglets défile : l'onglet choisi y reste
         visible, sans faire bouger la page. */
      const barre = liste.current;
      const onglet = onglets.current[courant];
      if (barre && onglet && barre.scrollWidth > barre.clientWidth) {
        barre.scrollTo({
          left: onglet.offsetLeft - (barre.clientWidth - onglet.offsetWidth) / 2,
          behavior: "smooth",
        });
      }

      const panneaux = gsap.utils.toArray<HTMLElement>(".tour-panneau", pile.current);
      const sortant = panneaux[avant];
      const entrant = panneaux[courant];
      enCours.current?.kill();
      gsap.set(panneaux, { clearProps: "opacity,visibility,transform" });
      if (!sortant || !entrant || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;

      const sens = courant > avant ? 1 : -1;
      enCours.current = gsap
        .timeline({
          onComplete: () =>
            gsap.set([sortant, entrant], { clearProps: "opacity,visibility,transform" }),
        })
        .fromTo(
          sortant,
          { autoAlpha: 1, x: 0 },
          { autoAlpha: 0, x: -14 * sens, duration: 0.26, ease: "power2.in" },
        )
        .fromTo(
          entrant,
          { autoAlpha: 0, x: 14 * sens },
          { autoAlpha: 1, x: 0, duration: 0.42, ease: "power3.out" },
          "<0.08",
        );
    },
    { dependencies: [courant], scope: pile },
  );

  if (!presents.length) return null;

  /* Le clavier d'un `tablist` : flèches pour passer d'un onglet à l'autre
     (en boucle), Début/Fin pour le premier et le dernier. Une seule
     tabulation entre dans la barre, la suivante atteint le panneau. */
  const auClavier = (ev: React.KeyboardEvent) => {
    const dernier = presents.length - 1;
    const cible =
      ev.key === "ArrowRight"
        ? (courant + 1) % presents.length
        : ev.key === "ArrowLeft"
          ? (courant - 1 + presents.length) % presents.length
          : ev.key === "Home"
            ? 0
            : ev.key === "End"
              ? dernier
              : null;
    if (cible === null) return;
    ev.preventDefault();
    setActif(cible);
    onglets.current[cible]?.focus();
  };

  return (
    <div className="tour-etape tour-grille reveal">
      <Numero n={n} />
      <div className="tour-grille-texte">
        <h3 className="tour-titre">{t("v2.tour.more.t")}</h3>
        <p className="tour-phrase">{t("v2.tour.more.d")}</p>
      </div>

      <div ref={liste} className="tour-onglets" role="tablist" aria-label={t("v2.tour.more.t")}>
        {presents.map((x, i) => (
          <button
            key={x.nom}
            ref={(el) => {
              onglets.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`onglet-${x.nom}`}
            aria-selected={i === courant}
            aria-controls={`panneau-${x.nom}`}
            tabIndex={i === courant ? 0 : -1}
            onClick={() => setActif(i)}
            onKeyDown={auClavier}
            className="tour-onglet"
          >
            {t(x.moment)}
          </button>
        ))}
      </div>

      {/* LA PILE. Les quatre panneaux restent montés, superposés : c'est ce
          qui permet le fondu enchaîné, et chaque onglet pointe vers un
          panneau qui existe vraiment. Les inactifs sont `inert` — ni focus,
          ni lecteur d'écran — et masqués par le CSS (`data-actif`), donc
          corrects dès le rendu serveur. La plaque est portée par la pile et
          ne bouge pas : seul le contenu glisse. */}
      <div ref={pile} className="tour-pile">
        {presents.map((x, i) => (
          <div
            key={x.nom}
            role="tabpanel"
            id={`panneau-${x.nom}`}
            aria-labelledby={`onglet-${x.nom}`}
            data-actif={i === courant}
            inert={i !== courant}
            tabIndex={i === courant ? 0 : -1}
            className="tour-panneau"
          >
            <div className="tour-panneau-texte">
              <h4 className="tour-carte-titre">{t(x.titre)}</h4>
              <p className="tour-carte-texte">{t(x.texte)}</p>
            </div>
            <div className="tour-panneau-scene">
              <ShotOuVisuel nom={x.nom} alt={t(x.alt)} repli={null} className="tour-vitrine-shot" />
            </div>
          </div>
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
          <VitrineSecondaire ecrans={secondaires} n={3} />
          <RangeeFinale e={jarvis} n={4} retard={4.6} />
        </div>
      </div>
    </section>
  );
}
