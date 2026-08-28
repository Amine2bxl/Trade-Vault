import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Lock, ArrowRight, Eye, Check } from "lucide-react";
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

/** Les paliers de flou : début et fin du masque, en % de la hauteur. */
const BLUR_LAYERS = [
  { blur: 1.5, from: 34, to: 50 },
  { blur: 3, from: 44, to: 60 },
  { blur: 6, from: 54, to: 71 },
  { blur: 12, from: 65, to: 84 },
  { blur: 22, from: 78, to: 100 },
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
      {/* La page, en vraie grandeur — mais coupée et hors d'atteinte. */}
      <div
        aria-hidden
        // @ts-expect-error `inert` n'est pas encore typé dans React 19 DOM
        inert=""
        className="pointer-events-none max-h-[74vh] select-none overflow-hidden"
      >
        {children}
      </div>

      {/* Le dégradé de flou, puis le voile de couleur qui porte le texte. */}
      <div className="pointer-events-none absolute inset-0">
        {BLUR_LAYERS.map((l) => (
          <div key={l.blur} className="absolute inset-0" style={maskStyle(l.blur, l.from, l.to)} />
        ))}
        <div className="absolute inset-x-0 bottom-0 top-[42%] bg-[linear-gradient(to_bottom,rgba(4,16,26,.38)_35%,rgba(4,16,26,.62)_62%,rgb(6,15,24))]" />
      </div>

      {/* L'appel à l'action : UNE carte, la décision en cinq secondes. Ce qu'on
          voit, ce que ça débloque, le prix, le geste — dans cet ordre, sans
          rien de plus. */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-6 sm:pb-8">
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-[#060f18]/90 p-5 text-center shadow-[0_-16px_80px_-24px_rgba(0,0,0,.9)] backdrop-blur-xl sm:p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-300">
            <Eye className="h-3 w-3" />
            {fr ? "Aperçu — données d'exemple" : "Preview — sample data"}
          </span>

          <h2 className="mt-3 font-display text-[22px] font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
            {benefit ?? (fr ? "Cette page, avec tes trades." : "This page, with your trades.")}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-snug text-slate-400">
            {fr
              ? "Débloque-la et elle se remplit avec TES chiffres."
              : "Unlock it and it fills with YOUR numbers."}
          </p>

          {/* Ce qui vient avec, pas seulement cette page. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {tier.features.slice(0, 3).map((f) => (
              <span
                key={f.en}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-slate-200"
              >
                <Check className="h-3 w-3 text-cyan-400" />
                {f[fr ? "fr" : "en"]}
              </span>
            ))}
          </div>

          {/* Le prix, posé juste au-dessus du geste. */}
          <div className="mt-5 flex items-baseline justify-center gap-1.5">
            <span className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-white">
              {perMonth}
            </span>
            <span className="text-sm text-slate-400">{fr ? "/mois" : "/month"}</span>
            {freeMonths > 0 && (
              <span className="ml-1 text-[11.5px] font-semibold text-emerald-400">
                · {freeMonths} {fr ? "mois offerts" : "months free"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {fr
              ? `${tier.name.fr} · facturé ${eur(tier.yearly)}/an`
              : `${tier.name.en} · billed ${eur(tier.yearly)}/year`}
          </p>

          <button
            onClick={onUpgrade}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-6 py-3.5 text-[15px] font-bold text-[#04101a] shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
          >
            <Lock className="h-4 w-4" />
            {fr ? `Passer à ${tier.name.fr}` : `Go ${tier.name.en}`}
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-3 text-[11px] text-slate-500">
            {fr
              ? "Sans engagement · Annulation en un clic · Ton journal reste gratuit"
              : "No commitment · Cancel in one click · Your journal stays free"}
          </p>
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
