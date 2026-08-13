import { useCallback, type ReactNode } from "react";
import {
  Sparkles,
  Shield,
  Zap,
  Crown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Bitcoin,
  CalendarClock,
  RefreshCw,
  Receipt,
  Download,
  Lock,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";
import { eur, planPrice, YEARLY_PER_MONTH } from "../utils/pricing";
import { PageHeader } from "@/shared/ui";
import SubscriptionSection from "../components/SubscriptionSection";

type TFn = (k: TKey) => string;

/**
 * Subscription — the single place the trader's plan lives.
 *
 * Everything about the subscription is here and only here: which formula, what
 * it costs, the live status, when it renews or ends, how it is paid, how much
 * trial is left, and what the plan actually unlocks. Profile stays focused on
 * personal information.
 *
 * The visual language is the landing page's — display type, a cyan hairline on
 * the card edge, one soft radial bloom, tabular figures — so the page a trader
 * was sold on and the page they manage look like the same product.
 *
 * Payment itself is untouched: checkout and the billing portal stay in
 * `SubscriptionSection`, rendered at the bottom exactly as it is.
 */
export default function Subscription() {
  const { t, lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const { sub, loading, isPro, trialDaysLeft } = useSubscription();

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

  const paid = sub?.plan === "pro_yearly" || sub?.plan === "pro_monthly";
  const dateFmt = (d: Date) =>
    d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });

  // Trial progress — a 14-day trial with 5 days left reads very differently as
  // a bar than as a sentence, and it is the single most retention-relevant
  // thing on this page.
  const TRIAL_DAYS = 14;
  const trialPct = Math.max(0, Math.min(100, ((TRIAL_DAYS - trialDaysLeft) / TRIAL_DAYS) * 100));

  return (
    <div className="p-4 md:p-5 max-w-5xl mx-auto space-y-4">
      <PageHeader
        className="mb-1 md:mb-1"
        icon={
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
            <Crown className="w-4 h-4 text-white" />
          </span>
        }
        title={tr("Abonnement", "Subscription")}
      />

      {/* ── Status hero, landing-page language ── */}
      <div className="relative rounded-3xl p-6 md:p-7 overflow-hidden border border-cyan-500/15 bg-[linear-gradient(160deg,rgba(14,58,82,.5),rgba(7,14,24,.9)_60%)] animate-fade-in-up stagger-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-white">
                {loading ? "TradeVault" : planLabel}
              </h2>
              {!loading && sub && <StatusChip sub={sub} trialDaysLeft={trialDaysLeft} t={t} />}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {loading
                ? tr("Chargement de ton statut…", "Loading your status…")
                : accessLine(sub, t, tr, dateFmt)}
            </p>
          </div>

          {/* The price of what they are on right now — not a sales price. */}
          {!loading && (
            <div className="text-right shrink-0">
              <div className="font-display text-3xl font-extrabold tabular-nums text-white leading-none">
                {paid && sub ? eur(planPrice(sub.plan as "pro_monthly" | "pro_yearly")) : "0 €"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {paid
                  ? sub?.plan === "pro_yearly"
                    ? `${t("billing.perYear")} · ${eur(YEARLY_PER_MONTH)}${t("billing.perMonth")}`
                    : t("billing.perMonth")
                  : tr("/ toujours", "/ forever")}
              </div>
            </div>
          )}
        </div>

        {/* Trial countdown — only while it is actually running. */}
        {!loading && sub?.status === "trialing" && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
              <span className="text-cyan-300">
                {tr("Essai Premium", "Premium trial")} · {TRIAL_DAYS} {tr("jours", "days")}
              </span>
              <span className="text-slate-400 tabular-nums">
                {t("billing.trialDaysLeft").replace("{n}", String(trialDaysLeft))}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition duration-250"
                style={{ width: `${trialPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── The facts, in one scannable grid ── */}
        {!loading && sub && (
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-6">
            <Fact
              icon={<Receipt className="w-3.5 h-3.5" />}
              label={tr("Formule", "Plan")}
              value={planLabel}
            />
            <Fact
              icon={<CalendarClock className="w-3.5 h-3.5" />}
              label={
                sub.cancelAtPeriodEnd
                  ? tr("Accès jusqu'au", "Access until")
                  : tr("Prochaine échéance", "Next billing")
              }
              value={
                sub.status === "trialing" && sub.trialEndsAt
                  ? dateFmt(sub.trialEndsAt)
                  : sub.currentPeriodEnd
                    ? dateFmt(sub.currentPeriodEnd)
                    : "—"
              }
            />
            <Fact
              icon={
                sub.source === "crypto" ? (
                  <Bitcoin className="w-3.5 h-3.5" />
                ) : sub.source === "stripe" ? (
                  <CreditCard className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )
              }
              label={tr("Paiement", "Payment")}
              value={
                sub.source === "crypto"
                  ? tr("Crypto", "Crypto")
                  : sub.source === "stripe"
                    ? tr("Carte", "Card")
                    : tr("Aucun", "None")
              }
            />
            <Fact
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              label={tr("Renouvellement", "Renewal")}
              value={
                !paid
                  ? "—"
                  : sub.cancelAtPeriodEnd
                    ? tr("Arrêté", "Stopped")
                    : sub.source === "crypto"
                      ? tr("Manuel", "Manual")
                      : tr("Automatique", "Automatic")
              }
              tone={sub.cancelAtPeriodEnd ? "warn" : undefined}
            />
          </div>
        )}
      </div>

      {/* ── What the plan unlocks ── */}
      <div className="glass rounded-2xl p-4 animate-fade-in-up stagger-2">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            {isPro
              ? tr("Ce que tu as débloqué", "What you have unlocked")
              : t("billing.premiumTitle")}
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-2.5">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3"
            >
              <f.icon className="w-4 h-4 text-cyan-400 mb-1.5" />
              <div className="text-xs font-bold text-white">{f.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{f.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Plans & payment. Untouched: this is the existing billing block. ── */}
      <div className="animate-fade-in-up stagger-3">
        <SubscriptionSection />
      </div>

      {/* ── Reassurance rail, straight from the landing ── */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1 pb-2">
        {[
          [Lock, tr("Paiement sécurisé Stripe", "Secure Stripe payment")],
          [CheckCircle2, tr("Annulation en 1 clic", "Cancel in one click")],
          [Download, tr("Données exportables", "Your data stays exportable")],
        ].map(([Ico, label]) => {
          const I = Ico as typeof Lock;
          return (
            <span
              key={label as string}
              className="flex items-center gap-2 text-[11px] text-slate-500"
            >
              <I className="w-3.5 h-3.5 text-emerald-400/80" />
              {label as string}
            </span>
          );
        })}
      </div>
    </div>
  );
}

type Sub = NonNullable<ReturnType<typeof useSubscription>["sub"]>;

/** One fact of the subscription: label on top, value below, nothing else. */
function Fact({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-cyan-400/70 shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-[13px] font-bold truncate",
          tone === "warn" ? "text-amber-300" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** One accessible line: renews on / access until / trial ends / free hint. */
function accessLine(
  sub: Sub | null,
  t: TFn,
  tr: (f: string, e: string) => string,
  dateFmt: (d: Date) => string,
): string {
  if (!sub) return tr("Statut indisponible pour le moment.", "Status unavailable right now.");
  if (sub.status === "active" && sub.currentPeriodEnd) {
    const label = sub.cancelAtPeriodEnd ? t("billing.accessUntil") : t("billing.renewsOn");
    return `${label} ${dateFmt(sub.currentPeriodEnd)}`;
  }
  if (sub.status === "trialing" && sub.trialEndsAt) {
    return `${t("billing.trialEndsOn")} ${dateFmt(sub.trialEndsAt)}`;
  }
  if (sub.status === "past_due") {
    return tr(
      "Le dernier paiement a échoué — mets ta carte à jour pour garder ton accès.",
      "The last payment failed — update your card to keep your access.",
    );
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
