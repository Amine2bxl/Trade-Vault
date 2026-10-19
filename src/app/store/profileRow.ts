import { supabase } from "@/integrations/supabase/client";
import { onResync, onTable } from "./liveSync";

/**
 * LA LIGNE `profiles` DU COMPTE — lue une fois, tenue à jour en direct.
 *
 * Une vingtaine d'écrans lisent chacun leur morceau du profil : règles, plan
 * de trading, devise, soldes, config de checklist, profil Jarvis… Chacun
 * faisait son propre `select`, et aucun ne voyait un changement fait sur un
 * autre appareil. Ici, la ligne est lue UNE fois (`select("*")`), tous les
 * lecteurs en dérivent, et le moyeu live la remplace quand Realtime en apporte
 * une nouvelle (`payload.new` est complet grâce à `replica identity full`).
 * Un changement distant ne coûte donc aucune requête : les écrans relisent le
 * cache.
 *
 * L'ÉCHO. Une écriture locale revient par Realtime. Si le trader a continué à
 * taper entre-temps, l'écho d'une sauvegarde PLUS ANCIENNE ne doit pas
 * effacer ce qu'il vient d'écrire. Chaque écriture marque donc ses colonnes
 * « en attente » (`beginProfileWrite`) jusqu'à sa fin : tant qu'elles le
 * sont, la valeur locale l'emporte sur ce qui arrive.
 */

export type ProfileRow = Record<string, unknown>;

/** Diffusé après un changement de l'objectif mensuel : le copilote du tableau
 *  de bord se met à jour sans recharger la page. */
export const MONTHLY_TARGET_EVENT = "tv:monthly-target";

const rows = new Map<string, ProfileRow | null>();
const inflight = new Map<string, Promise<ProfileRow | null>>();
/** Colonnes en cours d'écriture, par compte : nombre d'écritures, dernière valeur. */
const pending = new Map<string, Map<string, { count: number; value: unknown }>>();
/** Incrémenté à chaque invalidation : une lecture lancée avant ne s'installe pas. */
let generation = 0;

function overlay(userId: string, row: ProfileRow | null): ProfileRow | null {
  const cols = pending.get(userId);
  if (!cols || cols.size === 0) return row;
  const out: ProfileRow = { ...(row ?? { id: userId }) };
  for (const [col, p] of cols) out[col] = p.value;
  return out;
}

/** La ligne du compte (ou `null` s'il n'en a pas). Rejette si la lecture échoue — sans mémoriser l'échec. */
export function loadProfileRow(userId: string): Promise<ProfileRow | null> {
  if (rows.has(userId)) return Promise.resolve(overlay(userId, rows.get(userId) ?? null));
  let p = inflight.get(userId);
  if (!p) {
    const gen = generation;
    p = (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      // Une ligne arrivée par Realtime pendant la lecture est plus récente.
      if (gen === generation && !rows.has(userId)) {
        rows.set(userId, (data as ProfileRow | null) ?? null);
      }
      return (data as ProfileRow | null) ?? null;
    })();
    inflight.set(userId, p);
    p.then(
      () => inflight.delete(userId),
      () => inflight.delete(userId),
    );
  }
  return p.then((data) => overlay(userId, rows.has(userId) ? (rows.get(userId) ?? null) : data));
}

/**
 * Une écriture locale commence : ses colonnes sont appliquées au cache tout
 * de suite et protégées de l'écho jusqu'à `settle()`.
 */
export function beginProfileWrite(userId: string, patch: ProfileRow): () => void {
  let cols = pending.get(userId);
  if (!cols) {
    cols = new Map();
    pending.set(userId, cols);
  }
  for (const [col, value] of Object.entries(patch)) {
    const prev = cols.get(col);
    cols.set(col, { count: (prev?.count ?? 0) + 1, value });
  }
  const cached = rows.get(userId);
  if (cached) rows.set(userId, { ...cached, ...patch });

  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    const current = pending.get(userId);
    if (!current) return;
    for (const col of Object.keys(patch)) {
      const p = current.get(col);
      if (!p) continue;
      if (p.count <= 1) current.delete(col);
      else current.set(col, { ...p, count: p.count - 1 });
    }
    if (current.size === 0) pending.delete(userId);
  };
}

/** Remplace la ligne en cache par une version arrivée d'ailleurs. */
export function replaceProfileRow(userId: string, row: ProfileRow): void {
  rows.set(userId, overlay(userId, row));
}

/** Oublie la ligne d'un compte (ou de tous) : la prochaine lecture repart de la base. */
export function invalidateProfileRow(userId?: string): void {
  generation += 1;
  if (userId) {
    rows.delete(userId);
    inflight.delete(userId);
  } else {
    rows.clear();
    inflight.clear();
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Branche le cache sur le moyeu live. Les bus d'événements EXISTANTS sont
 * réutilisés plutôt que doublés : `tv-rules-updated` (vérificateur de règles,
 * Jarvis) et `MONTHLY_TARGET_EVENT` (copilote du tableau de bord).
 */
export function wireProfileRowLive(): () => void {
  const offTable = onTable("profiles", (c) => {
    const next = c.new;
    if (!next || typeof next.id !== "string") return;
    const userId = next.id;
    const before = rows.get(userId) ?? null;
    replaceProfileRow(userId, next);
    const after = rows.get(userId) ?? null;
    if (typeof window === "undefined" || !before) return;
    if (!sameJson(before.trading_rules, after?.trading_rules)) {
      const raw = after?.trading_rules;
      window.dispatchEvent(
        new CustomEvent("tv-rules-updated", { detail: Array.isArray(raw) ? raw : [] }),
      );
    }
    if (!sameJson(before.onboarding_monthly_target, after?.onboarding_monthly_target)) {
      const v = after?.onboarding_monthly_target;
      window.dispatchEvent(
        new CustomEvent(MONTHLY_TARGET_EVENT, { detail: v == null ? null : Number(v) }),
      );
    }
  });
  const offResync = onResync(() => invalidateProfileRow());
  return () => {
    offTable();
    offResync();
  };
}

/**
 * Écrit des colonnes du profil : cache mis à jour tout de suite, colonnes
 * protégées de l'écho le temps de l'écriture. Un échec relit la ligne au
 * prochain accès (le cache ne garde pas une valeur que la base a refusée).
 */
export async function updateProfile(userId: string, patch: ProfileRow): Promise<void> {
  const settle = beginProfileWrite(userId, patch);
  try {
    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", userId);
    if (error) throw error;
  } catch (e) {
    invalidateProfileRow(userId);
    throw e;
  } finally {
    settle();
  }
}
