import { useState } from "react";
import { Check, Sparkles, Zap, Gauge, ArrowRight, Bitcoin, Lock } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  TIERS,
  eur,
  monthsFree,
  planId,
  yearlyPerMonth,
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
 * Trois colonnes, mais une seule qui doit être lue : Pro est la vedette. La
 * grille ne vend pas trois offres, elle vend UNE offre (Pro) en rassurant sur
 * la gratuité d'à-côté. Chaque élément qui n'aide pas à prendre cette décision
 * a été retiré : pas de sous-titre, pas de calcul en cascade, pas de troisième
 * prière — les deux autres colonnes restent discrètes.
 *
 * Pro mène avec ses DEUX bénéfices les plus concrets (tes erreurs chiffrées en
 * euros, ta probabilité de ruine) — ce sont eux, pas le nom d'une page, qui
 * font passer à l'action. Le reste est une liste courte et vérifiable.
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
      {/* Bascule mensuel / annuel — la seule décision avant l'offre. */}
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
                  : "text-slate-500 hover:text-slate-200",
              )}
            >
              {value === "monthly" ? (fr ? "Mensuel" : "Monthly") : fr ? "Annuel" : "Yearly"}
              {value === "yearly" && (
                <span className="ml-1.5 text-[11px] font-bold text-emerald-400">
                  −{monthsFree("pro")} {fr ? "mois" : "mo."}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {TIERS.map((tier) => {
          const val =
            tier.id === "free" ? null : planId(tier.id as PaidTier, yearly ? "yearly" : "monthly");
          const current = val != null ? currentPlan === val : currentPlan === "free";
          return (
            <PlanColumn
              key={tier.id}
              tier={tier}
              lang={lang}
              yearly={yearly}
              current={current}
              busy={busy}
              onChoose={val ? onChoose : undefined}
              onCrypto={onCrypto}
              onFree={tier.id === "free" ? onFree : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlanColumn({
  tier,
  lang,
  yearly,
  current,
  busy,
  onChoose,
  onCrypto,
  onFree,
}: {
  tier: TierDef;
  lang: "fr" | "en";
  yearly: boolean;
  current: boolean;
  busy?: string | null;
  onChoose?: (plan: PaidPlan) => void;
  onCrypto?: (plan: PaidPlan) => void;
  onFree?: () => void;
}) {
  const fr = lang === "fr";
  const tr = (b: Bi) => b[lang];
  const Icon = ICONS[tier.id];
  const isFree = tier.id === "free";
  const isPro = tier.id === "pro";
  const plan = isFree ? null : planId(tier.id as PaidTier, yearly ? "yearly" : "monthly");
  const key = plan ?? "free";
  const price = isFree
    ? "0 €"
    : eur(Math.round((yearly ? yearlyPerMonth(tier.id) : tier.monthly) * 100) / 100);

  // Les deux bénéfices les plus concrets de Pro, en tête de liste. Texte déjà
  // utilisé partout (PAGE_VALUE), pas de promesse nouvelle. Liste courte,
  // vérifiable, chiffrée — c'est ce qui rend l'offre irrésistible.
  const proHighlights = [
    {
      fr: "Le prix en euros de chaque erreur que tu répètes.",
      en: "The euro price of every mistake you keep repeating.",
    },
    {
      fr: "Ta probabilité de ruine sur 10 000 scénarios de ton edge.",
      en: "Your risk of ruin across 10,000 runs of your edge.",
    },
  ];
  const featured = isPro ? tier.features : tier.features.slice(0, isFree ? 4 : 5);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border p-6 transition",
        isPro
          ? "border-cyan-400/40 bg-[linear-gradient(165deg,rgba(16,72,102,.6),rgba(7,14,24,.94)_62%)] lg:-my-4 lg:py-12 shadow-[0_24px_80px_-32px_rgba(34,211,238,.35)]"
          : "border-white/[0.07] bg-white/[0.015]",
        isFree && "lg:bg-transparent lg:opacity-80",
      )}
    >
      {isPro && (
        <>
          {/* Liseré haut, le seul « chrome » — il oriente l'œil vers Pro. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
          <span className="tv-label absolute right-6 top-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-2.5 py-1 text-[#041018]">
            <Sparkles className="h-3 w-3" />
            {fr ? "Recommandé" : "Recommended"}
          </span>
        </>
      )}

      {/* Le nom — aucune prière, juste ce qu'on achète. */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", isPro ? "text-cyan-300" : "text-slate-500")} />
        <span
          className={cn(
            "tv-label inline-flex items-center",
            isPro ? "text-cyan-300" : "text-slate-400",
          )}
        >
          {tr(tier.name)}
        </span>
        {current && (
          <span className="ml-1 rounded-full border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            {fr ? "Offre en cours" : "Current"}
          </span>
        )}
      </div>

      {/* Prix — un seul chiffre à lire. */}
      <div className="mt-5 flex items-end gap-1.5">
        <span className={cn("tv-figure text-white", isPro ? "text-5xl" : "text-4xl")}>{price}</span>
        <span className="mb-1.5 text-sm text-slate-400">
          {isFree ? (fr ? "/ pour toujours" : "/ forever") : fr ? "/mois" : "/month"}
        </span>
      </div>
      <p className="mt-1.5 min-h-[18px] text-[12px] text-slate-500">
        {isFree ? (
          <>&nbsp;</>
        ) : yearly ? (
          <>
            <span className="text-slate-500 line-through">{eur(tier.monthly)}</span>
            <span className="mx-2 text-slate-600">·</span>
            {fr ? "facturé" : "billed"} {eur(tier.yearly)}/an
            {!current && (
              <span className="ml-2 text-emerald-400">
                {monthsFree(tier.id)} {fr ? "mois offerts" : "mo. free"}
              </span>
            )}
          </>
        ) : (
          " "
        )}
      </p>

      <p
        className={cn(
          "mt-4 text-[13.5px] font-medium leading-5",
          isPro ? "text-cyan-100" : "text-slate-300",
        )}
      >
        {tr(tier.tagline)}
      </p>

      {/* Call to action — le point focal de la colonne. */}
      {isFree ? (
        <button
          onClick={onFree}
          disabled={!onFree || current}
          className="mt-6 w-full rounded-xl border border-white/[0.1] bg-transparent px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
        >
          {fr ? "Commencer gratuitement" : "Start for free"}
        </button>
      ) : (
        <>
          <button
            onClick={() => plan && onChoose && onChoose(plan)}
            disabled={busy != null || current}
            className={cn(
              "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition disabled:opacity-60",
              isPro
                ? "tv-accent-fill"
                : "border border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08]",
            )}
          >
            {current ? (
              fr ? (
                "Offre en cours"
              ) : (
                "Current plan"
              )
            ) : busy === key ? (
              fr ? (
                "Ouverture…"
              ) : (
                "Opening…"
              )
            ) : (
              <>
                {fr ? (isPro ? "Passer à Pro" : "Passer à Elite") : isPro ? "Get Pro" : "Go Elite"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {isPro && (
            <p className="mt-2.5 text-center text-[11px] text-slate-500">
              {fr
                ? "Sans engagement · Annulation en 1 clic"
                : "No commitment · Cancel in one click"}
            </p>
          )}

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

      {/* Pro mène avec ses bénéfices chiffrés ; les autres restent laconiques. */}
      <div className="mt-7 space-y-3">
        {isPro ? (
          <>
            {proHighlights.map((h) => (
              <div
                key={h.en}
                className="flex items-start gap-2.5 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-3.5 py-2.5"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <span className="text-[13px] font-semibold leading-snug text-cyan-50">
                  {h[lang]}
                </span>
              </div>
            ))}
            <div className="grid gap-1.5 pt-1">
              {[...tier.features.slice(0, 2), ...tier.features.slice(4)].map((f) => (
                <p key={f.en} className="flex items-start gap-2 text-[13px] text-slate-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {tr(f)}
                </p>
              ))}
            </div>
            <p className="pt-1 text-[12px] text-slate-500">
              {fr
                ? "+ tout le plan gratuit, sans aucune limite."
                : "+ everything in Free, with no limits at all."}
            </p>
          </>
        ) : (
          <div className="space-y-2.5">
            {tier.id === "elite" && (
              <p className="tv-label text-cyan-300/90">
                {fr ? "Tout Pro, mais sans limites, plus :" : "All of Pro without limits, plus:"}
              </p>
            )}
            {featured.map((f) => (
              <p key={f.en} className="flex items-start gap-2 text-[13px] text-slate-400">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                <span className="text-slate-300">{tr(f)}</span>
              </p>
            ))}
            {tier.id === "elite" && (
              <p className="flex items-start gap-2 text-[13px] text-slate-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                {fr
                  ? "Prends-la seulement si le Pro te limite."
                  : "Only if Pro starts limiting you."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
