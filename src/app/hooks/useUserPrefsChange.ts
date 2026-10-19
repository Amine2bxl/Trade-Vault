import { useEffect, useRef } from "react";
import { USER_PREFS_EVENT } from "../utils/userPrefs";

/**
 * Appelle `onChange` quand les préférences du compte arrivent d'ailleurs
 * (autre appareil, rattrapage après coupure). L'écran relit alors sa clé avec
 * `loadUserPref` : le cache a déjà protégé ce qui attend encore son envoi.
 */
export function useUserPrefsChange(userId: string | undefined | null, onChange: () => void): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!userId) return;
    const on = (e: Event) => {
      if ((e as CustomEvent<{ userId?: string }>).detail?.userId === userId) cb.current();
    };
    window.addEventListener(USER_PREFS_EVENT, on);
    return () => window.removeEventListener(USER_PREFS_EVENT, on);
  }, [userId]);
}
