import { serviceClient, userFromRequest } from "./billing.server";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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
    name: row.name || "trader",
    goal: row.onboarding_goal,
    style: row.onboarding_style,
    experience: row.onboarding_experience,
    usesIct: row.onboarding_uses_ict,
    assets: row.onboarding_assets ?? [],
    pain: row.onboarding_pain,
  };
}

const PROFILE_COLS =
  "id, name, email, onboarding_goal, onboarding_style, onboarding_experience, onboarding_uses_ict, onboarding_assets, onboarding_pain";

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

  // Sweep: trials past their end date fall back to free.
  await sb
    .from("subscriptions")
    .update({ plan: "free", status: "expired", updated_at: now.toISOString() })
    .eq("status", "trialing")
    .eq("source", "trial")
    .lt("trial_ends_at", now.toISOString());

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

  return json({ ok: true, trialEndingSent, winbackSent });
}
