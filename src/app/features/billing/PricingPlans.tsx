import {
  Bot,
  Clock,
  Check,
  Dices,
  FileText,
  Infinity as InfinityIcon,
  TriangleAlert,
} from "@/shared/ui/icons";
import type { ComponentType } from "react";
import { cn } from "@/shared/ui/cn";
import PrixAnime from "./PrixAnime";
import OfferCard, { type OfferState } from "./OfferCard";
import { FULL_ACCESS_POINTS, LIFETIME_COPY, LIFETIME_PLAN, MONTHLY_PLAN } from "@/domain/plans";
import { TIER_BY_ID, eur, tierOf, type PaidPlan, type Plan } from "@/app/utils/pricing";

/**
 * LA GRILLE TARIFAIRE — deux cartes, six résultats, une ligne pour le gratuit.
 *
 * ── CE QUI A CHANGÉ (2026-11-15, retour du propriétaire) ──────────────────
 *
 * « Trop de cases, trop de blabla, pas assez de concret. » La grille posait
 * trois colonnes puis une quatrième carte de dix fonctionnalités nommées.
 * Elle pose maintenant :
 *
 *   1. les DEUX offres payantes côte à côte — prix, rythme, une phrase, un
 *      bouton ;
 *   2. ce qu'elles ouvrent, en six RÉSULTATS (`FULL_ACCESS_POINTS`), sans
 *      cadre : une grille d'icônes, pas une carte de plus ;
 *   3. le gratuit sur UNE ligne, quand il est utile de le rappeler
 *      (`/pricing`) — dans l'app, l'état du compte le dit déjà.
 *
 * Le même composant sert `/pricing` et la page Abonnement : un trader
 * retrouve exactement l'offre qui l'a convaincu.
 */
export interface PricingPlansProps {
  lang: "fr" | "en";
  /** Le plan actuel, pour marquer l'offre en cours. */
  currentPlan?: Plan | null;
  /** Clé de l'action en cours (désactive les boutons). */
  busy?: string | null;
  /** Achat — checkout carte (mensuel ou licence). */
  onChoose: (plan: PaidPlan) => void;
  /** Portail Stripe — pour un mensuel en cours. */
  onManage?: () => void;
  /** Action de la ligne gratuite. */
  onFree?: () => void;
  /** Ligne gratuite affichée ? Inutile à qui paie déjà, ou dans l'app où
   *  l'état du compte le dit. */
  showFree?: boolean;
  /** Masquer le mensuel (passage mensuel → licence : seule la licence
   *  reste à vendre). */
  lifetimeOnly?: boolean;
  className?: string;
}

/** L'icône de chaque résultat — même ordre que `FULL_ACCESS_POINTS`. */
const ICONES: ComponentType<{ className?: string }>[] = [
  InfinityIcon,
  TriangleAlert,
  Clock,
  Bot,
  Dices,
  FileText,
];

export default function PricingPlans({
  lang,
  currentPlan,
  busy,
  onChoose,
  onManage,
  onFree,
  showFree = true,
  lifetimeOnly = false,
  className,
}: PricingPlansProps) {
  const free = TIER_BY_ID.free;
  const ownsLifetime = currentPlan === LIFETIME_PLAN;
  // Tout autre plan payant (mensuel, ancien Pro…) compte comme un abonnement
  // en cours : la licence reste achetable, le mensuel ne l'est plus.
  const subscribed = !ownsLifetime && tierOf(currentPlan) !== "free";
  const onFreePlan = !!currentPlan && tierOf(currentPlan) === "free";

  const monthlyState: OfferState = ownsLifetime ? "included" : subscribed ? "owned" : "buy";
  const lifetimeState: OfferState = ownsLifetime ? "owned" : "buy";

  return (
    <div className={cn("space-y-6", className)}>
      <div className={cn("grid gap-4", !lifetimeOnly && "md:grid-cols-2")}>
        {!lifetimeOnly && (
          <OfferCard
            plan={MONTHLY_PLAN}
            lang={lang}
            state={monthlyState}
            busy={busy != null}
            onChoose={onChoose}
            onManage={onManage}
          />
        )}
        <OfferCard
          plan={LIFETIME_PLAN}
          lang={lang}
          state={lifetimeState}
          busy={busy != null}
          onChoose={onChoose}
        />
      </div>

      {/* SIX RÉSULTATS, SANS CADRE. Ils valent pour les deux offres : une
          seule liste, et pas une carte de plus autour. */}
      <ul className="offer-points" aria-label={TIER_BY_ID.elite.name[lang]}>
        {FULL_ACCESS_POINTS.map((p, i) => {
          const Ico = ICONES[i] ?? Check;
          return (
            <li key={p.en} className="offer-point">
              <span className="offer-point-icon" aria-hidden>
                <Ico className="h-4 w-4" />
              </span>
              {p[lang]}
            </li>
          );
        })}
      </ul>

      {showFree && (
        <div className="offer-free-row">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px] leading-snug text-slate-400">
            <span className="font-semibold text-white">{free.name[lang]}</span>
            <PrixAnime valeur={eur(0, lang)} className="tv-figure font-semibold text-white" />
            <span>— {free.tagline[lang]}</span>
          </p>
          {onFreePlan ? (
            <span className="shrink-0 text-[12px] font-semibold text-slate-500">
              {LIFETIME_COPY.current[lang]}
            </span>
          ) : (
            onFree && (
              <button
                type="button"
                onClick={onFree}
                disabled={busy != null}
                className="btn-ghost shrink-0 disabled:opacity-50"
              >
                {LIFETIME_COPY.free[lang]}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
