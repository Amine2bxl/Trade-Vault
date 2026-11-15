import { useState } from "react";
import { CreditCard, ExternalLink, X } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { useSubscription, type Subscription } from "@/app/hooks/useSubscription";
import PricingPlans from "./PricingPlans";
import { Input } from "@/shared/ui";
import { checkoutErrorKey, etatAbonnement, offerMode } from "./subscriptionState";

/**
 * LE BLOC D'ACHAT de la page Abonnement — encaisser, et rien d'autre.
 *
 * L'état n'est plus recalculé ici : `subscriptionState.ts` décide, pour la
 * page ET pour ce bloc, s'il faut proposer les deux offres, seulement la
 * licence (mensuel en cours), ou rien (licence possédée). Le titre de la
 * section est porté par la page.
 *
 * Code promo : l'influenceur tape le sien pour l'accès permanent, sa
 * communauté colle le sien pour la réduction ; un lien d'e-mail
 * `/?upgrade=1&promo=VAULT20` arrive ici avec le code déjà posé.
 *
 * Erreurs : le serveur répond par des codes courts ; chacun a sa phrase
 * traduite (`checkoutErrorKey`), jamais le texte brut.
 *
 * `preview` (banc `/dev/ui` seulement) impose un abonnement fictif : aucun
 * paiement ne part de là.
 */
export default function SubscriptionSection({
  /** La carte d'adhésion porte déjà le bouton « Gérer » : ne pas le répéter. */
  showPortal = true,
  preview,
}: { showPortal?: boolean; preview?: Subscription | null } = {}) {
  const { t, lang } = useT();
  const live = useSubscription();
  const sub = preview !== undefined ? preview : live.sub;
  const loading = preview !== undefined ? false : live.loading;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
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

  if (loading) {
    return (
      <div className="subp-card">
        <div className="h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<string | null>) => {
    if (preview !== undefined) return;
    setBusy(key);
    setError(null);
    const err = await fn();
    if (err) {
      setError(t(checkoutErrorKey(err)));
      setBusy(null);
    }
    // En cas de succès le navigateur part chez Stripe : le bouton reste occupé.
  };

  const mode = offerMode(sub, etatAbonnement(sub));
  const showPlans = mode !== "none";
  const isStripeActive = sub?.status === "active" && sub.source === "stripe";
  const portal =
    showPortal && (isStripeActive || (!!sub?.hasStripeCustomer && sub.status !== "trialing"));
  const cryptoRenew =
    sub?.status === "active" && sub.source === "crypto" && sub.plan !== "lifetime";

  if (!showPlans && !portal && !cryptoRenew) return null;

  return (
    <div className="space-y-3.5">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {promo && showPlans && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          <span className="min-w-0 flex-1 truncate">
            {t("billing.promoApplied").replace("{code}", promo)}
          </span>
          <button
            onClick={() => setPromo(undefined)}
            aria-label={t("billing.promoRemove")}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-emerald-300/70 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showPlans && (
        <PricingPlans
          lang={lang === "fr" ? "fr" : "en"}
          currentPlan={sub?.plan ?? "free"}
          showFree={mode === "choose"}
          busy={busy}
          onChoose={(plan) => run(plan, () => live.checkout(plan, promo))}
          onCrypto={(plan) => run(`crypto-${plan}`, () => live.cryptoCheckout(plan))}
          onManage={isStripeActive ? () => run("portal", live.openPortal) : undefined}
        />
      )}

      {/* Le code promo SOUS la grille : on choisit une offre, puis on applique
          son code. Au-dessus, il passait avant les prix qu'il réduit. */}
      {showPlans && !promo && (
        <div className="flex gap-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCode()}
            placeholder={t("billing.promoPlaceholder")}
            aria-label={t("billing.promoLabel")}
            className="uppercase"
          />
          <button
            onClick={applyCode}
            disabled={!typed.trim()}
            className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            {t("billing.promoApply")}
          </button>
        </div>
      )}

      {portal && (
        <button
          onClick={() => run("portal", live.openPortal)}
          disabled={busy !== null}
          className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-60"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-slate-400" />
            {busy === "portal" ? t("billing.opening") : t("billing.manage")}
          </span>
          <ExternalLink className="h-4 w-4 text-slate-500" />
        </button>
      )}

      {/* Ancien accès crypto à durée limitée : il se prolonge désormais par
          la licence à vie, payée une fois en crypto aussi. */}
      {cryptoRenew && (
        <button
          onClick={() => run("crypto-lifetime", () => live.cryptoCheckout("lifetime"))}
          disabled={busy !== null}
          className="btn-ghost w-full justify-center disabled:opacity-60"
        >
          {t("billing.cryptoLifetime")}
        </button>
      )}
    </div>
  );
}
