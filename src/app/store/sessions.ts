import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getActiveAccountId } from "./accounts";
import { computeReadiness, isEmotionalState, type EmotionalState } from "../utils/readiness";
import { todayLocalDate } from "../utils/sessionDate";

export { todayLocalDate };

/**
 * Séances de trading — la couche de persistance.
 *
 * Une séance est UNE journée sur UN compte : préparation le matin, trades
 * pendant, revue le soir. La contrainte d'unicité `(user, compte, date)` en
 * base est ce qui rend le rattachement des trades déterministe ; ce module ne
 * fait que la respecter.
 *
 * RÈGLE QUI GOUVERNE TOUT LE FICHIER : rien ici ne doit jamais empêcher
 * d'enregistrer un trade. Une séance absente, une écriture refusée, une table
 * pas encore migrée — le journal continue de fonctionner. D'où les retours
 * `null` plutôt que des exceptions sur les chemins d'attachement.
 */

export interface TradingSession {
  id: string;
  accountId: string | null;
  /** `YYYY-MM-DD`, dans le fuseau du trader (voir `todayLocalDate`). */
  sessionDate: string;
  startedAt: string;
  endedAt: string | null;
  emotionalState: EmotionalState | null;
  /** DÉRIVÉ. Voir `utils/readiness.ts` — jamais saisi par l'utilisateur. */
  readinessScore: number | null;
  readinessInputs: Record<string, unknown>;
  checklistSnapshot: Record<string, unknown>;
  marketContext: string | null;
  dailyObjective: string | null;
  activeRules: unknown[];
  disciplineScore: number | null;
  reviewNote: string | null;
}

interface SessionRow {
  id: string;
  account_id: string | null;
  session_date: string;
  started_at: string;
  ended_at: string | null;
  emotional_state: string | null;
  readiness_score: number | null;
  readiness_inputs: Record<string, unknown> | null;
  checklist_snapshot: Record<string, unknown> | null;
  market_context: string | null;
  daily_objective: string | null;
  active_rules: unknown[] | null;
  discipline_score: number | null;
  review_note: string | null;
}

function fromRow(r: SessionRow): TradingSession {
  return {
    id: r.id,
    accountId: r.account_id,
    sessionDate: r.session_date,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    emotionalState: isEmotionalState(r.emotional_state) ? r.emotional_state : null,
    readinessScore: r.readiness_score,
    readinessInputs: r.readiness_inputs ?? {},
    checklistSnapshot: r.checklist_snapshot ?? {},
    marketContext: r.market_context,
    dailyObjective: r.daily_objective,
    activeRules: r.active_rules ?? [],
    disciplineScore: r.discipline_score,
    reviewNote: r.review_note,
  };
}

/** La séance du jour pour le compte actif, ou `null` si elle n'existe pas. */
export async function loadTodaySession(
  userId: string,
  date: string = todayLocalDate(),
): Promise<TradingSession | null> {
  const accountId = getActiveAccountId();
  let q = supabase
    .from("trading_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("session_date", date);
  q = accountId ? q.eq("account_id", accountId) : q.is("account_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error("loadTodaySession failed", error);
    return null;
  }
  return data ? fromRow(data as SessionRow) : null;
}

/** Les dernières séances du compte actif, la plus récente d'abord. */
export async function loadSessions(userId: string, limit = 60): Promise<TradingSession[]> {
  const accountId = getActiveAccountId();
  let q = supabase.from("trading_sessions").select("*").eq("user_id", userId);
  q = accountId ? q.eq("account_id", accountId) : q.is("account_id", null);
  const { data, error } = await q.order("session_date", { ascending: false }).limit(limit);
  if (error) {
    console.error("loadSessions failed", error);
    return [];
  }
  return (data as SessionRow[]).map(fromRow);
}

export interface OpenSessionInput {
  checklistDone: number;
  checklistTotal: number;
  emotionalState: EmotionalState | null;
  activeRules: unknown[];
  checklistSnapshot: Record<string, unknown>;
  marketContext?: string | null;
  dailyObjective?: string | null;
}

/**
 * Ouvre la séance du jour, ou met à jour celle qui existe déjà.
 *
 * LECTURE PUIS ÉCRITURE, PAS `upsert`. L'unicité est portée en base par un
 * index d'EXPRESSION (`coalesce(account_id, …)`) et non par une contrainte sur
 * trois colonnes, parce qu'en SQL deux NULL ne sont pas égaux et qu'un compte
 * nul aurait autorisé plusieurs séances le même jour. PostgREST ne sait pas
 * viser un index d'expression avec `on_conflict`, donc on lit d'abord.
 *
 * La course reste couverte : si un second onglet insère entre-temps, l'index
 * rejette l'insertion (23505) et on repasse en mise à jour. C'est le cas rare,
 * traité, plutôt que le cas rare, ignoré.
 *
 * Le score de préparation est CALCULÉ ici à partir des entrées, jamais reçu de
 * l'appelant : aucune interface ne pourra le faire saisir.
 */
export async function openSession(
  userId: string,
  input: OpenSessionInput,
  date: string = todayLocalDate(),
  // Garde-fou de récursion : une seule reprise après conflit. Sans elle, une
  // base qui rejette ET ne rend pas la ligne relue ferait boucler l'appel.
  retryOnConflict = true,
): Promise<TradingSession | null> {
  const readiness = computeReadiness({
    checklistDone: input.checklistDone,
    checklistTotal: input.checklistTotal,
    emotionalState: input.emotionalState,
    activeRuleCount: input.activeRules.length,
  });

  // Les trois champs `jsonb` sont typés `Json` par le schéma généré — un type
  // récursif que TypeScript ne peut pas déduire d'une interface applicative.
  // La conversion est explicite et LOCALE plutôt qu'un `as any` sur tout le
  // payload : ce qui traverse reste nommé, et les autres champs restent
  // vérifiés colonne par colonne.
  const payload = {
    emotional_state: input.emotionalState,
    readiness_score: readiness.score,
    readiness_inputs: readiness.inputs as unknown as Json,
    checklist_snapshot: input.checklistSnapshot as unknown as Json,
    active_rules: input.activeRules as unknown as Json,
    market_context: input.marketContext ?? null,
    daily_objective: input.dailyObjective ?? null,
    updated_at: new Date().toISOString(),
  };

  const existing = await loadTodaySession(userId, date);
  if (existing) {
    const { data, error } = await supabase
      .from("trading_sessions")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) {
      console.error("openSession update failed", error);
      return null;
    }
    return data ? fromRow(data as SessionRow) : null;
  }

  const { data, error } = await supabase
    .from("trading_sessions")
    .insert({
      user_id: userId,
      account_id: getActiveAccountId(),
      session_date: date,
      ...payload,
    })
    .select()
    .maybeSingle();

  if (error) {
    // 23505 : un autre onglet a inséré la même séance entre la lecture et
    // l'écriture. On relit et on met à jour, plutôt que de rendre une erreur
    // que l'utilisateur ne peut pas interpréter.
    if (error.code === "23505" && retryOnConflict) {
      return openSession(userId, input, date, false);
    }
    console.error("openSession insert failed", error);
    return null;
  }
  return data ? fromRow(data as SessionRow) : null;
}

/** Clôture la séance : horodatage de fin, note de revue, score de discipline. */
export async function closeSession(
  sessionId: string,
  review: { reviewNote?: string | null; disciplineScore?: number | null } = {},
): Promise<boolean> {
  const { error } = await supabase
    .from("trading_sessions")
    .update({
      ended_at: new Date().toISOString(),
      review_note: review.reviewNote ?? null,
      discipline_score: review.disciplineScore ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) {
    console.error("closeSession failed", error);
    return false;
  }
  return true;
}

/**
 * Rattache un trade à la séance de sa journée, au mieux.
 *
 * « Au mieux » est le contrat : s'il n'y a pas de séance ce jour-là, ou si
 * l'écriture échoue, le trade reste tel quel et la fonction rend `false`.
 * Aucun appelant ne doit traiter cet échec comme une erreur — un trade sans
 * séance est un trade parfaitement valide, et c'est la raison pour laquelle
 * `trades.session_id` est nullable.
 */
export async function attachTradeToSession(
  userId: string,
  tradeId: string,
  tradeDate: string,
): Promise<boolean> {
  try {
    const session = await loadTodaySession(userId, tradeDate);
    if (!session) return false;
    const { error } = await supabase
      .from("trades")
      .update({ session_id: session.id })
      .eq("id", tradeId)
      .eq("user_id", userId);
    if (error) {
      console.error("attachTradeToSession failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("attachTradeToSession threw", e);
    return false;
  }
}
