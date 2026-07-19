import { supabase } from "@/integrations/supabase/client";
import { generateId } from "@/app/store";

/**
 * Persistent AI memory (ai_memory table) — what makes the coach KNOW the
 * trader instead of rediscovering them every conversation.
 *
 * kinds:
 *  - profile : who the trader is (level, market, style, schedule)
 *  - fact    : durable observations ("oversizes after 2 losses")
 *  - lesson  : lessons the AI issued and the trader accepted
 *  - conversation : rolling chat history (windowed)
 */

export type MemoryKind = "profile" | "fact" | "lesson" | "conversation";

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  content: string;
  createdAt: string;
}

export async function loadMemory(
  userId: string,
  kinds: MemoryKind[] = ["profile", "fact", "lesson"],
  limit = 40,
): Promise<MemoryEntry[]> {
  const { data, error } = await supabase
    .from("ai_memory")
    .select("id, kind, content, created_at")
    .eq("user_id", userId)
    .in("kind", kinds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as MemoryKind,
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function remember(userId: string, kind: MemoryKind, content: string): Promise<void> {
  const { error } = await supabase.from("ai_memory").insert({
    id: generateId(),
    user_id: userId,
    kind,
    content,
  });
  if (error) throw error;
}

export async function forget(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("ai_memory").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
