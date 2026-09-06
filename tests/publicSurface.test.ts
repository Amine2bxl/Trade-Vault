import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SSR_LANG } from "../src/shared/lang";
import { readSource, stripComments } from "./helpers/source";

/**
 * LA SURFACE PUBLIQUE : ce qu'un visiteur — ou un robot d'indexation — reçoit
 * avant qu'une ligne de JavaScript ne s'exécute.
 */

const read = (p: string) => readSource(import.meta.dir, p);
const repo = (p: string) => resolve(import.meta.dir, "..", p);

describe("robots.txt et sitemap.xml", () => {
  test("aucun fichier statique ne masque les gestionnaires dynamiques", () => {
    // Sur Vercel, le CDN sert `public/` AVANT d'atteindre la fonction. Tant que
    // ces deux fichiers existaient, `robotsTxt()` et `sitemapXml()` n'étaient
    // jamais appelés : du code mort qui portait pourtant la protection des
    // préversions.
    expect(existsSync(repo("public/robots.txt"))).toBe(false);
    expect(existsSync(repo("public/sitemap.xml"))).toBe(false);
  });

  test("une préversion refuse toute indexation", () => {
    const server = read("../src/server.ts");
    expect(server).toContain("isCanonicalHost");
    expect(server).toContain("Disallow: /");
  });

  test("le sitemap est dérivé des routes publiques, pas tenu à la main", () => {
    // Le fichier statique supprimé ignorait `/contact` : une page publique
    // absente de son propre sitemap.
    const server = read("../src/server.ts");
    expect(server).toContain("PUBLIC_ROUTES.map");
    expect(server).toContain('"/contact"');
  });

  test("le fichier de vérification Google est réellement servi", () => {
    // Il vivait à la RACINE du dépôt, pas dans `public/` : il n'était donc
    // servi par rien, et la vérification Search Console ne pouvait pas aboutir.
    expect(existsSync(repo("public/google576720876a8ff805.html"))).toBe(true);
    expect(existsSync(repo("google576720876a8ff805.html"))).toBe(false);
  });
});

describe("langue du document servi", () => {
  test("les cinq déclarations de langue suivent la LANGUE DE LA ROUTE", () => {
    // `<html lang>`, le corps rendu côté serveur, le titre/description,
    // `og:locale` et `inLanguage` du graphe schema.org. Elles ne l'étaient pas :
    // `lang="fr"` et un titre français pour un corps rendu en ANGLAIS — la
    // détection de langue s'exécutant dans un initialiseur d'état, elle rendait
    // « en » côté serveur.
    //
    // CE QUI A CHANGÉ. La vitrine française a maintenant une ADRESSE (`/fr`).
    // Tant qu'il n'y en avait qu'une, ces déclarations pouvaient toutes pointer
    // sur la constante `SSR_LANG` ; désormais elles doivent suivre la langue de
    // la ROUTE, sinon `/fr` serait servie sous `<html lang="en">` — la même
    // contradiction, déplacée.
    //
    // `SSR_LANG` reste la langue servie par défaut, donc celle de `/` et le
    // `x-default` de la grappe `hreflang`.
    expect(SSR_LANG).toBe("en");

    const root = read("../src/routes/__root.tsx");
    expect(root).toContain("langForPath(pathname)");
    expect(root).toContain("<html lang={lang}>");

    // `langForPath` doit rester dans le module SANS DÉPENDANCE, pour la même
    // raison que `SSR_LANG` : `__root.tsx` est chargé sur chaque route.
    const lang = read("../src/shared/lang.ts");
    expect(lang).toContain("export function langForPath");
    expect(lang).toContain("FR_PREFIX");

    // `og:locale` de l'application suit toujours la constante ; celui des
    // routes publiques suit la langue de la page (`seo.lang ?? SSR_LANG`).
    expect(read("../src/routes/__root.tsx")).toContain('SSR_LANG === "fr" ? "fr_FR" : "en_US"');
    const seo = read("../src/shared/seo.ts");
    expect(seo).toContain("const lang = seo.lang ?? SSR_LANG;");
    expect(seo).toContain('lang === "fr" ? "fr_FR" : "en_US"');
    // La CINQUIÈME déclaration — celle qui avait été oubliée : le graphe
    // schema.org affirmait `fr-FR` en dur.
    expect(seo).toContain('SSR_LANG === "fr" ? "fr-FR" : "en-US"');
    expect(stripComments(seo)).not.toContain('inLanguage: "fr-FR"');

    // Le premier rendu reste identique des deux côtés : l'état initial est une
    // valeur connue au SSR (la langue de la route), jamais une lecture de
    // `localStorage`.
    const landing = read("../src/app/pages/landing/i18n.tsx");
    expect(landing).toContain("useState<LandingLang>(pinned ?? SSR_LANG)");
  });

  test("les deux vitrines se déclarent MUTUELLEMENT en hreflang", () => {
    // Une grappe `hreflang` à sens unique est ignorée EN BLOC par Google — la
    // grappe entière, pas seulement le lien manquant. Les deux moitiés doivent
    // donc citer la même paire, et elles la tirent de la même constante pour
    // qu'aucune ne puisse être modifiée seule.
    const seo = read("../src/shared/seo.ts");
    expect(seo).toContain("export const LANDING_ALTERNATES");
    for (const file of ["../src/routes/index.tsx", "../src/routes/fr.tsx"]) {
      expect(read(file), file).toContain("alternates: LANDING_ALTERNATES");
    }
    // `x-default` désigne la version servie à qui n'a rien choisi : l'anglais.
    expect(seo).toContain('hrefLang: "x-default", href: absoluteUrl(alternates.en)');

    // Le sitemap porte la MÊME paire. Deux canaux, une seule vérité.
    const server = read("../src/server.ts");
    expect(server).toContain('{ path: "/fr"');
    expect(server).toContain('hreflang="x-default"');
  });

  test("la détection de langue ne s'exécute plus pendant le rendu", () => {
    // C'est la cause exacte de la divergence d'hydratation : lire
    // `localStorage` et `navigator` dans l'initialiseur d'état fait diverger le
    // premier rendu client du rendu serveur.
    const landing = stripComments(read("../src/app/pages/landing/i18n.tsx"));
    expect(landing.includes("useState<LandingLang>(readInitial)")).toBe(false);
    // La préférence est appliquée dans un effet de MISE EN PAGE : il s'exécute
    // avant la première peinture, donc personne ne voit passer la langue par
    // défaut.
    expect(landing).toContain("useIsomorphicLayoutEffect(() => {");
    expect(landing).toContain("preferredLang()");
  });

  test("la constante de langue n'entraîne pas le dictionnaire dans le chunk d'entrée", () => {
    // `__root.tsx` est chargé sur CHAQUE route. Importer la constante depuis le
    // dictionnaire de la landing y faisait entrer une vingtaine de kilo-octets
    // qu'un trader connecté ne verra jamais — mesuré à +24 Ko sur l'entrée.
    const root = stripComments(read("../src/routes/__root.tsx"));
    expect(root).toContain('from "@/shared/lang"');
    // Hors commentaires : l'en-tête du fichier a le droit de CITER l'ancien
    // emplacement pour expliquer le déplacement.
    expect(root.includes("landing/i18n")).toBe(false);

    const lang = read("../src/shared/lang.ts");
    expect(lang).not.toContain("import ");
  });
});

describe("modale d'authentification — le point de conversion", () => {
  const modal = read("../src/app/pages/landing/AuthModal.tsx");

  test("elle passe par le dictionnaire de la landing", () => {
    // Elle était intégralement en français alors que la landing s'ouvre en
    // anglais pour tout navigateur non francophone : un visiteur anglophone
    // traversait une page de vente anglaise et tombait sur un formulaire
    // français au moment exact où on lui demande quelque chose.
    expect(modal).toContain('import { useLandingT } from "./i18n"');
    expect(modal).toContain("const { t } = useLandingT();");
  });

  test("il ne reste aucune chaîne visible écrite en dur", () => {
    const code = stripComments(modal);
    // Les accents sont le marqueur le plus fiable d'un texte français resté
    // dans le JSX. Les commentaires sont retirés — ils ont le droit d'être en
    // français, c'est la langue du dépôt.
    const accented = code.match(/"[^"\n]*[àâçéèêëîïôùûü][^"\n]*"/g) ?? [];
    expect(accented).toEqual([]);
  });

  test("les libellés d'accessibilité sont traduits eux aussi", () => {
    // `aria-label="Fermer"` est invisible à l'œil et lu à voix haute par un
    // lecteur d'écran anglophone.
    expect(modal).toContain('aria-label={t("auth.close")}');
    expect(modal).toContain('t("auth.hidePassword")');
  });

  test("les deux écrans de chargement de l'application sont traduits", () => {
    const app = read("../src/app/App.tsx");
    expect(app).toContain('t("app.checkingAccount")');
    expect(app).toContain('t("app.loadingOnboarding")');
  });
});
