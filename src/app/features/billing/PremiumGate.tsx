import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Eye } from "@/shared/ui/icons";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { useT } from "@/app/i18n/LanguageContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import { cn } from "@/shared/ui/cn";
import {
  PAGE_TIER,
  PAGE_VALUE,
  TIER_BY_ID,
  eur,
  tierAtLeast,
  type Tier,
} from "@/app/utils/pricing";
import { LIFETIME_COPY, LIFETIME_EUR, MONTHLY_EUR } from "@/domain/plans";
import type { Page } from "@/app/types";

/**
 * « Cet écran est-il rendu derrière le mur d'aperçu ? »
 *
 * Les pages nourries par les trades reçoivent l'historique de démonstration
 * depuis `App.tsx`. Celles qui vont chercher leurs propres données (Jarvis,
 * setups manqués) ne peuvent pas : elles lisent ce drapeau et servent leur
 * propre jeu d'exemple. Sans lui, leur aperçu serait un état vide — l'écran le
 * moins vendeur du produit.
 */
const PreviewContext = createContext(false);

export function usePreviewMode(): boolean {
  return useContext(PreviewContext);
}

/**
 * Le mur d'aperçu.
 *
 * Une fenêtre modale par-dessus une page floutée cache précisément ce qu'on
 * essaie de vendre : le trader voit un voile et un prix, jamais la valeur. Ici
 * il voit la PAGE — avec SES trades dès qu'il en a assez, sinon un historique
 * d'exemple — nette en haut, puis fondue dans le fond.
 *
 * ── REFAIT LE 2026-11-15 (retour du propriétaire) ─────────────────────────
 *
 *   1. « Un dégradé bleu qui finit en ligne droite, avec du noir dessous. »
 *      Le voile finissait sur un bleu nuit (`rgb(6,15,24)`) dans un bloc
 *      plafonné à 82vh : sous lui, le vrai fond — une cassure nette. Le voile
 *      finit maintenant sur `--tv-bg`, la couleur exacte du fond, et le mur
 *      occupe toute la hauteur disponible : plus rien dessous.
 *   2. « Go Full Access doit toujours être au même endroit. » La barre était
 *      collée au bas d'un bloc dont la hauteur suivait la page. Le mur est
 *      maintenant mesuré jusqu'au bas de la fenêtre (`useAvailableHeight`) :
 *      la barre tombe au même pixel sur toutes les pages verrouillées.
 *   3. « Les users doivent voir à quoi ressemble LEUR page. » `ownData`
 *      dit si l'aperçu montre ses propres trades ; la mention suit.
 */

/** Les paliers de flou : début et fin du masque, en % de la hauteur.
 *  DEUX paliers seulement : chaque `backdrop-filter` est une passe de flou
 *  recalculée à chaque image où quelque chose bouge dessous. */
const BLUR_LAYERS = [
  { blur: 3, from: 40, to: 66 },
  { blur: 12, from: 60, to: 92 },
];

function maskStyle(blur: number, from: number, to: number): CSSProperties {
  const mask = `linear-gradient(to bottom, rgba(0,0,0,0) ${from}%, rgba(0,0,0,1) ${to}%)`;
  return {
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    maskImage: mask,
    WebkitMaskImage: mask,
  };
}

/** Sous ce nombre de trades, l'aperçu montre l'historique d'exemple : une
 *  page presque vide ne dit rien de ce qu'elle deviendra. */
export const PREVIEW_OWN_MIN_TRADES = 10;

export function PreviewWall({
  locked,
  benefit,
  onUpgrade,
  ownData = false,
  children,
  className,
}: {
  locked: boolean;
  /** Palier technique requis — gardé pour les appelants ; l'offre affichée
   *  est toujours celle en vente (voir plus bas). */
  requiredTier: Tier;
  /** Ce que la page apporte, en une phrase — le vrai argument de vente. */
  benefit?: string;
  onUpgrade: () => void;
  /** L'aperçu montre-t-il les trades du trader (et non l'exemple) ? */
  ownData?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { t, lang } = useT();
  const { boxRef, height } = useAvailableHeight();
  if (!locked) return <>{children}</>;

  /* L'offre affichée est celle qu'on VEND aujourd'hui : les deux plans en
     vente ouvrent tout ; on montre l'entrée (le mensuel) et la licence. */
  const tier = TIER_BY_ID.elite;
  const lg = lang === "fr" ? "fr" : "en";

  return (
    <div
      ref={boxRef}
      className={cn("relative overflow-hidden", className)}
      style={{ height: height ?? "calc(100dvh - 9rem)" }}
    >
      {/* La page, en vraie grandeur, inerte. */}
      <div
        aria-hidden
        // @ts-expect-error `inert` n'est pas encore typé dans React 19 DOM
        inert=""
        className="pointer-events-none h-full select-none overflow-hidden"
      >
        {children}
      </div>

      {/* Le fondu : flou progressif, puis le FOND EXACT de la page — aucune
          ligne, aucune bande d'une autre couleur dessous. */}
      <div className="pointer-events-none absolute inset-0">
        {BLUR_LAYERS.map((l) => (
          <div key={l.blur} className="absolute inset-0" style={maskStyle(l.blur, l.from, l.to)} />
        ))}
        <div className="tv-preview-fade absolute inset-0" />
      </div>

      {/* LA barre — toujours au même endroit : le bas du mur est le bas de
          la fenêtre. */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5 sm:pb-6">
        <div className="tv-preview-bar w-full max-w-2xl">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-white">
              {benefit ?? t("gate.thisPageWithYour")}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-slate-400">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Eye className="h-3 w-3 shrink-0" aria-hidden />
                {ownData ? t("gate.previewOwnData") : t("gate.previewSampleData")}
              </span>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">
                <span className="tv-figure text-slate-200">{eur(MONTHLY_EUR, lang)}</span>
                {t("gate.month")}
              </span>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">
                <span className="tv-figure text-slate-200">{eur(LIFETIME_EUR, lang)}</span>{" "}
                {LIFETIME_COPY.priceNote[lg]}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            className="btn-primary inline-flex h-11 shrink-0 items-center gap-2 px-5"
          >
            {t("upgrade.goTier").replace("{tier}", tier.name[lg])}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Le mur appliqué à une page entière, depuis la table `PAGE_TIER`.
 *
 * Le verrou est posé à UN seul endroit (le rendu des pages dans `App.tsx`) :
 * ajouter une page payante est une ligne dans `PAGE_TIER`, jamais une
 * modification de la page elle-même, qui ne sait rien de la facturation.
 */
export function PageGate({
  page,
  onUpgrade,
  ownData = false,
  children,
}: {
  page: Page;
  onUpgrade: () => void;
  /** L'aperçu est-il nourri par les trades du trader ? (voir `App`) */
  ownData?: boolean;
  children: ReactNode;
}) {
  const { lang } = useT();
  const fr = lang === "fr";
  const locked = usePageLock(page);
  const value = PAGE_VALUE[page];

  if (!locked) {
    return (
      <>
        {/* Plus de phrase « à quoi sert cette page » au-dessus de l'écran :
            l'onglet nomme la page, le contenu dit le reste. La promesse ne
            reste que sur le mur d'aperçu, pour qui n'a pas l'offre. */}
        {children}
      </>
    );
  }

  return (
    <PreviewContext.Provider value>
      <PreviewWall
        locked
        requiredTier={PAGE_TIER[page] ?? "pro"}
        benefit={value ? value.benefit[fr ? "fr" : "en"] : undefined}
        onUpgrade={onUpgrade}
        ownData={ownData}
      >
        {children}
      </PreviewWall>
    </PreviewContext.Provider>
  );
}

/**
 * Cette page est-elle verrouillée pour l'utilisateur courant ?
 *
 * Exporté parce que `App.tsx` en a besoin AVANT le rendu : une page verrouillée
 * reçoit l'historique de démonstration au lieu du compte réel, sinon l'aperçu
 * d'un compte vide ne montrerait rien du tout.
 */
export function usePageLock(page: Page): boolean {
  return usePageLockState(page).locked;
}

/**
 * L'état COMPLET du verrou : verrouillé, et surtout — le sait-on déjà ?
 *
 * POURQUOI LA DEUXIÈME QUESTION EXISTE. `usePageLock` répond `false` tant que
 * l'abonnement n'est pas chargé, ce qui est le bon choix pour le MUR (afficher
 * un mur puis le retirer donnerait à un abonné l'impression d'avoir perdu son
 * accès). Mais `App` s'en servait aussi pour choisir QUELLES DONNÉES passer à
 * la page : `pageLocked ? previewTrades() : trades`. Pendant le chargement, un
 * compte gratuit voyait donc ses VRAIS chiffres s'afficher sur la page
 * Analytics… puis être remplacés sous ses yeux par des données de
 * démonstration. Ses propres nombres, changés en direct.
 *
 * Avec `resolved`, l'appelant peut attendre de savoir avant de peindre — un
 * squelette une demi-seconde, plutôt qu'une bascule de chiffres.
 */
export function usePageLockState(page: Page): { locked: boolean; resolved: boolean } {
  const { tier, loading } = useSubscription();
  const required = PAGE_TIER[page];
  if (!required) return { locked: false, resolved: true };
  return { locked: !loading && !tierAtLeast(tier, required), resolved: !loading };
}
