import { useState } from "react";
import {
  CreditCard,
  Sparkles,
  Bitcoin,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";

// "Gestion d'abonnement" card on the profile page.
//
// Free / trialing users see both Pro plans with card (Stripe Checkout —
// cards, Apple Pay, Google Pay) and crypto (Coinbase Commerce) buttons.
// Stripe subscribers get one button into the Billing Portal, where upgrade,
// downgrade, card change and cancellation are each one click. Crypto
// subscribers see their access end date and renewal buttons.

export default function SubscriptionSection() {
  const { t } = useT();
  const { sub, loading, isPro, trialDaysLeft, checkout, openPortal, cryptoCheckout } =
    useSubscription();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Promo deep link from the winback email: /?upgrade=1&promo=VAULT20
  const promo =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("promo") ?? undefined)
      : undefined;

  if (loading || !sub) {
    return (
      <div className="glass-strong rounded-3xl p-6">
        <div className="h-5 w-40 rounded bg-white/[0.06] animate-pulse" />
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<string | null>) => {
    setBusy(key);
    setError(null);
    const err = await fn();
    if (err) {
      setError(err);
      setBusy(null);
    }
    // on success the browser navigates away — leave the spinner on
  };

  const planLabel =
    sub.plan === "pro_yearly"
      ? t("billing.planProYearly")
      : sub.plan === "pro_monthly"
        ? t("billing.planProMonthly")
        : t("billing.planFree");

  const statusChip =
    sub.status === "trialing" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 px-3 py-1 text-xs font-bold text-cyan-300">
        <Clock className="w-3.5 h-3.5" />
        {t("billing.trialDaysLeft").replace("{n}", String(trialDaysLeft))}
      </span>
    ) : sub.status === "active" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-bold text-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {sub.cancelAtPeriodEnd ? t("billing.cancelsAtPeriodEnd") : t("billing.active")}
      </span>
    ) : sub.status === "past_due" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-3 py-1 text-xs font-bold text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5" />
        {t("billing.pastDue")}
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-white/[0.05] border border-white/[0.08] px-3 py-1 text-xs font-bold text-slate-400">
        {t("billing.freePlan")}
      </span>
    );

  const showPlans = !isPro || sub.status === "trialing";
  const isStripeActive = sub.status === "active" && sub.source === "stripe";

  return (
    <div className="glass-strong rounded-3xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
          {t("billing.title")}
        </h2>
        {statusChip}
      </div>

      {/* Current plan summary */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{planLabel}</div>
          <div className="text-[11px] text-slate-500">
            {sub.status === "active" && sub.currentPeriodEnd
              ? `${sub.cancelAtPeriodEnd ? t("billing.accessUntil") : t("billing.renewsOn")} ${sub.currentPeriodEnd.toLocaleDateString()}`
              : sub.status === "trialing" && sub.trialEndsAt
                ? `${t("billing.trialEndsOn")} ${sub.trialEndsAt.toLocaleDateString()}`
                : t("billing.freeHint")}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {promo && showPlans && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-sm text-emerald-300 font-semibold">
          {t("billing.promoApplied").replace("{code}", promo)}
        </div>
      )}

      {/* Upgrade grid — free & trialing users */}
      {showPlans && (
        <div className="grid sm:grid-cols-2 gap-3">
          <PlanCard
            highlight
            title={t("billing.planProYearly")}
            price="239 €"
            per={t("billing.perYear")}
            note={t("billing.yearlyNote")}
            busy={busy}
            keys={{ card: "y-card", crypto: "y-crypto" }}
            onCard={() => run("y-card", () => checkout("pro_yearly", promo))}
            onCrypto={() => run("y-crypto", () => cryptoCheckout("pro_yearly"))}
          />
          <PlanCard
            title={t("billing.planProMonthly")}
            price="24,99 €"
            per={t("billing.perMonth")}
            note={t("billing.monthlyNote")}
            busy={busy}
            keys={{ card: "m-card", crypto: "m-crypto" }}
            onCard={() => run("m-card", () => checkout("pro_monthly", promo))}
            onCrypto={() => run("m-crypto", () => cryptoCheckout("pro_monthly"))}
          />
        </div>
      )}

      {/* Stripe subscribers: everything (card, plan switch, cancel) is one
          click away inside the Billing Portal. */}
      {(isStripeActive || (sub.hasStripeCustomer && sub.status !== "trialing")) && (
        <button
          onClick={() => run("portal", openPortal)}
          disabled={busy !== null}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-200 hover:bg-white/[0.06] transition disabled:opacity-60"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <CreditCard className="w-4 h-4 text-cyan-400" />
            {busy === "portal" ? t("billing.opening") : t("billing.manage")}
          </span>
          <ExternalLink className="w-4 h-4 text-slate-500" />
        </button>
      )}
      {isStripeActive && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{t("billing.portalHint")}</p>
      )}

      {/* Crypto subscribers renew manually — crypto has no auto-renewal. */}
      {sub.status === "active" && sub.source === "crypto" && (
        <div className="flex gap-2.5">
          <button
            onClick={() => run("renew-m", () => cryptoCheckout("pro_monthly"))}
            disabled={busy !== null}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-semibold text-slate-200 hover:bg-white/[0.06] transition disabled:opacity-60"
          >
            {t("billing.renewMonth")}
          </button>
          <button
            onClick={() => run("renew-y", () => cryptoCheckout("pro_yearly"))}
            disabled={busy !== null}
            className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/15 transition disabled:opacity-60"
          >
            {t("billing.renewYear")}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  title,
  price,
  per,
  note,
  highlight = false,
  busy,
  keys,
  onCard,
  onCrypto,
}: {
  title: string;
  price: string;
  per: string;
  note: string;
  highlight?: boolean;
  busy: string | null;
  keys: { card: string; crypto: string };
  onCard: () => void;
  onCrypto: () => void;
}) {
  const { t: tt } = useT();
  return (
    <div
      className={cn(
        "rounded-2xl p-4 border flex flex-col gap-3",
        highlight ? "border-cyan-500/30 bg-cyan-500/[0.05]" : "border-white/[0.07] bg-white/[0.02]",
      )}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</span>
          {highlight && (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-300">
              {tt("billing.bestValue")}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-end gap-1">
          <span className="text-2xl font-extrabold text-white">{price}</span>
          <span className="mb-0.5 text-xs text-slate-500">{per}</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{note}</p>
      </div>
      <button
        onClick={onCard}
        disabled={busy !== null}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/20 transition disabled:opacity-60"
      >
        <CreditCard className="w-4 h-4" />
        {busy === keys.card ? tt("billing.opening") : tt("billing.payByCard")}
      </button>
      <button
        onClick={onCrypto}
        disabled={busy !== null}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition disabled:opacity-60"
      >
        <Bitcoin className="w-4 h-4 text-amber-400" />
        {busy === keys.crypto ? tt("billing.opening") : tt("billing.payByCrypto")}
      </button>
    </div>
  );
}
