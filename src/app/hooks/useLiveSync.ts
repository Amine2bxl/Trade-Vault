import { useEffect } from "react";
import { startLiveSync, stopLiveSync } from "../store/liveSync";
import { invalidateProfileRow, wireProfileRowLive } from "../store/profileRow";
import { invalidateUserPrefs, wireUserPrefsLive } from "../utils/userPrefs";

/**
 * Ouvre le canal live du compte connecté, le ferme à la déconnexion.
 * Monté UNE fois, par le cadre de l'app (`shell/App.tsx`). Branche aussi les
 * caches partagés (ligne du profil, préférences du compte) pour qu'ils suivent
 * les autres appareils.
 */
export function useLiveSync(userId: string | undefined | null): void {
  useEffect(() => {
    if (!userId) return;
    // Nouvelle session (connexion, changement de compte dans l'onglet) : rien
    // de ce qui a été lu avant n'est servi sans être relu.
    invalidateProfileRow();
    invalidateUserPrefs();
    const unwireProfile = wireProfileRowLive();
    const unwirePrefs = wireUserPrefsLive();
    startLiveSync(userId);
    return () => {
      stopLiveSync();
      unwireProfile();
      unwirePrefs();
      invalidateProfileRow();
      invalidateUserPrefs();
    };
  }, [userId]);
}
