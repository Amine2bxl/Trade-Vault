import { useCallback, type ReactNode } from "react";
import { Sparkles, Shield, Zap, Crown, Clock, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";
import { PageHeader } from "@/shared/ui";

type TFn = (k: TKey) => string;

// Subscription — STATUS ONLY. This page shows the trader where they stand
// (plan, trial, days left) and never any price or checkout: all payment logic
// lives in the Profile billing section. No Stripe calls happen here.

export default function Subscription() {
  const { t, lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const { sub, loading, trialDaysLeft } = useSubscription();

  const features = [
    {
      icon: Sparkles,
      title: tr("Jarvis illimité", "Unlimited Jarvis"),
      sub: tr("Analyses et débriefs sans limite", "Unlimited analysis and debriefs"),
    },
    {
      icon: Zap,
      title: tr("Rapports mensuels IA", "AI monthly reports"),
      sub: tr("Synthèse automatique chaque mois", "Automatic synthesis every month"),
    },
    {
      icon: Shield,
      title: tr("Comptes illimités", "Unlimited accounts"),
      sub: tr("Prop firms, démo, réel — tout séparé", "Prop firms, demo, live — all separate"),
    },
  ];

  const planLabel =
    sub?.plan === "pro_yearly"
      ? t("billing.planProYearly")
      : sub?.plan === "pro_monthly"
        ? t("billing.planProMonthly")
        : t("billing.planFree");

  return (
    <div className="p-4 md:p-5 max-w-5xl mx-auto space-y-4">
      <PageHeader
        className="mb-1 md:mb-1"
        title={tr("Abonnement", "Subscription")}
        subtitle={tr(
          "Ton accès TradeVault, en un coup d'œil.",
          "Your TradeVault access at a glance.",
        )}
      />

      {/* Status hero — real subscription state, no prices. */}
      <div className="relative glass-strong rounded-3xl p-4 md:p-5 overflow-hidden animate-fade-in-up stagger-1">
        <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-white">{loading ? "TradeVault" : planLabel}</h2>
              {!loading && sub && <StatusChip sub={sub} trialDaysLeft={trialDaysLeft} t={t} />}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {loading
                ? tr("Chargement de ton statut…", "Loading your status…")
                : accessLine(sub, t, tr)}
            </p>
          </div>
        </div>
        <div className="relative grid md:grid-cols-3 gap-2.5 mt-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3.5"
            >
              <f.icon className="w-4.5 h-4.5 text-cyan-400 mb-2" />
              <div className="text-xs font-bold text-white">{f.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{f.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans — same structure and wording as the landing pricing section, so
          the product and the marketing site tell one story. Presentation only:
          no Stripe, no checkout, no payment logic on this page. */}
      <section className="animate-fade-in-up stagger-2">
        <div className="grid gap-3 lg:grid-cols-3 lg:items-stretch">
          {PLANS(tr).map((p) => (
            <PlanCard key={p.id} plan={p} current={sub?.plan} tr={tr} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Plans (presentation only — mirrors the landing pricing section) ───────── */

interface Plan {
  id: "free" | "pro_yearly" | "pro_monthly";
  name: string;
  price: string;
  period: string;
  note?: string;
  badge?: string;
  tagline: string;
  featured?: boolean;
  included: string[];
  excluded?: string[];
}

const PLANS = (tr: (f: string, e: string) => string): Plan[] => [
  {
    id: "free",
    name: "Free",
    price: "0 €",
    period: tr("/ toujours", "/ forever"),
    tagline: tr("Pour poser les bases de ta discipline.", "To lay the foundations of your discipline."),
    included: [
      "Dashboard",
      tr("Journal de trading (30 trades / mois)", "Trading journal (30 trades / month)"),
      tr("Checklist pré-market", "Pre-market checklist"),
      tr("Statistiques de base", "Basic statistics"),
    ],
    excluded: [
      tr("Jarvis illimité", "Unlimited Jarvis"),
      tr("Import CSV automatique", "Automatic CSV import"),
      tr("Rapports mensuels", "Monthly reports"),
    ],
  },
  {
    id: "pro_yearly",
    name: tr("Pro · Annuel", "Pro · Yearly"),
    price: "19,90 €",
    period: tr("/ mois", "/ month"),
    note: tr("239 € facturés une fois par an", "€239 billed once a year"),
    badge: tr("2 mois offerts", "2 months free"),
    tagline: tr("La meilleure valeur, de loin.", "The best value, by far."),
    featured: true,
    included: [
      tr("Tout le plan Free, sans limite", "Everything in Free, unlimited"),
      tr("Jarvis illimité 24h/24", "Unlimited Jarvis 24/7"),
      tr("Analytics quantitatives (20+ métriques)", "Quant analytics (20+ metrics)"),
      tr("Suivi des erreurs & setups manqués", "Mistake & missed-setup tracking"),
      tr("Rapports mensuels automatiques", "Automatic monthly reports"),
      tr("Import CSV illimité", "Unlimited CSV import"),
    ],
  },
  {
    id: "pro_monthly",
    name: tr("Pro · Mensuel", "Pro · Monthly"),
    price: "24,99 €",
    period: tr("/ mois", "/ month"),
    note: tr("Sans engagement, résiliable à tout moment", "No commitment, cancel anytime"),
    tagline: tr("La souplesse, mois par mois.", "Flexibility, month by month."),
    included: [
      tr("Tout le plan Free, sans limite", "Everything in Free, unlimited"),
      tr("Jarvis illimité 24h/24", "Unlimited Jarvis 24/7"),
      tr("Analytics quantitatives (20+ métriques)", "Quant analytics (20+ metrics)"),
      tr("Rapports mensuels automatiques", "Automatic monthly reports"),
    ],
  },
];

function PlanCard({
  plan,
  current,
  tr,
}: {
  plan: Plan;
  current?: string;
  tr: (f: string, e: string) => string;
}) {
  const isCurrent = current === plan.id || (!current && plan.id === "free");
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl p-4 md:p-5",
        plan.featured
          ? "border border-cyan-400/25 bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)]"
          : "border border-white/[0.06] bg-white/[0.015]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-[.15em]",
            plan.featured ? "text-cyan-300" : "text-slate-400",
          )}
        >
          {plan.name}
        </p>
        {plan.badge && (
          <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#03131b]">
            {plan.badge}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-1.5">
        <span
          className={cn(
            "font-display font-extrabold text-white",
            plan.featured ? "text-4xl" : "text-3xl",
          )}
        >
          {plan.price}
        </span>
        <span className="mb-1.5 text-sm text-slate-500">{plan.period}</span>
      </div>
      {plan.note && <p className="mt-1.5 text-xs text-slate-400">{plan.note}</p>}
      <p className="mt-2 text-xs text-slate-500">{plan.tagline}</p>

      {/* Presentation only — the real checkout lives in the Profile billing section. */}
      <div className="mt-4">
        {isCurrent ? (
          <span className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-bold text-slate-400">
            <CheckCircle2 className="h-4 w-4" />
            {tr("Ton offre actuelle", "Your current plan")}
          </span>
        ) : (
          <span className="flex h-10 w-full items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] text-xs font-bold text-cyan-300">
            {tr("Disponible bientôt", "Available soon")}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2 text-xs">
        {plan.included.map((f) => (
          <p key={f} className="flex items-start gap-2 text-slate-300">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/[0.06] text-slate-300">
              <CheckCircle2 className="h-3 w-3" />
            </span>
            {f}
          </p>
        ))}
        {plan.excluded?.map((f) => (
          <p key={f} className="flex items-start gap-2 text-slate-600">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/[0.03]">
              <X className="h-3 w-3" />
            </span>
            <span className="line-through">{f}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

type Sub = NonNullable<ReturnType<typeof useSubscription>["sub"]>;

/** One accessible line: renews on / access until / trial ends / free hint. */
function accessLine(sub: Sub | null, t: TFn, tr: (f: string, e: string) => string): string {
  if (!sub) return tr("Statut indisponible pour le moment.", "Status unavailable right now.");
  if (sub.status === "active" && sub.currentPeriodEnd) {
    const label = sub.cancelAtPeriodEnd ? t("billing.accessUntil") : t("billing.renewsOn");
    return `${label} ${sub.currentPeriodEnd.toLocaleDateString()}`;
  }
  if (sub.status === "trialing" && sub.trialEndsAt) {
    return `${t("billing.trialEndsOn")} ${sub.trialEndsAt.toLocaleDateString()}`;
  }
  return tr(
    "Tout TradeVault, sans limite — pensé pour les traders sérieux.",
    "All of TradeVault, unlimited — built for serious traders.",
  );
}

function StatusChip({ sub, trialDaysLeft, t }: { sub: Sub; trialDaysLeft: number; t: TFn }) {
  if (sub.status === "trialing") {
    return (
      <Chip className="bg-cyan-500/10 border-cyan-500/25 text-cyan-300" icon={Clock}>
        {t("billing.trialDaysLeft").replace("{n}", String(trialDaysLeft))}
      </Chip>
    );
  }
  if (sub.status === "active") {
    return (
      <Chip
        className="bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
        icon={CheckCircle2}
      >
        {sub.cancelAtPeriodEnd ? t("billing.cancelsAtPeriodEnd") : t("billing.active")}
      </Chip>
    );
  }
  if (sub.status === "past_due") {
    return (
      <Chip className="bg-amber-500/10 border-amber-500/25 text-amber-300" icon={AlertTriangle}>
        {t("billing.pastDue")}
      </Chip>
    );
  }
  return (
    <Chip className="bg-white/[0.05] border-white/[0.08] text-slate-400">
      {t("billing.freePlan")}
    </Chip>
  );
}

function Chip({
  children,
  className,
  icon: Icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: typeof Clock;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
        className,
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}
