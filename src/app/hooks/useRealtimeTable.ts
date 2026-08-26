import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Abonnement live générique à une table scopée `user_id`.
 *
 * Sert aux écrans qui gardent leurs lignes dans un `useState` local : à chaque
 * changement venu d'un AUTRE appareil (ou d'un autre onglet), `onChange` est
 * appelé pour recharger. Les rafales sont regroupées (150 ms) — une
 * sauvegarde qui écrit plusieurs lignes ne déclenche qu'un rechargement.
 *
 * `onChange` peut changer à chaque rendu : il est lu via une ref, donc le
 * canal n'est jamais recréé inutilement.
 */
export function useRealtimeTable(
  table: string,
  userId: string | undefined | null,
  onChange: () => void,
): void {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`${table}:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => cb.current(), 150);
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [table, userId]);
}
