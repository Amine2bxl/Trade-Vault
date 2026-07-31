import { useCallback, useEffect, useState } from "react";
import type { JarvisMessage } from "./blocks";

/**
 * Conversations Jarvis — couche de données (Phase UX).
 *
 * Chaque conversation : id, title, createdAt, updatedAt, messages[].
 * `user_plan` et `retention_policy` (FREE limité / PREMIUM complet) sont prévus
 * par le modèle métier mais NON implémentés (aucun paywall pour l'instant).
 *
 * Stockage Phase 1 : sessionStorage, derrière une interface `ConversationStore`
 * (future migration Supabase sans toucher aux workspaces).
 */

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationMeta {
  messages: JarvisMessage[];
}

export interface ConversationStore {
  list(): Promise<ConversationMeta[]>;
  get(id: string): Promise<Conversation | null>;
  create(): Promise<Conversation>;
  saveMessages(id: string, messages: JarvisMessage[]): Promise<void>;
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
  if (typeof sessionStorage === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
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

export class SessionConversationStore implements ConversationStore {
  constructor(private readonly userId: string) {}

  async list(): Promise<ConversationMeta[]> {
    const list = read<ConversationMeta[]>(indexKey(this.userId), []);
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
    };
    write(convKey(this.userId, id), messages);
    write(
      indexKey(this.userId),
      [meta, ...list.filter((c) => c.id !== id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
    notify();
  }

  async remove(id: string): Promise<void> {
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.removeItem(convKey(this.userId, id));
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
export function sessionConversationStore(userId: string): ConversationStore {
  return new SessionConversationStore(userId);
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
    void sessionConversationStore(userId)
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
