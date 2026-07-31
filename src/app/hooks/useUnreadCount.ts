import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);
  const activeRef = useRef(true);

  const fetchCount = async () => {
    if (!userId || !activeRef.current) return;
    try {
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (activeRef.current) setCount(c ?? 0);
    } catch {
      /* silent — Supabase not available */
    }
  };

  useEffect(() => {
    if (!userId) return;
    activeRef.current = true;
    fetchCount();

    // Poll every 30s
    const interval = setInterval(fetchCount, 30_000);

    // Listen for manual refresh events (from Inbox mark-all-read)
    const handler = () => fetchCount();
    window.addEventListener("tv:notif-updated", handler);

    return () => {
      activeRef.current = false;
      clearInterval(interval);
      window.removeEventListener("tv:notif-updated", handler);
    };
  }, [userId]);

  return count;
}
