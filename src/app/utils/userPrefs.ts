import { supabase } from "@/integrations/supabase/client";
import { onResync, onTable } from "../store/liveSync";

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
 *
 * EN DIRECT : la ligne est publiée pour Realtime ; un réglage changé sur un
 * autre appareil remplace le cache (`wireUserPrefsLive`) et prévient les
 * écrans (`USER_PREFS_EVENT`).
 */

type Prefs = Record<string, unknown>;

/** Diffusé quand les préférences d'un compte arrivent d'ailleurs (autre
 *  appareil, rattrapage) : `detail = { userId }`. Les écrans relisent alors
 *  leur clé avec `loadUserPref`. */
export const USER_PREFS_EVENT = "tv:user-prefs";

const loaded = new Map<string, Promise<void>>();
const current = new Map<string, Prefs>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/**
 * Les clés modifiées SUR CET APPAREIL et pas encore confirmées par la base,
 * avec un numéro de version. Tant qu'une clé y figure, la valeur locale
 * l'emporte sur ce qui arrive : l'écho d'un envoi plus ancien ne doit pas
 * effacer ce que le trader vient de régler.
 */
const dirty = new Map<string, Map<string, number>>();

function dirtyOnly(userId: string): Prefs {
  const keys = dirty.get(userId);
  const local = current.get(userId) ?? {};
  const out: Prefs = {};
  if (keys) for (const k of keys.keys()) if (k in local) out[k] = local[k];
  return out;
}

function notify(userId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(USER_PREFS_EVENT, { detail: { userId } }));
}

/** Toutes les préférences du compte — lues une fois, puis tenues à jour en direct. */
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
      current.set(userId, { ...prefs, ...dirtyOnly(userId) });
    })();
    // Un échec de lecture ne doit pas être mémorisé : on retentera.
    p.catch(() => loaded.delete(userId));
    loaded.set(userId, p);
  }
  return p.then(() => current.get(userId) ?? {});
}

export async function loadUserPref<T>(userId: string, key: string): Promise<T | undefined> {
  const prefs = await loadUserPrefs(userId);
  return prefs[key] as T | undefined;
}

/** Enregistre une préférence (fusionnée, écriture regroupée). */
export function saveUserPref(userId: string, key: string, value: unknown): void {
  current.set(userId, { ...(current.get(userId) ?? {}), [key]: value });
  let keys = dirty.get(userId);
  if (!keys) {
    keys = new Map();
    dirty.set(userId, keys);
  }
  keys.set(key, (keys.get(key) ?? 0) + 1);
  scheduleFlush(userId);
}

/**
 * Envoie (regroupé, 500 ms) ce qui attend pour ce compte. Les clés ne sont
 * libérées qu'après un envoi RÉUSSI : un échec (hors réseau) les garde en
 * attente, protégées de ce qui arrive, et le rattrapage les renvoie.
 */
function scheduleFlush(userId: string): void {
  const pending = timers.get(userId);
  if (pending) clearTimeout(pending);
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      // Les versions envoyées : une clé re-modifiée pendant l'envoi reste protégée.
      const sent = new Map(dirty.get(userId) ?? []);
      void (async () => {
        // On part de la ligne en base pour ne pas effacer une clé écrite par
        // un autre appareil depuis notre lecture.
        const base = await loadUserPrefs(userId).catch(() => ({}) as Prefs);
        const prefs = { ...base, ...(current.get(userId) ?? {}) };
        current.set(userId, prefs);
        const { error } = await supabase
          .from("user_preferences")
          .upsert(
            { user_id: userId, prefs: prefs as never, updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          )
          .then(
            (r: { error: unknown }) => r,
            (e: unknown) => ({ error: e }),
          );
        if (error) {
          console.error("[prefs] save failed", error);
          return;
        }
        const keys = dirty.get(userId);
        if (!keys) return;
        for (const [k, v] of sent) if (keys.get(k) === v) keys.delete(k);
        if (keys.size === 0) dirty.delete(userId);
      })();
    }, 500),
  );
}

/** Les préférences arrivées d'ailleurs remplacent le cache — hors clés en attente d'envoi. */
export function replaceUserPrefs(userId: string, prefs: Prefs): void {
  current.set(userId, { ...prefs, ...dirtyOnly(userId) });
  if (!loaded.has(userId)) loaded.set(userId, Promise.resolve());
  notify(userId);
}

/** Oublie ce qui a été lu (sauf les clés en attente d'envoi) : la prochaine lecture repart de la base. */
export function invalidateUserPrefs(userId?: string): void {
  const users = userId ? [userId] : [...new Set([...loaded.keys(), ...current.keys()])];
  for (const uid of users) {
    loaded.delete(uid);
    current.set(uid, dirtyOnly(uid));
  }
}

/** Branche le cache sur le moyeu live (appelé par `useLiveSync`). */
export function wireUserPrefsLive(): () => void {
  const offTable = onTable("user_preferences", (c) => {
    const row = c.new;
    if (!row || typeof row.user_id !== "string") return;
    replaceUserPrefs(row.user_id, (row.prefs ?? {}) as Prefs);
  });
  const offResync = onResync(() => {
    const users = [...loaded.keys()];
    invalidateUserPrefs();
    for (const uid of users) notify(uid);
    // Ce qui n'était jamais parti (envoi échoué hors réseau) repart maintenant.
    for (const uid of dirty.keys()) scheduleFlush(uid);
  });
  return () => {
    offTable();
    offResync();
  };
}
