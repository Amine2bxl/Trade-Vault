/**
 * Une session Supabase est-elle (probablement) déjà là — lu SANS réseau.
 *
 * Supabase garde la session dans `localStorage` sous `sb-<projet>-auth-token`.
 * Un retour d'OAuth n'en a pas encore : il porte `?code=` (PKCE) ou
 * `#access_token=` dans l'adresse, et l'échange est en cours. Les deux veulent
 * dire « un trader arrive » : on attend l'auth au lieu de peindre la vitrine.
 * Stockage bloqué (navigation privée stricte) : `false`, jamais une exception.
 */
export function hasLikelySession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (/[?&#](code|access_token)=/.test(window.location.search + window.location.hash)) {
      return true;
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) return true;
    }
  } catch {
    /* stockage inaccessible */
  }
  return false;
}
