import { useState } from "react";
import { CreditCard, ExternalLink, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useSubscription } from "../hooks/useSubscription";
import PricingPlans from "./pricing/PricingPlans";
import { Input } from "@/shared/ui";

// "Gestion d'abonnement" card on the profile page.
//
// Free / trialing users see both Pro plans with card (Stripe Checkout —
// cards, Apple Pay, Google Pay) and crypto (Coinbase Commerce) buttons.
// Stripe subscribers get one button into the Billing Portal, where upgrade,
// downgrade, card change and cancellation are each one click. Crypto
// subscribers see their access end date and renewal buttons.

export default function SubscriptionSection() {
  const { t, lang } = useT();
  const { sub, loading, isPro, checkout, openPortal, cryptoCheckout } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  // Deep link from lifecycle emails: /?upgrade=1&promo=VAULT20 lands on the
  // subscription section with the code already applied. La saisie manuelle
  // permet ensuite à l'influenceur de taper le sien, et à sa communauté de
  // coller son code.
  const [promo, setPromo] = useState<string | undefined>(() =>
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("promo") ?? undefined)
      : undefined,
  );

  const applyCode = () => {
    const clean = typed.trim().toUpperCase();
    if (clean) {
      setPromo(clean);
      setTyped("");
    }
  };

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

  /* NI PASTILLE DE STATUT NI RÉSUMÉ DE FORMULE ICI.
     Ce bloc en portait un de chacun, alors que la page d'abonnement affiche
     déjà l'état complet juste au-dessus — et le portait avec sa PROPRE logique
     (`sub.status === "active" ? …`), qui ne connaissait ni l'expiration ni la
     reprise. Deux vérités sur le même écran, dont une fausse : un abonnement
     annulé s'y lisait en vert. L'état est calculé une seule fois, dans
     `pages/Subscription.tsx` ; ce bloc ne fait plus que ce que son nom dit —
     encaisser. */
  const showPlans = !isPro || sub.status === "trialing";
  const isStripeActive = sub.status === "active" && sub.source === "stripe";

  return (
    <div className="glass rounded-3xl p-4 space-y-3.5 md:p-5">
      <h2 className="tv-title">{t("billing.title")}</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {promo && showPlans && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-sm text-emerald-300 font-semibold">
          <span className="min-w-0 flex-1 truncate">
            {t("billing.promoApplied").replace("{code}", promo)}
          </span>
          <button
            onClick={() => setPromo(undefined)}
            aria-label={lang === "fr" ? "Retirer le code" : "Remove code"}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-emerald-300/70 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Code promo — l'influenceur tape le sien pour activer l'accès
          permanent, sa communauté colle le sien pour la réduction. */}
      {showPlans && !promo && (
        <div className="flex gap-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCode()}
            placeholder={lang === "fr" ? "Code promo (facultatif)" : "Promo code (optional)"}
            aria-label={lang === "fr" ? "Code promo" : "Promo code"}
            className="uppercase"
          />
          <button
            onClick={applyCode}
            disabled={!typed.trim()}
            className="shrink-0 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            {lang === "fr" ? "Appliquer" : "Apply"}
          </button>
        </div>
      )}

      {/* La grille tarifaire partagée avec la landing : le trader retrouve
          exactement l'offre qui l'a convaincu, aux mêmes prix, parce que c'est
          littéralement le même composant et le même catalogue. */}
      {showPlans && (
        <PricingPlans
          lang={lang === "fr" ? "fr" : "en"}
          currentPlan={sub.plan}
          busy={busy}
          onChoose={(plan) => run(plan, () => checkout(plan, promo))}
          onCrypto={(plan) => run(`crypto-${plan}`, () => cryptoCheckout(plan))}
        />
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
      {isStripeActive && <p className="tv-row-label leading-relaxed">{t("billing.portalHint")}</p>}

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
