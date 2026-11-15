import { Check } from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import PrixAnime from "./PrixAnime";
import OfferCard, { type OfferState } from "./OfferCard";
import { LIFETIME_COPY, LIFETIME_PLAN, MONTHLY_PLAN } from "@/domain/plans";
import { TIER_BY_ID, eur, tierOf, type PaidPlan, type Plan } from "@/app/utils/pricing";

/**
 * LA GRILLE TARIFAIRE — trois colonnes, puis ce que les deux payantes ouvrent.
 *
 * Gratuit (pour toujours, avec ses limites), Mensuel (sans engagement),
 * Licence à vie (une fois). Les deux offres payantes ouvrent EXACTEMENT le
 * même produit : leur liste commune vit une seule fois, sous les cartes, au
 * lieu d'être répétée dans chaque colonne.
 *
 * Le même composant sert la vitrine (`/pricing`) et l'application
 * (Abonnement) : le trader retrouve exactement l'offre qui l'a convaincu.
 */
export interface PricingPlansProps {
  lang: "fr" | "en";
  /** Le plan actuel, pour marquer l'offre en cours. */
  currentPlan?: Plan | null;
  /** Clé de l'action en cours (désactive les boutons). */
  busy?: string | null;
  /** Achat — checkout carte (mensuel ou licence). */
  onChoose: (plan: PaidPlan) => void;
  /** Paiement en crypto, quand il est proposé (licence seulement). */
  onCrypto?: (plan: PaidPlan) => void;
  /** Portail Stripe — pour un mensuel en cours. */
  onManage?: () => void;
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
  onManage,
  onFree,
  className,
}: PricingPlansProps) {
  const free = TIER_BY_ID.free;
  const full = TIER_BY_ID.elite;
  const ownsLifetime = currentPlan === LIFETIME_PLAN;
  // Tout autre plan payant (mensuel, ancien Pro…) compte comme un abonnement
  // en cours : la licence reste achetable, le mensuel ne l'est plus.
  const subscribed = !ownsLifetime && tierOf(currentPlan) !== "free";
  const onFreePlan = !!currentPlan && tierOf(currentPlan) === "free";

  const monthlyState: OfferState = ownsLifetime ? "included" : subscribed ? "owned" : "buy";
  const lifetimeState: OfferState = ownsLifetime ? "owned" : "buy";

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="offer-card">
          <h3 className="text-[1.05rem] font-bold tracking-tight text-white">{free.name[lang]}</h3>
          <p className="mt-1 text-[13px] text-slate-400">{free.tagline[lang]}</p>
          <div className="mt-5">
            <PrixAnime valeur={eur(0, lang)} className="offer-price text-slate-200" />
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
          <div className="mt-auto pt-6">
            {onFreePlan ? (
              <p className="text-center text-[12px] font-semibold text-slate-500">
                {LIFETIME_COPY.current[lang]}
              </p>
            ) : (
              onFree && (
                <button
                  type="button"
                  onClick={onFree}
                  disabled={busy != null}
                  className="btn-ghost w-full justify-center disabled:opacity-50"
                >
                  {LIFETIME_COPY.free[lang]}
                </button>
              )
            )}
          </div>
        </article>

        <OfferCard
          plan={MONTHLY_PLAN}
          lang={lang}
          state={monthlyState}
          busy={busy != null}
          onChoose={onChoose}
          onManage={onManage}
        />
        <OfferCard
          plan={LIFETIME_PLAN}
          lang={lang}
          state={lifetimeState}
          busy={busy != null}
          onChoose={onChoose}
          onCrypto={onCrypto}
        />
      </div>

      {/* CE QUE LES DEUX OFFRES PAYANTES OUVRENT — une fois, pour les deux. */}
      <section className="offer-card offer-card--flat" aria-labelledby="offer-included">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="offer-included" className="text-[15px] font-bold text-white">
            {full.name[lang]}
          </h3>
          <p className="text-[13px] text-slate-400">{full.tagline[lang]}</p>
        </div>
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {full.features.map((f) => (
            <li
              key={f.en}
              className="flex items-start gap-2 text-[13px] leading-snug text-slate-300"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tv-chart-green)]" />
              {f[lang]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
