import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to live changes on the signed-in user's `profiles` row so
 * server-backed preferences (language, balances, confluences…) propagate
 * across their devices in real time: change a setting on the phone and the
 * laptop reflects it without a refresh.
 *
 * Safe by design — if Realtime isn't enabled for the `profiles` table the
 * channel simply never emits; there's no error and nothing breaks. Local
 * writes echo back as no-op UPDATEs (same value in, same value out), so there's
 * no feedback loop.
 *
 * `onChange` should be stable (wrap in useCallback) — it's re-subscribed when
 * it or the user changes.
 */
export function useRealtimeProfile(
  userId: string | undefined | null,
  onChange: (row: Record<string, unknown>) => void,
): void {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            onChange(payload.new as Record<string, unknown>);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onChange]);
}
