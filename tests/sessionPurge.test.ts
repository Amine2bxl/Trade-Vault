import { describe, expect, test } from "bun:test";
import { KEPT_ON_LOGOUT, purgeLocalSessionData, shouldPurge } from "../src/app/utils/session-purge";
import { readSource, stripComments } from "./helpers/source";

/**
 * CE QUI RESTE SUR LE DISQUE APRÈS UNE DÉCONNEXION.
 *
 * `logout()` appelait `signOut()` et rien d'autre. L'historique complet des
 * conversations Jarvis — pertes, capital, positions ouvertes — restait en clair
 * dans `localStorage`, avec les réponses de checklist, les brouillons et la
 * calculatrice de position. Le dépôt se contredisait d'ailleurs lui-même :
 * `useTrades.ts` refuse explicitement `localStorage` pour le P&L au motif qu'il
 * serait « lisible sur une machine partagée ».
 */

const read = (p: string) => readSource(import.meta.dir, p);

function installStorage() {
  const mk = () => {
    const data = new Map<string, string>();
    return {
      data,
      api: {
        get length() {
          return data.size;
        },
        key: (i: number) => [...data.keys()][i] ?? null,
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
        clear: () => data.clear(),
      } as Storage,
    };
  };
  const local = mk();
  const session = mk();
  (globalThis as Record<string, unknown>).localStorage = local.api;
  (globalThis as Record<string, unknown>).sessionStorage = session.api;
  return { local, session };
}

describe("classification des clés", () => {
  /**
   * Les clés réellement écrites par le produit pour un utilisateur donné,
   * relevées une à une dans les fichiers qui les écrivent. Chacune est une
   * donnée que le suivant sur la même machine ne doit pas trouver.
   */
  const USER_DATA = [
    "tv:jarvis:conv:u1:index", // l'historique Jarvis — le plus sensible
    "tv:jarvis:conv:u1:c-123",
    "tv:jarvis:profile:u1",
    "tv:jarvis:usage:u1",
    "tv:jarvis:memory",
    "tv-chk-config-u1",
    "tv-chk-u1-2026-08-29",
    "tv-chk-wizard-u1",
    "tv-active-account-u1",
    "tv:first-session:u1",
    "tv.u1.trade.draft", // l'espace de noms de utils/persistence.ts
    "tv:trades:u1:acc-1", // le miroir de session des trades
    "tv:unread-count",
    // Non nommées par utilisateur — donc HÉRITÉES par le compte suivant :
    "tv.journal.filters",
    "tv.dashboard.period",
    "tv-lot-calc",
    "tv.notif.coded",
    "tv.notif.pushed",
    "tv.notif.prefs",
    "tv.lastInboxVisit",
  ];

  test.each(USER_DATA)("%s est effacée", (key) => {
    expect(shouldPurge(key)).toBe(true);
  });

  test.each([...KEPT_ON_LOGOUT])("%s survit — réglage d'appareil, pas donnée du trader", (key) => {
    expect(shouldPurge(key)).toBe(false);
  });

  test("les clés d'authentification Supabase ne sont JAMAIS touchées", () => {
    // Marcher sur `sb-*` casserait la déconnexion elle-même : c'est `signOut()`
    // qui en a la charge.
    expect(shouldPurge("sb-abcdefgh-auth-token")).toBe(false);
    expect(shouldPurge("supabase.auth.token")).toBe(false);
  });

  test("une clé étrangère au produit est laissée intacte", () => {
    expect(shouldPurge("intercom-session")).toBe(false);
    expect(shouldPurge("theme")).toBe(false);
  });
});

describe("purgeLocalSessionData", () => {
  test("vide les deux magasins de leurs données utilisateur", () => {
    const { local, session } = installStorage();
    local.data.set("tv:jarvis:conv:u1:index", "[…]");
    local.data.set("tv.u1.trade.draft", "{…}");
    local.data.set("tv-themes", "{…}");
    local.data.set("sb-xyz-auth-token", "jwt");
    session.data.set("tv:trades:u1:acc-1", "[…]");
    session.data.set("tv:jarvis:memory", "{…}");

    purgeLocalSessionData();

    expect(local.data.has("tv:jarvis:conv:u1:index")).toBe(false);
    expect(local.data.has("tv.u1.trade.draft")).toBe(false);
    expect(session.data.has("tv:trades:u1:acc-1")).toBe(false);
    expect(session.data.has("tv:jarvis:memory")).toBe(false);
    // …sans emporter le thème personnalisé ni le jeton.
    expect(local.data.has("tv-themes")).toBe(true);
    expect(local.data.has("sb-xyz-auth-token")).toBe(true);
  });

  test("n'en saute aucune, quel que soit leur nombre", () => {
    // `Storage.key(i)` est INDEXÉ : supprimer pendant l'itération décale les
    // suivantes et en ferait sauter une sur deux. La liste est donc constituée
    // avant toute suppression — ce test échoue si quelqu'un « simplifie ».
    const { local } = installStorage();
    for (let i = 0; i < 50; i += 1) local.data.set(`tv.u1.draft-${i}`, "x");
    local.data.set("tv.lang", "fr");

    purgeLocalSessionData();

    expect([...local.data.keys()]).toEqual(["tv.lang"]);
  });

  test("ne lève pas quand le stockage refuse l'accès", () => {
    // Navigation privée : `removeItem` peut lever. Un trader doit pouvoir se
    // déconnecter quand même.
    const data = new Map([["tv.u1.a", "1"]]);
    const hostile = {
      get length() {
        return data.size;
      },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error("SecurityError");
      },
      clear: () => {},
    } as unknown as Storage;
    (globalThis as Record<string, unknown>).localStorage = hostile;
    (globalThis as Record<string, unknown>).sessionStorage = hostile;

    expect(() => purgeLocalSessionData()).not.toThrow();
  });
});

describe("le branchement dans le parcours d'authentification", () => {
  const auth = stripComments(read("../src/app/contexts/AuthContext.tsx"));

  test("la déconnexion purge", () => {
    expect(auth).toContain("purgeLocalSessionData");
    const logout = auth.slice(auth.indexOf("const logout = useCallback"));
    expect(logout).toContain("purgeLocalSessionData()");
  });

  test("la suppression de compte purge aussi", () => {
    // Le compte n'existe plus côté serveur : en laisser une copie locale ferait
    // de « supprimer mon compte » une promesse à moitié tenue.
    const del = auth.slice(
      auth.indexOf("const deleteAccount = useCallback"),
      auth.indexOf("const logout = useCallback"),
    );
    expect(del).toContain("purgeLocalSessionData()");
  });
});

describe("la liste de ce qui survit ne rouille pas", () => {
  test("chaque clé gardée est réellement écrite quelque part dans le produit", () => {
    // Une entrée qui ne correspond plus à aucune clé est au mieux du bruit, au
    // pire le souvenir d'une clé renommée — dont le nouveau nom, lui, n'est
    // plus protégé.
    const sources = [
      "../src/app/components/CookieConsent.tsx",
      "../src/app/i18n/LanguageContext.tsx",
      "../src/app/pages/usePersistedLang.ts",
      "../src/app/pages/landing/i18n.tsx",
      "../src/app/components/jarvis/prefs.ts",
      "../src/app/hooks/useSidebarCollapsed.ts",
      "../src/app/utils/themes.ts",
      "../src/routes/__root.tsx",
      "../src/app/contexts/AuthContext.tsx",
    ]
      .map(read)
      .join("\n");

    for (const key of KEPT_ON_LOGOUT) {
      expect(sources, key).toContain(`"${key}"`);
    }
  });
});
