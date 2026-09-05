import { supabase } from "@/integrations/supabase/client";
import { generateId } from "@/domain";

/**
 * Mémoire persistante de Jarvis (table `ai_memory`) — ce qui fait la différence
 * entre un assistant qui redécouvre le trader à chaque session et un coach qui
 * se souvient de ce qu'il lui a dit.
 *
 * PRINCIPE DIRECTEUR : on ne mémorise QUE ce qui ne peut pas être recalculé.
 * Les règles vivent dans `profiles`, les objectifs dans `goal_plans`, les
 * habitudes sont recalculées depuis les trades à chaque appel. Les dupliquer
 * ici créerait deux sources de vérité qui divergeraient — et un souvenir
 * périmé est pire que pas de souvenir du tout.
 *
 * Catégories :
 *  - profile      : qui est le trader (niveau, marché, style) — upserté
 *  - fact         : observation durable non recalculable
 *  - lesson       : leçon émise par le coach et acceptée par le trader
 *  - decision     : ENGAGEMENT pris par le trader (le signal le plus fort)
 *  - preference   : goûts durables (setups, marchés)
 *  - conversation : contexte de repli, faible autorité
 */

export type MemoryKind = "profile" | "fact" | "lesson" | "conversation" | "preference" | "decision";

/** D'où vient ce que Jarvis croit savoir — conditionne la confiance accordée. */
export type MemorySource = "onboarding" | "rule_accepted" | "conversation" | "detector" | "unknown";

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  content: string;
  createdAt: string;
  /** Identité sémantique — deux souvenirs de même clé se remplacent. */
  key?: string | null;
  /** 1–5. Arbitre la sélection quand la récence ne suffit pas. */
  importance: number;
  /** 0–1. Sous le seuil, le souvenir n'atteint plus le LLM (sans être détruit). */
  confidence: number;
  source: MemorySource;
  /** Dernière CONFIRMATION — distincte de la naissance (`createdAt`). */
  updatedAt: string;
}

/**
 * Seuil d'autorité. En dessous, un souvenir est une croyance contestée : il
 * reste en base — pour que Jarvis puisse un jour dire « je croyais X, tes
 * données montrent le contraire » — mais il ne pèse plus sur ses réponses.
 */
export const MIN_CONFIDENCE_TO_USE = 0.3;

const SELECT_COLS =
  "id, kind, content, created_at, key, importance, confidence, source, updated_at";

interface MemoryRow {
  id: string;
  kind: string;
  content: string;
  created_at: string;
  key: string | null;
  importance: number | null;
  confidence: number | null;
  source: string | null;
  updated_at: string | null;
}

function toEntry(r: MemoryRow): MemoryEntry {
  return {
    id: r.id,
    kind: r.kind as MemoryKind,
    content: r.content,
    createdAt: r.created_at,
    key: r.key,
    // Replis alignés sur les défauts SQL : une ligne écrite avant la migration
    // reste exploitable sans avoir à réécrire les données.
    importance: r.importance ?? 3,
    confidence: r.confidence ?? 0.6,
    source: (r.source as MemorySource) ?? "unknown",
    updatedAt: r.updated_at ?? r.created_at,
  };
}

export async function loadMemory(
  userId: string,
  kinds: MemoryKind[] = ["profile", "fact", "lesson", "decision", "preference"],
  limit = 40,
): Promise<MemoryEntry[]> {
  const { data, error } = await supabase
    .from("ai_memory")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .in("kind", kinds)
    // Les croyances contestées ne remontent pas : c'est ce filtre qui garantit
    // qu'un souvenir devenu faux n'atteint jamais le LLM.
    .gte("confidence", MIN_CONFIDENCE_TO_USE)
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as MemoryRow[]).map(toEntry);
}

export interface RememberOptions {
  /**
   * Identité sémantique. À FOURNIR dès que le souvenir peut être réappris :
   * sans clé, réapprendre le même fait crée un doublon. L'unicité est portée
   * par un index en base, pas seulement par ce code.
   */
  key?: string;
  importance?: number;
  confidence?: number;
  source?: MemorySource;
}

/**
 * Enregistre — ou MET À JOUR — un souvenir.
 *
 * Avec une `key`, l'écriture est un upsert sur `(user_id, kind, key)` :
 * réapprendre le même fait rafraîchit son contenu et son `updated_at` au lieu
 * d'empiler une ligne. Sans clé, insertion simple (compatibilité avec les
 * appels historiques).
 */
export async function remember(
  userId: string,
  kind: MemoryKind,
  content: string,
  opts: RememberOptions = {},
): Promise<void> {
  const row = {
    user_id: userId,
    kind,
    content,
    key: opts.key ?? null,
    importance: opts.importance ?? 3,
    confidence: opts.confidence ?? 0.6,
    source: opts.source ?? "unknown",
  };

  if (opts.key) {
    const { error } = await supabase
      .from("ai_memory")
      .upsert({ id: generateId(), ...row }, { onConflict: "user_id,kind,key" });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("ai_memory").insert({ id: generateId(), ...row });
  if (error) throw error;
}

/**
 * Ajuste la confiance d'un souvenir — le mécanisme d'AUTO-CORRECTION.
 *
 * Une confirmation par les données monte la confiance, une contradiction la
 * baisse. Ce chemin ne supprime jamais : passer sous le seuil rend le souvenir
 * inaudible, ce qui suffit, et conserve la trace de ce que Jarvis a cru —
 * matière première de la remise en question (PR-3).
 */
export async function adjustConfidence(userId: string, id: string, delta: number): Promise<void> {
  // ATOMIQUE — l'ajustement se fait EN BASE, dans une seule instruction.
  //
  // La version précédente lisait `confidence`, calculait la nouvelle valeur en
  // JavaScript, puis l'écrivait. Deux ajustements concurrents (le détecteur de
  // patterns et une conversation, typiquement) lisaient la même valeur de
  // départ et le second écrasait le premier : une CONTRADICTION pouvait ainsi
  // être effacée par une confirmation arrivée en même temps, et Jarvis
  // continuait de s'appuyer sur un souvenir que les données démentaient. C'est
  // exactement le mécanisme d'auto-correction que ce chemin existe pour servir.
  const { error } = await supabase.rpc("adjust_memory_confidence", {
    p_id: id,
    p_delta: delta,
  });
  if (!error) return;

  // Repli tant que la migration n'est pas appliquée. Il garde la course qu'il a
  // toujours eue — mais il est nommé, borné dans le temps, et il journalise.
  console.warn("[memory] adjust_memory_confidence unavailable, falling back", error);
  const { data, error: readError } = await supabase
    .from("ai_memory")
    .select("confidence")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!data) return;
  const current = (data as { confidence: number | null }).confidence ?? 0.6;
  const next = Math.max(0, Math.min(1, current + delta));
  const { error: upErr } = await supabase
    .from("ai_memory")
    .update({ confidence: next })
    .eq("id", id)
    .eq("user_id", userId);
  if (upErr) throw upErr;
}

export async function forget(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("ai_memory").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
