import { describe, it, expect, beforeEach } from "bun:test";
import { SessionConversationStore, sessionConversationStore, autoTitle } from "../conversations";
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

describe("ConversationStore — sessionStorage", () => {
  beforeEach(() => {
    installStorageMock();
  });

  it("crée une conversation vide, listée en tête", async () => {
    const store: SessionConversationStore = new SessionConversationStore("u1");
    const a = await store.create();
    const b = await store.create();
    expect((await store.list()).length).toBe(2);
    expect(a.id).not.toBe(b.id);
  });

  it("sauvegarde les messages et titre automatiquement depuis le 1er message utilisateur", async () => {
    const store = sessionConversationStore("u1");
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
    const store = sessionConversationStore("u1");
    const conv = await store.create();
    await store.saveMessages(conv.id, [msg("user", "test")]);
    await store.remove(conv.id);
    expect(await store.get(conv.id)).toBeNull();
    expect((await store.list()).find((c) => c.id === conv.id)).toBeUndefined();
  });

  it("isole les conversations par utilisateur", async () => {
    const a = sessionConversationStore("u1");
    const b = sessionConversationStore("u2");
    const ca = await a.create();
    await b.create();
    expect((await a.list()).map((c) => c.id)).toEqual([ca.id]);
  });
});
