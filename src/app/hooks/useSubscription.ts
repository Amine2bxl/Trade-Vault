import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import {
  ACCOUNT_LIMIT,
  CAPABILITY_TIER,
  tierAtLeast,
  tierOf,
  type Capability,
  type PaidPlan,
  type Plan,
  type Tier,
} from "@/domain/plans";

// Subscription state + billing actions for the signed-in user.
//
// The row itself is written only by the server (signup trigger, Stripe and
// crypto webhooks) — the client just reads it and calls the /api/billing
// endpoints, which redirect to Stripe Checkout / Billing Portal / Coinbase
// Commerce hosted pages.

export type { Plan, PaidPlan, Tier } from "@/domain/plans";
export type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface Subscription {
  plan: Plan;
  status: SubStatus;
  source: "trial" | "stripe" | "crypto";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
}

export interface UseSubscription {
  sub: Subscription | null;
  loading: boolean;
  /** Pro access right now (paid, or trial still running). */
  isPro: boolean;
  /** Le palier réellement accessible : `free` dès que l'abonnement n'est plus
   *  actif, même si la ligne garde le nom du plan acheté. */
  tier: Tier;
  /** L'accès à une capacité gardée (le palier du dessus donne toujours accès). */
  can: (capability: Capability) => boolean;
  /** Le palier minimum qui ouvre cette capacité — pour le libellé du cadenas. */
  requiredTier: (capability: Capability) => Tier;
  /** Nombre de comptes de trading autorisés par le palier courant. */
  accountLimit: number;
  /** Whole days of trial left, 0 when none. */
  trialDaysLeft: number;
  /** Opens Stripe Checkout for the given plan (optionally with a promo code). */
  checkout: (plan: PaidPlan, promoCode?: string) => Promise<string | null>;
  /** Opens the Stripe Billing Portal (change card, upgrade/downgrade, cancel). */
  openPortal: () => Promise<string | null>;
  /** Opens a Coinbase Commerce hosted charge (USDT/USDC/BTC/ETH). */
  cryptoCheckout: (plan: PaidPlan) => Promise<string | null>;
  refresh: () => Promise<void>;
}

async function callBilling(
  path: string,
  body?: unknown,
): Promise<{ url?: string; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "not signed in" };
  const res = await fetch(path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({ error: "network error" }));
}

/**
 * Cache partagé de la ligne d'abonnement.
 *
 * Le hook est appelé par plusieurs composants montés en même temps (la garde
 * premium, les onglets de section, la page d'abonnement) : sans cache, chaque
 * changement de page déclenchait autant de requêtes identiques. La promesse en
 * vol est partagée, donc N appels simultanés = une seule requête.
 */
let cachedFor: string | null = null;
let cachedRow: Subscription | null = null;
let inFlight: Promise<Subscription | null> | null = null;

/** Vide le cache — après un checkout, une reprise, ou un changement d'utilisateur. */
export function invalidateSubscription(): void {
  cachedFor = null;
  cachedRow = null;
  inFlight = null;
}

export function useSubscription(): UseSubscription {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (userId: string): Promise<Subscription | null> => {
    const { data } = await supabase
      .from("subscriptions")
      .select(
        "plan, status, source, trial_ends_at, current_period_end, cancel_at_period_end, stripe_customer_id",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    return {
      plan: data.plan as Plan,
      status: data.status as SubStatus,
      source: data.source as Subscription["source"],
      trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
      currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
      cancelAtPeriodEnd: !!data.cancel_at_period_end,
      hasStripeCustomer: !!data.stripe_customer_id,
    };
  }, []);

  // Montage : on sert le cache s'il est chaud, sinon une seule requête partagée.
  const hydrate = useCallback(async () => {
    if (!user) {
      invalidateSubscription();
      setSub(null);
      setLoading(false);
      return;
    }
    if (cachedFor === user.id && cachedRow) {
      setSub(cachedRow);
      setLoading(false);
      return;
    }
    inFlight = inFlight ?? load(user.id);
    const row = await inFlight;
    inFlight = null;
    cachedFor = user.id;
    cachedRow = row;
    if (row) setSub(row);
    setLoading(false);
  }, [user, load]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // `refresh` est l'ordre explicite de RELIRE (retour de checkout, reprise
  // d'abonnement) : il doit traverser le cache, sinon il ne rafraîchit rien.
  const refresh = useCallback(async () => {
    invalidateSubscription();
    await hydrate();
  }, [hydrate]);

  const trialDaysLeft =
    sub?.status === "trialing" && sub.trialEndsAt
      ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / (24 * 3600 * 1000)))
      : 0;

  const isPro =
    !!sub &&
    (sub.status === "active" ||
      (sub.status === "trialing" && (sub.trialEndsAt?.getTime() ?? 0) > Date.now()));

  // Un abonnement expiré ou impayé garde le nom de son plan en base (utile pour
  // proposer la reprise) mais ne donne plus rien : le palier effectif retombe
  // donc à `free` dès que l'accès n'est plus valide.
  const tier: Tier = isPro ? tierOf(sub?.plan) : "free";

  const redirect = async (path: string, body?: unknown): Promise<string | null> => {
    const { url, error } = await callBilling(path, body);
    if (url) {
      window.location.href = url;
      return null;
    }
    return error ?? "unexpected error";
  };

  return {
    sub,
    loading,
    isPro,
    tier,
    can: (capability: Capability) => tierAtLeast(tier, CAPABILITY_TIER[capability]),
    requiredTier: (capability: Capability) => CAPABILITY_TIER[capability],
    accountLimit: ACCOUNT_LIMIT[tier],
    trialDaysLeft,
    checkout: (plan, promoCode) => redirect("/api/billing/checkout", { plan, promoCode }),
    openPortal: () => redirect("/api/billing/portal"),
    cryptoCheckout: (plan) => redirect("/api/crypto/checkout", { plan }),
    refresh,
  };
}
