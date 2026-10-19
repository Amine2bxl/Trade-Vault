import { useEffect } from "react";
import { startLiveSync, stopLiveSync } from "../store/liveSync";
import { wireProfileRowLive } from "../store/profileRow";

/**
 * Ouvre le canal live du compte connecté, le ferme à la déconnexion.
 * Monté UNE fois, par le cadre de l'app (`shell/App.tsx`). Branche aussi les
 * caches partagés (ligne du profil) pour qu'ils suivent les autres appareils.
 */
export function useLiveSync(userId: string | undefined | null): void {
  useEffect(() => {
    if (!userId) return;
    const unwireProfile = wireProfileRowLive();
    startLiveSync(userId);
    return () => {
      stopLiveSync();
      unwireProfile();
    };
  }, [userId]);
}
