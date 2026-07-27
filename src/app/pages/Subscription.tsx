import { useCallback, type ReactNode } from "react";
import { Sparkles, Shield, Zap, Crown, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";
import { PageHeader, Card } from "@/shared/ui";

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
    <div className="p-4 md:p-5 max-w-3xl mx-auto space-y-4">
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

      {/* Where to manage it — points to the Profile billing section, no logic here. */}
      <Card className="px-4 py-3.5 flex items-center gap-3 animate-fade-in-up stagger-4">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {tr(
            "La gestion de ton abonnement (changement de formule, paiement) se fait depuis ton Profil.",
            "Managing your subscription (plan change, payment) happens from your Profile.",
          )}
        </p>
      </Card>
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
