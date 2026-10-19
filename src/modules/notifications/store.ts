import { supabase } from "@/integrations/supabase/client";
import type { AppNotification } from "./types";
import { categoryOf } from "./engine";
import { PRUNE_READ_AFTER_DAYS, notificationDedupKey, planArchive } from "./policy";
import { todayLocalDate } from "@/shared/calendar-date";

/**
 * Persistence adapter for the notifications table (see migration
 * 20260718*_engines_foundation.sql). Injected into the engine at app
 * bootstrap — the engine itself never imports supabase.
 */

/**
 * Écrit la notification ; rend `true` si la ligne a été créée, `false` si un
 * autre appareil l'avait déjà créée (même `dedup_key`, voir
 * `policy.notificationDedupKey`). La garantie est en base : l'index unique
 * `(user_id, dedup_key)` et `on conflict do nothing`.
 *
 * Base pas encore migrée (colonne ou index absents) : repli sur l'insertion
 * d'avant. Une notification en double vaut mieux qu'une notification perdue.
 */
export async function persistNotification(n: AppNotification): Promise<boolean> {
  const row = {
    id: n.id,
    user_id: n.userId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    url: n.url ?? null,
    severity: n.severity,
    data: (n.data ?? {}) as never,
    created_at: n.createdAt,
    read_at: n.readAt ?? null,
  };
  const { data, error } = await supabase
    .from("notifications")
    .upsert({ ...row, dedup_key: notificationDedupKey(n, todayLocalDate()) } as never, {
      onConflict: "user_id,dedup_key",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error && (error.code === "42703" || error.code === "42P10")) {
    const { error: insertError } = await supabase.from("notifications").insert(row);
    if (insertError) throw insertError;
    return true;
  }
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Le trader a fermé un popup : on l'écrit sur la notification, pour que les
 * autres appareils où le même popup est ouvert le ferment aussi
 * (`policy.shouldClosePopup`).
 */
export async function dismissNotification(userId: string, n: AppNotification): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ data: { ...(n.data ?? {}), dismissedAt: new Date().toISOString() } as never })
    .eq("id", n.id)
    .eq("user_id", userId);
  if (error) throw error;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  severity: string;
  created_at: string;
  read_at: string | null;
  data: unknown;
};

/** Une ligne de la table (lecture ou Realtime) → la notification du produit. */
export function notificationFromRow(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind as AppNotification["kind"],
    title: r.title,
    body: r.body,
    url: r.url ?? undefined,
    severity: r.severity as AppNotification["severity"],
    channels: ["dashboard"],
    // La catégorie est dérivée du kind côté client (pas de colonne en base) —
    // un seul point de vérité, aucune migration requise.
    category: categoryOf(
      r.kind as AppNotification["kind"],
      r.severity as AppNotification["severity"],
    ),
    createdAt: r.created_at,
    readAt: r.read_at,
    data: (r.data ?? undefined) as AppNotification["data"],
  };
}

/**
 * La boîte de réception : TOUTES les non lues, plus l'historique récent.
 *
 * L'ancien chargement prenait les 50 dernières lignes, lues ou non. Le badge,
 * lui, comptait toutes les non lues en base : il affichait « 99+ » pendant que
 * la page en montrait douze, et « tout marquer comme lu » ne touchait que ces
 * douze — le badge ne redescendait jamais. Les deux lisent maintenant le même
 * ensemble.
 */
export async function loadNotifications(
  userId: string,
  readLimit = 60,
): Promise<AppNotification[]> {
  const [unread, read] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .not("read_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(readLimit),
  ]);
  if (unread.error) throw unread.error;
  if (read.error) throw read.error;
  return [...(unread.data ?? []), ...(read.data ?? [])]
    .map((r) => notificationFromRow(r as NotificationRow))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Marque d'un coup une liste de notifications — une requête, pas N. */
export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}

/** Toutes les non lues du compte, y compris celles que la page n'a pas chargées. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

/**
 * Les clés de déduplication déjà émises par CE COMPTE, tous appareils
 * confondus. Le journal local (`tv.notif.coded`) ne voyait que l'appareil
 * courant : le téléphone et l'ordinateur envoyaient chacun leur exemplaire, et
 * une purge du stockage (déconnexion) relançait tout.
 */
export async function loadRecentDedupKeys(userId: string, days = 45): Promise<Set<string>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select("data")
    .eq("user_id", userId)
    .gte("created_at", since)
    .not("data->>dedupKey", "is", null)
    .limit(2000);
  if (error) throw error;
  const keys = new Set<string>();
  for (const r of data ?? []) {
    const k = (r.data as { dedupKey?: unknown } | null)?.dedupKey;
    if (typeof k === "string") keys.add(k);
  }
  return keys;
}

/**
 * L'entretien de la boîte — une fois par jour et par appareil :
 * archive les non lues expirées et les doublons (voir `planArchive`), purge
 * l'historique lu de plus de 90 jours.
 */
export async function maintainNotifications(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, created_at, read_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .limit(2000);
  if (error) throw error;
  const archive = planArchive(
    (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind as AppNotification["kind"],
      title: r.title,
      body: r.body,
      createdAt: r.created_at,
      readAt: r.read_at,
    })),
  );
  await markNotificationsRead(userId, archive);
  const before = new Date(Date.now() - PRUNE_READ_AFTER_DAYS * 86_400_000).toISOString();
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .not("read_at", "is", null)
    .lt("created_at", before);
  return archive.length;
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
