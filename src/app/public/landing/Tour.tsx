import { shot } from "./shots";
import { useLandingT, type LandingKey } from "./i18n";

/**
 * LA VISITE DU PRODUIT — en bento, à la DA de l'app (Liquid, novembre 2026).
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI ────────────────────────────────────────────
 *
 * La visite précédente empilait des rangées texte / capture numérotées sur un
 * fil, des onglets « moment de la journée » et un final à deux téléphones.
 * Elle montrait l'ANCIEN produit (captures d'avant Liquid) dans une
 * composition de site marketing, alors que l'app est devenue une app native :
 * plaques opaques à grand rayon, un chiffre héros, rien qui flotte.
 *
 * Le bento parle la langue de l'app : chaque écran est une CARTE de contenu
 * (plaque `--tv-plate-1`, rayon 28), titre et phrase en tête, la capture
 * réelle qui affleure par le bas — on voit le vrai écran, recadré comme une
 * fenêtre, pas une vignette réduite à l'illisible.
 *
 * ── LES RÈGLES QUI TIENNENT ─────────────────────────────────────────────────
 *
 *  • Une capture absente ne montre rien (`shot()` rend `null`) : la carte
 *    garde son texte, aucun dessin ne prend la place.
 *  • Les chiffres visibles sont ceux du compte de démonstration — la mention
 *    est portée sous la grille, une fois (`lq.shot.demo`).
 *  • Aucune animation propre : l'apparition au défilement (`.reveal`) est
 *    celle de toute la vitrine, et rien ne boucle.
 */
export interface EcranBento {
  /** Nom de la capture dans `src/assets/product/` (sans extension). */
  nom: string;
  titre: LandingKey;
  texte: LandingKey;
  alt: LandingKey;
  /** Largeur dans la grille de six colonnes (bureau). */
  largeur: 2 | 3 | 4;
}

function CarteBento({ e }: { e: EcranBento }) {
  const { t } = useLandingT();
  const src = shot(e.nom);
  const srcMobile = shot(`${e.nom}-m`);
  return (
    <article className={`reveal lq-bento-card lq-span-${e.largeur}`} data-shot={e.nom}>
      <div className="lq-bento-text">
        <h3 className="lq-card-title">{t(e.titre)}</h3>
        <p className="lq-card-body">{t(e.texte)}</p>
      </div>
      {src && (
        <div className="lq-bento-window">
          <picture>
            {srcMobile && <source media="(max-width: 639px)" srcSet={srcMobile} />}
            <img src={src} alt={t(e.alt)} loading="lazy" decoding="async" />
          </picture>
        </div>
      )}
    </article>
  );
}

export function TourProduit({ ecrans }: { ecrans: EcranBento[] }) {
  const { t } = useLandingT();
  return (
    <section id="product" className="lq-section">
      <div className="lp-container">
        <div className="reveal lq-head">
          <h2 className="lq-h2">
            {t("lq.tour.title.a")} <span className="lq-h2-soft">{t("lq.tour.title.b")}</span>
          </h2>
          <p className="lq-sub">{t("lq.tour.sub")}</p>
        </div>

        <div className="lq-bento">
          {ecrans.map((e) => (
            <CarteBento key={e.nom} e={e} />
          ))}
        </div>
        <p className="lq-demo-note">{t("lq.shot.demo")}</p>
      </div>
    </section>
  );
}
