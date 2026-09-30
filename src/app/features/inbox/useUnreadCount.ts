import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "tv:unread-count";

function readCached(): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    const n = Number(sessionStorage.getItem(CACHE_KEY));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function useUnreadCount(userId: string | undefined): number {
  // Le badge repart de la VALEUR MISE EN CACHE (sessionStorage), pas de zéro :
  // au F5 il apparaît dès la première frame avec la dernière valeur connue, au
  // lieu de surgir une seconde plus tard — le « chargement en deux temps » de
  // la navbar. Le refetch corrige ensuite silencieusement.
  const [count, setCount] = useState(readCached);
  const activeRef = useRef(true);

  const fetchCount = async () => {
    if (!userId || !activeRef.current) return;
    try {
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (!activeRef.current) return;
      const next = c ?? 0;
      setCount(next);
      try {
        sessionStorage.setItem(CACHE_KEY, String(next));
      } catch {
        /* quota / privé — le badge vit quand même en mémoire */
      }
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
