import { describe, it, expect } from "bun:test";
import {
  pathForPage,
  pageFromPath,
  pageFromLegacySearch,
  buildPageUrl,
  resolveLocation,
  authAliasRedirect,
  DEFAULT_PAGE,
} from "../pageUrl";
import { PAGES } from "../../types";

describe("pathForPage", () => {
  it("le tableau de bord vit à la racine", () => {
    // Page d'accueil de l'application : une redirection /dashboard → /
    // coûterait un aller-retour à chaque connexion.
    expect(pathForPage("dashboard")).toBe("/");
  });

  it("chaque autre page a son propre chemin", () => {
    expect(pathForPage("settings")).toBe("/settings");
    expect(pathForPage("journal")).toBe("/journal");
  });
});

describe("pageFromPath", () => {
  it("lit une page valide, avec ou sans barre finale", () => {
    expect(pageFromPath("/settings")).toBe("settings");
    expect(pageFromPath("/settings/")).toBe("settings");
  });

  it("la racine est le tableau de bord", () => {
    expect(pageFromPath("/")).toBe(DEFAULT_PAGE);
    expect(pageFromPath("")).toBe(DEFAULT_PAGE);
  });

  it("rend null sur un chemin inconnu — la route affichera un 404", () => {
    expect(pageFromPath("/nexistepas")).toBeNull();
  });
});

describe("compatibilité ascendante", () => {
  it("reconnaît l'ANCIEN format ?p=", () => {
    expect(pageFromLegacySearch("?p=settings")).toBe("settings");
    expect(pageFromLegacySearch("?p=inconnu")).toBeNull();
  });

  it("une ancienne URL est réécrite en chemin propre", () => {
    // Un lien partagé hier doit continuer de fonctionner aujourd'hui.
    const r = resolveLocation("/", "?p=journal");
    expect(r.page).toBe("journal");
    expect(r.redirectTo).toBe("/journal");
  });

  it("l'ancien format PRIME sur le chemin", () => {
    // `/?p=journal` doit mener au journal, pas au tableau de bord — c'est
    // exactement la forme des liens déjà partagés.
    expect(resolveLocation("/", "?p=journal").page).toBe("journal");
  });

  it("une URL propre ne déclenche AUCUNE redirection", () => {
    const r = resolveLocation("/settings", "");
    expect(r.page).toBe("settings");
    expect(r.redirectTo).toBeNull();
  });
});

describe("buildPageUrl", () => {
  it("PRÉSERVE les paramètres de campagne et de lien profond", () => {
    // Les perdre casserait l'attribution marketing et le lien profond au
    // moment précis où l'utilisateur clique dessus.
    const url = buildPageUrl("journal", "?upgrade=1&promo=VAULT20");
    expect(url).toContain("upgrade=1");
    expect(url).toContain("promo=VAULT20");
    expect(url.startsWith("/journal?")).toBe(true);
  });

  it("retire l'ancien paramètre `p`, remplacé par le chemin", () => {
    expect(buildPageUrl("settings", "?p=journal")).toBe("/settings");
  });

  it("aller-retour : ce qui est écrit est relu à l'identique", () => {
    for (const page of ["journal", "analytics", "settings", "goals", "dashboard"] as const) {
      expect(pageFromPath(buildPageUrl(page, ""))).toBe(page);
    }
  });
});

describe("adresses de connexion tapées de mémoire", () => {
  it("`/login`, `/signup`, `/register` ouvrent le bon formulaire au lieu d'un 404", () => {
    expect(resolveLocation("/login", "").redirectTo).toBe("/?auth=login");
    expect(resolveLocation("/sign-in/", "").redirectTo).toBe("/?auth=login");
    expect(resolveLocation("/signup", "").redirectTo).toBe("/?auth=signup");
    expect(resolveLocation("/Register", "").redirectTo).toBe("/?auth=signup");
  });

  it("`/app` mène simplement à l'accueil", () => {
    expect(authAliasRedirect("/app")).toBe("/");
  });

  it("aucun alias ne masque une vraie page", () => {
    for (const page of PAGES) expect(authAliasRedirect(`/${page}`)).toBeNull();
  });

  it("une adresse inconnue reste un 404", () => {
    expect(resolveLocation("/nimporte-quoi", "").page).toBeNull();
    expect(resolveLocation("/nimporte-quoi", "").redirectTo).toBeNull();
  });
});
