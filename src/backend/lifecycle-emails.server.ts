import { serviceClient, userFromRequest } from "./billing.server";
import { needsExpiry } from "../domain/entitlement";
import {
  welcomeEmail,
  trialEndingEmail,
  winbackEmail,
  type OnboardingProfile,
} from "./email-templates.server";

// Lifecycle email engine.
//
// Two entry points:
//   POST /api/emails/welcome        — fired by the client right after
//                                     onboarding completes (J+0, instant).
//   GET  /api/cron/lifecycle-emails — daily Vercel cron: J+12 trial-ending,
//                                     J+17 winback, plus the trial-expiry
//                                     sweep (trialing → free/expired).
//
// email_log's (user_id, email_key) primary key is the dedupe: an insert that
// conflicts means "already sent", so reruns and overlapping crons are safe.

import { json } from "../shared/response";

function siteUrl(request: Request): string {
  return process.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "TradeVault <onboarding@resend.dev>";
  if (!key) {
    console.error("RESEND_API_KEY missing — email skipped:", subject);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) console.error("resend failed", res.status, await res.text());
  return res.ok;
}

function toProfile(row: any): OnboardingProfile {
  return {
    // Le prénom de l'onboarding (jarvis_first_name) prime sur le nom du compte.
    name: row.jarvis_first_name || row.name || "trader",
    goal: row.onboarding_goal,
    style: row.onboarding_style,
    experience: row.onboarding_experience,
    usesIct: row.onboarding_uses_ict,
    assets: row.onboarding_assets ?? [],
    pain: row.onboarding_pain,
  };
}

const PROFILE_COLS =
  "id, name, email, jarvis_first_name, onboarding_goal, onboarding_style, onboarding_experience, onboarding_uses_ict, onboarding_assets, onboarding_pain";

/** Insert-first dedupe: returns true when this call won the right to send. */
async function claimEmail(sb: any, userId: string, key: string): Promise<boolean> {
  const { error } = await sb.from("email_log").insert({ user_id: userId, email_key: key });
  return !error; // conflict (already sent) or failure — don't send
}

// ── J+0: welcome, fired from the client after onboarding ────────────────────
export async function handleWelcomeEmail(request: Request): Promise<Response> {
  const user = await userFromRequest(request);
  if (!user) return json({ error: "unauthorized" }, 401);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  if (!(await claimEmail(sb, user.id, "welcome")))
    return json({ sent: false, reason: "already sent" });

  const { data: prof } = await sb
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", user.id)
    .maybeSingle();
  const { subject, html } = welcomeEmail(toProfile(prof ?? { name: "" }), siteUrl(request));
  const sent = await sendEmail(user.email, subject, html);
  if (!sent) await sb.from("email_log").delete().eq("user_id", user.id).eq("email_key", "welcome");
  return json({ sent });
}

// ── Daily cron: J+12, J+17, trial expiry ─────────────────────────────────────
export async function handleLifecycleCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  const sb = serviceClient();
  if (!sb) return json({ error: "server misconfigured" }, 500);

  const site = siteUrl(request);
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  let trialEndingSent = 0;
  let winbackSent = 0;

  // Sweep 1 : les essais dépassés retombent en gratuit.
  await sb
    .from("subscriptions")
    .update({ plan: "free", status: "expired", updated_at: now.toISOString() })
    .eq("status", "trialing")
    .eq("source", "trial")
    .lt("trial_ends_at", now.toISOString());

  // Sweep 2 : LES PÉRIODES PAYÉES ÉCOULÉES — le balayage qui manquait.
  //
  // Une charge crypto achète une période fixe (il n'existe aucune facturation
  // récurrente en crypto) et un accès offert porte la date de fin décidée par
  // l'administrateur. Les deux étaient écrits `status = 'active'` et RIEN, nulle
  // part, ne les faisait jamais expirer : quinze euros payés une fois en USDT
  // ouvraient l'accès à vie, et `comp_grants.expires_at` était décoratif.
  //
  // `domain/entitlement` ferme déjà l'accès en LECTURE dès la date passée ; ce
  // balayage aligne la BASE sur cette décision, pour que les relances, les
  // statistiques et le support ne lisent pas un `active` qui ment.
  //
  // Stripe est volontairement EXCLU : c'est lui qui pilote son cycle de vie et
  // son webhook écrit `past_due` puis `canceled`. Réécrire ici créerait une
  // seconde autorité sur la même donnée. Voir `needsExpiry`.
  const { data: lapsedPaid } = await sb
    .from("subscriptions")
    .select("user_id, plan, status, source, trial_ends_at, current_period_end")
    .eq("status", "active")
    .in("source", ["crypto", "comp", "promo"])
    .not("current_period_end", "is", null)
    .lt("current_period_end", now.toISOString());

  let expiredPaid = 0;
  for (const row of lapsedPaid ?? []) {
    // Le prédicat partagé décide, pas la requête : le filtre SQL ci-dessus est
    // une PRÉ-SÉLECTION (il évite de lire toute la table), `needsExpiry` est la
    // règle. Les deux ne peuvent donc pas diverger.
    if (!needsExpiry(row)) continue;
    const { error } = await sb
      .from("subscriptions")
      .update({ plan: "free", status: "expired", updated_at: now.toISOString() })
      .eq("user_id", row.user_id)
      // Garde de concurrence : si un paiement a rouvert l'accès entre la
      // lecture et l'écriture, la ligne n'est plus `active` sur cette période
      // et on ne doit surtout pas la refermer.
      .eq("status", "active")
      .eq("current_period_end", row.current_period_end);
    if (!error) expiredPaid++;
  }
  if (expiredPaid > 0) console.log("[lifecycle] expired paid periods", expiredPaid);

  // J+12 — trial ends within 48h, still trialing, not yet warned.
  const { data: ending } = await sb
    .from("subscriptions")
    .select("user_id, trial_ends_at")
    .eq("status", "trialing")
    .eq("source", "trial")
    .gt("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", in48h.toISOString());

  for (const row of ending ?? []) {
    if (!(await claimEmail(sb, row.user_id, "trial_ending"))) continue;
    const { data: prof } = await sb
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", row.user_id)
      .maybeSingle();
    if (!prof?.email) continue;
    const { subject, html } = trialEndingEmail(toProfile(prof), site);
    if (await sendEmail(prof.email, subject, html)) trialEndingSent++;
  }

  // J+17 — trial expired 3+ days ago, never paid, not yet relanced. The
  // 10-day lower bound keeps ancient accounts from getting a winback the
  // day this feature ships.
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
  const { data: lapsed } = await sb
    .from("subscriptions")
    .select("user_id")
    .eq("status", "expired")
    .eq("source", "trial")
    .lte("trial_ends_at", threeDaysAgo.toISOString())
    .gte("trial_ends_at", tenDaysAgo.toISOString());

  for (const row of lapsed ?? []) {
    if (!(await claimEmail(sb, row.user_id, "winback"))) continue;
    const { data: prof } = await sb
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", row.user_id)
      .maybeSingle();
    if (!prof?.email) continue;
    const { subject, html } = winbackEmail(toProfile(prof), site);
    if (await sendEmail(prof.email, subject, html)) winbackSent++;
  }

  return json({ ok: true, trialEndingSent, winbackSent, expiredPaid });
}
