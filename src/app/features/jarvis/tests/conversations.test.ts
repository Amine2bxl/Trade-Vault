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

/**
 * UN STOCKAGE QUI DIT NON.
 *
 * `localStorage` plafonne autour de cinq mégaoctets par origine. Rien ne
 * bornait la taille de l'historique Jarvis : passé le plafond, chaque écriture
 * levait `QuotaExceededError` — que l'ancien `write()` avalait sans rien
 * rendre. Un vrai navigateur se comporte comme ce mock ; le mock partagé
 * ci-dessus, lui, accepte tout et ne peut donc rien prouver.
 */
function installBudgetedStorage(budgetBytes: number) {
  const data = new Map<string, string>();
  const used = () => {
    let n = 0;
    for (const [k, v] of data) n += k.length + v.length;
    return n;
  };
  const api = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const previous = data.get(k);
      data.delete(k);
      if (used() + k.length + v.length > budgetBytes) {
        if (previous !== undefined) data.set(k, previous);
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  } as Storage;
  (globalThis as Record<string, unknown>).localStorage = api;
  (globalThis as Record<string, unknown>).sessionStorage = api;
  return { data, used };
}

/** Un message d'environ `bytes` octets, pour remplir le quota de façon prévisible. */
function bulky(bytes: number): JarvisMessage {
  return msg("user", "x".repeat(bytes));
}

describe("ConversationStore — le quota du navigateur", () => {
  it("n'ANNONCE jamais un enregistrement qui n'a pas eu lieu", async () => {
    // C'était le défaut le plus vicieux : le corps (volumineux) échouait, mais
    // l'index (quelques centaines d'octets) passait encore. L'historique
    // datait donc la conversation d'un enregistrement fictif — « dernière
    // activité il y a une minute » pour des messages jamais écrits.
    installBudgetedStorage(1_500);
    const store = new JarvisConversationStore("u1");
    const conv = await store.create();
    await store.saveMessages(conv.id, [msg("user", "petite question")]);
    const savedAt = (await store.list())[0].updatedAt;

    // L'horodatage se compte en millisecondes : sans cette attente, les deux
    // enregistrements porteraient la même date et le test ne prouverait rien.
    await new Promise((r) => setTimeout(r, 5));
    // Ce corps ne tiendra jamais, même après avoir tout évincé.
    await store.saveMessages(conv.id, [bulky(50_000)]);

    // Le corps sur le disque est toujours l'ancien…
    expect((await store.get(conv.id))?.messages).toHaveLength(1);
    // …et l'index le dit.
    expect((await store.list())[0].updatedAt).toBe(savedAt);
  });

  it("FAIT DE LA PLACE en évinçant la plus ancienne plutôt que de perdre la courante", async () => {
    // Le comportement qui compte pour le trader : la discussion qu'il est en
    // train d'avoir doit survivre. C'est la plus ancienne qui cède.
    const { data } = installBudgetedStorage(4_000);
    const store = new JarvisConversationStore("u1");

    const first = await store.create();
    await store.saveMessages(first.id, [bulky(800)]);
    const second = await store.create();
    await store.saveMessages(second.id, [bulky(800)]);

    const current = await store.create();
    await store.saveMessages(current.id, [bulky(1_500)]);

    // La courante est bien sur le disque…
    expect(data.has(`tv:jarvis:conv:u1:${current.id}`)).toBe(true);
    expect((await store.get(current.id))?.messages).toHaveLength(1);
    // …et la plus ancienne a réellement libéré sa place, corps compris.
    expect(data.has(`tv:jarvis:conv:u1:${first.id}`)).toBe(false);
    const ids = (await store.list()).map((c) => c.id);
    expect(ids).toContain(current.id);
    expect(ids).not.toContain(first.id);
  });

  it("n'évince JAMAIS une conversation épinglée", async () => {
    // Épingler, c'est l'acte par lequel le trader dit « celle-là, je la
    // garde ». Une éviction automatique qui l'ignore trahit ce geste.
    const { data } = installBudgetedStorage(4_000);
    const store = new JarvisConversationStore("u1");

    const pinned = await store.create();
    await store.saveMessages(pinned.id, [bulky(800)]);
    await store.togglePin(pinned.id);
    const other = await store.create();
    await store.saveMessages(other.id, [bulky(800)]);

    const current = await store.create();
    await store.saveMessages(current.id, [bulky(1_500)]);

    expect(data.has(`tv:jarvis:conv:u1:${pinned.id}`)).toBe(true);
    expect((await store.list()).map((c) => c.id)).toContain(pinned.id);
    // C'est la non-épinglée qui a payé.
    expect(data.has(`tv:jarvis:conv:u1:${other.id}`)).toBe(false);
  });

  it("plafonne le NOMBRE de conversations conservées", async () => {
    // Sans plafond, l'éviction sous quota finit par devenir le fonctionnement
    // normal — c'est-à-dire un historique qui se dégrade à chaque message.
    installBudgetedStorage(50_000_000);
    const store = new JarvisConversationStore("u1");
    for (let i = 0; i < 70; i += 1) {
      const c = await store.create();
      await store.saveMessages(c.id, [msg("user", `question ${i}`)]);
    }
    const list = await store.list();
    expect(list.length).toBeLessThanOrEqual(60);
    // Ce sont les plus récentes qui restent.
    expect(list.some((c) => c.title.includes("question 69"))).toBe(true);
    expect(list.some((c) => c.title.includes("question 0"))).toBe(false);
  });
});
