import { supabase } from "@/integrations/supabase/client";

/**
 * LA PREUVE D'UN IMPORT — lot et lignes brutes (lot 1).
 *
 * Ordre « brut d'abord » : chaque ligne du fichier est enregistrée telle que
 * reçue (`raw_ingest_events`, insert-only) AVANT que le moindre trade soit
 * écrit. C'est la base, pas le navigateur, qui décide qu'une ligne est un
 * CONFLIT (même identifiant source, autre contenu) : une ligne mise en
 * quarantaine ne devient pas un trade.
 *
 * Best-effort sur la preuve, jamais sur la donnée : si les tables n'existent
 * pas encore (application déployée avant sa migration) ou si l'écriture de la
 * preuve échoue, l'import continue — la clé d'import du trade garantit déjà
 * l'idempotence — et le défaut est journalisé, pas maquillé.
 */

/* Les types générés ne connaissent pas encore ces tables (migration lot 1). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type RawRowStatus =
  | "accepted"
  | "duplicate"
  | "probable_duplicate"
  | "in_file_conflict"
  | "rejected";

export interface RawRowRecord {
  /** Clé d'import de la ligne (non qualifiée par le compte). */
  key: string;
  /** Empreinte du contenu (ou de la ligne brute pour une ligne refusée). */
  sha256: string;
  status: RawRowStatus;
  /** La ligne telle que lue : en-tête → cellule. */
  raw: Record<string, string>;
  /** Le trade qui sera créé, pour une ligne acceptée. */
  tradeId?: string;
  diagnostic?: string;
}

export interface ImportMeta {
  fileName: string;
  fileSha256: string;
  rowCount: number;
}

const CELL_MAX = 1000;
const RAW_CHUNK = 100;

/** Clé source qualifiée par le compte : même fichier, deux comptes = deux faits. */
export function qualifiedSourceKey(accountId: string | null, key: string): string {
  return `csv:${accountId ?? "none"}:${key}`.slice(0, 300);
}

function boundedRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k.slice(0, 120)] = String(v).slice(0, CELL_MAX);
  return out;
}

const dbStatus = (s: RawRowStatus) => (s === "in_file_conflict" ? "conflict" : s);

/**
 * Enregistre le lot et ses lignes. Rend l'identifiant du lot et les clés que
 * la BASE a classées en conflit (à ne pas écrire comme trades).
 */
export async function recordCsvImport(
  userId: string,
  accountId: string | null,
  meta: ImportMeta,
  rows: readonly RawRowRecord[],
): Promise<{ batchId: string | null; conflicts: Set<string>; recorded: boolean }> {
  const conflicts = new Set<string>();
  const counts = countByStatus(rows);
  const { data: batch, error: batchError } = await db
    .from("import_batches")
    .insert({
      user_id: userId,
      account_id: accountId,
      source_kind: "csv",
      file_name: meta.fileName.slice(0, 255),
      file_sha256: meta.fileSha256,
      row_count: meta.rowCount,
      duplicates: counts.duplicate,
      probable_duplicates: counts.probable_duplicate,
      conflicts: counts.in_file_conflict,
      rejected: counts.rejected,
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    console.warn("[imports] lot non enregistré (migration absente ?)", batchError);
    return { batchId: null, conflicts, recorded: false };
  }
  const batchId = batch.id as string;

  let recorded = true;
  for (let i = 0; i < rows.length; i += RAW_CHUNK) {
    const chunk = rows.slice(i, i + RAW_CHUNK).map((r) => ({
      user_id: userId,
      batch_id: batchId,
      account_id: accountId,
      source_kind: "csv",
      source_key: qualifiedSourceKey(accountId, r.key),
      payload: { row: boundedRow(r.raw) },
      payload_sha256: r.sha256,
      status: dbStatus(r.status),
      diagnostic: r.diagnostic ?? null,
      trade_id: r.status === "accepted" ? (r.tradeId ?? null) : null,
    }));
    const { data, error } = await db
      .from("raw_ingest_events")
      // Le même fait déjà reçu (réimport) n'ajoute rien : `ignoreDuplicates`.
      .upsert(chunk, { onConflict: "user_id,source_key,payload_sha256", ignoreDuplicates: true })
      .select("source_key, status");
    if (error) {
      console.warn("[imports] lignes brutes non enregistrées", error);
      recorded = false;
      continue;
    }
    for (const r of (data ?? []) as { source_key: string; status: string }[]) {
      if (r.status === "conflict") conflicts.add(r.source_key);
    }
  }
  return { batchId, conflicts, recorded };
}

/** Clôt le lot avec ce qui a été réellement écrit. */
export async function completeImportBatch(
  userId: string,
  batchId: string,
  result: { accepted: number; failed: number; conflicts: number },
): Promise<void> {
  const { error } = await db
    .from("import_batches")
    .update({
      accepted: result.accepted,
      failed: result.failed,
      conflicts: result.conflicts,
      status: result.failed > 0 && result.accepted === 0 ? "failed" : "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("user_id", userId);
  if (error) console.warn("[imports] lot non clôturé", error);
}

export function countByStatus(rows: readonly { status: RawRowStatus }[]) {
  const counts: Record<RawRowStatus, number> = {
    accepted: 0,
    duplicate: 0,
    probable_duplicate: 0,
    in_file_conflict: 0,
    rejected: 0,
  };
  for (const r of rows) counts[r.status]++;
  return counts;
}
