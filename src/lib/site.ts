// Single source of truth for the public identity of the app.
//
// Everything that used to hardcode a hostname (SEO/Open Graph URLs, the sitemap,
// the Trustpilot review link, contact addresses) reads from here, so a future
// domain move is a one-line change plus an env var — not a repo-wide grep.
//
// `VITE_SITE_URL` lets preview deployments advertise their own origin. It is a
// PUBLIC value by design (it ships to the browser); the server-side equivalent
// is `PUBLIC_SITE_URL`, read per-request in the .server.ts modules.

/** Canonical origin, no trailing slash. */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://tradevault.be"
).replace(/\/+$/, "");

/** Bare hostname — used for Trustpilot's review path and display copy. */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "");

export const SITE_NAME = "TradeVault";

export const CONTACT_EMAIL = `contact@${SITE_DOMAIN}`;

/** Trustpilot indexes a business unit by its verified domain. */
export const TRUSTPILOT_REVIEW_URL = `https://www.trustpilot.com/review/${SITE_DOMAIN}`;

/** Absolute URL for a site-relative path — Open Graph and sitemaps require it. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
