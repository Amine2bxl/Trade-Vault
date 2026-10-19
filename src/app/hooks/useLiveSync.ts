import { useEffect } from "react";
import { startLiveSync, stopLiveSync } from "../store/liveSync";
import { wireProfileRowLive } from "../store/profileRow";
import { wireUserPrefsLive } from "../utils/userPrefs";

/**
 * Ouvre le canal live du compte connecté, le ferme à la déconnexion.
 * Monté UNE fois, par le cadre de l'app (`shell/App.tsx`). Branche aussi les
 * caches partagés (ligne du profil, préférences du compte) pour qu'ils suivent
 * les autres appareils.
 */
export function useLiveSync(userId: string | undefined | null): void {
  useEffect(() => {
    if (!userId) return;
    const unwireProfile = wireProfileRowLive();
    const unwirePrefs = wireUserPrefsLive();
    startLiveSync(userId);
    return () => {
      stopLiveSync();
      unwireProfile();
      unwirePrefs();
    };
  }, [userId]);
}
