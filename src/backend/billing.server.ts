import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Billing core — Stripe subscriptions over raw REST (no SDK: the Stripe npm
// package drags Node built-ins that break on edge runtimes, and fetch covers
// the four calls we make). All handlers here are wired as raw HTTP endpoints
// in src/server.ts.
//
// Plans en vente : `elite_monthly` (abonnement mensuel) et `lifetime`
// (paiement unique) — le catalogue est dans `src/domain/plans.ts`, partagé
// avec l'app. Les anciens plans pro_* / elite_yearly restent reconnus.
//
// PAS D'ESSAI GRATUIT. Une inscription démarre sur l'offre gratuite, qui est
// utilisable indéfiniment ; le paiement ouvre l'accès payant immédiatement.
// Le statut `trialing` reste géré côté webhook au cas où un essai serait
// configuré dans le dashboard Stripe, mais l'application n'en accorde aucun.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;

const STRIPE_API = "https://api.stripe.com/v1";

export type { PaidPlan } from "../domain/plans";
import {
  LIFETIME_PLAN,
  MONTHLY_PLAN,
  isPaidPlan,
  planPrice,
  salePlanFor,
  tierOf,
  type PaidPlan,
} from "../domain/plans";
import { normalizePromoCode } from "../domain/promo";

/**
 * LE PRIX STRIPE D'UN PLAN — retrouvé par le MONTANT du catalogue.
 *
 * ── LE DÉFAUT QUE ÇA FERME ──────────────────────────────────────────────────
 *
 * Le prix affiché vient de `domain/plans` ; le prix facturé venait d'une
 * variable Vercel (`STRIPE_PRICE_LIFETIME`…) qui désignait un prix Stripe
 * IMMUABLE. Changer un tarif demandait donc deux éditions synchronisées — le
 * catalogue dans le code, la variable dans Vercel — et toute fenêtre entre
 * les deux affichait un montant et en facturait un autre.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Chaque prix Stripe porte une `lookup_key` qui ENCODE son montant :
 * `tradevault_<plan>_eur_<centimes>` (`stripeLookupKey`). Le serveur cherche
 * la clé dérivée du catalogue ; s'il ne la trouve pas, il ne vend pas au
 * mauvais prix. Changer un tarif = créer le prix Stripe avec sa clé, puis
 * modifier le catalogue : l'ordre n'a plus d'importance, l'écart devient
 * impossible.
 *
 * Repli : la variable `STRIPE_PRICE_<PLAN>`, mais SEULEMENT si le prix qu'elle
 * désigne a exactement le montant du catalogue. Une variable restée sur
 * l'ancien tarif répond « price not configured » plutôt que de facturer
 * autre chose que ce que la page annonce.
 *
 * Le résultat est gardé en mémoire de l'instance : un prix Stripe ne change
 * pas de montant, la clé ne change de prix que par un transfert explicite.
 */
export function stripeLookupKey(plan: PaidPlan): string {
  return `tradevault_${plan}_eur_${Math.round(planPrice(plan) * 100)}`;
}

const prixConnus = new Map<string, string>();

async function stripePriceId(plan: PaidPlan): Promise<string | undefined> {
  const key = stripeLookupKey(plan);
  const connu = prixConnus.get(key);
  if (connu) return connu;

  const attendu = Math.round(planPrice(plan) * 100);
  let id: string | undefined;
  try {
    const found = await stripe(
      "/prices",
      { "lookup_keys[]": key, active: "true", limit: "1" },
      "GET",
    );
    const price = found?.data?.[0];
    if (price?.id && price.unit_amount === attendu) id = price.id;
  } catch (e) {
    console.error("price lookup failed", e);
  }

  if (!id) {
    const fromEnv = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`];
    if (fromEnv) {
      try {
        const price = await stripe(`/prices/${fromEnv}`, {}, "GET");
        if (price?.unit_amount === attendu) id = fromEnv;
        else console.error(`STRIPE_PRICE_${plan.toUpperCase()} ne vaut pas ${attendu} centimes`);
      } catch (e) {
        console.error("price check failed", e);
      }
    }
  }
  if (id) prixConnus.set(key, id);
  return id;
}

import { json } from "../shared/response";

export function serviceClient(): AnyClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Les variables Supabase serveur manquantes — pour nommer l'erreur au lieu
 *  de renvoyer un « misconfigured » muet. Le client de l'app utilise
 *  `VITE_SUPABASE_URL` (compilée dans le bundle) ; les server functions, elles,
 *  lisent `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` à l'exécution. */
export function missingServerSupabaseConfig(): string[] {
  return [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean) as string[];
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

export async function stripe(
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

export function siteUrl(request: Request): string {
  return process.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

/** Finds (or creates) the Stripe customer for a user, persisting the id.
 *  §4 STRIPE_INTEGRATION : l'écriture est un UPSERT — une `update` matchant
 *  zéro ligne ne renvoyait pas d'erreur et laissait le client Stripe orphelin,
 *  puis le checkout suivant créait un DEUXIÈME customer pour le même humain. */
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
    .upsert(
      { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  return customer.id;
}

/**
 * Ce que l'utilisateur possède déjà et qui rend l'achat demandé inutile.
 *
 * Lu en base (la projection des webhooks), pas chez Stripe : c'est la même
 * vérité que celle qui ouvre les pages payantes. Une ligne expirée ou en
 * défaut de paiement ne bloque rien — elle doit pouvoir repayer.
 */
async function alreadyHolds(
  sb: AnyClient,
  userId: string,
  salePlan: PaidPlan,
): Promise<"already lifetime" | "already subscribed" | null> {
  const { data } = await sb
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  if (data.plan === LIFETIME_PLAN) return "already lifetime";
  const live = !data.current_period_end || new Date(data.current_period_end).getTime() > Date.now();
  if (salePlan === MONTHLY_PLAN && data.plan === MONTHLY_PLAN && live) {
    return "already subscribed";
  }
  return null;
}

// ── POST /api/billing/checkout  { plan, promoCode? } ────────────────────────
// Returns { url } to a Stripe Checkout session. Cards + Apple Pay + Google Pay
// come from Stripe's automatic payment methods (enabled per default in the
// dashboard). Le paiement démarre immédiatement : il n'y a pas d'essai.
//
// Un code promo passe d'abord par le catalogue applicatif (`promo_codes`) :
// le titulaire (influenceur) obtient l'accès permanent sans carte ni Stripe,
// sa communauté obtient une réduction via un coupon Stripe réel. Sans code ou
// code inconnu ici, on retombe sur les promotion codes du dashboard Stripe.
export async function handleCheckout(request: Request): Promise<Response> {
  // Ordre volontaire : vérifier LA CONFIG d'abord, la session ensuite. Sinon,
  // un `SUPABASE_SERVICE_ROLE_KEY` absent se cacherait derrière un
  // « unauthorized » trompeur sur des endpoints qui n'existent pas encore.
  const sb = serviceClient();
  if (!sb) {
    const missing = missingServerSupabaseConfig();
    return json(
      { error: `server misconfigured${missing.length ? `: ${missing.join(", ")}` : ""}` },
      500,
    );
  }
  const user = await userFromRequest(request);
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: { plan?: string; promoCode?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const plan = payload.plan;
  if (!isPaidPlan(plan)) return json({ error: "invalid plan" }, 400);
  // DEUX OFFRES À LA VENTE : le mensuel et la licence. Un client resté sur
  // une ancienne grille (onglet ouvert, cache) qui demande un plan retiré est
  // conduit vers l'offre la plus proche, jamais vers un tarif disparu.
  const salePlan: PaidPlan = salePlanFor(plan);

  // On ne vend pas deux fois la même chose. Une licence active rend tout
  // achat inutile ; un mensuel actif rend un second mensuel absurde (Stripe
  // ouvrirait un DEUXIÈME abonnement, facturé en parallèle). Passer du
  // mensuel à la licence reste permis : le webhook coupe alors le
  // renouvellement du mensuel.
  const blocked = await alreadyHolds(sb, user.id, salePlan);
  if (blocked) return json({ error: blocked }, 409);

  const appCode = normalizePromoCode(payload.promoCode);
  if (appCode) {
    const {
      resolveAppPromo,
      grantPromoAccess,
      reservePromoRedemption,
      releasePromoRedemption,
      redemptionGrantsAccess,
      ensureDiscountStripeCoupon,
    } = await import("./promo.server");

    const app = await resolveAppPromo(sb, appCode, user);
    if (app.status === "invalid" || app.status === "owner_mismatch") {
      return json({ error: "invalid promo code" }, 400);
    }

    if (app.status === "granted") {
      // Parcours influenceur : accès permanent, sans paiement.
      //
      // ORDRE VOLONTAIRE — on RÉSERVE l'usage AVANT d'ouvrir l'accès. Réserver
      // après (l'ordre précédent) laissait `max_uses` inopérant : l'accès était
      // déjà donné quand on découvrait que le code était épuisé, et il n'y
      // avait plus rien à refuser. `resolveAppPromo` a déjà lu le compteur,
      // mais sa lecture n'est pas verrouillée ; la réservation, elle, l'est.
      const outcome = await reservePromoRedemption(sb, appCode, user, app.plan, app.kind);
      if (outcome === "error") return json({ error: "promo unavailable" }, 503);
      if (!redemptionGrantsAccess(outcome)) return json({ error: "invalid promo code" }, 400);

      const granted = await grantPromoAccess(sb, user.id, app.plan);
      if (!granted.ok) {
        // L'accès n'a pas pu être écrit : rendre l'usage, sinon la personne
        // perd sa place sans rien avoir obtenu.
        await releasePromoRedemption(sb, appCode, user.id);
        return json({ error: "grant failed" }, 500);
      }
      return json({
        url: `${siteUrl(request)}/?billing=success&promo=${encodeURIComponent(appCode)}`,
      });
    }

    if (app.status === "discount") {
      // Réduction communauté : on encaisse réellement, à prix réduit.
      const price = await stripePriceId(salePlan);
      if (!price) return json({ error: "price not configured" }, 500);

      const outcome = await reservePromoRedemption(sb, appCode, user, salePlan, "discount");
      if (outcome === "error") return json({ error: "promo unavailable" }, 503);
      if (!redemptionGrantsAccess(outcome)) return json({ error: "invalid promo code" }, 400);

      try {
        const couponId = await ensureDiscountStripeCoupon(appCode, app.percent);
        const customer = await ensureCustomer(sb, user.id, user.email);
        const url = await openCheckoutSession(request, {
          userId: user.id,
          plan: salePlan,
          price,
          customer,
          couponId,
        });
        return json({ url });
      } catch (e) {
        // Stripe n'a pas ouvert la session : l'usage réservé n'a servi à rien,
        // on le rend au pot avant de répondre.
        console.error("discount checkout failed", e);
        await releasePromoRedemption(sb, appCode, user.id);
        return json({ error: "checkout failed" }, 500);
      }
    }
    // `app.status === "not_app"` : code inconnu de l'app — on laisse Stripe
    // dashboard tenter le sien plus bas.
  }

  const price = await stripePriceId(salePlan);
  if (!price) return json({ error: "price not configured" }, 500);

  const customer = await ensureCustomer(sb, user.id, user.email);

  // Promotion codes (e.g. VAULT20) créés dans le dashboard Stripe : on résout
  // le code humain vers son identifiant pour le pré-appliquer. Un code
  // introuvable n'est pas une erreur — on laisse simplement le champ ouvert
  // dans le checkout.
  let promotionCodeId: string | undefined;
  if (payload.promoCode) {
    try {
      const found = await stripe(
        "/promotion_codes",
        { code: payload.promoCode, active: "true", limit: "1" },
        "GET",
      );
      promotionCodeId = found?.data?.[0]?.id;
    } catch (e) {
      // La résolution d'un code est un CONFORT : si elle échoue, le checkout
      // doit quand même s'ouvrir. Avant, l'exception remontait jusqu'au
      // gestionnaire global et rendait une page d'erreur 500.
      console.error("promotion code lookup failed", e);
    }
  }

  try {
    const url = await openCheckoutSession(request, {
      userId: user.id,
      plan: salePlan,
      price,
      customer,
      promotionCodeId,
    });
    return json({ url });
  } catch (e) {
    console.error("checkout failed", e);
    return json({ error: "checkout failed" }, 500);
  }
}

/**
 * Ouvre une session de checkout Stripe et rend son URL.
 *
 * SEUL constructeur de session du fichier. Il y en avait deux — celui-ci et
 * une copie inline dans `handleCheckout` — et ils avaient déjà divergé : la
 * copie posait `subscription_data[metadata]`, l'autre non systématiquement.
 * Ces métadonnées sont ce que le webhook lit pour savoir À QUI attribuer
 * l'abonnement ; les oublier sur un chemin, c'est perdre un paiement.
 *
 * Lève en cas d'échec — c'est l'appelant qui décide quoi défaire (rendre un
 * usage promo réservé, par exemple) avant de répondre.
 */
async function openCheckoutSession(
  request: Request,
  opts: {
    userId: string;
    plan: PaidPlan;
    price: string;
    customer: string;
    couponId?: string;
    promotionCodeId?: string;
  },
): Promise<string> {
  const lifetime = opts.plan === LIFETIME_PLAN;
  const params: Record<string, string> = {
    // La licence à vie est un PAIEMENT UNIQUE, pas un abonnement.
    mode: lifetime ? "payment" : "subscription",
    customer: opts.customer,
    "line_items[0][price]": opts.price,
    "line_items[0][quantity]": "1",
    success_url: `${siteUrl(request)}/?billing=success`,
    // Annulation → racine propre, jamais de `?billing=canceled` dans l'URL.
    cancel_url: `${siteUrl(request)}/`,
  };
  // Les DEUX métadonnées, toujours : le webhook n'a rien d'autre pour
  // rattacher le paiement à un compte et à une offre.
  if (lifetime) {
    params["metadata[user_id]"] = opts.userId;
    params["metadata[plan]"] = opts.plan;
    params["payment_intent_data[metadata][user_id]"] = opts.userId;
    params["payment_intent_data[metadata][plan]"] = opts.plan;
    // Une facture pour un achat unique (reçu exploitable en comptabilité).
    params["invoice_creation[enabled]"] = "true";
  } else {
    params["subscription_data[metadata][user_id]"] = opts.userId;
    params["subscription_data[metadata][plan]"] = opts.plan;
    // La marque qui distingue un abonnement VENDU AUJOURD'HUI d'un abonnement
    // d'avant la licence : seuls ces derniers sont convertis en licence à vie
    // par le webhook (voir `isLegacySubscription`).
    params["subscription_data[metadata][offer]"] = SUBSCRIPTION_OFFER;
  }

  // Un coupon applicatif et un promotion code du dashboard sont exclusifs :
  // Stripe refuse les deux ensemble. Le coupon applicatif prime, parce qu'il
  // vient d'un code que nous avons nous-mêmes validé et déjà réservé.
  if (opts.couponId) params["discounts[0][coupon]"] = opts.couponId;
  else if (opts.promotionCodeId) params["discounts[0][promotion_code]"] = opts.promotionCodeId;
  else params.allow_promotion_codes = "true";

  const session = await stripe("/checkout/sessions", params);
  if (!session?.url) throw new Error("Stripe returned a checkout session without a url");
  return session.url;
}

// ── POST /api/billing/portal ─────────────────────────────────────────────────
// Stripe Billing Portal: upgrade/downgrade, change card, cancel — all managed
// by Stripe's hosted UI, one click from the profile page.
export async function handlePortal(request: Request): Promise<Response> {
  const sb = serviceClient();
  if (!sb) {
    const missing = missingServerSupabaseConfig();
    return json(
      { error: `server misconfigured${missing.length ? `: ${missing.join(", ")}` : ""}` },
      500,
    );
  }
  const user = await userFromRequest(request);
  if (!user) return json({ error: "unauthorized" }, 401);

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

/**
 * Le plan d'un abonnement Stripe.
 *
 * Les métadonnées sont la source fiable : c'est nous qui les écrivons au
 * checkout. En secours — un abonnement créé depuis le dashboard, ou une
 * ancienne ligne — on retombe sur le palier déduit de l'identifiant de prix,
 * puis sur la période de facturation. Sans cela, un abonné Elite serait
 * silencieusement projeté en Pro par le webhook.
 */
/**
 * La FORME de l'objet Stripe que nous lisons — pas le modèle complet.
 *
 * Ces champs étaient traversés depuis un `Record<string, unknown>` :
 * TypeScript signalait chaque accès (`Property 'metadata' does not exist`) et
 * les erreurs étaient tolérées parce que la CI ne lance pas `tsc`. Or c'est
 * précisément ici qu'une faute de frappe sur `metadata.user_id` perd un
 * paiement en silence. On déclare donc ce qu'on lit, et rien de plus.
 */
export interface StripeSubscriptionObject {
  id?: string;
  customer?: string;
  status?: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: { user_id?: string; plan?: string; offer?: string };
  items?: {
    data?: {
      price?: { id?: string; lookup_key?: string | null; recurring?: { interval?: string } };
      current_period_end?: number;
    }[];
  };
}

/** Session Checkout et charge — les champs lus par le webhook. */
interface StripeCheckoutObject {
  mode?: string;
  payment_status?: string;
  customer?: string;
  payment_intent?: string;
  refunded?: boolean;
  metadata?: { user_id?: string; plan?: string };
}

interface StripeEvent {
  id?: string;
  type?: string;
  created?: number;
  data?: { object?: StripeSubscriptionObject & StripeCheckoutObject };
}

/**
 * CONVERTIT UN ANCIEN ABONNÉ EN LICENCE À VIE.
 *
 * Décision produit : personne ne repaie, personne ne perd l'accès. La ligne
 * passe en `lifetime` (sans échéance) et le renouvellement Stripe est coupé
 * (`cancel_at_period_end`) : la période déjà payée court jusqu'au bout, puis
 * l'abonnement s'éteint — son dernier événement ne peut plus rétrograder la
 * licence (garde SQL de `apply_subscription_event`).
 */
async function convertToLifetime(
  sb: AnyClient,
  input: {
    userId: string;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    alreadyCancelling: boolean;
    eventAt: string;
  },
): Promise<void> {
  if (input.stripeSubscriptionId && !input.alreadyCancelling) {
    await stripe(`/subscriptions/${input.stripeSubscriptionId}`, {
      cancel_at_period_end: "true",
    });
  }
  await applySubscriptionEvent(sb, {
    userId: input.userId,
    plan: LIFETIME_PLAN,
    status: "active",
    source: "stripe",
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeCustomerId: input.stripeCustomerId,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: true,
    eventAt: input.eventAt,
  });
}

/**
 * Convertit en une fois tous les ANCIENS abonnés Stripe actifs (action
 * admin). Les conversions suivantes se font d'elles-mêmes au prochain
 * événement Stripe.
 *
 * Depuis la relance du mensuel, une ligne `elite_monthly` active peut être un
 * abonné d'aujourd'hui : chaque abonnement est donc relu chez Stripe et
 * seuls les anciens (`isLegacySubscription`) sont convertis.
 */
export async function convertAllSubscribersToLifetime(sb: AnyClient): Promise<number> {
  const { data, error } = await sb
    .from("subscriptions")
    .select(
      "user_id, plan, status, stripe_subscription_id, stripe_customer_id, cancel_at_period_end",
    )
    .eq("source", "stripe")
    .in("status", ["active", "trialing"])
    .neq("plan", LIFETIME_PLAN);
  if (error) throw new Error(`list subscribers failed: ${error.message}`);
  let converted = 0;
  for (const row of (data ?? []) as {
    user_id: string;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    cancel_at_period_end: boolean | null;
  }[]) {
    if (row.stripe_subscription_id) {
      const live = (await stripe(
        `/subscriptions/${row.stripe_subscription_id}`,
        {},
        "GET",
      )) as StripeSubscriptionObject;
      if (!isLegacySubscription(live)) continue;
    }
    await convertToLifetime(sb, {
      userId: row.user_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      alreadyCancelling: !!row.cancel_at_period_end,
      eventAt: new Date().toISOString(),
    });
    converted++;
  }
  return converted;
}

/** La valeur de `metadata.offer` posée sur tout abonnement vendu depuis la
 *  relance du mensuel (novembre 2026). */
export const SUBSCRIPTION_OFFER = "monthly-2026-11";

/**
 * Un abonnement d'AVANT la licence à vie ?
 *
 * Ceux-là ont reçu une promesse : convertis en licence, sans repayer. Les
 * abonnements mensuels vendus depuis la relance, eux, sont de vrais
 * abonnements et ne doivent JAMAIS devenir une licence — ce serait offrir
 * 49 € à qui en a payé 9.
 *
 * Deux preuves de modernité, l'une suffit : la marque `offer` que notre
 * checkout pose, ou la clé de catalogue du prix (`tradevault_…`, portée aussi
 * par un abonnement créé à la main depuis le dashboard). Sans aucune, c'est un
 * ancien abonnement.
 *
 * La variable `STRIPE_PRICE_ELITE_MONTHLY` n'est PAS une preuve : en
 * production elle désigne encore l'ancien Elite mensuel, et s'y fier aurait
 * soustrait ses abonnés à la conversion promise.
 */
export function isLegacySubscription(sub: StripeSubscriptionObject): boolean {
  if (sub.metadata?.offer) return false;
  if (sub.items?.data?.[0]?.price?.lookup_key?.startsWith("tradevault_")) return false;
  return true;
}

function planFromStripeSub(sub: StripeSubscriptionObject): PaidPlan {
  const fromMeta = sub.metadata?.plan;
  if (isPaidPlan(fromMeta)) return fromMeta;

  const priceId = sub.items?.data?.[0]?.price?.id;
  const interval =
    sub.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
  if (priceId) {
    for (const [key, value] of Object.entries(process.env)) {
      if (value === priceId && key.startsWith("STRIPE_PRICE_")) {
        const candidate = key.slice("STRIPE_PRICE_".length).toLowerCase();
        if (isPaidPlan(candidate)) return candidate;
      }
    }
  }
  return `${tierOf(fromMeta) === "free" ? "pro" : tierOf(fromMeta)}_${interval}` as PaidPlan;
}

/**
 * Projette un état d'abonnement en base, via `apply_subscription_event`.
 *
 * Passe par la fonction SQL plutôt que par un `update` : elle CRÉE la ligne si
 * elle manque (abonnement né dans le dashboard Stripe, compte recréé — le
 * `update` précédent ne touchait alors aucune ligne, ne renvoyait aucune
 * erreur, et le paiement était perdu en silence) et elle ignore une livraison
 * arrivée hors ordre au lieu de faire régresser l'état.
 *
 * Lève si l'écriture échoue vraiment : l'appelant doit alors répondre 500 pour
 * que le fournisseur réessaie.
 */
export async function applySubscriptionEvent(
  sb: AnyClient,
  input: {
    userId: string;
    plan: string;
    status: string;
    source: "stripe" | "crypto";
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    cryptoChargeId?: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    eventAt: string;
  },
): Promise<"applied" | "stale"> {
  const { data, error } = await sb.rpc("apply_subscription_event", {
    p_user_id: input.userId,
    p_plan: input.plan,
    p_status: input.status,
    p_source: input.source,
    p_stripe_subscription_id: input.stripeSubscriptionId ?? null,
    p_stripe_customer_id: input.stripeCustomerId ?? null,
    p_crypto_charge_id: input.cryptoChargeId ?? null,
    p_current_period_end: input.currentPeriodEnd,
    p_cancel_at_period_end: input.cancelAtPeriodEnd,
    p_event_at: input.eventAt,
  });
  if (error) throw new Error(`apply_subscription_event failed: ${error.message}`);
  return data === "stale" ? "stale" : "applied";
}

/** L'horodatage d'un événement fournisseur (secondes epoch) en ISO. Sans date
 *  exploitable on retombe sur « maintenant » : mieux vaut appliquer l'état que
 *  refuser un paiement pour un champ absent. */
function eventTimestamp(seconds: unknown): string {
  const n = typeof seconds === "number" ? seconds : Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const payload = await request.text();
  const ok = await verifyStripeSignature(payload, request.headers.get("stripe-signature"));
  if (!ok) return json({ error: "bad signature" }, 400);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return json({ error: "invalid payload" }, 400);
  }
  const type: string = event.type ?? "";
  const obj: StripeSubscriptionObject & StripeCheckoutObject = event.data?.object ?? {};

  // Drop duplicate deliveries before touching subscription state.
  if (await markWebhookProcessed(sb, "stripe", event.id)) {
    return json({ received: true, deduped: true });
  }

  try {
    // ── LA LICENCE À VIE : paiement unique confirmé ──
    if (
      (type === "checkout.session.completed" ||
        type === "checkout.session.async_payment_succeeded") &&
      obj.mode === "payment"
    ) {
      const userId = obj.metadata?.user_id;
      if (!userId || obj.metadata?.plan !== LIFETIME_PLAN) {
        return json({ received: true, skipped: "not a lifetime purchase" });
      }
      if (obj.payment_status !== "paid") {
        return json({ received: true, skipped: "payment not settled yet" });
      }
      // Un ancien abonnement encore actif chez ce client : on coupe son
      // renouvellement — il ne doit pas payer deux fois.
      const { data: prev } = await sb
        .from("subscriptions")
        .select("stripe_subscription_id, plan, cancel_at_period_end")
        .eq("user_id", userId)
        .maybeSingle();
      if (
        prev?.stripe_subscription_id &&
        prev.plan !== LIFETIME_PLAN &&
        !prev.cancel_at_period_end
      ) {
        await stripe(`/subscriptions/${prev.stripe_subscription_id}`, {
          cancel_at_period_end: "true",
        });
      }
      await applySubscriptionEvent(sb, {
        userId,
        plan: LIFETIME_PLAN,
        status: "active",
        source: "stripe",
        stripeSubscriptionId: null,
        stripeCustomerId: obj.customer ?? null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        eventAt: eventTimestamp(event.created),
      });
      return json({ received: true });
    }

    // ── Remboursement d'une licence : l'accès est retiré ──
    if (type === "charge.refunded" && obj.refunded && obj.customer && obj.payment_intent) {
      // Seul le remboursement du PAIEMENT DE LA LICENCE retire l'accès — pas
      // celui d'une ancienne mensualité d'un abonné converti.
      const intent = await stripe(`/payment_intents/${obj.payment_intent}`, {}, "GET");
      if (intent?.metadata?.plan !== LIFETIME_PLAN) {
        return json({ received: true, skipped: "not a lifetime charge" });
      }
      // Fonction SQL dédiée : c'est le SEUL chemin qui peut retirer une
      // licence (la garde de `apply_subscription_event` l'interdit ailleurs).
      const { error } = await sb.rpc("revoke_lifetime_license", {
        p_stripe_customer_id: obj.customer,
      });
      if (error) throw new Error(`lifetime refund failed: ${error.message}`);
      return json({ received: true });
    }

    if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const userId = obj.metadata?.user_id;
      if (!userId) return json({ received: true, skipped: "no user_id metadata" });

      // Un abonnement d'AVANT la licence, encore actif : converti en licence
      // à vie. Un mensuel vendu depuis la relance suit son cycle normal.
      if (
        type !== "customer.subscription.deleted" &&
        (obj.status === "active" || obj.status === "trialing") &&
        isLegacySubscription(obj)
      ) {
        await convertToLifetime(sb, {
          userId,
          stripeSubscriptionId: obj.id ?? null,
          stripeCustomerId: obj.customer ?? null,
          alreadyCancelling: !!obj.cancel_at_period_end,
          eventAt: eventTimestamp(event.created),
        });
        return json({ received: true, converted: "lifetime" });
      }

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
      const result = await applySubscriptionEvent(sb, {
        userId,
        plan: type === "customer.subscription.deleted" ? "free" : planFromStripeSub(obj),
        status,
        source: "stripe",
        stripeSubscriptionId: obj.id ?? null,
        stripeCustomerId: obj.customer ?? null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancelAtPeriodEnd: !!obj.cancel_at_period_end,
        eventAt: eventTimestamp(event.created),
      });
      if (result === "stale") {
        return json({ received: true, skipped: "out-of-order event" });
      }
    }
  } catch (e) {
    // §3 STRIPE_INTEGRATION : on RETIRE la marque d'idempotence avant de
    // renvoyer 500. Sinon, la retransmission de Stripe était dédupliquée
    // comme « déjà traitée » et l'événement — un abonnement payé — était
    // perdu pour toujours, sans erreur remontée à personne.
    console.error("stripe webhook failed", e);
    const eventId = event.id ?? null;
    if (eventId) {
      await sb
        .from("processed_webhook_events")
        .delete()
        .eq("provider", "stripe")
        .eq("event_id", eventId);
    }
    return json({ error: "handler failed" }, 500);
  }

  return json({ received: true });
}
