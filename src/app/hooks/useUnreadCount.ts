import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .then(({ count: c }) => {
        if (active) setCount(c ?? 0);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [userId]);

  return count;
}
