import {
  markWebhookProcessed,
  serviceClient,
  timingSafeEqualHex,
  userFromRequest,
  type PaidPlan,
} from "./billing.server";

// Crypto payments via Coinbase Commerce (self-custody / onchain checkout —
// funds settle to the merchant wallet, no intermediary). Accepts USDC, USDT,
// BTC, ETH across the networks Commerce enables, including low-fee ones
// (Polygon, Base). Crypto has no recurring billing, so a confirmed charge
// buys a fixed period: 1 month or 1 year from now (stacked on top of any
// remaining paid time).

const COMMERCE_API = "https://api.commerce.coinbase.com";

// Mirrors the landing pricing: 24,99 €/mois · 239 €/an.
const PLAN_PRICING: Record<PaidPlan, { amount: string; label: string; days: number }> = {
  pro_monthly: { amount: "24.99", label: "TradeVault Pro — 1 mois", days: 31 },
  pro_yearly: { amount: "239.00", label: "TradeVault Pro — 1 an", days: 366 },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ── POST /api/crypto/checkout  { plan } ──────────────────────────────────────
// Creates a Commerce charge and returns { url } to its hosted payment page.
export async function handleCryptoCheckout(request: Request): Promise<Response> {
  const user = await userFromRequest(request);
  if (!user) return json({ error: "unauthorized" }, 401);
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) return json({ error: "crypto payments not configured" }, 500);

  let payload: { plan?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const plan = payload.plan as PaidPlan;
  const pricing = PLAN_PRICING[plan];
  if (!pricing) return json({ error: "invalid plan" }, 400);

  const res = await fetch(`${COMMERCE_API}/charges`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-CC-Api-Key": apiKey,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name: pricing.label,
      description: "Journal de trading TradeVault — accès Pro complet.",
      pricing_type: "fixed_price",
      local_price: { amount: pricing.amount, currency: "EUR" },
      metadata: { user_id: user.id, plan },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("commerce charge failed", data);
    return json({ error: "charge creation failed" }, 500);
  }
  return json({ url: data.data.hosted_url });
}

// ── POST /api/crypto/webhook ─────────────────────────────────────────────────
// X-CC-Webhook-Signature = HMAC-SHA256 hex of the raw body with the shared
// secret from the Commerce dashboard. charge:confirmed activates the plan.
async function verifyCommerceSignature(payload: string, header: string | null): Promise<boolean> {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqualHex(expected, header);
}

export async function handleCryptoWebhook(request: Request): Promise<Response> {
  const payload = await request.text();
  const ok = await verifyCommerceSignature(payload, request.headers.get("x-cc-webhook-signature"));
  if (!ok) return json({ error: "bad signature" }, 400);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  const event = JSON.parse(payload).event;
  if (event?.type !== "charge:confirmed") return json({ received: true });

  // Drop duplicate deliveries before extending the paid period.
  if (await markWebhookProcessed(sb, "coinbase", event?.id)) {
    return json({ received: true, deduped: true });
  }

  const charge = event.data;
  const userId: string | undefined = charge?.metadata?.user_id;
  const plan = charge?.metadata?.plan as PaidPlan;
  const pricing = PLAN_PRICING[plan];
  if (!userId || !pricing) return json({ received: true, skipped: "missing metadata" });

  // Extend from the later of (now, existing paid period end) so renewing
  // early never loses days.
  const { data: sub } = await sb
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  const base =
    sub?.current_period_end && new Date(sub.current_period_end) > new Date()
      ? new Date(sub.current_period_end)
      : new Date();
  const periodEnd = new Date(base.getTime() + pricing.days * 24 * 3600 * 1000);

  const { error } = await sb
    .from("subscriptions")
    .update({
      plan,
      status: "active",
      source: "crypto",
      crypto_charge_id: charge.id,
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) {
    console.error("crypto activation failed", error);
    return json({ error: "activation failed" }, 500);
  }
  return json({ received: true });
}
