import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";

// Subscription state + billing actions for the signed-in user.
//
// The row itself is written only by the server (signup trigger, Stripe and
// crypto webhooks) — the client just reads it and calls the /api/billing
// endpoints, which redirect to Stripe Checkout / Billing Portal / Coinbase
// Commerce hosted pages.

export type Plan = "free" | "pro_monthly" | "pro_yearly";
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
  /** Whole days of trial left, 0 when none. */
  trialDaysLeft: number;
  /** Opens Stripe Checkout for the given plan (optionally with a promo code). */
  checkout: (plan: "pro_monthly" | "pro_yearly", promoCode?: string) => Promise<string | null>;
  /** Opens the Stripe Billing Portal (change card, upgrade/downgrade, cancel). */
  openPortal: () => Promise<string | null>;
  /** Opens a Coinbase Commerce hosted charge (USDT/USDC/BTC/ETH). */
  cryptoCheckout: (plan: "pro_monthly" | "pro_yearly") => Promise<string | null>;
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

export function useSubscription(): UseSubscription {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSub(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select(
        "plan, status, source, trial_ends_at, current_period_end, cancel_at_period_end, stripe_customer_id",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setSub({
        plan: data.plan as Plan,
        status: data.status as SubStatus,
        source: data.source as Subscription["source"],
        trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
        cancelAtPeriodEnd: !!data.cancel_at_period_end,
        hasStripeCustomer: !!data.stripe_customer_id,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const trialDaysLeft =
    sub?.status === "trialing" && sub.trialEndsAt
      ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / (24 * 3600 * 1000)))
      : 0;

  const isPro =
    !!sub &&
    (sub.status === "active" ||
      (sub.status === "trialing" && (sub.trialEndsAt?.getTime() ?? 0) > Date.now()));

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
    trialDaysLeft,
    checkout: (plan, promoCode) => redirect("/api/billing/checkout", { plan, promoCode }),
    openPortal: () => redirect("/api/billing/portal"),
    cryptoCheckout: (plan) => redirect("/api/crypto/checkout", { plan }),
    refresh,
  };
}
