import { supabase } from "@/integrations/supabase/client";

/**
 * LES PRÉFÉRENCES DU COMPTE — durables, suivies d'un appareil à l'autre.
 *
 * `localStorage` ne suffit pas pour un réglage que le trader s'attend à
 * retrouver : il ne suit pas d'un appareil à l'autre, et la déconnexion le
 * PURGE volontairement (`session-purge.ts` : rien ne doit rester sur un poste
 * partagé). Le calculateur de lots perdait ainsi son marché, sa paire et son
 * stop à chaque déconnexion.
 *
 * La table `user_preferences` (une ligne par compte, `prefs jsonb`, RLS « le
 * sien uniquement ») existait sans être utilisée. Chaque réglage y vit sous
 * sa clé ; les écritures sont regroupées (une par demi-seconde et par compte)
 * et fusionnées dans l'objet courant, pour que deux réglages modifiés coup
 * sur coup ne s'écrasent pas.
 */

type Prefs = Record<string, unknown>;

const loaded = new Map<string, Promise<Prefs>>();
const current = new Map<string, Prefs>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Toutes les préférences du compte — lues une fois par session. */
export function loadUserPrefs(userId: string): Promise<Prefs> {
  let p = loaded.get(userId);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("prefs")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const prefs = (data?.prefs ?? {}) as Prefs;
      current.set(userId, { ...prefs, ...(current.get(userId) ?? {}) });
      return current.get(userId)!;
    })();
    // Un échec de lecture ne doit pas être mémorisé : on retentera.
    p.catch(() => loaded.delete(userId));
    loaded.set(userId, p);
  }
  return p;
}

export async function loadUserPref<T>(userId: string, key: string): Promise<T | undefined> {
  const prefs = await loadUserPrefs(userId);
  return prefs[key] as T | undefined;
}

/** Enregistre une préférence (fusionnée, écriture regroupée). */
export function saveUserPref(userId: string, key: string, value: unknown): void {
  current.set(userId, { ...(current.get(userId) ?? {}), [key]: value });
  const pending = timers.get(userId);
  if (pending) clearTimeout(pending);
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      void (async () => {
        // On part de la ligne en base pour ne pas effacer une clé écrite par
        // un autre appareil depuis notre lecture.
        const base = await loadUserPrefs(userId).catch(() => ({}) as Prefs);
        const prefs = { ...base, ...(current.get(userId) ?? {}) };
        current.set(userId, prefs);
        await supabase
          .from("user_preferences")
          .upsert(
            { user_id: userId, prefs: prefs as never, updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          )
          .then(({ error }) => {
            if (error) console.error("[prefs] save failed", error);
          });
      })();
    }, 500),
  );
}
