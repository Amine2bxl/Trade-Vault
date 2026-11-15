import { ArrowRight, Bitcoin, CreditCard, ShieldCheck } from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import PrixAnime from "./PrixAnime";
import {
  LIFETIME_COPY,
  LIFETIME_EUR,
  LIFETIME_PLAN,
  MONTHLY_COPY,
  MONTHLY_EUR,
  breakEvenCopy,
  type PaidPlan,
  type SalePlan,
} from "@/domain/plans";
import { eur } from "@/app/utils/pricing";

/**
 * UNE OFFRE PAYANTE — la carte du mensuel OU de la licence.
 *
 * Les deux plans ouvrent exactement le même produit : la carte ne dit donc
 * que ce qui les distingue — le prix, son rythme, et comment on s'en va.
 * La liste de ce qui est inclus vit UNE fois, sous les deux cartes
 * (`PricingPlans`) : la répéter dans chaque colonne ferait comparer deux
 * listes identiques à la recherche d'une différence qui n'existe pas.
 *
 * Matière Revolut : prix en chiffre héros, bouton plein (texte blanc), ligne
 * de confiance dessous. La licence porte le liseré d'accent : c'est l'offre
 * la plus avantageuse dès le sixième mois, et la phrase qui le dit est
 * calculée (`breakEvenCopy`), jamais écrite à la main.
 */
export type OfferState =
  /** À vendre. */
  | "buy"
  /** Déjà possédée — la carte le dit au lieu de vendre. */
  | "owned"
  /** Rendue inutile par une offre supérieure déjà possédée (mensuel face à
   *  une licence). */
  | "included";

export default function OfferCard({
  plan,
  lang,
  state = "buy",
  busy = false,
  onChoose,
  onCrypto,
  onManage,
  className,
}: {
  plan: SalePlan;
  lang: "fr" | "en";
  state?: OfferState;
  busy?: boolean;
  onChoose?: (plan: PaidPlan) => void;
  /** Paiement en crypto — proposé pour la licence seulement : un paiement
   *  crypto ne se renouvelle pas tout seul. */
  onCrypto?: (plan: PaidPlan) => void;
  /** Portail Stripe — pour gérer ou résilier un mensuel en cours. */
  onManage?: () => void;
  className?: string;
}) {
  const lifetime = plan === LIFETIME_PLAN;
  const copy = lifetime ? LIFETIME_COPY : MONTHLY_COPY;
  const price = eur(lifetime ? LIFETIME_EUR : MONTHLY_EUR, lang);

  return (
    <article className={cn("offer-card", lifetime && "offer-card--featured", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[1.05rem] font-bold tracking-tight text-white">{copy.title[lang]}</h3>
        <span className={cn("offer-badge", !lifetime && "offer-badge--neutral")}>
          {copy.badge[lang]}
        </span>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <PrixAnime valeur={price} className="offer-price" />
        <span className="mb-1.5 text-[13px] font-medium text-slate-400">
          {copy.priceNote[lang]}
        </span>
      </div>
      {/* La seule phrase qui compare les deux offres, sur la carte qui en
          profite. Elle sort des deux montants du catalogue. */}
      <p className="mt-2 min-h-[20px] text-[13px] text-slate-400">
        {lifetime ? breakEvenCopy(lang) : MONTHLY_COPY.note[lang]}
      </p>

      <div className="mt-auto pt-6">
        {state === "owned" ? (
          <>
            <p className="offer-owned">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              {copy.owned[lang]}
            </p>
            {!lifetime && onManage && (
              <button
                type="button"
                onClick={onManage}
                disabled={busy}
                className="btn-ghost mt-2 w-full justify-center disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" aria-hidden />
                {MONTHLY_COPY.manage[lang]}
              </button>
            )}
          </>
        ) : state === "included" ? (
          <p className="text-center text-[12.5px] font-medium text-slate-500">
            {LIFETIME_COPY.owned[lang]}
          </p>
        ) : (
          onChoose && (
            <>
              <button
                type="button"
                onClick={() => onChoose(plan)}
                disabled={busy}
                className={cn(
                  "w-full justify-center disabled:opacity-60",
                  lifetime ? "btn-primary" : "btn-ghost",
                )}
              >
                {copy.cta[lang]}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              {lifetime && onCrypto && (
                <button
                  type="button"
                  onClick={() => onCrypto(plan)}
                  disabled={busy}
                  className="mt-2 inline-flex min-h-[32px] w-full items-center justify-center gap-1.5 text-[12px] font-medium text-slate-500 transition hover:text-slate-300 disabled:opacity-60"
                >
                  <Bitcoin className="h-3.5 w-3.5" aria-hidden />
                  {LIFETIME_COPY.crypto[lang]}
                </button>
              )}
              <p className="mt-3 text-center text-[11.5px] leading-snug text-slate-500">
                {copy.trust[lang]}
              </p>
            </>
          )
        )}
      </div>
    </article>
  );
}
