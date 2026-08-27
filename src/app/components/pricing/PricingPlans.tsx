import { useState } from "react";
import { Check, Sparkles, Zap, Gauge, ArrowRight, Bitcoin } from "lucide-react";
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
  type TierDef,
} from "../../utils/pricing";

/**
 * La grille tarifaire — un seul composant, la landing et l'application.
 *
 * Trois colonnes, dans l'ordre où on les lit : ce qu'on a déjà (Gratuit), ce
 * qu'on devrait prendre (Pro), ce qu'on prendra peut-être un jour (Elite). Pro
 * est au centre, surélevée, et porte la promesse du produit : c'est l'offre
 * qu'on veut vendre, donc c'est elle qui reçoit le plus de valeur, pas la plus
 * chère.
 *
 * Les cartes sont construites depuis `domain/plans` : le tarif affiché est
 * littéralement celui que Stripe encaissera, et l'offre décrite sur la landing
 * est littéralement celle qu'on retrouve dans l'application.
 */

const ICONS: Record<Tier, typeof Sparkles> = {
  free: Gauge,
  pro: Sparkles,
  elite: Zap,
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
  /** Action de la colonne gratuite. Absente = colonne affichée sans bouton. */
  onFree?: () => void;
  /** Période affichée à l'ouverture. */
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
  const fr = lang === "fr";
  const yearly = interval === "yearly";

  return (
    <div className={cn("space-y-6", className)}>
      {/* Bascule mensuel / annuel */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label={fr ? "Période de facturation" : "Billing period"}
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
        >
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-semibold transition",
                interval === value
                  ? "bg-white text-[#04101a] shadow-lg shadow-black/30"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {value === "monthly" ? (fr ? "Mensuel" : "Monthly") : fr ? "Annuel" : "Yearly"}
              {value === "yearly" && (
                <span className="ml-2 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {fr ? `${monthsFree("pro")} mois offerts` : `${monthsFree("pro")} months free`}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {TIERS.map((tier) => (
          <PlanColumn
            key={tier.id}
            tier={tier}
            lang={lang}
            yearly={yearly}
            currentPlan={currentPlan}
            busy={busy}
            onChoose={onChoose}
            onCrypto={onCrypto}
            onFree={onFree}
          />
        ))}
      </div>
    </div>
  );
}

function PlanColumn({
  tier,
  lang,
  yearly,
  currentPlan,
  busy,
  onChoose,
  onCrypto,
  onFree,
}: {
  tier: TierDef;
  lang: "fr" | "en";
  yearly: boolean;
  currentPlan?: Plan | null;
  busy?: string | null;
  onChoose: (plan: PaidPlan) => void;
  onCrypto?: (plan: PaidPlan) => void;
  onFree?: () => void;
}) {
  const fr = lang === "fr";
  const tr = (b: Bi) => b[lang];
  const Icon = ICONS[tier.id];
  const isFree = tier.id === "free";
  const plan = isFree ? null : planId(tier.id as PaidTier, yearly ? "yearly" : "monthly");
  const current = isFree ? currentPlan === "free" : currentPlan === plan;
  const monthlyFigure = yearly && !isFree ? yearlyPerMonth(tier.id) : tier.monthly;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border p-6 transition",
        tier.featured
          ? "border-cyan-400/30 bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] lg:-my-3 lg:py-9"
          : "border-white/[0.07] bg-white/[0.015]",
        isFree && "lg:bg-transparent",
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
          <Pill tone="neutral">{fr ? "Offre en cours" : "Current plan"}</Pill>
        ) : tier.featured ? (
          <Pill tone="accent">{fr ? "Recommandé" : "Recommended"}</Pill>
        ) : null}
      </div>

      <div className="mt-4 flex items-end gap-1.5">
        <span className="font-display text-4xl font-extrabold tracking-tight text-white tabular-nums">
          {eur(Math.round(monthlyFigure * 100) / 100)}
        </span>
        <span className="mb-1.5 text-sm text-slate-400">{fr ? "/mois" : "/month"}</span>
      </div>

      <p className="mt-1.5 min-h-[18px] text-[12px] text-slate-500">
        {isFree ? (
          fr ? (
            "Pour toujours"
          ) : (
            "Forever"
          )
        ) : yearly ? (
          <>
            {eur(tier.yearly)} {fr ? "par an" : "per year"}
            <span className="ml-2 text-emerald-400">−{eur(yearlySaving(tier.id))}</span>
          </>
        ) : fr ? (
          "Sans engagement"
        ) : (
          "No commitment"
        )}
      </p>

      <p className="mt-4 text-[13.5px] font-medium leading-5 text-slate-200">{tr(tier.tagline)}</p>

      {isFree ? (
        <button
          onClick={onFree}
          disabled={!onFree || current}
          className="mt-5 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
        >
          {current
            ? fr
              ? "Offre en cours"
              : "Current plan"
            : fr
              ? "Continuer gratuitement"
              : "Continue for free"}
        </button>
      ) : (
        <>
          <button
            onClick={() => plan && onChoose(plan)}
            disabled={busy != null || current}
            className={cn(
              "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-60",
              tier.featured
                ? "bg-gradient-to-r from-cyan-400 to-teal-400 text-[#04101a] hover:brightness-110"
                : "border border-white/[0.1] bg-white/[0.04] text-white hover:bg-white/[0.07]",
            )}
          >
            {current ? (
              fr ? (
                "Offre en cours"
              ) : (
                "Current plan"
              )
            ) : busy === plan ? (
              fr ? (
                "Ouverture…"
              ) : (
                "Opening…"
              )
            ) : (
              <>
                {fr ? "Commencer" : "Get started"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {onCrypto && !current && plan && (
            <button
              onClick={() => onCrypto(plan)}
              disabled={busy != null}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[11.5px] font-medium text-slate-500 transition hover:text-slate-300 disabled:opacity-60"
            >
              <Bitcoin className="h-3 w-3" />
              {fr ? "ou payer en crypto" : "or pay with crypto"}
            </button>
          )}
        </>
      )}

      <div className="mt-6 space-y-2.5 text-[13px]">
        {!isFree && (
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80">
            {tier.id === "pro"
              ? fr
                ? "Tout le gratuit, plus :"
                : "Everything free, plus:"
              : fr
                ? "Tout Pro, plus :"
                : "Everything in Pro, plus:"}
          </p>
        )}
        {tier.features.map((f) => (
          <p key={f.en} className="flex items-start gap-2.5 text-slate-300">
            <span
              className={cn(
                "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full",
                tier.featured ? "bg-cyan-400/20 text-cyan-300" : "bg-white/[0.06] text-slate-400",
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
}

function Pill({ tone, children }: { tone: "accent" | "neutral"; children: React.ReactNode }) {
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
