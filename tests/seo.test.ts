import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  pageSeo,
  structuredData,
  absoluteUrl,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  LANDING_ALTERNATES,
} from "../src/shared/seo";
import { TIERS } from "../src/domain/plans";
import { langForPath, SSR_LANG } from "../src/shared/lang";
import { tr } from "../src/app/pages/landing/i18n";
import { readSource, stripComments } from "./helpers/source";

/**
 * LE RÉFÉRENCEMENT SE CASSE EN SILENCE.
 *
 * C'est la seule raison d'être de ce fichier. Aucun des défauts qu'il couvre ne
 * lève d'exception, n'échoue au typage ni ne dérange l'affichage : un lien mort
 * se clique, une carte sociale rognée se partage, un `hreflang` à sens unique
 * s'écrit très bien, et une donnée structurée qui contredit la page se rend
 * sans un mot. On ne les découvre que des semaines plus tard, dans une courbe
 * de trafic — quand on les découvre.
 *
 * Chaque test ci-dessous correspond à un défaut RÉEL trouvé dans l'audit
 * (`docs/seo/SEO_AUDIT.md`), et existe pour qu'il ne revienne pas.
 */

const read = (p: string) => readSource(import.meta.dir, p);
const repo = (p: string) => resolve(import.meta.dir, "..", p);

/* ────────────────────────── Données structurées ────────────────────────── */

describe("le graphe schema.org ne dit que ce que la page dit", () => {
  const graph = JSON.parse(structuredData());
  const node = (type: string) =>
    graph["@graph"].find((n: { "@type": string }) => n["@type"] === type);

  test("il n'invente NI note, NI avis, NI audience", () => {
    // La règle la plus importante de tout ce fichier. Une donnée structurée est
    // une affirmation faite à une machine ; ces quatre-là seraient invérifiables
    // et fausses — le site n'affiche aucune note, aucun avis, aucun compteur
    // d'utilisateurs.
    const raw = structuredData();
    for (const forbidden of [
      "aggregateRating",
      "ratingValue",
      "reviewCount",
      "userInteractionCount",
      "Review",
    ]) {
      expect(raw, `le graphe ne doit pas contenir ${forbidden}`).not.toContain(forbidden);
    }
  });

  test("les tarifs sortent du CATALOGUE, pas d'une constante recopiée", () => {
    // Il annonçait `price: "0"` en dur avec une vague « offre Premium
    // optionnelle », pendant que la grille de la page affichait trois paliers
    // chiffrés. L'écart grandissait tout seul à chaque changement de tarif.
    const offers = node("SoftwareApplication").offers;
    expect(offers["@type"]).toBe("AggregateOffer");
    expect(offers.priceCurrency).toBe("EUR");
    expect(offers.lowPrice).toBe(String(Math.min(...TIERS.map((t) => t.monthly))));
    expect(offers.highPrice).toBe(String(Math.max(...TIERS.map((t) => t.monthly))));
    expect(offers.offerCount).toBe(String(TIERS.length));
  });

  test("`sameAs` ne liste que des profils qui existent vraiment", () => {
    // Le pied de page affichait cinq icônes de réseaux sociaux sans compte
    // derrière. Elles ont été retirées, pas promues en `sameAs`.
    const sameAs: string[] = node("Organization").sameAs;
    expect(sameAs).toHaveLength(1);
    expect(sameAs[0]).toContain("trustpilot.com/review/");
    // Et surtout pas vers l'ancien domaine, abandonné à la migration.
    expect(sameAs[0]).not.toContain("vercel.app");
  });

  test("`inLanguage` suit la langue servie", () => {
    // La cinquième déclaration de langue du document — la seule qui avait été
    // oubliée. Elle valait `fr-FR` en dur pour un site servi en anglais.
    expect(node("WebSite").inLanguage).toBe("en-US");
  });
});

describe("les balisages dérivés du contenu visible", () => {
  test("le `FAQPage` reprend EXACTEMENT les entrées qu'on lui donne", () => {
    const entries = [
      { q: "Is the free plan really free?", a: "Yes — no time limit, no credit card." },
    ];
    const faq = JSON.parse(faqPageJsonLd(entries));
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity).toHaveLength(1);
    expect(faq.mainEntity[0].name).toBe(entries[0].q);
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(entries[0].a);
  });

  test("la landing le construit depuis le MÊME tableau que l'accordéon", () => {
    // C'est tout l'intérêt : une seconde liste déclarée à côté aurait pu dériver
    // de la première sans que rien ne le signale, et un `FAQPage` qui décrit des
    // questions absentes de la page est précisément ce qu'un moteur sanctionne.
    const landing = stripComments(read("../src/app/pages/Landing.tsx"));
    expect(landing).toContain("faqPageJsonLd(faqs)");
    expect(landing).toContain("faqs.map(");
  });

  test("le fil d'Ariane rattache la page à l'accueil", () => {
    const crumb = JSON.parse(breadcrumbJsonLd("Privacy", "/privacy"));
    expect(crumb["@type"]).toBe("BreadcrumbList");
    expect(crumb.itemListElement[0].name).toBe(SITE_NAME);
    expect(crumb.itemListElement[1].name).toBe("Privacy");
    expect(crumb.itemListElement[1].item).toBe(absoluteUrl("/privacy"));
  });

  test("les quatre pages publiques secondaires en portent un", () => {
    for (const route of ["privacy", "terms", "cgu"]) {
      expect(read(`../src/routes/${route}.tsx`), route).toContain(`path="/${route}"`);
    }
    expect(read("../src/app/pages/LegalPage.tsx")).toContain("breadcrumbJsonLd(doc.title, path)");
    expect(read("../src/app/pages/ContactPage.tsx")).toContain(
      'breadcrumbJsonLd(doc.title, "/contact")',
    );
  });
});

/* ────────────────────────────── Carte sociale ───────────────────────────── */

describe("la carte sociale peut réellement s'afficher", () => {
  test("l'aperçu est un PNG de 1200×630", () => {
    // `twitter:card` vaut `summary_large_image`, qui attend un rapport 1,91:1.
    // `og:image` pointait sur `/icon-512.png` — une icône CARRÉE : carte rognée,
    // ou repli silencieux en petite vignette, sur chaque partage du lien.
    expect(DEFAULT_OG_IMAGE).toBe(absoluteUrl("/og-image.png"));

    const png = readFileSync(repo("public/og-image.png"));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  test("le SVG source est conservé, mais n'est JAMAIS servi comme aperçu", () => {
    // Aucun moissonneur social ne rend le SVG — ni Facebook, ni LinkedIn, ni X,
    // ni Slack, ni Discord. Un `og-image.svg` aux bonnes dimensions dormait dans
    // `public/` sans être référencé nulle part, et n'aurait de toute façon
    // jamais pu s'afficher.
    expect(existsSync(repo("public/og-image.svg"))).toBe(true);
    expect(existsSync(repo("scripts/og-image.ts"))).toBe(true);

    const meta = pageSeo({ title: "T", description: "D", path: "/" }).meta;
    for (const tag of meta) {
      const content = (tag as { content?: string }).content ?? "";
      expect(content).not.toContain(".svg");
    }
  });

  test("les dimensions et le texte alternatif sont déclarés", () => {
    // `meta` est une union de formes (`{title}`, `{name, content}`,
    // `{property, content}`) : on la relit comme un simple sac de chaînes
    // facultatives plutôt que de discriminer, ce qui n'apprendrait rien de plus
    // au test.
    type MetaTag = { property?: string; name?: string; content?: string };
    const meta = pageSeo({ title: "T", description: "D", path: "/" }).meta as MetaTag[];
    const by = (key: string) => meta.find((m) => m.property === key || m.name === key);

    expect(by("og:image:width")?.content).toBe("1200");
    expect(by("og:image:height")?.content).toBe("630");
    expect(by("og:image:alt")?.content).toContain(SITE_NAME);
    // La carte Twitter demande le même alt, sinon l'image y reste muette pour
    // un lecteur d'écran.
    expect(by("twitter:image:alt")?.content).toContain(SITE_NAME);
  });
});

/* ───────────────────────────── Internationalisation ─────────────────────── */

describe("la langue suit l'adresse", () => {
  test("`langForPath` ne réclame le français que sous `/fr`", () => {
    // C'est cette fonction qui pilote `<html lang>` (`routes/__root.tsx`). Une
    // correspondance trop large — un `includes("fr")` par exemple — servirait
    // du français sur `/from-somewhere`, et un document se contredirait à
    // nouveau sur sa propre langue.
    expect(langForPath("/fr")).toBe("fr");
    expect(langForPath("/fr/quoi-que-ce-soit")).toBe("fr");

    for (const path of ["/", "/privacy", "/terms", "/cgu", "/contact", "/friends", "/journal"]) {
      expect(langForPath(path), path).toBe(SSR_LANG);
    }
  });

  test("le dictionnaire rend RÉELLEMENT deux langues différentes", () => {
    // Le garde-fou du pari « /fr ». Si le dictionnaire français retombait sur
    // l'anglais, `/fr` servirait de l'anglais sous un `hreflang="fr"` et un
    // canonical distinct — c'est-à-dire un contenu dupliqué déclaré comme une
    // traduction, le pire des deux mondes.
    for (const key of ["hero.sub", "faq.q1", "faq.a2", "footer.r1"] as const) {
      expect(tr("fr", key), key).not.toBe(tr("en", key));
      expect(tr("fr", key).length, key).toBeGreaterThan(0);
    }
  });
});

describe("hreflang", () => {
  test("une page bilingue déclare les trois liens attendus", () => {
    const links = pageSeo({
      title: "T",
      description: "D",
      path: "/",
      alternates: LANDING_ALTERNATES,
    }).links as { rel: string; hrefLang?: string; href: string }[];

    const alt = links.filter((l) => l.rel === "alternate");
    expect(alt.map((l) => l.hrefLang)).toEqual(["en", "fr", "x-default"]);
    // La page se cite ELLE-MÊME : c'est l'omission la plus fréquente, et elle
    // suffit à faire ignorer la grappe entière.
    expect(alt.find((l) => l.hrefLang === "en")!.href).toBe(absoluteUrl("/"));
    expect(alt.find((l) => l.hrefLang === "fr")!.href).toBe(absoluteUrl("/fr"));
    expect(alt.find((l) => l.hrefLang === "x-default")!.href).toBe(absoluteUrl("/"));
  });

  test("une page unilingue n'en déclare AUCUN", () => {
    // Déclarer une alternative qui n'existe pas est pire que de n'en déclarer
    // aucune : le moteur suit le lien et trouve un 404.
    const links = pageSeo({ title: "T", description: "D", path: "/privacy" }).links;
    expect(links.filter((l) => (l as { rel: string }).rel === "alternate")).toHaveLength(0);
    expect(links).toHaveLength(1); // le canonical, et lui seul
  });

  test("`/fr` existe, rend le français au SSR et n'est pas en `noindex`", () => {
    const fr = read("../src/routes/fr.tsx");
    expect(fr).toContain('createFileRoute("/fr")');
    expect(fr).toContain('<Landing lang="fr" />');
    expect(fr).toContain('lang: "fr"');
    expect(stripComments(fr)).not.toContain("index: false");

    // Le rendu est bien SERVEUR : pas de `ClientOnly` qui masquerait le texte
    // aux robots et aux moteurs de réponse.
    expect(stripComments(fr)).not.toContain("ClientOnly");
  });
});

/* ─────────────────────── Indexabilité et maillage ───────────────────────── */

describe("indexabilité", () => {
  const server = read("../src/server.ts");

  test("les écrans authentifiés restent EXPLORABLES et en `noindex`", () => {
    // Le piège que rate la plupart des configurations : un `Disallow` empêche le
    // robot de LIRE le `noindex`, donc l'URL peut rester dans l'index, sans
    // titre ni description. Explorable + `noindex` est la seule combinaison qui
    // désindexe vraiment.
    expect(read("../src/routes/$page.tsx")).toContain("index: false");
    expect(server).not.toContain("Disallow: /journal");
    expect(server).not.toContain("Disallow: /settings");
  });

  test("seul `/api/` est interdit d'exploration", () => {
    expect(server).toContain("Disallow: /api/");
  });

  test("`lastmod` est figé au build, pas recalculé à chaque requête", () => {
    // Il valait `new Date()` DANS le gestionnaire : chaque URL était déclarée
    // modifiée aujourd'hui, tous les jours, y compris des CGU inchangées depuis
    // des mois. Google en conclut que le `lastmod` du site n'est pas fiable et
    // cesse alors de le lire — pour toutes les URL, y compris celles qui
    // changent vraiment.
    expect(server).toContain("const BUILD_DATE =");
    expect(server).toContain("<lastmod>${BUILD_DATE}</lastmod>");
    const sitemapFn = server.slice(server.indexOf("function sitemapXml"));
    expect(sitemapFn).not.toContain("new Date()");
  });

  test("aucune page publique n'échappe au sitemap", () => {
    for (const path of ["/", "/fr", "/privacy", "/terms", "/cgu", "/contact"]) {
      expect(server, path).toContain(`path: "${path}"`);
    }
  });

  test("`robots.txt` annonce le sitemap et le résumé pour agents", () => {
    expect(server).toContain("Sitemap: ${SITE_URL}/sitemap.xml");
    expect(server).toContain("/llms.txt");
    expect(existsSync(repo("public/llms.txt"))).toBe(true);
  });
});

describe("maillage interne", () => {
  const landing = stripComments(read("../src/app/pages/Landing.tsx"));

  test("le pied de page ne contient plus un seul lien mort", () => {
    // Il en portait TREIZE — quatre « Produit », quatre « Ressources », cinq
    // icônes sociales — tous en `href="#"`, dans le seul bloc du site censé
    // faire circuler le maillage.
    expect(landing).not.toContain('href="#"');
  });

  test("chaque lien du pied de page désigne une ancre ou une route RÉELLE", () => {
    const targets = [...landing.matchAll(/\{ k: "footer\.[fr]\d", href: "([^"]+)" \}/g)].map(
      (m) => m[1],
    );
    expect(targets.length).toBe(8);

    const sectionIds = [...landing.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
    const routes = ["/demo", "/demo-site", "/contact", "/privacy", "/terms", "/cgu", "/"];
    for (const href of targets) {
      const ok = href.startsWith("#") ? sectionIds.includes(href.slice(1)) : routes.includes(href);
      expect(ok, `cible de pied de page introuvable : ${href}`).toBe(true);
    }
  });

  test("`/contact` n'est plus orpheline", () => {
    // Elle était déclarée dans le sitemap et atteignable par AUCUN lien du site.
    expect(landing).toContain('href: "/contact"');
  });

  test("aucune icône de réseau social sans compte derrière", () => {
    // Cinq logos — Twitter, LinkedIn, Instagram, Facebook, YouTube — annonçaient
    // une présence que la marque n'a pas. Un logo de réseau est une affirmation.
    for (const brand of ["Twitter", "Linkedin", "Instagram", "Facebook", "Youtube"]) {
      expect(landing, brand).not.toContain(brand);
    }
  });

  test("le lien Trustpilot suit le domaine, il n'est pas écrit en dur", () => {
    // Il pointait encore sur `tradevaultt.vercel.app`, l'ancien domaine : le
    // lien « Avis vérifiés » affiché au moment exact de l'inscription menait à
    // une fiche qui n'est plus la nôtre.
    const site = read("../src/shared/site.ts");
    expect(site).toContain("export const TRUSTPILOT_URL");
    expect(site).toContain("${SITE_DOMAIN}");
    const modal = read("../src/app/pages/landing/AuthModal.tsx");
    expect(modal).toContain("href={TRUSTPILOT_URL}");
    expect(modal).not.toContain("trustpilot.com/review/tradevault");
  });
});

/* ──────────────────────────── Cohérence des manifestes ──────────────────── */

describe("le manifeste PWA ne contredit pas le document", () => {
  const manifest = JSON.parse(readFileSync(repo("public/manifest.webmanifest"), "utf8"));

  test("sa langue est celle qui est servie", () => {
    expect(manifest.lang).toBe("en");
  });

  test("sa couleur de thème est celle du `<meta theme-color>`", () => {
    // Le manifeste annonçait `#060810`, la couleur d'AVANT le passage au
    // graphite, pendant que le document déclarait `#0a0b0d`.
    const root = read("../src/routes/__root.tsx");
    const themeColor = root.match(/name: "theme-color", content: "([^"]+)"/)![1];
    expect(manifest.theme_color).toBe(themeColor);
    expect(manifest.background_color).toBe(themeColor);
  });
});
