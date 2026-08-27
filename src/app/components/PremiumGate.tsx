import type { ReactNode } from "react";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";
import { PAGE_TIER, TIER_BY_ID, eur, tierAtLeast, type Tier } from "../utils/pricing";
import type { Page } from "../types";

/**
 * Le cadenas premium.
 *
 * La fonctionnalité reste VISIBLE — floutée, inerte, mais visible. Une page
 * vide qui dit « passez à l'offre supérieure » ne vend rien : on ne désire pas
 * ce qu'on n'a jamais vu. Ici le trader voit son propre écran, ses propres
 * chiffres derrière le voile, et le cadenas dit exactement quelle offre le
 * lève et combien elle coûte.
 *
 * `aria-hidden` + `inert` sur le contenu flouté : au clavier et au lecteur
 * d'écran, un contenu qu'on ne peut pas utiliser ne doit pas être atteignable.
 */
export function PremiumGate({
  locked,
  requiredTier,
  title,
  description,
  onUpgrade,
  children,
  className,
}: {
  locked: boolean;
  requiredTier: Tier;
  title?: string;
  description?: string;
  onUpgrade: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { lang } = useT();
  const fr = lang === "fr";
  if (!locked) return <>{children}</>;

  const tier = TIER_BY_ID[requiredTier];

  return (
    <div className={cn("relative", className)}>
      {/* Le contenu réel, hors d'atteinte. */}
      <div
        aria-hidden
        // @ts-expect-error `inert` n'est pas encore typé dans React 19 DOM
        inert=""
        className="pointer-events-none select-none blur-[7px] saturate-[.6] opacity-60"
      >
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto bg-[#04101a]/45 p-4 backdrop-blur-[2px]">
        <div className="mt-10 w-full max-w-md rounded-3xl border border-cyan-400/20 bg-[linear-gradient(160deg,rgba(14,58,82,.65),rgba(7,14,24,.96)_60%)] p-6 text-center shadow-2xl shadow-black/50">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600">
            <Lock className="h-5 w-5 text-white" />
          </span>
          <h2 className="mt-4 font-display text-lg font-extrabold tracking-tight text-white">
            {title ??
              (fr ? `Inclus dans l'offre ${tier.name.fr}` : `Included in the ${tier.name.en} plan`)}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
            {description ?? tier.tagline[fr ? "fr" : "en"]}
          </p>

          <div className="mt-4 flex items-baseline justify-center gap-1.5">
            <span className="font-display text-3xl font-extrabold text-white tabular-nums">
              {eur(Math.round((tier.yearly / 12) * 100) / 100)}
            </span>
            <span className="text-xs text-slate-400">{fr ? "/mois" : "/month"}</span>
            <span className="ml-1 text-[11px] text-slate-500">
              {fr ? `soit ${eur(tier.yearly)}/an` : `${eur(tier.yearly)} billed yearly`}
            </span>
          </div>

          <button
            onClick={onUpgrade}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3 text-sm font-bold text-[#04101a] transition hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" />
            {fr ? `Débloquer avec ${tier.name.fr}` : `Unlock with ${tier.name.en}`}
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-[11px] text-slate-500">
            {fr
              ? "Résiliable en un clic. Ton journal et tes données restent gratuits."
              : "Cancel in one click. Your journal and data stay free."}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * La même garde, appliquée à une page entière depuis la table `PAGE_TIER`.
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
  const { tier, loading } = useSubscription();
  const required = PAGE_TIER[page];
  // Tant que l'abonnement n'est pas chargé on ne floute rien : afficher un
  // cadenas puis le retirer une seconde plus tard donnerait à un abonné
  // payant l'impression d'avoir perdu son accès.
  const locked = !!required && !loading && !tierAtLeast(tier, required);
  return (
    <PremiumGate locked={locked} requiredTier={required ?? "pro"} onUpgrade={onUpgrade}>
      {children}
    </PremiumGate>
  );
}
