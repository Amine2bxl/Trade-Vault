/**
 * SEO metadata — one builder for every public route.
 *
 * Two things this fixes, both of which are invisible until they matter:
 *
 *  1. **Absolute URLs.** Open Graph and Twitter cards ignore relative paths —
 *     a scraper has no base to resolve `/icon-512.png` against, so the preview
 *     image silently never renders. Canonical links have the same requirement.
 *  2. **Domain independence.** Every absolute URL is derived from `SITE_URL`,
 *     so connecting a custom domain changes one environment variable and every
 *     canonical, `og:url` and preview image follows. Nothing here hardcodes a
 *     host.
 *
 * Only public, indexable routes need this. The authenticated app lives behind
 * `/` and is client-rendered, so it inherits the root defaults.
 */
import { SITE_URL } from "./site";

export const SITE_NAME = "TradeVault";

/** Default social preview. Square, works as both `summary` and app icon. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/icon-512.png`;

export interface PageSeo {
  /** Full <title>. Include the brand — this is not auto-suffixed. */
  title: string;
  description: string;
  /** Route path, e.g. "/privacy". Used for canonical + og:url. */
  path: string;
  /** Absolute image URL. Defaults to the app icon. */
  image?: string;
  /** `false` on pages that must never be indexed. */
  index?: boolean;
  /** og:type — "website" for marketing pages, "article" for legal docs. */
  type?: "website" | "article";
}

/** Absolute URL for a route path, without a duplicate slash or trailing one. */
export function absoluteUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `${SITE_URL}/` : `${SITE_URL}${clean.replace(/\/+$/, "")}`;
}

/**
 * Build the `head()` payload for a public route. Returns the exact shape
 * TanStack Router expects, so a route is `head: () => pageSeo({ … })`.
 */
export function pageSeo(seo: PageSeo) {
  const url = absoluteUrl(seo.path);
  const image = seo.image ?? DEFAULT_OG_IMAGE;
  const index = seo.index !== false;

  return {
    meta: [
      { title: seo.title },
      { name: "description", content: seo.description },
      { name: "robots", content: index ? "index,follow" : "noindex,nofollow" },

      { property: "og:site_name", content: SITE_NAME },
      { property: "og:type", content: seo.type ?? "website" },
      { property: "og:title", content: seo.title },
      { property: "og:description", content: seo.description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:locale", content: "fr_FR" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: seo.title },
      { name: "twitter:description", content: seo.description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
