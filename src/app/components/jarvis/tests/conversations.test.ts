import { describe, it, expect, beforeEach } from "bun:test";
import { JarvisConversationStore, jarvisConversationStore, autoTitle } from "../conversations";
import type { JarvisMessage } from "../blocks";

function installStorageMock() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  } as Storage;
  (globalThis as Record<string, unknown>).sessionStorage = storage;
  (globalThis as Record<string, unknown>).localStorage = storage;
  return () => data.clear();
}

function msg(role: JarvisMessage["role"], content: string): JarvisMessage {
  return {
    role,
    id: `${role}-${Date.now()}-${Math.random()}`,
    blocks: [{ type: "markdown", content }],
    createdAt: new Date().toISOString(),
  };
}

describe("ConversationStore — comportement de base", () => {
  beforeEach(() => {
    installStorageMock();
  });

  it("crée une conversation vide, listée en tête", async () => {
    const store: JarvisConversationStore = new JarvisConversationStore("u1");
    const a = await store.create();
    const b = await store.create();
    expect((await store.list()).length).toBe(2);
    expect(a.id).not.toBe(b.id);
  });

  it("sauvegarde les messages et titre automatiquement depuis le 1er message utilisateur", async () => {
    const store = jarvisConversationStore("u1");
    const conv = await store.create();
    const messages = [
      msg("user", "Pourquoi j'ai perdu cette semaine sur le NQ ?"),
      msg("assistant", "J'ai trouvé plusieurs patterns…"),
    ];
    await store.saveMessages(conv.id, messages);
    const got = await store.get(conv.id);
    expect(got?.messages).toHaveLength(2);
    expect(got?.title).toContain("Pourquoi j'ai perdu");
    expect((await store.list())[0].updatedAt >= conv.createdAt).toBe(true);
  });

  it("autoTitle retombe sur 'Nouvelle discussion' sans message utilisateur", () => {
    expect(autoTitle([msg("assistant", "Bonjour")])).toBe("Nouvelle discussion");
    expect(autoTitle([msg("user", "   ")])).toBe("Nouvelle discussion");
  });

  it("supprime une conversation (messages + index)", async () => {
    const store = jarvisConversationStore("u1");
    const conv = await store.create();
    await store.saveMessages(conv.id, [msg("user", "test")]);
    await store.remove(conv.id);
    expect(await store.get(conv.id)).toBeNull();
    expect((await store.list()).find((c) => c.id === conv.id)).toBeUndefined();
  });

  it("isole les conversations par utilisateur", async () => {
    const a = jarvisConversationStore("u1");
    const b = jarvisConversationStore("u2");
    const ca = await a.create();
    await b.create();
    expect((await a.list()).map((c) => c.id)).toEqual([ca.id]);
  });
});

/**
 * Persistance — le défaut produit le plus coûteux corrigé dans ce module.
 *
 * Ces tests utilisent DEUX stockages distincts, contrairement au mock partagé
 * ci-dessus qui ne pouvait rien prouver : avec une seule Map, écrire dans l'un
 * ou l'autre est indiscernable.
 */
function installSplitStorage() {
  const mk = () => {
    const data = new Map<string, string>();
    return {
      data,
      api: {
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

describe("ConversationStore — persistance entre sessions", () => {
  it("SURVIT à la fermeture de l'onglet", async () => {
    // Le cœur du problème : en sessionStorage, le trader revenait le lendemain
    // devant un Jarvis amnésique, ce qui démentait la promesse du produit.
    const { local, session } = installSplitStorage();
    const store = jarvisConversationStore("u1");
    const conv = await store.create();
    await store.saveMessages(conv.id, [msg("user", "Pourquoi je perds le vendredi ?")]);

    // Fermeture de l'onglet : sessionStorage disparaît, localStorage demeure.
    session.data.clear();
    expect(local.data.size).toBeGreaterThan(0);

    const reopened = await jarvisConversationStore("u1").get(conv.id);
    expect(reopened?.messages).toHaveLength(1);
  });

  it("RÉCUPÈRE une conversation restée dans l'ancien emplacement", async () => {
    // Un trader dont la session est en cours au moment du déploiement ne doit
    // pas voir sa conversation disparaître.
    const { local, session } = installSplitStorage();
    session.data.set(
      "tv:jarvis:conv:u1:index",
      JSON.stringify([
        { id: "c1", title: "Ancienne", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
      ]),
    );

    const list = await jarvisConversationStore("u1").list();
    expect(list).toHaveLength(1);
    // …et la reprise est définitive : la donnée vit maintenant dans localStorage.
    expect(local.data.has("tv:jarvis:conv:u1:index")).toBe(true);
  });

  it("PURGE réellement les messages d'une conversation supprimée", async () => {
    // Ne nettoyer que l'ancien emplacement laisserait les messages sur le
    // disque : une promesse de suppression non tenue.
    const { local } = installSplitStorage();
    const store = jarvisConversationStore("u1");
    const conv = await store.create();
    await store.saveMessages(conv.id, [msg("user", "secret")]);
    expect(local.data.has(`tv:jarvis:conv:u1:${conv.id}`)).toBe(true);

    await store.remove(conv.id);
    expect(local.data.has(`tv:jarvis:conv:u1:${conv.id}`)).toBe(false);
    expect(await store.list()).toHaveLength(0);
  });
});
