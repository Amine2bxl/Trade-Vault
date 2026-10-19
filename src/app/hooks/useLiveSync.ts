import { useEffect } from "react";
import { startLiveSync, stopLiveSync } from "../store/liveSync";

/**
 * Ouvre le canal live du compte connecté, le ferme à la déconnexion.
 * Monté UNE fois, par le cadre de l'app (`shell/App.tsx`).
 */
export function useLiveSync(userId: string | undefined | null): void {
  useEffect(() => {
    if (!userId) return;
    startLiveSync(userId);
    return () => stopLiveSync();
  }, [userId]);
}
