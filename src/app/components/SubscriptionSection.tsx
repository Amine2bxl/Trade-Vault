import { useState } from "react";
import {
  CreditCard,
  Sparkles,
  Bitcoin,
  ExternalLink,
  Clock,
  Check,
  CheckCircle2,
  AlertTriangle,
  Flame,
  X,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";
import { eur, MONTHLY_EUR, YEARLY_EUR, YEARLY_PER_MONTH, YEARLY_SAVING } from "../utils/pricing";
import { Button } from "@/shared/ui";

/** What Free gives, and where it stops. Same content as the landing. */
const FREE_KEYS: TKey[] = ["plan.free1", "plan.free2", "plan.free3", "plan.free4"];
const MISSING_KEYS: TKey[] = ["plan.miss1", "plan.miss2", "plan.miss3", "plan.miss4"];

/** The Premium promise, ordered by perceived value — the coach first. */
const PREMIUM_KEYS: [TKey, TKey][] = [
  ["plan.p1", "plan.p1sub"],
  ["plan.p2", "plan.p2sub"],
  ["plan.p3", "plan.p3sub"],
  ["plan.p4", "plan.p4sub"],
  ["plan.p5", "plan.p5sub"],
  ["plan.p6", "plan.p6sub"],
  ["plan.p7", "plan.p7sub"],
  ["plan.p8", "plan.p8sub"],
];

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
      <div className="glass-strong rounded-3xl p-5">
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
    <div className="glass-strong rounded-3xl p-5 space-y-4">
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

      {/* Plan cards — the landing's three-column offer, rendered in-app.
          A trader who was sold on the landing should recognise the exact same
          cards here: same hierarchy, same "2 mois offerts" badge, same raised
          annual column, same honest crossed-out anchor. Only the CTAs differ,
          because here they lead to checkout rather than to signup. */}
      {showPlans && (
        <div className="grid gap-3 lg:grid-cols-3 lg:items-stretch">
          {/* FREE — where the trader is today */}
          <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">
                {t("billing.freePlan")}
              </p>
              {sub.plan === "free" && sub.status !== "trialing" && (
                <span className="rounded-full border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                  {t("plan.current")}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-end gap-1">
              <span className="font-display text-3xl font-extrabold text-white">0 €</span>
              <span className="mb-1 text-xs text-slate-500">{t("plan.forever")}</span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-slate-500">{t("plan.freeTagline")}</p>

            <div className="mt-5 space-y-2 text-[13px]">
              {FREE_KEYS.map((k) => (
                <p key={k} className="flex items-start gap-2.5 text-slate-300">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/[0.06] text-slate-400">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  {t(k)}
                </p>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                {t("plan.notIncluded")}
              </p>
              <div className="mt-2 space-y-1.5 text-[12px]">
                {MISSING_KEYS.map((k) => (
                  <p key={k} className="flex items-start gap-2.5 text-slate-600">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/[0.03]">
                      <X className="h-2.5 w-2.5" />
                    </span>
                    {t(k)}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* PRO ANNUEL — the hero column, raised like on the landing */}
          <PlanCard
            highlight
            title={t("billing.planProYearly")}
            badge={t("plan.monthsFree")}
            price={eur(YEARLY_PER_MONTH)}
            per={t("billing.perMonth")}
            billed={t("plan.billedYearly").replace("{v}", eur(YEARLY_EUR))}
            anchor={eur(MONTHLY_EUR * 12)}
            saving={t("billing.yearlySave").replace("{v}", eur(YEARLY_SAVING))}
            current={sub.plan === "pro_yearly"}
            busy={busy}
            keys={{ card: "y-card", crypto: "y-crypto" }}
            onCard={() => run("y-card", () => checkout("pro_yearly", promo))}
            onCrypto={() => run("y-crypto", () => cryptoCheckout("pro_yearly"))}
          />

          {/* PRO MENSUEL — same product, looser commitment */}
          <PlanCard
            title={t("billing.planProMonthly")}
            price={eur(MONTHLY_EUR)}
            per={t("billing.perMonth")}
            billed={t("billing.monthlyEquiv").replace("{v}", eur(MONTHLY_EUR * 12))}
            note={t("billing.monthlyNote")}
            compact
            current={sub.plan === "pro_monthly"}
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

/**
 * A plan column, with the landing page's anatomy: label + badge, the price a
 * trader actually compares (the monthly figure), the honest annual bill under
 * it with the crossed-out anchor, the saving pill, then the feature list. The
 * highlighted column is raised on desktop exactly as on the landing.
 */
function PlanCard({
  title,
  badge,
  price,
  per,
  billed,
  anchor,
  note,
  saving,
  highlight = false,
  compact = false,
  current = false,
  busy,
  keys,
  onCard,
  onCrypto,
}: {
  title: string;
  /** Small emphasis pill on the hero column ("2 mois offerts"). */
  badge?: string;
  price: string;
  per: string;
  /** The honest second line: what is actually charged, and when. */
  billed?: string;
  /** Crossed-out full price, only where a discount is real. */
  anchor?: string;
  note?: string;
  saving?: string;
  highlight?: boolean;
  /** Renders the feature list as bare titles instead of title + reason. */
  compact?: boolean;
  current?: boolean;
  busy: string | null;
  keys: { card: string; crypto: string };
  onCard: () => void;
  onCrypto: () => void;
}) {
  const { t: tt } = useT();
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl p-5 transition-colors",
        highlight
          ? "border border-cyan-500/30 bg-[linear-gradient(160deg,rgba(14,58,82,.45),rgba(7,14,24,.85)_60%)] lg:-my-2 lg:py-7"
          : "border border-white/[0.07] bg-white/[0.015] hover:border-white/[0.12]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-[.15em]",
            highlight ? "text-cyan-300" : "text-slate-400",
          )}
        >
          {title}
        </p>
        {current ? (
          <span className="rounded-full border border-emerald-500/25 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-300">
            {tt("plan.current")}
          </span>
        ) : (
          badge && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-[#03131b]">
              <Flame className="h-3 w-3 fill-current" />
              {badge}
            </span>
          )
        )}
      </div>

      <div className="mt-3 flex items-end gap-1.5">
        <span className="font-display text-4xl font-extrabold tabular-nums text-white">
          {price}
        </span>
        <span className="mb-1.5 text-xs text-slate-400">{per}</span>
      </div>
      {billed && (
        <p className="mt-2 text-[13px] text-slate-300 tabular-nums">
          {billed}
          {anchor && <span className="ml-1.5 text-slate-500 line-through">{anchor}</span>}
        </p>
      )}
      {note && <p className="mt-1 text-[12px] text-slate-500">{note}</p>}
      {saving && (
        <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[12px] font-bold text-emerald-300">
          <Check className="h-3.5 w-3.5" /> {saving}
        </div>
      )}

      <div className="mt-5 space-y-2">
        <Button onClick={onCard} disabled={busy !== null} className="w-full disabled:opacity-60">
          <CreditCard className="w-4 h-4" />
          {busy === keys.card ? tt("billing.opening") : tt("billing.payByCard")}
        </Button>
        <button
          onClick={onCrypto}
          disabled={busy !== null}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition disabled:opacity-60"
        >
          <Bitcoin className="w-4 h-4 text-amber-400" />
          {busy === keys.crypto ? tt("billing.opening") : tt("billing.payByCrypto")}
        </button>
      </div>

      <p
        className={cn(
          "mt-5 text-[11px] font-bold uppercase tracking-[.12em]",
          highlight ? "text-cyan-300/80" : "text-slate-500",
        )}
      >
        {compact ? tt("plan.sameAsYearly") : tt("plan.premiumIntro")}
      </p>
      <div className={cn("mt-3", compact ? "space-y-1.5" : "space-y-2.5")}>
        {PREMIUM_KEYS.map(([k, why]) => (
          <div key={k} className="flex items-start gap-2.5 text-[13px]">
            <span
              className={cn(
                "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full",
                highlight ? "bg-cyan-400/15 text-cyan-300" : "bg-white/[0.06] text-slate-500",
              )}
            >
              <Check className="h-2.5 w-2.5" />
            </span>
            <span>
              <span className={cn("block", highlight ? "text-slate-100" : "text-slate-400")}>
                {tt(k)}
              </span>
              {!compact && (
                <span className="block text-[12px] leading-5 text-slate-500">{tt(why)}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
