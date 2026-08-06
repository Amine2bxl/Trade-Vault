import { describe, it, expect } from "bun:test";
import { pageFromSearch, buildPageUrl, DEFAULT_PAGE } from "../pageUrl";

describe("pageFromSearch", () => {
  it("lit une page valide", () => {
    expect(pageFromSearch("?p=journal")).toBe("journal");
  });

  it("rend null sur une page inconnue plutôt qu'un écran vide", () => {
    // URL trafiquée, ou lien partagé vers une page supprimée depuis.
    expect(pageFromSearch("?p=nexistepas")).toBeNull();
    expect(pageFromSearch("")).toBeNull();
  });

  it("ignore les autres paramètres", () => {
    expect(pageFromSearch("?upgrade=1&p=analytics&promo=VAULT20")).toBe("analytics");
  });
});

describe("buildPageUrl", () => {
  it("PRÉSERVE les paramètres de campagne et de lien profond", () => {
    // Les écraser casserait l'attribution marketing et le lien profond au
    // moment précis où l'utilisateur clique dessus.
    const url = buildPageUrl("/", "?upgrade=1&promo=VAULT20", "journal");
    expect(url).toContain("upgrade=1");
    expect(url).toContain("promo=VAULT20");
    expect(url).toContain("p=journal");
  });

  it("OMET le paramètre pour la page par défaut — l'accueil reste propre", () => {
    expect(buildPageUrl("/", "?p=journal", DEFAULT_PAGE)).toBe("/");
  });

  it("remplace la page au lieu d'empiler les paramètres", () => {
    const once = buildPageUrl("/", "", "journal");
    const twice = buildPageUrl("/", once.slice(once.indexOf("?")), "analytics");
    expect(twice).toBe("/?p=analytics");
  });

  it("aller-retour : ce qui est écrit est relu à l'identique", () => {
    for (const page of ["journal", "analytics", "settings", "goals"] as const) {
      const url = buildPageUrl("/", "", page);
      expect(pageFromSearch(url.slice(url.indexOf("?")))).toBe(page);
    }
  });
});
