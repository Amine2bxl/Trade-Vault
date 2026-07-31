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
 * Why a single fixed origin matters (Supabase auth logs, 24 h to 2026-07-28):
 * every "OAuth state not found or expired" came from a non-canonical origin
 * (the project default `tradevault-…-projects.vercel.app`), while successful
 * logins came from the canonical one. The PKCE verifier is stored per-origin,
 * so a flow started on one origin can never be completed on another — hence a
 * single canonical origin (now `tradevault.be`) for every auth redirect.
 *
 * CHANGING THE DOMAIN: set `VITE_SITE_URL` in Vercel and redeploy. Nothing else
 * in the app hardcodes a domain. The matching console changes are in BACKEND.md §12.
 *
 * CURRENT CANONICAL DOMAIN: `tradevault.be` — connected on Vercel and serving
 * the app (HTTP 200). The old project domain `tradevaultt.vercel.app` now issues
 * a 307 redirect to `tradevault.be`, so every canonical, `og:url`, sitemap entry
 * and auth redirect resolves to the custom domain. Production already runs with
 * `VITE_SITE_URL=https://tradevault.be`; the fallback below matches it so the
 * source of truth cannot drift back to the old host if the env var is ever lost.
 *
 * Whatever value is active must match, character for character, the Homepage /
 * Privacy / Terms URLs and the Authorized Domain on the Google OAuth consent
 * screen — brand verification compares them and rejects on any mismatch.
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
 * Redirects to the CURRENT origin (`window.location.origin`), not a fixed
 * canonical one. Why: the Supabase PKCE verifier is stored per-origin, so a
 * flow started on one origin can ONLY complete on that same origin. Pointing
 * the redirect at a fixed `tradevault.be` worked on production but silently
 * shipped every preview login off to production — the developer never saw the
 * branch they were testing. Ending where the flow started keeps previews on
 * the preview and production on production, and satisfies PKCE in both cases.
 *
 * The production fallback (`SITE_URL`) only applies outside the browser (SSR),
 * where there is no current origin; it matches the live domain anyway.
 *
 * REQUIRES the Supabase redirect allow-list to accept the preview domains —
 * add `https://tradevault-*.vercel.app/**` (Authentication → URL Configuration
 * → Redirect URLs). Production (`tradevault.be`) is already listed.
 */
export function authRedirectTo(path = "/"): string {
  const base = typeof window !== "undefined" ? window.location.origin : SITE_URL;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
