import { json } from "../shared/response";
import { serviceClient, userFromRequest } from "./billing.server";
import { isPaidPlan, type PaidPlan } from "../domain/plans";

/**
 * Accès offert — les points d'entrée d'administration.
 *
 * Qui est administrateur est décidé par `ADMIN_EMAILS` (liste séparée par des
 * virgules, définie dans Vercel), jamais par une colonne que l'application
 * pourrait lire ou écrire : un drapeau `is_admin` en base, c'est une élévation
 * de privilège à un `update` de distance. Ici, la seule façon de devenir
 * administrateur est d'avoir la main sur les variables d'environnement.
 *
 * Toutes les écritures passent par le rôle de service : `comp_grants` est
 * invisible aux clients (RLS active, aucune politique).
 */

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.toLowerCase());
}
export { isAdminEmail };

/** L'appelant, s'il est administrateur. `null` sinon — jamais d'exception. */
async function adminFromRequest(request: Request) {
  const user = await userFromRequest(request);
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

// ── GET /api/admin/me ───────────────────────────────────────────────────────
// Dit à l'interface s'il faut afficher le panneau. Ce n'est PAS un contrôle
// d'accès : chaque écriture revérifie côté serveur.
export async function handleAdminMe(request: Request): Promise<Response> {
  const user = await userFromRequest(request);
  return json({ admin: !!user && isAdminEmail(user.email) });
}

// ── GET /api/admin/grants ───────────────────────────────────────────────────
export async function handleListGrants(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  const { data, error } = await sb
    .from("comp_grants")
    .select("email, plan, note, granted_by, expires_at, created_at")
    .order("created_at", { ascending: false });
  if (error) return json({ error: "list failed" }, 500);
  return json({ grants: data ?? [] });
}

// ── POST /api/admin/grants  { email, plan?, note?, expiresAt? } ─────────────
// Ajoute (ou met à jour) un accès offert, et l'applique immédiatement si la
// personne a déjà un compte. Sinon il s'appliquera à son inscription, via le
// déclencheur `handle_new_user_billing`.
export async function handleGrant(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let payload: { email?: string; plan?: string; note?: string; expiresAt?: string | null };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "invalid email" }, 400);
  const plan: PaidPlan = isPaidPlan(payload.plan) ? payload.plan : "elite_yearly";

  // La date de fin partait telle quelle dans une colonne `timestamptz` : une
  // chaîne invalide faisait échouer l'écriture, et l'échec était renvoyé comme
  // `applied: false` — indistinguable d'« aucun compte à cette adresse ».
  let expiresAt: string | null = null;
  if (payload.expiresAt) {
    const parsed = new Date(String(payload.expiresAt));
    if (Number.isNaN(parsed.getTime())) return json({ error: "invalid expiry" }, 400);
    expiresAt = parsed.toISOString();
  }

  const { error } = await sb.from("comp_grants").upsert(
    {
      email,
      plan,
      note: payload.note?.slice(0, 200) ?? null,
      granted_by: admin.email,
      expires_at: expiresAt,
    },
    { onConflict: "email" },
  );
  if (error) return json({ error: "grant failed" }, 500);

  const applied = await applyToExistingUser(sb, email, plan, expiresAt);
  return json({ ok: true, email, plan, applied });
}

// ── POST /api/admin/grants/revoke  { email } ────────────────────────────────
// Retire l'accès offert. La ligne d'abonnement repasse en gratuit — sauf si la
// personne a AUSSI un abonnement payant : on ne touche jamais à une ligne dont
// la source est Stripe ou crypto, sinon révoquer un cadeau couperait un
// abonnement réellement payé.
export async function handleRevokeGrant(request: Request): Promise<Response> {
  const admin = await adminFromRequest(request);
  if (!admin) return json({ error: "forbidden" }, 403);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  let payload: { email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const email = (payload.email ?? "").trim().toLowerCase();
  if (!email) return json({ error: "invalid email" }, 400);

  await sb.from("comp_grants").delete().eq("email", email);

  const userId = await findUserId(sb, email);
  if (userId) {
    await sb
      .from("subscriptions")
      .update({ plan: "free", status: "expired", current_period_end: null })
      .eq("user_id", userId)
      .eq("source", "comp");
  }
  return json({ ok: true, email });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * L'identifiant du compte portant cette adresse, s'il existe déjà.
 *
 * Recherche INDEXÉE via `find_user_id_by_email`. La version précédente
 * parcourait `auth.admin.listUsers()` par pages de deux cents, plafonnée à
 * vingt pages : passé 4 000 comptes elle renvoyait `null` en silence, et
 * accorder ou révoquer un accès cessait simplement de marcher — sans erreur,
 * sans journal, sans que personne le voie.
 *
 * Le balayage reste en REPLI pour le seul cas où la migration n'est pas encore
 * appliquée (déploiement du code avant le SQL). Il porte la même limite qu'avant
 * — mais elle est désormais journalisée au lieu d'être muette.
 */
export async function findUserId(sb: any, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  const { data, error } = await sb.rpc("find_user_id_by_email", { p_email: target });
  if (!error) return (data as string | null) ?? null;

  console.warn("[admin] find_user_id_by_email unavailable, falling back to scan", error);
  for (let page = 1; page <= 20; page++) {
    const { data: list, error: listError } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (listError || !list?.users?.length) return null;
    const hit = list.users.find((u: any) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id as string;
    if (list.users.length < 200) return null;
  }
  console.error("[admin] user lookup exhausted the 4000-account scan limit for", target);
  return null;
}

/** Applique l'accès offert à un compte existant. Renvoie `false` si personne
 *  ne porte encore cette adresse — le déclencheur d'inscription s'en chargera. */
async function applyToExistingUser(
  sb: any,
  email: string,
  plan: PaidPlan,
  expiresAt: string | null,
): Promise<boolean> {
  const userId = await findUserId(sb, email);
  if (!userId) return false;
  const { error } = await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status: "active",
      source: "comp",
      current_period_end: expiresAt,
      cancel_at_period_end: false,
    },
    { onConflict: "user_id" },
  );
  return !error;
}
