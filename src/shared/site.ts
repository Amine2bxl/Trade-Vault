/**
 * Canonical site identity — the ONE place a domain lives.
 *
 * Why this file exists: every auth redirect (Google OAuth, e-mail confirmation,
 * password reset) has to hand an absolute URL to Supabase, and that URL must
 * match an entry in the project's Redirect URLs allow-list. Deriving it from
 * `window.location.origin` looks convenient but silently breaks the moment the
 * app is opened on any origin other than the canonical one — and a Vercel
 * project answers on several (the production alias, the project default domain,
 * and one domain per preview branch).
 *
 * Production evidence (Supabase auth logs, 24 h to 2026-07-28): every single
 * "OAuth state not found or expired" came from the project default domain
 * `tradevault-…-projects.vercel.app`, while every successful Google login came
 * from `tradevaultt.vercel.app`. Same code, different origin — the PKCE
 * verifier is stored per-origin, so a flow started on one domain can never be
 * completed on another.
 *
 * MIGRATION TO A CUSTOM DOMAIN: set `VITE_SITE_URL` in Vercel (or edit the
 * fallback below) and redeploy. Nothing else in the app hardcodes a domain.
 * The matching console changes are listed in BACKEND.md §12.
 *
 * The canonical domain is now `tradevault.be`. It must match, character for
 * character, the Homepage / Privacy / Terms URLs and the Authorized Domain
 * declared on the Google OAuth consent screen — Google's brand verification
 * compares them and rejects the app on any mismatch.
 */

/** Canonical origin, no trailing slash. Build-time value (Vite inlines it). */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://tradevault.be").replace(
  /\/+$/,
  "",
);

/** Bare hostname — Trustpilot review paths and any display copy. */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "");

/** Supabase project ref — also the host of the Google OAuth callback. */
export const SUPABASE_PROJECT_REF = "tjikygsipblatubyzbrt";

/**
 * The redirect URI Google must have in its authorized list. Google returns to
 * Supabase, not to the app, so this value is INDEPENDENT of the site domain —
 * it does not change when a custom domain is connected.
 */
export const GOOGLE_CALLBACK_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/callback`;

/**
 * Absolute URL to send the user back to after an auth round-trip.
 *
 * Always the canonical origin: the flow must end where it started, and the
 * allow-list has to contain a finite set of URLs. A preview deployment
 * therefore lands on production after signing in — deliberate, and strictly
 * better than the current behaviour, where previews fail outright.
 */
export function authRedirectTo(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
