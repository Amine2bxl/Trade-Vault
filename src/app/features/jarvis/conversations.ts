import { useCallback, useEffect, useState } from "react";
import type { JarvisMessage } from "./blocks";

/**
 * Conversations Jarvis — couche de données (Phase UX).
 *
 * Chaque conversation : id, title, createdAt, updatedAt, messages[].
 * `user_plan` et `retention_policy` (FREE limité / PREMIUM complet) sont prévus
 * par le modèle métier mais NON implémentés (aucun paywall pour l'instant).
 *
 * Stockage : `localStorage`, derrière une interface `ConversationStore` (une
 * future synchronisation Supabase se fera sans toucher aux workspaces).
 *
 * POURQUOI PAS `sessionStorage` — c'était le choix initial, et c'était un vrai
 * défaut produit. `sessionStorage` est détruit à la fermeture de l'onglet : un
 * trader qui revenait le lendemain retrouvait Jarvis amnésique, alors que la
 * promesse du produit est précisément l'inverse. On peut construire la
 * meilleure mémoire long terme du marché — si l'historique visible s'efface
 * chaque soir, le trader ne croira jamais que Jarvis se souvient de lui.
 *
 * Limite assumée : le stockage reste LOCAL à l'appareil. Changer de machine ne
 * rapatrie pas l'historique. La synchronisation serveur est le prochain palier ;
 * `localStorage` corrige aujourd'hui le défaut le plus visible sans introduire
 * de table, de migration ni de coût.
 */

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Épinglée = toujours en tête d'Historique, quel que soit l'ordre récent. */
  pinned?: boolean;
}

export interface Conversation extends ConversationMeta {
  messages: JarvisMessage[];
}

export interface ConversationStore {
  list(): Promise<ConversationMeta[]>;
  get(id: string): Promise<Conversation | null>;
  create(): Promise<Conversation>;
  saveMessages(id: string, messages: JarvisMessage[]): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  togglePin(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const indexKey = (uid: string) => `tv:jarvis:conv:${uid}:index`;
const convKey = (uid: string, id: string) => `tv:jarvis:conv:${uid}:${id}`;

export const CONVERSATIONS_EVENT = "tv:jarvis:conversations";

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONVERSATIONS_EVENT));
}

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    // Récupération de l'ancien emplacement : un trader dont la session est en
    // cours au moment du déploiement ne doit pas voir sa conversation
    // disparaître. La reprise est transparente et ne s'exécute qu'une fois,
    // puisque la valeur est ensuite écrite dans `localStorage`.
    const legacy = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
    if (legacy) {
      localStorage.setItem(key, legacy);
      return JSON.parse(legacy) as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Écrit, et DIT si l'écriture a eu lieu.
 *
 * L'ancienne version avalait l'exception et ne rendait rien. `localStorage`
 * plafonne autour de cinq mégaoctets par origine, et rien ici n'a jamais borné
 * la taille de l'historique : passé le plafond, CHAQUE écriture échouait en
 * silence. Jarvis continuait de répondre, l'interface affichait la
 * conversation, et rien n'était conservé — le trader ne l'apprenait qu'au
 * rechargement suivant.
 *
 * Pire, `saveMessages` écrivait le corps PUIS l'index. Le corps échouait, pas
 * l'index (quelques centaines d'octets, souvent encore admis) : l'historique
 * datait alors la conversation d'un enregistrement qui n'avait pas eu lieu —
 * « dernière activité à l'instant » pour des messages jamais écrits.
 */
function write(key: string, value: unknown): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Combien de conversations un appareil conserve.
 *
 * Ce n'est pas une limite de produit, c'est la limite du support : au-delà,
 * l'échec n'est pas « on garde moins », c'est « on ne garde plus rien ». Mieux
 * vaut perdre la plus ancienne discussion, explicitement, que perdre la
 * courante, en silence. Les conversations ÉPINGLÉES sont exclues de
 * l'éviction : les épingler est précisément l'acte par lequel un trader dit
 * qu'il veut les garder.
 */
const MAX_CONVERSATIONS = 60;

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Titre automatique : le premier message utilisateur (≈ 48 caractères). */
export function autoTitle(messages: JarvisMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue;
    const md = m.blocks.find((b) => b.type === "markdown");
    const text = (md && md.type === "markdown" ? md.content : "").trim();
    if (text) return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }
  return "Nouvelle discussion";
}

/** Tri : épinglées en tête, puis les plus récentes. */
function sortList(list: ConversationMeta[]): ConversationMeta[] {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export class JarvisConversationStore implements ConversationStore {
  constructor(private readonly userId: string) {}

  async list(): Promise<ConversationMeta[]> {
    const list = read<ConversationMeta[]>(indexKey(this.userId), []);
    return sortList(list);
  }

  async get(id: string): Promise<Conversation | null> {
    const meta = (await this.list()).find((c) => c.id === id);
    if (!meta) return null;
    const messages = read<JarvisMessage[]>(convKey(this.userId, id), []);
    return { ...meta, messages };
  }

  async create(): Promise<Conversation> {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: genId(),
      title: "Nouvelle discussion",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const list = await this.list();
    write(indexKey(this.userId), [conv, ...list]);
    notify();
    return conv;
  }

  /** Efface le corps d'une conversation dans les deux magasins. */
  private dropBody(id: string): void {
    for (const store of [
      typeof localStorage !== "undefined" ? localStorage : null,
      typeof sessionStorage !== "undefined" ? sessionStorage : null,
    ]) {
      try {
        store?.removeItem(convKey(this.userId, id));
      } catch {
        /* best-effort */
      }
    }
  }

  /**
   * Retire la plus ancienne conversation évinçable et libère sa place.
   *
   * Évinçable = ni épinglée, ni celle qu'on est en train d'enregistrer. Rend
   * l'index amputé, ou `null` quand il n'y a plus rien à libérer — auquel cas
   * l'appelant doit renoncer plutôt que de boucler.
   */
  private evictOldest(list: ConversationMeta[], keepId: string): ConversationMeta[] | null {
    // `sortList` place les épinglées en tête puis les plus récentes : la
    // dernière évinçable en partant de la fin est la plus ancienne.
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const c = list[i];
      if (c.pinned || c.id === keepId) continue;
      this.dropBody(c.id);
      return list.filter((x) => x.id !== c.id);
    }
    return null;
  }

  async saveMessages(id: string, messages: JarvisMessage[]): Promise<void> {
    const now = new Date().toISOString();
    let list = await this.list();
    const existing = list.find((c) => c.id === id);
    const meta: ConversationMeta = {
      id,
      title:
        existing && existing.title !== "Nouvelle discussion" ? existing.title : autoTitle(messages),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      pinned: existing?.pinned,
    };

    // LE CORPS D'ABORD, et on ne passe à l'index que s'il est réellement écrit.
    // Tant que le quota refuse, on libère la plus ancienne conversation et on
    // réessaie.
    while (!write(convKey(this.userId, id), messages)) {
      const pruned = this.evictOldest(list, id);
      if (!pruned) {
        // Plus rien à évincer : même seule, cette conversation ne tient pas.
        // On renonce SANS toucher à l'index — il continue de décrire
        // exactement ce qui est sur le disque, ce qui vaut mieux qu'une entrée
        // pointant vers des messages inexistants.
        notify();
        return;
      }
      list = pruned;
    }

    let next = sortList([meta, ...list.filter((c) => c.id !== id)]);
    // Plafond de garde : sans lui, l'historique ne cesse de croître jusqu'à ce
    // que la boucle ci-dessus devienne le fonctionnement NORMAL.
    while (next.length > MAX_CONVERSATIONS) {
      const pruned = this.evictOldest(next, id);
      if (!pruned) break; // toutes épinglées : le choix du trader l'emporte
      next = pruned;
    }
    write(indexKey(this.userId), next);
    notify();
  }

  async rename(id: string, title: string): Promise<void> {
    const clean = title.trim().slice(0, 64);
    if (!clean) return;
    const list = await this.list();
    write(
      indexKey(this.userId),
      sortList(list.map((c) => (c.id === id ? { ...c, title: clean } : c))),
    );
    notify();
  }

  async togglePin(id: string): Promise<void> {
    const list = await this.list();
    write(
      indexKey(this.userId),
      sortList(list.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))),
    );
    notify();
  }

  async remove(id: string): Promise<void> {
    // Les DEUX emplacements sont purgés. Ne nettoyer que l'ancien laisserait
    // les messages d'une conversation « supprimée » sur le disque : une fuite
    // silencieuse, et une promesse de suppression non tenue.
    this.dropBody(id);
    write(
      indexKey(this.userId),
      (await this.list()).filter((c) => c.id !== id),
    );
    notify();
  }
}

/** Fabrique : l'UI obtient un store sans connaître la classe. */
export function jarvisConversationStore(userId: string): ConversationStore {
  return new JarvisConversationStore(userId);
}

/**
 * Migration one-shot de l'ancien chat unique (`tv.{uid}.ai.chat`, localStorage)
 * vers une conversation du store, si le store est vide.
 */
export async function migrateLegacyChat(store: ConversationStore, userId: string): Promise<void> {
  if ((await store.list()).length > 0) return;
  let raw: unknown = [];
  try {
    const legacy = localStorage.getItem(`tv.${userId}.ai.chat`);
    if (legacy) raw = JSON.parse(legacy);
  } catch {
    return;
  }
  const messages = normalizeLegacy(raw);
  if (messages.length === 0) return;
  const conv = await store.create();
  await store.saveMessages(conv.id, messages);
}

function normalizeLegacy(raw: unknown): JarvisMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m, i) => {
    const r = m as Partial<JarvisMessage> & { text?: string };
    if (r.blocks && Array.isArray(r.blocks) && r.blocks.length > 0) return r as JarvisMessage;
    return {
      role: (r.role as JarvisMessage["role"]) ?? "assistant",
      id: `legacy-${i}-${Date.now()}`,
      blocks: [{ type: "markdown", content: typeof r.text === "string" ? r.text : "" }],
      createdAt: new Date().toISOString(),
    };
  });
}

/** Hook UI : liste des conversations, rafraîchie à chaque changement du store. */
export function useConversations(userId: string | undefined): ConversationMeta[] {
  const [list, setList] = useState<ConversationMeta[]>([]);

  const refresh = useCallback(() => {
    if (!userId) {
      setList([]);
      return;
    }
    void jarvisConversationStore(userId)
      .list()
      .then(setList)
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    refresh();
    window.addEventListener(CONVERSATIONS_EVENT, refresh);
    return () => window.removeEventListener(CONVERSATIONS_EVENT, refresh);
  }, [refresh]);

  return list;
}
