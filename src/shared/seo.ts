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
 * One-sentence product definition, in English, reused by the structured data
 * and the OAuth consent screen copy.
 *
 * English on purpose: this string is read by machines and by Google's brand
 * reviewers, not by visitors — the visible page stays French. Keeping it here
 * means the schema.org description, the manifest and the consent screen can
 * never drift apart into three different claims about what the product is.
 */
export const PRODUCT_DESCRIPTION_EN =
  "TradeVault is an AI-powered trading journal and trading coach that helps traders analyze performance, follow their trading plan and improve discipline.";

/**
 * schema.org graph for the homepage.
 *
 * Google's OAuth brand verification wants the homepage to identify the
 * application unambiguously under the same name as the consent screen. Machine-
 * readable Organization + SoftwareApplication nodes state that outright instead
 * of leaving it to be inferred from marketing copy, and the `url` fields tie the
 * brand to the domain being verified.
 */
export function structuredData(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
        email: "tradevault@outlook.fr",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        inLanguage: "fr-FR",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: PRODUCT_DESCRIPTION_EN,
        image: `${SITE_URL}/icon-512.png`,
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          description: "Free plan, with an optional Premium subscription.",
        },
      },
    ],
  });
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
