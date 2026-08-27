import { useState, type ReactNode } from "react";
import { Check, Sparkles, Zap, Building2, ArrowRight, Bitcoin, CreditCard } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  TIERS,
  eur,
  monthsFree,
  planId,
  yearlyPerMonth,
  yearlySaving,
  type Bi,
  type Interval,
  type PaidPlan,
  type PaidTier,
  type Plan,
  type Tier,
} from "../../utils/pricing";

/**
 * La grille tarifaire — un seul composant, la landing et l'application.
 *
 * C'était le même contenu écrit deux fois : trois colonnes dans `Landing.tsx`,
 * trois colonnes dans `SubscriptionSection.tsx`. Deux copies d'une offre, c'est
 * une divergence garantie au premier changement de prix, et un trader qui
 * découvre en payant que l'offre n'est pas celle qui l'avait convaincu. Ici,
 * les cartes sont construites depuis `domain/plans` : le tarif affiché est
 * littéralement celui que Stripe encaissera.
 *
 * Le bouton « Continuer gratuitement » est délibérément présent et lisible,
 * pas caché sous la grille : une offre gratuite qu'on doit chercher n'est pas
 * une offre gratuite.
 */

const ICONS: Record<PaidTier, typeof Sparkles> = {
  pro: Sparkles,
  elite: Zap,
  fund: Building2,
};

export interface PricingPlansProps {
  lang: "fr" | "en";
  /** Le plan actuel, pour marquer la colonne « offre en cours ». */
  currentPlan?: Plan | null;
  /** Clé de l'action en cours (désactive les boutons et affiche l'attente). */
  busy?: string | null;
  /** Choix d'une offre payante — checkout carte. */
  onChoose: (plan: PaidPlan) => void;
  /** Paiement en crypto, quand il est proposé. */
  onCrypto?: (plan: PaidPlan) => void;
  /** Action du bouton « Continuer gratuitement ». Absent = bouton masqué. */
  onFree?: () => void;
  /** Période affichée à l'ouverture. L'annuel est mis en avant : c'est l'offre
   *  la plus intéressante pour le trader comme pour le produit. */
  defaultInterval?: Interval;
  className?: string;
}

export default function PricingPlans({
  lang,
  currentPlan,
  busy,
  onChoose,
  onCrypto,
  onFree,
  defaultInterval = "yearly",
  className,
}: PricingPlansProps) {
  const [interval, setInterval] = useState<Interval>(defaultInterval);
  const tr = (b: Bi) => b[lang];
  const yearly = interval === "yearly";
  const paid = TIERS.filter((p) => p.id !== "free");
  const free = TIERS[0];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Bascule mensuel / annuel */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label={lang === "fr" ? "Période de facturation" : "Billing period"}
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
        >
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                "relative rounded-full px-4 py-2 text-[13px] font-semibold transition",
                interval === value
                  ? "bg-white text-[#04101a] shadow-lg shadow-black/30"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {value === "monthly"
                ? lang === "fr"
                  ? "Mensuel"
                  : "Monthly"
                : lang === "fr"
                  ? "Annuel"
                  : "Yearly"}
              {value === "yearly" && (
                <span className="ml-2 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {lang === "fr"
                    ? `${monthsFree("pro")} mois offerts`
                    : `${monthsFree("pro")} months free`}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {paid.map((tier) => {
          const Icon = ICONS[tier.id as PaidTier];
          const plan = planId(tier.id as PaidTier, interval);
          const monthlyFigure = yearly ? yearlyPerMonth(tier.id) : tier.monthly;
          const current = currentPlan === plan;
          const inherits = inheritedFrom(tier.id, lang);
          return (
            <div
              key={tier.id}
              className={cn(
                "relative flex flex-col rounded-3xl border p-6 transition",
                tier.featured
                  ? "border-cyan-400/30 bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] lg:-my-3 lg:py-9"
                  : "border-white/[0.07] bg-white/[0.015]",
              )}
            >
              {tier.featured && (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
              )}

              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em]",
                    tier.featured ? "text-cyan-300" : "text-slate-400",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tr(tier.name)}
                </span>
                {current ? (
                  <Pill tone="neutral">{lang === "fr" ? "Offre en cours" : "Current plan"}</Pill>
                ) : tier.featured ? (
                  <Pill tone="accent">{lang === "fr" ? "Le plus choisi" : "Most popular"}</Pill>
                ) : null}
              </div>

              <div className="mt-4 flex items-end gap-1.5">
                <span className="font-display text-4xl font-extrabold tracking-tight text-white tabular-nums">
                  {eur(Math.round(monthlyFigure * 100) / 100)}
                </span>
                <span className="mb-1.5 text-sm text-slate-400">
                  {lang === "fr" ? "/mois" : "/month"}
                </span>
              </div>

              <p className="mt-2 min-h-[20px] text-[13px] text-slate-400">
                {yearly ? (
                  <>
                    <span className="font-semibold text-white">{eur(tier.yearly)}</span>{" "}
                    {lang === "fr" ? "facturés par an" : "billed yearly"}
                    <span className="ml-2 text-slate-600 line-through">
                      {eur(tier.monthly * 12)}
                    </span>
                  </>
                ) : (
                  <>
                    {lang === "fr" ? "Sans engagement, résiliable" : "No commitment, cancel"}{" "}
                    {lang === "fr" ? "en un clic" : "in one click"}
                  </>
                )}
              </p>

              {yearly && (
                <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-400/15 px-2.5 py-1 text-[12px] font-bold text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {lang === "fr"
                    ? `${eur(yearlySaving(tier.id))} économisés`
                    : `${eur(yearlySaving(tier.id))} saved`}
                </div>
              )}

              <p className="mt-4 text-[13px] leading-5 text-slate-400">{tr(tier.tagline)}</p>

              <button
                onClick={() => onChoose(plan)}
                disabled={busy != null || current}
                className={cn(
                  "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-60",
                  tier.featured
                    ? "bg-gradient-to-r from-cyan-400 to-teal-400 text-[#04101a] hover:brightness-110"
                    : "border border-white/[0.1] bg-white/[0.04] text-white hover:bg-white/[0.07]",
                )}
              >
                {current ? (
                  lang === "fr" ? (
                    "Offre en cours"
                  ) : (
                    "Current plan"
                  )
                ) : busy === plan ? (
                  lang === "fr" ? (
                    "Ouverture…"
                  ) : (
                    "Opening…"
                  )
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {lang === "fr" ? `Choisir ${tr(tier.name)}` : `Choose ${tr(tier.name)}`}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {onCrypto && !current && (
                <button
                  onClick={() => onCrypto(plan)}
                  disabled={busy != null}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13px] font-semibold text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-60"
                >
                  <Bitcoin className="h-4 w-4 text-amber-400" />
                  {busy === `crypto-${plan}`
                    ? lang === "fr"
                      ? "Ouverture…"
                      : "Opening…"
                    : lang === "fr"
                      ? "Payer en crypto"
                      : "Pay with crypto"}
                </button>
              )}

              <div className="mt-6 space-y-2.5 text-[13px]">
                {inherits && (
                  <p className="text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80">
                    {inherits}
                  </p>
                )}
                {tier.features.map((f) => (
                  <p key={f.en} className="flex items-start gap-2.5 text-slate-300">
                    <span
                      className={cn(
                        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full",
                        tier.featured
                          ? "bg-cyan-400/20 text-cyan-300"
                          : "bg-white/[0.06] text-slate-400",
                      )}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    {tr(f)}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* L'offre gratuite — une ligne entière, pas une note de bas de page. */}
      {onFree && (
        <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">
              {lang === "fr" ? "Rester gratuitement" : "Stay on the free plan"}
              <span className="ml-2 text-slate-500">· 0 €</span>
            </p>
            <p className="mt-1 text-[13px] leading-5 text-slate-400">{tr(free.tagline)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
              {free.features.map((f) => (
                <span key={f.en} className="inline-flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-slate-600" />
                  {tr(f)}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onFree}
            className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            {lang === "fr" ? "Continuer gratuitement" : "Continue for free"}
          </button>
        </div>
      )}
    </div>
  );
}

/** « Tout Pro, plus : » — dit l'héritage au lieu de recopier les lignes. */
function inheritedFrom(tier: Tier, lang: "fr" | "en"): string | null {
  if (tier === "elite") return lang === "fr" ? "Tout Pro, plus :" : "Everything in Pro, plus:";
  if (tier === "fund") return lang === "fr" ? "Tout Elite, plus :" : "Everything in Elite, plus:";
  return lang === "fr" ? "Tout le gratuit, plus :" : "Everything free, plus:";
}

function Pill({ tone, children }: { tone: "accent" | "neutral"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        tone === "accent"
          ? "bg-emerald-400 text-[#041018]"
          : "border border-white/[0.1] bg-white/[0.05] text-slate-300",
      )}
    >
      {children}
    </span>
  );
}
