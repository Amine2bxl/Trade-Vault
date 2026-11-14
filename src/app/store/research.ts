import { supabase } from "@/integrations/supabase/client";
import type { EdgeDimension, ProtocolVerdict, ResearchProtocol } from "@/modules/research";

/**
 * RESEARCH NOTEBOOK — accès client (lot 2).
 *
 * Une note fige un protocole (`modules/research/notebook`) : la base refuse
 * toute réécriture de ses champs (`research_note_frozen`). Les évaluations
 * successives s'AJOUTENT (`research_note_results`). Tables absentes
 * (application déployée avant sa migration) : la lecture rend
 * « indisponible », rien n'est simulé.
 */

/* Les types générés ne connaissent pas encore ces tables (migration lot 2). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface StoredResult {
  verdict: ProtocolVerdict;
  holdoutN: number;
  holdoutSessions: number;
}

export interface ResearchNote {
  id: string;
  accountId: string | null;
  protocol: ResearchProtocol;
  archived: boolean;
  createdAt: string;
  /** Dernière évaluation enregistrée, `null` s'il n'y en a pas encore. */
  lastResult: StoredResult | null;
}

export interface ResearchNotesData {
  notes: ResearchNote[];
  available: boolean;
}

const DIMENSIONS: readonly EdgeDimension[] = [
  "strategy",
  "symbol",
  "session",
  "weekday",
  "account",
];

function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    !!e && (e.code === "PGRST205" || e.code === "42P01" || /does not exist/i.test(e.message ?? ""))
  );
}

export async function loadResearchNotes(userId: string): Promise<ResearchNotesData> {
  const [notesRes, resultsRes] = await Promise.all([
    db
      .from("research_notes")
      .select(
        "id, account_id, hypothesis, dimension, cell_key, holdout_start, method_version, seed, data_snapshot, archived, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("research_note_results")
      .select("note_id, result, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (isMissingTable(notesRes.error) || isMissingTable(resultsRes.error)) {
    return { notes: [], available: false };
  }
  if (notesRes.error) throw notesRes.error;
  if (resultsRes.error) throw resultsRes.error;
  const latest = new Map<string, StoredResult>();
  for (const r of (resultsRes.data ?? []) as { note_id: string; result: StoredResult }[]) {
    if (!latest.has(r.note_id)) latest.set(r.note_id, r.result);
  }
  const notes = ((notesRes.data ?? []) as Record<string, unknown>[])
    .filter((r) => DIMENSIONS.includes(r.dimension as EdgeDimension))
    .map((r) => ({
      id: String(r.id),
      accountId: (r.account_id as string | null) ?? null,
      archived: !!r.archived,
      createdAt: String(r.created_at),
      lastResult: latest.get(String(r.id)) ?? null,
      protocol: {
        hypothesis: String(r.hypothesis),
        dimension: r.dimension as EdgeDimension,
        cellKey: String(r.cell_key),
        holdoutStart: String(r.holdout_start),
        methodVersion: Number(r.method_version),
        seed: Number(r.seed),
        dataSnapshot: r.data_snapshot as ResearchProtocol["dataSnapshot"],
      },
    }));
  return { notes, available: true };
}

export async function createResearchNote(
  userId: string,
  accountId: string | null,
  protocol: ResearchProtocol,
): Promise<void> {
  const { error } = await db.from("research_notes").insert({
    user_id: userId,
    account_id: accountId,
    hypothesis: protocol.hypothesis,
    dimension: protocol.dimension,
    cell_key: protocol.cellKey,
    holdout_start: protocol.holdoutStart,
    method_version: protocol.methodVersion,
    seed: protocol.seed,
    data_snapshot: protocol.dataSnapshot,
  });
  if (error) throw error;
}

/** Ajoute une évaluation — jamais ne la réécrit. */
export async function appendResearchResult(
  userId: string,
  noteId: string,
  result: StoredResult,
): Promise<void> {
  const { error } = await db
    .from("research_note_results")
    .insert({ user_id: userId, note_id: noteId, result });
  if (error) throw error;
}

export async function archiveResearchNote(userId: string, id: string): Promise<void> {
  const { error } = await db
    .from("research_notes")
    .update({ archived: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
