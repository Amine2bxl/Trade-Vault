import { supabase } from "@/integrations/supabase/client";
import type { AppNotification } from "./types";

/**
 * Persistence adapter for the notifications table (see migration
 * 20260718*_engines_foundation.sql). Injected into the engine at app
 * bootstrap — the engine itself never imports supabase.
 */

export async function persistNotification(n: AppNotification): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
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
  });
  if (error) throw error;
}

export async function loadNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    kind: r.kind as AppNotification["kind"],
    title: r.title,
    body: r.body,
    url: r.url ?? undefined,
    severity: r.severity as AppNotification["severity"],
    channels: ["dashboard"],
    createdAt: r.created_at,
    readAt: r.read_at,
    data: (r.data ?? undefined) as AppNotification["data"],
  }));
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
