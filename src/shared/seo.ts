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
import { SITE_URL, TRUSTPILOT_URL } from "./site";
import { SSR_LANG, FR_PREFIX, type SiteLang } from "./lang";
import { TIERS } from "@/domain/plans";

export const SITE_NAME = "TradeVault";

/** L'adresse de support réelle — celle qui répond. Elle vit ici parce que le
 *  graphe schema.org et la page `/contact` doivent annoncer la MÊME. */
export const SUPPORT_EMAIL = "tradevault@outlook.fr";

/**
 * L'aperçu social par défaut — un PNG 1200×630.
 *
 * Il pointait sur `/icon-512.png`, une icône CARRÉE, alors que le document
 * déclare `twitter:card: summary_large_image`, qui attend un rapport de 1,91:1.
 * Résultat : une carte rognée, ou un repli silencieux en petite vignette, sur
 * chaque partage du lien.
 *
 * Un `og-image.svg` aux bonnes dimensions dormait dans `public/` sans être
 * référencé nulle part — et il ne l'aurait pas sauvée : AUCUN moissonneur
 * social ne rend le SVG (ni Facebook, ni LinkedIn, ni X, ni Slack, ni Discord).
 * Le PNG qui le remplace est produit depuis ce même SVG, source conservée à
 * côté pour pouvoir le régénérer.
 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Dimensions de `DEFAULT_OG_IMAGE`. Déclarées explicitement : sans elles, un
 *  moissonneur doit télécharger l'image pour les découvrir, et plusieurs
 *  renoncent avant. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

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
  /** La langue de CETTE page, si elle diffère de celle servie par défaut.
   *  Seule `/fr` s'en sert. Pilote `og:locale`. */
  lang?: SiteLang;
  /** Les deux adresses de la même page, quand elle existe en deux langues.
   *  Émet la grappe `hreflang` — voir `hreflangLinks`. */
  alternates?: { en: string; fr: string };
}

/** Les deux adresses de la vitrine. Une seule paire existe dans le produit :
 *  la déclarer ici évite qu'un des deux côtés de la réciprocité `hreflang` soit
 *  écrit à la main — et donc oublié. */
export const LANDING_ALTERNATES = { en: "/", fr: FR_PREFIX } as const;

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
  "TradeVault is an AI trading journal and trading coach that turns your trading history into clear performance analytics — equity curve, drawdown, expectancy, recurring mistakes — so you understand and improve your own trading.";

/** L'étiquette BCP-47 de la langue SERVIE. Cinquième déclaration de langue du
 *  document, après `<html lang>`, le corps rendu, le titre et `og:locale` —
 *  et la seule qui avait été oubliée : le graphe schema.org affirmait
 *  `fr-FR` EN DUR pendant que les quatre autres disaient « en ». */
export const SITE_LOCALE = SSR_LANG === "fr" ? "fr-FR" : "en-US";

/**
 * schema.org graph for the homepage.
 *
 * Google's OAuth brand verification wants the homepage to identify the
 * application unambiguously under the same name as the consent screen. Machine-
 * readable Organization + SoftwareApplication nodes state that outright instead
 * of leaving it to be inferred from marketing copy, and the `url` fields tie the
 * brand to the domain being verified. A SoftwareApplication node also lets
 * answer engines (GEO) describe the product from structured facts.
 *
 * ── CE GRAPHE NE DOIT DÉCRIRE QUE CE QUI EST VISIBLE ────────────────────────
 *
 * Une donnée structurée est une promesse faite à une machine : « la page dit
 * ceci ». Trois règles en découlent, et elles ont chacune corrigé un défaut
 * réel ici :
 *
 *   • `inLanguage` suit `SSR_LANG`. Il valait `fr-FR` en dur — corrigé sur
 *     `main` en parallèle ; `SITE_LOCALE` nomme simplement la même expression
 *     pour qu'elle ne soit plus recopiée à deux endroits.
 *   • Les prix sortent du CATALOGUE (`domain/plans`), pas d'une constante
 *     recopiée. Le graphe annonçait `price: "0"` et une vague « offre Premium
 *     optionnelle » pendant que la grille tarifaire de la page affichait trois
 *     paliers chiffrés. C'est exactement le genre d'écart qui fait rejeter des
 *     données structurées — et il grandit tout seul à chaque changement de
 *     tarif.
 *   • `sameAs` ne liste que des profils qui EXISTENT. Il n'y en a qu'un
 *     (Trustpilot). Le pied de page affichait cinq icônes de réseaux sociaux
 *     sans compte derrière ; elles ne sont pas devenues des `sameAs`, elles ont
 *     été retirées.
 *
 * Ce qui n'y figure PAS, volontairement : aucun `aggregateRating`, aucun
 * `review`, aucun nombre d'utilisateurs. Le site n'affiche aucune de ces
 * choses ; les inventer serait une donnée structurée mensongère.
 */
export function structuredData(): string {
  // `AggregateOffer` plutôt qu'un `Offer` unique : la page de tarifs affiche
  // les TROIS paliers du catalogue (Free, Pro, Elite). L'agrégat est la seule
  // forme qui décrive honnêtement une grille — un `Offer` isolé à 0 € aurait
  // laissé croire que le produit est intégralement gratuit.
  const monthly = TIERS.map((t) => t.monthly);

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
        email: SUPPORT_EMAIL,
        sameAs: [TRUSTPILOT_URL],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: SUPPORT_EMAIL,
          url: `${SITE_URL}/contact`,
          availableLanguage: ["en", "fr"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        // Aligné sur `SSR_LANG` (english default) — la langue du document servi.
        inLanguage: SITE_LOCALE,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: "FinanceApplication",
        applicationSubCategory: "Trading journal",
        operatingSystem: "Web",
        description: PRODUCT_DESCRIPTION_EN,
        // L'aperçu 1200×630, pas l'icône carrée : c'est la même image que celle
        // que servent `og:image` et `twitter:image`, donc une seule vérité sur
        // « à quoi ressemble ce produit ».
        image: DEFAULT_OG_IMAGE,
        inLanguage: ["en", "fr"],
        author: { "@id": `${SITE_URL}/#organization` },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: String(Math.min(...monthly)),
          highPrice: String(Math.max(...monthly)),
          offerCount: String(TIERS.length),
        },
      },
    ],
  });
}

/**
 * `FAQPage`, construit À PARTIR DES MÊMES CHAÎNES que l'accordéon visible.
 *
 * La landing affiche quatre questions/réponses réelles et ne les balisait pas :
 * le contenu le plus directement extractible du site — par Google comme par un
 * moteur de réponse — restait un empilement de `<button>` et de `<div>`.
 *
 * Le paramètre est délibérément la liste DÉJÀ RENDUE, pas une copie déclarée
 * ici. Une seconde liste aurait pu dériver de la première sans que rien ne le
 * signale, et un `FAQPage` qui décrit des questions absentes de la page est
 * précisément ce qu'un moteur sanctionne. Ici, la divergence est impossible :
 * c'est le même tableau qui peint l'accordéon et qui remplit le balisage.
 */
export function faqPageJsonLd(entries: readonly { q: string; a: string }[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });
}

/**
 * `BreadcrumbList` pour les pages publiques secondaires.
 *
 * Sans lui, un résultat de recherche pour `/privacy` affiche l'URL brute. Avec
 * lui, il affiche « TradeVault › Privacy » — et le moteur comprend que la page
 * est une feuille rattachée à l'accueil, pas une racine concurrente.
 */
export function breadcrumbJsonLd(name: string, path: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name, item: absoluteUrl(path) },
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
  // La langue de CETTE page. Par défaut celle servie par le site ; `/fr`
  // annonce la sienne.
  const lang = seo.lang ?? SSR_LANG;

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
      // Dimensions et texte alternatif de l'aperçu. Sans les dimensions,
      // plusieurs moissonneurs téléchargent l'image avant de décider s'ils
      // l'affichent — et certains renoncent en route.
      { property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
      { property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
      { property: "og:image:alt", content: `${SITE_NAME} — ${seo.title}` },
      // Aligné sur la langue de la page : `og:locale` annonçait `fr_FR` pour un
      // corps rendu en anglais. Les cinq déclarations de langue du document
      // (`<html lang>`, le corps servi, le titre, celle-ci et `inLanguage` du
      // graphe schema.org) doivent dire la même chose — voir `shared/lang.ts`.
      { property: "og:locale", content: lang === "fr" ? "fr_FR" : "en_US" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: seo.title },
      { name: "twitter:description", content: seo.description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: `${SITE_NAME} — ${seo.title}` },
    ],
    links: [{ rel: "canonical", href: url }, ...hreflangLinks(seo.alternates)],
  };
}

/**
 * `hreflang` — les deux versions d'une même page se déclarent MUTUELLEMENT.
 *
 * Trois règles, et les trois comptent :
 *
 *  1. **La déclaration doit être réciproque.** `/` doit citer `/fr` ET `/fr`
 *     doit citer `/`. Un lien à sens unique est ignoré en bloc par Google — la
 *     grappe entière, pas seulement le lien manquant.
 *  2. **Chaque page se cite elle-même.** Une grappe `hreflang` inclut toujours
 *     la page courante ; l'omettre est l'erreur d'implémentation la plus
 *     fréquente.
 *  3. **`x-default` désigne la version servie à qui n'a rien choisi** — ici
 *     l'anglais, exactement ce que fait `SSR_LANG`.
 *
 * Rendu vide pour toute page qui n'existe que dans une langue (les pages
 * légales, les écrans authentifiés) : déclarer une alternative qui n'existe pas
 * est pire que de n'en déclarer aucune.
 */
function hreflangLinks(alternates?: PageSeo["alternates"]) {
  if (!alternates) return [];
  return [
    { rel: "alternate", hrefLang: "en", href: absoluteUrl(alternates.en) },
    { rel: "alternate", hrefLang: "fr", href: absoluteUrl(alternates.fr) },
    { rel: "alternate", hrefLang: "x-default", href: absoluteUrl(alternates.en) },
  ];
}
