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

function write(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best-effort */
  }
}

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

  async saveMessages(id: string, messages: JarvisMessage[]): Promise<void> {
    const now = new Date().toISOString();
    const list = await this.list();
    const existing = list.find((c) => c.id === id);
    const meta: ConversationMeta = {
      id,
      title:
        existing && existing.title !== "Nouvelle discussion" ? existing.title : autoTitle(messages),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      pinned: existing?.pinned,
    };
    write(convKey(this.userId, id), messages);
    write(indexKey(this.userId), sortList([meta, ...list.filter((c) => c.id !== id)]));
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
