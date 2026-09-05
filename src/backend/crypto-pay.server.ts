import { json } from "../shared/response";
import {
  applySubscriptionEvent,
  markWebhookProcessed,
  serviceClient,
  timingSafeEqualHex,
  userFromRequest,
} from "./billing.server";
import {
  PAID_TIERS,
  TIER_BY_ID,
  intervalOf,
  isPaidPlan,
  planId,
  planPrice,
  tierOf,
  type PaidPlan,
} from "../domain/plans";

// Crypto payments via Coinbase Commerce (self-custody / onchain checkout —
// funds settle to the merchant wallet, no intermediary). Accepts USDC, USDT,
// BTC, ETH across the networks Commerce enables, including low-fee ones
// (Polygon, Base). Crypto has no recurring billing, so a confirmed charge
// buys a fixed period: 1 month or 1 year from now (stacked on top of any
// remaining paid time).

const COMMERCE_API = "https://api.commerce.coinbase.com";

/**
 * Le tarif crypto d'un plan — dérivé du catalogue, jamais recopié.
 *
 * Les montants étaient écrits en dur ici : la moindre évolution de l'offre
 * laissait le paiement crypto encaisser l'ancien prix, en silence. Ils sont
 * maintenant calculés depuis `domain/plans`, comme partout ailleurs.
 */
function cryptoPricing(plan: PaidPlan): { amount: string; label: string; days: number } | null {
  if (!isPaidPlan(plan)) return null;
  const yearly = intervalOf(plan) === "yearly";
  const tier = TIER_BY_ID[tierOf(plan)];
  return {
    amount: planPrice(plan).toFixed(2),
    label: `TradeVault ${tier.name.en} — ${yearly ? "1 an" : "1 mois"}`,
    days: yearly ? 366 : 31,
  };
}

/** Tous les plans payants, pour les vérifications exhaustives. */
export const CRYPTO_PLANS: PaidPlan[] = PAID_TIERS.flatMap((t) => [
  planId(t, "monthly"),
  planId(t, "yearly"),
]);

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
  const pricing = cryptoPricing(plan);
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

/**
 * La FORME de la charge Coinbase Commerce que nous lisons.
 *
 * Même raison que côté Stripe : ces champs étaient traversés depuis un
 * `Record<string, unknown>`, donc chaque accès était une erreur de type que
 * personne ne voyait — sur le chemin qui décide d'ouvrir un accès payant.
 */
interface CommerceCharge {
  id?: string;
  metadata?: { user_id?: string; plan?: string };
}

interface CommerceEvent {
  id?: string;
  type?: string;
  data?: CommerceCharge;
}

export async function handleCryptoWebhook(request: Request): Promise<Response> {
  const payload = await request.text();
  const ok = await verifyCommerceSignature(payload, request.headers.get("x-cc-webhook-signature"));
  if (!ok) return json({ error: "bad signature" }, 400);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let event: CommerceEvent | undefined;
  try {
    event = (JSON.parse(payload) as { event?: CommerceEvent }).event;
  } catch {
    return json({ error: "invalid payload" }, 400);
  }
  if (event?.type !== "charge:confirmed") return json({ received: true });

  // Drop duplicate deliveries before extending the paid period.
  if (await markWebhookProcessed(sb, "coinbase", event?.id)) {
    return json({ received: true, deduped: true });
  }

  const charge: CommerceCharge = event.data ?? {};
  const userId = charge.metadata?.user_id;
  const plan = charge.metadata?.plan as PaidPlan;
  const pricing = cryptoPricing(plan);
  if (!userId || !pricing) return json({ received: true, skipped: "missing metadata" });

  // Extend from the later of (now, existing paid period end) so renewing
  // early never loses days.
  //
  // CETTE PROLONGATION N'EST PAS IDEMPOTENTE par nature : la rejouer ajoute un
  // mois de plus. La table `processed_webhook_events` couvre le cas normal,
  // mais elle échoue OUVERT sur incident d'infrastructure — et deux
  // prolongations pour une seule charge, c'est un abonnement offert.
  // `crypto_charge_id` est la clé d'idempotence naturelle : une charge déjà
  // portée par la ligne a déjà été créditée, quoi qu'en dise le dédoublonnage.
  const { data: sub } = await sb
    .from("subscriptions")
    .select("current_period_end, crypto_charge_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (charge.id && sub?.crypto_charge_id === charge.id) {
    return json({ received: true, deduped: "charge already credited" });
  }

  const base =
    sub?.current_period_end && new Date(sub.current_period_end) > new Date()
      ? new Date(sub.current_period_end)
      : new Date();
  const periodEnd = new Date(base.getTime() + pricing.days * 24 * 3600 * 1000);

  try {
    // Passe par `apply_subscription_event` : la ligne est CRÉÉE si elle manque
    // (un `update` sans ligne cible répondait 200 en perdant le paiement).
    await applySubscriptionEvent(sb, {
      userId,
      plan,
      status: "active",
      source: "crypto",
      cryptoChargeId: charge.id ?? null,
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      eventAt: new Date().toISOString(),
    });
  } catch (e) {
    // Le traitement critique a échoué : on RETIRE la marque d'idempotence pour
    // que la nouvelle tentative de Coinbase ne soit pas dédoublonnée comme
    // « déjà traitée », puis on répond 500 pour la déclencher.
    console.error("crypto activation failed", e);
    const eventId = event.id ?? null;
    if (eventId) {
      await sb
        .from("processed_webhook_events")
        .delete()
        .eq("provider", "coinbase")
        .eq("event_id", eventId);
    }
    return json({ error: "activation failed" }, 500);
  }
  return json({ received: true });
}
