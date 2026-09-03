import { useCallback, type ReactNode } from "react";
import {
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
import {
  eur,
  planPrice,
  intervalOf,
  tierOf,
  yearlyPerMonth,
  TIER_BY_ID,
  type PaidPlan,
} from "../utils/pricing";
import { PageHeader } from "@/shared/ui";
import SubscriptionSection from "../components/SubscriptionSection";
import PlanMatrix from "../components/pricing/PlanMatrix";
import CompAccessSection, { useIsAdmin } from "../components/CompAccessSection";
import PromoCodeSection from "../components/PromoCodeSection";

type TFn = (k: TKey) => string;

/**
 * Subscription — the single place the trader's plan lives.
 *
 * Everything about the subscription is here and only here: which formula, what
 * it costs, the live status, when it renews or ends, how it is paid, what the
 * plan actually unlocks. Profile stays focused on personal information.
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
  const { sub, loading } = useSubscription();
  const isAdmin = useIsAdmin();

  const currentTier = tierOf(sub?.plan);

  const planLabel =
    currentTier === "free"
      ? t("billing.planFree")
      : `TradeVault ${TIER_BY_ID[currentTier].name[fr ? "fr" : "en"]} · ${
          intervalOf(sub?.plan ?? "free") === "yearly"
            ? tr("annuel", "yearly")
            : tr("mensuel", "monthly")
        }`;

  const paid = currentTier !== "free";
  // Un abonnement PAYÉ actif se lit en vert, comme la carte de confirmation
  // d'achat : on voit d'un coup d'œil que c'est en cours, pas à vendre.
  const isActivePaid = paid && sub?.status === "active";
  const dateFmt = (d: Date) =>
    d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-5 max-w-[1400px] mx-auto space-y-4">
      <PageHeader
        className="mb-1 md:mb-1"
        icon={
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
              isActivePaid ? "bg-emerald-500" : "tv-accent-fill",
            )}
          >
            <Crown className="w-4 h-4 text-white" />
          </span>
        }
        title={tr("Abonnement", "Subscription")}
      />

      {/* ── Status hero — VERT quand l'abonnement est actif, cyan quand il
          reste à souscrire (comme la carte de confirmation d'achat). */}
      <div
        className={cn(
          "relative rounded-3xl p-6 md:p-7 overflow-hidden border animate-fade-in-up stagger-1",
          isActivePaid
            ? "border-emerald-400/25 bg-[linear-gradient(160deg,rgba(12,84,62,.5),rgba(6,24,20,.94)_60%)]"
            : "border-cyan-500/15 bg-[linear-gradient(160deg,rgba(14,58,82,.5),rgba(7,14,24,.9)_60%)]",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-60% to-transparent",
            isActivePaid ? "via-emerald-400/70" : "via-cyan-400/60",
          )}
        />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div
            className={cn(
              "relative grid h-12 w-12 place-items-center rounded-xl shrink-0",
              isActivePaid ? "bg-gradient-to-br from-emerald-400 to-teal-500" : "tv-accent-fill",
            )}
          >
            {isActivePaid ? (
              <CheckCircle2 className="w-6 h-6 text-[#03140e]" strokeWidth={2.5} />
            ) : (
              <Crown className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-white">
                {loading ? "TradeVault" : planLabel}
              </h2>
              {!loading && sub && <StatusChip sub={sub} t={t} />}
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
              <div
                className={cn(
                  "tv-figure text-3xl leading-none",
                  isActivePaid ? "text-emerald-300" : "text-white",
                )}
              >
                {paid && sub ? eur(planPrice(sub.plan as PaidPlan)) : "0 €"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {paid
                  ? intervalOf(sub?.plan ?? "free") === "yearly"
                    ? `${t("billing.perYear")} · ${eur(
                        Math.round(yearlyPerMonth(currentTier) * 100) / 100,
                      )}${t("billing.perMonth")}`
                    : t("billing.perMonth")
                  : tr("/ toujours", "/ forever")}
              </div>
            </div>
          )}
        </div>

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
              value={sub.currentPeriodEnd ? dateFmt(sub.currentPeriodEnd) : "—"}
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

      {/* ── Tout ce que contient chaque offre ──
          Une matrice, pas une liste : chaque fonctionnalité n'apparaît
          qu'une fois, dans le palier qui l'ajoute, et sa coche se propage aux
          offres supérieures. La valeur de chaque abonnement se lit en une
          colonne, et Pro — l'offre qu'on veut voir choisir — est en avant. */}
      <div className="glass animate-fade-in-up stagger-2 rounded-2xl p-4">
        <PlanMatrix />
      </div>

      {/* ── Plans & payment. Untouched: this is the existing billing block. ── */}
      <div className="animate-fade-in-up stagger-3">
        <SubscriptionSection />
      </div>

      {/* Panneaux propriétaires : n'apparaissent que pour une adresse listée
          dans `ADMIN_EMAILS`, et chaque action est revérifiée côté serveur. */}
      {isAdmin && (
        <div className="space-y-4">
          <CompAccessSection />
          <PromoCodeSection />
        </div>
      )}

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

/** One accessible line: renews on / access until / permanent / free hint. */
function accessLine(
  sub: Sub | null,
  t: TFn,
  tr: (f: string, e: string) => string,
  dateFmt: (d: Date) => string,
): string {
  if (!sub) return tr("Statut indisponible pour le moment.", "Status unavailable right now.");
  if ((sub.status === "active" || sub.status === "trialing") && sub.currentPeriodEnd) {
    const label = sub.cancelAtPeriodEnd ? t("billing.accessUntil") : t("billing.renewsOn");
    return `${label} ${dateFmt(sub.currentPeriodEnd)}`;
  }
  if (sub.status === "past_due") {
    return tr(
      "Le dernier paiement a échoué — mets ta carte à jour pour garder ton accès.",
      "The last payment failed — update your card to keep your access.",
    );
  }
  if (sub.status === "active" || sub.status === "trialing") {
    return tr("Accès permanent — offert", "Permanent access — complimentary");
  }
  return tr(
    "Tout TradeVault, sans limite — pensé pour les traders sérieux.",
    "All of TradeVault, unlimited — built for serious traders.",
  );
}

function StatusChip({ sub, t }: { sub: Sub; t: TFn }) {
  if (sub.status === "active" || sub.status === "trialing") {
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
