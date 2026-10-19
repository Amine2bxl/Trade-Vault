import { useEffect } from "react";
import { onTable } from "../store/liveSync";

/**
 * Les changements de la ligne `profiles` du compte connecté, en direct :
 * une langue (ou tout autre réglage serveur) changée sur le téléphone se
 * reflète sur l'ordinateur sans rafraîchir.
 *
 * Passe par le moyeu unique (`store/liveSync.ts`). Sans Realtime, rien
 * n'arrive et rien ne casse. Les écritures locales reviennent en écho avec la
 * même valeur : pas de boucle.
 *
 * `onChange` doit être stable (useCallback) — il est réabonné quand il change.
 */
export function useRealtimeProfile(
  userId: string | undefined | null,
  onChange: (row: Record<string, unknown>) => void,
): void {
  useEffect(() => {
    if (!userId) return;
    return onTable("profiles", (c) => {
      if (c.eventType !== "UPDATE" || !c.new || c.new.id !== userId) return;
      onChange(c.new);
    });
  }, [userId, onChange]);
}
