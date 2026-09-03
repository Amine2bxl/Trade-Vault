import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Lock, ArrowRight, Eye } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";
import {
  PAGE_TIER,
  PAGE_VALUE,
  TIER_BY_ID,
  eur,
  tierAtLeast,
  yearlyPerMonth,
  monthsFree,
  type Tier,
} from "../utils/pricing";
import type { Page } from "../types";

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
 * il voit la PAGE, remplie de données d'exemple, nette en haut — de vrais
 * graphiques, de vrais chiffres, la vraie mise en page. Le flou n'arrive que
 * progressivement vers le bas, et la page s'arrête là : impossible de
 * continuer à défiler sans s'abonner.
 *
 * Le dégradé est construit en couches : chaque couche applique un flou plus
 * fort, révélé par un masque qui descend. C'est ce qui donne une transition
 * continue plutôt que la cassure nette d'un `blur` unique.
 */

/** Les paliers de flou : début et fin du masque, en % de la hauteur.
 *  Le haut de l'aperçu reste net — ce sont les chiffres d'exemple qui vendent. */
const BLUR_LAYERS = [
  { blur: 1.5, from: 44, to: 60 },
  { blur: 3, from: 54, to: 70 },
  { blur: 6, from: 64, to: 80 },
  { blur: 12, from: 74, to: 90 },
  { blur: 20, from: 86, to: 100 },
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

export function PreviewWall({
  locked,
  requiredTier,
  benefit,
  onUpgrade,
  children,
  className,
}: {
  locked: boolean;
  requiredTier: Tier;
  /** Ce que la page apporte, en une phrase — le vrai argument de vente. */
  benefit?: string;
  onUpgrade: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { lang } = useT();
  const fr = lang === "fr";
  if (!locked) return <>{children}</>;

  const tier = TIER_BY_ID[requiredTier];
  const perMonth = eur(Math.round(yearlyPerMonth(requiredTier) * 100) / 100);
  const freeMonths = monthsFree(requiredTier);

  return (
    <div className={cn("relative", className)}>
      {/* La page, en vraie grandeur — le plus lisible possible : aperçu haut,
          valeurs visibles, vente réelle. L'aperçu montre une vraie page
          remplie, et la barre d'abonnement ne la masque pas. */}
      <div
        aria-hidden
        // @ts-expect-error `inert` n'est pas encore typé dans React 19 DOM
        inert=""
        className="pointer-events-none max-h-[82vh] select-none overflow-hidden"
      >
        {children}
      </div>

      {/* Le dégradé de flou — doux en haut (on lit les chiffres), total en
          bas. Le voile ne débute qu'après ~la moitié de l'aperçu. */}
      <div className="pointer-events-none absolute inset-0">
        {BLUR_LAYERS.map((l) => (
          <div key={l.blur} className="absolute inset-0" style={maskStyle(l.blur, l.from, l.to)} />
        ))}
        <div className="absolute inset-x-0 bottom-0 top-[55%] bg-[linear-gradient(to_bottom,rgba(4,16,26,.2)_20%,rgba(4,16,26,.55)_55%,rgb(6,15,24))]" />
      </div>

      {/* L'appel à l'action — UNE barre basse, pas une fenêtre : la page reste
          lisible au-dessus. Ce qu'on voit, le prix, le geste — en une ligne. */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5 sm:pb-6">
        <div className="w-full max-w-2xl rounded-2xl border border-[var(--tv-border-strong)] bg-[var(--tv-plate-2)] p-3.5 shadow-[var(--tv-elev-3)] sm:p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[15px] font-bold leading-snug text-white">
                {benefit ?? (fr ? "Cette page, avec tes trades." : "This page, with your trades.")}
              </p>
              <p className="mt-1 text-[11.5px] font-medium text-slate-400">
                {tier.name[fr ? "fr" : "en"]} ·{" "}
                <span className="tv-figure text-white">{perMonth}</span>
                {fr ? "/mois" : "/month"}
                {freeMonths > 0 && (
                  <span className="ml-1 text-emerald-400">
                    · {freeMonths} {fr ? "mois offerts" : "mo. free"}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onUpgrade}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl tv-accent-fill px-5 py-3 text-sm font-bold transition"
            >
              <Lock className="h-4 w-4" />
              {fr ? `Passer à ${tier.name.fr}` : `Go ${tier.name.en}`}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {fr ? "Aperçu — données d'exemple" : "Preview — sample data"}
            </span>
            <span>
              {fr
                ? "Sans engagement · Annulation en 1 clic"
                : "No commitment · Cancel in one click"}
            </span>
          </div>
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
  children,
}: {
  page: Page;
  onUpgrade: () => void;
  children: ReactNode;
}) {
  const { lang } = useT();
  const fr = lang === "fr";
  const locked = usePageLock(page);
  const value = PAGE_VALUE[page];

  // La phrase « à quoi sert cette page » est affichée pour TOUT LE MONDE, pas
  // seulement derrière le mur : un abonné qui ouvre Monte-Carlo pour la
  // première fois a le même besoin de comprendre que le visiteur qui hésite.
  const purpose = value ? (
    <p className="px-4 pt-3 text-[12.5px] leading-snug text-slate-400 md:px-5">
      <span className="font-semibold text-slate-200">{value.title[fr ? "fr" : "en"]}</span>
      <span className="mx-1.5 text-slate-600">·</span>
      {value.benefit[fr ? "fr" : "en"]}
    </p>
  ) : null;

  if (!locked) {
    return (
      <>
        {purpose}
        {children}
      </>
    );
  }

  return (
    <PreviewContext.Provider value>
      {purpose}
      <PreviewWall
        locked
        requiredTier={PAGE_TIER[page] ?? "pro"}
        benefit={value ? value.benefit[fr ? "fr" : "en"] : undefined}
        onUpgrade={onUpgrade}
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
  const { tier, loading } = useSubscription();
  const required = PAGE_TIER[page];
  // Tant que l'abonnement n'est pas chargé on ne verrouille rien : montrer le
  // mur puis le retirer donnerait à un abonné l'impression d'avoir perdu son
  // accès.
  return !!required && !loading && !tierAtLeast(tier, required);
}
