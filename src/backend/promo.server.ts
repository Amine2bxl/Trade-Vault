import { json } from "../shared/response";
import { serviceClient, stripe, userFromRequest } from "./billing.server";
import { findUserId, isAdminEmail } from "./admin.server";
import { decidePromoCode, normalizePromoCode, type PromoCodeRow } from "../domain/promo";
import { isPaidPlan, type PaidPlan } from "../domain/plans";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = any;

// Codes promo gérés par l'application.
//
// Côté CLIENT (checkout), un code ne fait que déclencher la résolution
// « serveur » de `resolveAppPromo` : le titulaire (influenceur) obtient
// l'accès permanent écrit en base (`source = 'promo'`), sa communauté obtient
// une réduction encaissée via un coupon Stripe. Côté ADMIN, les quatre
// points d'entrée tiennent le catalogue des codes — réservés à `ADMIN_EMAILS`,
// chacun revérifié côté serveur.
//
// Tout se passe avec le rôle de service : `promo_codes` et `promo_redemptions`
// ont RLS active et AUCUNE politique, donc elles sont invisibles aux clients.

export type AppPromoResolution =
  | { status: "granted"; plan: PaidPlan; kind: "owner" | "free" }
  | { status: "discount"; percent: number }
  | { status: "invalid" }
  | { status: "owner_mismatch" }
  | { status: "not_app" };

function mapPromoRow(row: any): PromoCodeRow {
  return {
    code: row.code,
    plan: row.plan as PaidPlan,
    ownerEmail: row.owner_email ?? null,
    discountPercent: row.discount_percent ?? null,
    active: !!row.active,
    expiresAt: row.expires_at ?? null,
    maxUses: row.max_uses ?? null,
    usesCount: row.uses_count ?? 0,
    note: row.note ?? null,
    grantedBy: row.granted_by ?? null,
    createdAt: row.created_at,
  };
}

/** Lit et décide, sans écrire. `not_app` = code inconnu : le checkout retombe
 *  alors sur les promotion codes du dashboard Stripe. */
export async function resolveAppPromo(
  sb: AnyClient,
  code: string,
  user: { id: string; email: string },
): Promise<AppPromoResolution> {
  const { data, error } = await sb
    .from("promo_codes")
    .select("*")
    .eq("code", normalizePromoCode(code))
    .maybeSingle();
  if (error || !data) return { status: "not_app" };
  const decision = decidePromoCode(mapPromoRow(data), user.email);
  if (decision.status === "owner") return { status: "granted", plan: decision.plan, kind: "owner" };
  if (decision.status === "free") return { status: "granted", plan: decision.plan, kind: "free" };
  if (decision.status === "discount") return { status: "discount", percent: decision.percent };
  if (decision.status === "owner_mismatch") return { status: "owner_mismatch" };
  return { status: "invalid" };
}

/** Ouvre l'accès permanent (`source='promo'`, jamais de date de fin). Ne
 *  touche PAS à un abonnement payant actif : un gestionnaire qui rembourse et
 *  garde en même temps — on ne fait pas tomber une ligne Stripe en comp. */
export async function grantPromoAccess(
  sb: AnyClient,
  userId: string,
  plan: PaidPlan,
): Promise<{ ok: boolean; error?: string }> {
  const { data: current } = await sb
    .from("subscriptions")
    .select("source, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (current && (current.source === "stripe" || current.source === "crypto")) {
    if (current.status === "active" || current.status === "trialing") {
      return { ok: true };
    }
  }
  const { error } = await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status: "active",
      source: "promo",
      current_period_end: null,
      cancel_at_period_end: false,
    },
    { onConflict: "user_id" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Trace l'utilisation et remonte `uses_count` d'un cran, une seule fois par
 *  personne et par code (contrainte d'unicité `(code, user_id)`). */
export async function recordPromoRedemption(
  sb: AnyClient,
  code: string,
  user: { id: string; email: string },
  plan: PaidPlan,
  kind: "owner" | "free" | "discount",
): Promise<void> {
  const { data: inserted, error } = await sb
    .from("promo_redemptions")
    .insert({ code, user_id: user.id, email: user.email, plan, kind })
    .select()
    .onConflict("code,user_id")
    .ignore();
  if (error || !inserted?.length) return;
  const { data: row } = await sb
    .from("promo_codes")
    .select("uses_count")
    .eq("code", code)
    .maybeSingle();
  await sb
    .from("promo_codes")
    .update({ uses_count: (row?.uses_count ?? 0) + 1 })
    .eq("code", code);
}

/** Le coupon Stripe de la réduction communauté, créé une fois avec un id
 *  déterministe (`coupon_<code>`), réutilisé ensuite — idempotent. Le coupon
 *  est récurrent (`duration=forever`) : la réduction s'applique à chaque
 *  facture, comme un partenariat influenceur classique. */
export async function ensureDiscountStripeCoupon(code: string, percent: number): Promise<string> {
  const couponId = `coupon_${normalizePromoCode(code)?.toLowerCase() ?? "code"}`;
  try {
    await stripe("/coupons", {
      id: couponId,
      percent_off: String(percent),
      duration: "forever",
      name: normalizePromoCode(code) ?? code,
      "metadata[promo_code]": normalizePromoCode(code) ?? code,
    });
  } catch (e) {
    const message = (e as Error).message ?? "";
    if (!/already exists|exists/i.test(message)) throw e;
  }
  return couponId;
}

// ── ADMIN : gestion des codes ─────────────────────────────────────────────────
// Chaque appel revérifie côté serveur qu'ADMIN_EMAILS autorise cette adresse.
// Le panneau n'affiche rien pour les autres, mais il ne protège rien.

async function adminFromRequest(request: Request) {
  const user = await userFromRequest(request);
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

// ── GET /api/admin/promos ────────────────────────────────────────────────────
export async function handleListPromos(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  const { data, error } = await sb
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return json({ error: "list failed" }, 500);
  return json({ promos: data ?? [] });
}

// ── POST /api/admin/promos  { code, plan?, ownerEmail?, discountPercent?,
//                              expiresAt?, maxUses?, note? } ───────────────────
export async function handleCreatePromo(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const code = normalizePromoCode(String(payload.code ?? ""));
  if (!code) return json({ error: "invalid code" }, 400);
  const plan: PaidPlan = isPaidPlan(payload.plan) ? payload.plan : "pro_yearly";

  let discountPercent: number | null = null;
  if (payload.discountPercent != null && payload.discountPercent !== "") {
    discountPercent = Number(payload.discountPercent);
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      return json({ error: "invalid discount" }, 400);
    }
  }
  let maxUses: number | null = null;
  if (payload.maxUses != null && payload.maxUses !== "") {
    maxUses = Number(payload.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) return json({ error: "invalid max uses" }, 400);
  }
  const ownerEmail =
    String(payload.ownerEmail ?? "")
      .trim()
      .toLowerCase() || null;
  if (ownerEmail && !ownerEmail.includes("@")) return json({ error: "invalid email" }, 400);
  let expiresAt: string | null = null;
  if (payload.expiresAt) {
    const parsed = new Date(String(payload.expiresAt));
    if (Number.isNaN(parsed.getTime())) return json({ error: "invalid expiry" }, 400);
    expiresAt = parsed.toISOString();
  }

  const { error } = await sb.from("promo_codes").insert({
    code,
    plan,
    owner_email: ownerEmail,
    discount_percent: discountPercent,
    expires_at: expiresAt,
    max_uses: maxUses,
    note: String(payload.note ?? "").slice(0, 200) || null,
    granted_by: admin.email,
  });
  if (error) return json({ error: "invalid promo" }, 500);
  return json({ ok: true, code, plan, ownerEmail, discountPercent });
}

// ── POST /api/admin/promos/set-active  { code, active } ──────────────────────
// Désactiver arrête d'émettre le code ; les accès déjà ouverts restent (on ne
// coupe jamais brutalement un accès offert — on le retire individuellement par
// la révocation ci-dessous).
export async function handleSetPromoActive(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let payload: { code?: string; active?: boolean };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const code = normalizePromoCode(payload.code);
  if (!code) return json({ error: "invalid code" }, 400);

  const { error } = await sb
    .from("promo_codes")
    .update({ active: !!payload.active })
    .eq("code", code);
  if (error) return json({ error: "update failed" }, 500);
  return json({ ok: true, code, active: !!payload.active });
}

// ── POST /api/admin/promos/delete  { code } ──────────────────────────────────
export async function handleDeletePromo(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let payload: { code?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const code = normalizePromoCode(payload.code);
  if (!code) return json({ error: "invalid code" }, 400);

  const { error } = await sb.from("promo_codes").delete().eq("code", code);
  if (error) return json({ error: "delete failed" }, 500);
  return json({ ok: true, code });
}

// ── GET /api/admin/promos/redemptions ────────────────────────────────────────
export async function handleListPromoRedemptions(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  const { data, error } = await sb
    .from("promo_redemptions")
    .select("code, user_id, email, plan, kind, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return json({ error: "list failed" }, 500);
  return json({ redemptions: data ?? [] });
}

// ── POST /api/admin/promos/revoke  { code, email } ───────────────────────────
// Retire l'accès ouvert par le code à cette personne : la ligne d'abonnement
// repasse en gratuit, mais SEULEMENT si elle est encore `source='promo'` — un
// accès réellement payé (Stripe/crypto) n'est jamais touché.
export async function handleRevokePromoRedemption(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let payload: { code?: string; email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const code = normalizePromoCode(payload.code);
  const email = (payload.email ?? "").trim().toLowerCase();
  if (!code || !email) return json({ error: "bad request" }, 400);

  const userId = await findUserId(sb, email);
  if (userId) {
    await sb
      .from("subscriptions")
      .update({ plan: "free", status: "expired", current_period_end: null })
      .eq("user_id", userId)
      .eq("source", "promo");
  }
  await sb
    .from("promo_redemptions")
    .delete()
    .eq("code", code)
    .eq("user_id", userId ?? "");
  return json({ ok: true });
}
