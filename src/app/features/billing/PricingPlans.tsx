import { Check } from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import PrixAnime from "./PrixAnime";
import LifetimeOffer from "./LifetimeOffer";
import { LIFETIME_COPY } from "@/domain/plans";
import { TIER_BY_ID, eur, tierOf, type PaidPlan, type Plan } from "@/app/utils/pricing";

/**
 * LA GRILLE TARIFAIRE — deux colonnes, une décision.
 *
 * TradeVault ne se vend plus au mois : à gauche l'offre gratuite (utilisable
 * pour toujours, avec ses limites), à droite la licence à vie (20 €, une
 * fois). Le même composant sert la vitrine (`/pricing`) et l'application
 * (Abonnement) : le trader retrouve exactement l'offre qui l'a convaincu.
 */
export interface PricingPlansProps {
  lang: "fr" | "en";
  /** Le plan actuel, pour marquer l'offre en cours. */
  currentPlan?: Plan | null;
  /** Clé de l'action en cours (désactive les boutons). */
  busy?: string | null;
  /** Achat de la licence — checkout carte. */
  onChoose: (plan: PaidPlan) => void;
  /** Paiement en crypto, quand il est proposé. */
  onCrypto?: (plan: PaidPlan) => void;
  /** Action de la colonne gratuite. Absente = colonne affichée sans bouton. */
  onFree?: () => void;
  className?: string;
}

export default function PricingPlans({
  lang,
  currentPlan,
  busy,
  onChoose,
  onCrypto,
  onFree,
  className,
}: PricingPlansProps) {
  const free = TIER_BY_ID.free;
  const owned = tierOf(currentPlan) !== "free";
  const onFreePlan = !!currentPlan && !owned;

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]", className)}>
      <article className="pricing-free">
        <span className="tv-label text-slate-500">{free.name[lang]}</span>
        <p className="mt-1 text-[13px] text-slate-400">{free.tagline[lang]}</p>
        <div className="mt-5">
          <PrixAnime valeur={eur(0, lang)} className="lifetime-price text-slate-200" />
        </div>
        <ul className="mt-5 space-y-2">
          {free.features.map((f) => (
            <li
              key={f.en}
              className="flex items-start gap-2 text-[13px] leading-snug text-slate-400"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              {f[lang]}
            </li>
          ))}
        </ul>
        {onFreePlan ? (
          <p className="mt-6 text-center text-[12px] font-semibold text-slate-500">
            {LIFETIME_COPY.current[lang]}
          </p>
        ) : (
          onFree && (
            <button
              type="button"
              onClick={onFree}
              disabled={busy != null}
              className="btn-ghost mt-6 w-full justify-center disabled:opacity-50"
            >
              {LIFETIME_COPY.free[lang]}
            </button>
          )
        )}
      </article>

      <LifetimeOffer
        lang={lang}
        owned={owned}
        busy={busy != null}
        onChoose={onChoose}
        onCrypto={onCrypto}
      />
    </div>
  );
}
