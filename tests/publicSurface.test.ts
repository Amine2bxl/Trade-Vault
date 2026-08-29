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
  test("les quatre déclarations de langue disent la même chose", () => {
    // `<html lang>`, le corps rendu côté serveur, le titre/description et
    // `og:locale`. Elles ne l'étaient pas : `lang="fr"` et un titre français
    // pour un corps rendu en ANGLAIS — la détection de langue s'exécutant dans
    // un initialiseur d'état, elle rendait « en » côté serveur.
    expect(SSR_LANG).toBe("fr");

    const root = read("../src/routes/__root.tsx");
    expect(root).toContain("<html lang={SSR_LANG}>");

    // Les DEUX déclarations d'`og:locale` — celle des routes publiques et celle
    // de l'application — doivent suivre la même constante.
    for (const file of ["../src/shared/seo.ts", "../src/routes/__root.tsx"]) {
      expect(read(file), file).toContain('SSR_LANG === "fr" ? "fr_FR" : "en_US"');
    }

    const landing = read("../src/app/pages/landing/i18n.tsx");
    expect(landing).toContain("useState<LandingLang>(SSR_LANG)");
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
