import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Billing core — Stripe subscriptions over raw REST (no SDK: the Stripe npm
// package drags Node built-ins that break on edge runtimes, and fetch covers
// the four calls we make). All handlers here are wired as raw HTTP endpoints
// in src/server.ts.
//
// Plans: free / pro_monthly / pro_yearly. Trial is app-level (14 days from
// signup, see the billing migration); when a trialing user checks out we pass
// the remaining trial to Stripe as `trial_end` so nothing is charged early.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;

const STRIPE_API = "https://api.stripe.com/v1";

export type PaidPlan = "pro_monthly" | "pro_yearly";

function stripePriceId(plan: PaidPlan): string | undefined {
  return plan === "pro_monthly"
    ? process.env.STRIPE_PRICE_PRO_MONTHLY
    : process.env.STRIPE_PRICE_PRO_YEARLY;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function serviceClient(): AnyClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resolves the calling user from the Supabase access token in the
 *  Authorization header. Returns null on any failure — callers 401. */
export async function userFromRequest(
  request: Request,
): Promise<{ id: string; email: string } | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const sb = serviceClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(auth.slice(7));
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

/** Idempotency guard for signed webhooks. Records `(provider, event_id)` and
 *  reports whether this event was seen before. Providers retry deliveries, so
 *  without this a valid, re-delivered event would re-run its state change.
 *  Fails OPEN (returns "not seen") on any infra error or a missing id, so a
 *  transient DB issue never drops a real payment event. */
export async function markWebhookProcessed(
  sb: AnyClient,
  provider: string,
  eventId: string | null | undefined,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    const { error } = await sb
      .from("processed_webhook_events")
      .insert({ provider, event_id: eventId });
    if (!error) return false; // freshly inserted → new event
    if ((error as { code?: string }).code === "23505") return true; // unique_violation → duplicate
    console.error("[webhook] idempotency insert failed, processing anyway", error);
    return false;
  } catch (e) {
    console.error("[webhook] idempotency check threw, processing anyway", e);
    return false;
  }
}

async function stripe(
  path: string,
  params: Record<string, string>,
  method: "POST" | "GET" = "POST",
): Promise<any> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  const body = new URLSearchParams(params).toString();
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe ${path} failed (${res.status})`);
  return data;
}

function siteUrl(request: Request): string {
  return process.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

/** Finds (or creates) the Stripe customer for a user, persisting the id. */
async function ensureCustomer(sb: AnyClient, userId: string, email: string): Promise<string> {
  const { data: sub } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  const customer = await stripe("/customers", {
    email,
    "metadata[user_id]": userId,
  });
  await sb
    .from("subscriptions")
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return customer.id;
}

// ── POST /api/billing/checkout  { plan, promoCode? } ────────────────────────
// Returns { url } to a Stripe Checkout session. Cards + Apple Pay + Google Pay
// come from Stripe's automatic payment methods (enabled per default in the
// dashboard). A user still inside their signup trial gets the remainder as a
// Stripe trial — card saved, zero charged until the trial ends.
export async function handleCheckout(request: Request): Promise<Response> {
  const user = await userFromRequest(request);
  if (!user) return json({ error: "unauthorized" }, 401);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let payload: { plan?: string; promoCode?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const plan = payload.plan as PaidPlan;
  if (plan !== "pro_monthly" && plan !== "pro_yearly") return json({ error: "invalid plan" }, 400);
  const price = stripePriceId(plan);
  if (!price) return json({ error: "price not configured" }, 500);

  const customer = await ensureCustomer(sb, user.id, user.email);

  const { data: sub } = await sb
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const params: Record<string, string> = {
    mode: "subscription",
    customer,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${siteUrl(request)}/?billing=success`,
    cancel_url: `${siteUrl(request)}/?billing=canceled`,
    "subscription_data[metadata][user_id]": user.id,
    "subscription_data[metadata][plan]": plan,
  };

  // Remaining signup trial carries over: Stripe requires trial_end ≥ 48h out,
  // closer than that we just start the paid period immediately.
  if (sub?.status === "trialing" && sub.trial_ends_at) {
    const trialEnd = Math.floor(new Date(sub.trial_ends_at).getTime() / 1000);
    if (trialEnd > Math.floor(Date.now() / 1000) + 48 * 3600) {
      params["subscription_data[trial_end]"] = String(trialEnd);
    }
  }

  if (payload.promoCode) {
    // Promotion codes (e.g. VAULT20) are created in the Stripe dashboard;
    // resolve the human code to its id and pre-apply it.
    const found = await stripe(
      "/promotion_codes",
      { code: payload.promoCode, active: "true", limit: "1" },
      "GET",
    );
    const promoId = found?.data?.[0]?.id;
    if (promoId) params["discounts[0][promotion_code]"] = promoId;
    else params.allow_promotion_codes = "true";
  } else {
    params.allow_promotion_codes = "true";
  }

  try {
    const session = await stripe("/checkout/sessions", params);
    return json({ url: session.url });
  } catch (e) {
    console.error("checkout failed", e);
    return json({ error: "checkout failed" }, 500);
  }
}

// ── POST /api/billing/portal ─────────────────────────────────────────────────
// Stripe Billing Portal: upgrade/downgrade, change card, cancel — all managed
// by Stripe's hosted UI, one click from the profile page.
export async function handlePortal(request: Request): Promise<Response> {
  const user = await userFromRequest(request);
  if (!user) return json({ error: "unauthorized" }, 401);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  const { data: sub } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) return json({ error: "no stripe customer" }, 400);

  try {
    const session = await stripe("/billing_portal/sessions", {
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl(request)}/`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("portal failed", e);
    return json({ error: "portal failed" }, 500);
  }
}

// ── POST /api/stripe/webhook ─────────────────────────────────────────────────
// Signature-verified (HMAC-SHA256 over `t.payload`, per Stripe's scheme —
// webcrypto, no SDK). Subscription lifecycle events project onto our row.

/** Constant-time equality for two same-length hex digests. Avoids the early
 *  return of `===`, so a forged signature cannot be recovered byte-by-byte via
 *  response-timing. Length is compared first (both are fixed 64-char SHA-256
 *  hex, so this leaks nothing useful). Shared with the crypto webhook. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(payload: string, header: string | null): Promise<boolean> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=", 2) as [string, string]),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  // 5-minute tolerance against replay.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  return timingSafeEqualHex(expected, v1);
}

function planFromStripeSub(sub: any): PaidPlan {
  if (sub.metadata?.plan === "pro_yearly") return "pro_yearly";
  if (sub.metadata?.plan === "pro_monthly") return "pro_monthly";
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  return interval === "year" ? "pro_yearly" : "pro_monthly";
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const payload = await request.text();
  const ok = await verifyStripeSignature(payload, request.headers.get("stripe-signature"));
  if (!ok) return json({ error: "bad signature" }, 400);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  const event = JSON.parse(payload);
  const type: string = event.type;
  const obj = event.data.object;

  // Drop duplicate deliveries before touching subscription state.
  if (await markWebhookProcessed(sb, "stripe", event.id)) {
    return json({ received: true, deduped: true });
  }

  try {
    if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const userId: string | undefined = obj.metadata?.user_id;
      if (!userId) return json({ received: true, skipped: "no user_id metadata" });

      const status: string =
        type === "customer.subscription.deleted"
          ? "expired"
          : obj.status === "trialing"
            ? "trialing"
            : obj.status === "active"
              ? "active"
              : obj.status === "past_due" || obj.status === "unpaid"
                ? "past_due"
                : "canceled";

      const periodEnd = obj.items?.data?.[0]?.current_period_end ?? obj.current_period_end;
      await sb
        .from("subscriptions")
        .update({
          plan: type === "customer.subscription.deleted" ? "free" : planFromStripeSub(obj),
          status,
          source: "stripe",
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: !!obj.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  } catch (e) {
    console.error("stripe webhook failed", e);
    return json({ error: "handler failed" }, 500);
  }

  return json({ received: true });
}
