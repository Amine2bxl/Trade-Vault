import type { Trade } from "./trade";

/**
 * IMPORTER DEUX FOIS NE DOUBLE RIEN, ET NE PERD RIEN — module pur (lot 1).
 *
 * L'ancienne détection de doublons comparait une signature
 * `date|symbole|P&L|heure` : deux trades RÉELS identiques d'un même fichier
 * (deux scalps NQ à +50 $ sans colonne d'heure) n'en faisaient qu'un, le
 * second étant compté « doublon » — une perte silencieuse de données. Et un
 * export corrigé (même trade, P&L rectifié) s'ajoutait à côté de l'ancien.
 *
 * Chaque ligne reçoit désormais une CLÉ D'OCCURRENCE stable :
 *   • avec une colonne d'identifiant (n° d'ordre, de ticket…) :
 *     `csv-id:<id>` — une ligne corrigée garde sa clé, change d'empreinte,
 *     et la base la met en conflit au lieu de l'ajouter (`raw_ingest_events`) ;
 *   • sans identifiant : `csv:<empreinte du contenu>#<rang>` — la k-ième
 *     ligne identique d'un fichier garde le rang k à chaque réimport. Deux
 *     lignes identiques restent deux trades ; réimporter le même export (ou un
 *     export plus long qui les contient) ne les recrée pas.
 *
 * La clé est unique PAR COMPTE (index `trades_user_account_import_key_uidx`).
 */

/** SHA-256 hexadécimal (Web Crypto : navigateur, Bun, Node ≥ 20). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const money = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "";

/**
 * Le CONTENU FACTUEL d'une ligne importée, sous forme canonique.
 *
 * Les annotations (setup, notes) n'en font pas partie : corriger une note
 * dans le fichier ne fait pas d'un trade un autre trade.
 */
export function canonicalTradeContent(
  t: Pick<
    Trade,
    "date" | "symbol" | "direction" | "pnl" | "riskAmount" | "entryTime" | "exitTime"
  > &
    Partial<Pick<Trade, "fees" | "slippage">>,
): string {
  return [
    t.date,
    t.symbol.trim().toUpperCase(),
    t.direction,
    money(t.pnl),
    t.riskAmount > 0 ? money(t.riskAmount) : "",
    (t.entryTime ?? "").trim(),
    (t.exitTime ?? "").trim(),
    money(t.fees ?? null),
    money(t.slippage ?? null),
  ].join("|");
}

/** Identifiant de ligne fourni par le fichier, normalisé, ou `null`. */
export function normalizeSourceId(raw: string | null | undefined): string | null {
  const id = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!id || id.length > 120) return null;
  return id;
}

export interface KeyedRow<T> {
  trade: T;
  /** Clé d'idempotence, qualifiée par la source. */
  key: string;
  /** Empreinte du contenu factuel : détecte une ligne corrigée sous la même clé. */
  contentSha256: string;
}

/** Attribue une clé à chaque ligne, dans l'ordre du fichier. */
export async function assignImportKeys<T extends Parameters<typeof canonicalTradeContent>[0]>(
  rows: readonly T[],
  sourceIds: readonly (string | null | undefined)[] = [],
): Promise<KeyedRow<T>[]> {
  const occurrences = new Map<string, number>();
  const out: KeyedRow<T>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const trade = rows[i];
    const contentSha256 = await sha256Hex(canonicalTradeContent(trade));
    const id = normalizeSourceId(sourceIds[i]);
    if (id) {
      out.push({ trade, key: `csv-id:${id}`, contentSha256 });
      continue;
    }
    const rank = occurrences.get(contentSha256) ?? 0;
    occurrences.set(contentSha256, rank + 1);
    out.push({ trade, key: `csv:${contentSha256.slice(0, 40)}#${rank}`, contentSha256 });
  }
  return out;
}

/** L'ancienne signature, gardée pour reconnaître l'historique SANS clé. */
export function legacySignature(tr: Pick<Trade, "date" | "symbol" | "pnl" | "entryTime">): string {
  return `${tr.date}|${tr.symbol}|${tr.pnl}|${tr.entryTime}`;
}

export type ImportRowStatus = "accepted" | "duplicate" | "probable_duplicate" | "in_file_conflict";

export interface CsvImportPlan<T> {
  fresh: KeyedRow<T>[];
  /** Ligne par ligne, dans l'ordre du fichier. */
  statuses: { row: KeyedRow<T>; status: ImportRowStatus }[];
  /** Même clé déjà au journal (réimport exact). */
  duplicates: number;
  /**
   * Un trade SANS clé (saisi à la main ou importé avant le lot 1) porte la
   * même signature : probablement le même trade, écarté — et compté à part,
   * pour que le trader sache que ce n'est pas un doublon certain.
   */
  probableDuplicates: number;
  /** Deux lignes du fichier sous le même identifiant avec des contenus différents. */
  inFileConflicts: number;
}

/**
 * Ce que l'import fera, AVANT toute écriture.
 *
 * `existing` = les trades du compte de destination. La comparaison avec
 * l'historique sans clé est un MULTI-ENSEMBLE : un fichier qui contient deux
 * lignes identiques face à un seul trade correspondant au journal en importe
 * une, au lieu de zéro (ancienne règle) ou de deux.
 */
export function planCsvImport<T extends Pick<Trade, "date" | "symbol" | "pnl" | "entryTime">>(
  rows: readonly KeyedRow<T>[],
  existing: readonly (Pick<Trade, "date" | "symbol" | "pnl" | "entryTime"> &
    Partial<Pick<Trade, "importKey">>)[],
): CsvImportPlan<T> {
  const knownKeys = new Set(existing.map((t) => t.importKey).filter((k): k is string => !!k));
  const legacy = new Map<string, number>();
  for (const t of existing) {
    if (t.importKey) continue;
    const s = legacySignature(t);
    legacy.set(s, (legacy.get(s) ?? 0) + 1);
  }
  const seenIds = new Map<string, string>();
  const plan: CsvImportPlan<T> = {
    fresh: [],
    statuses: [],
    duplicates: 0,
    probableDuplicates: 0,
    inFileConflicts: 0,
  };
  for (const row of rows) {
    if (row.key.startsWith("csv-id:")) {
      const prior = seenIds.get(row.key);
      if (prior !== undefined) {
        // Un identifiant répété dans le fichier : même contenu = ligne en
        // double, contenu différent = le fichier se contredit.
        const status = prior === row.contentSha256 ? "duplicate" : "in_file_conflict";
        if (status === "duplicate") plan.duplicates++;
        else plan.inFileConflicts++;
        plan.statuses.push({ row, status });
        continue;
      }
      seenIds.set(row.key, row.contentSha256);
    }
    if (knownKeys.has(row.key)) {
      plan.duplicates++;
      plan.statuses.push({ row, status: "duplicate" });
      continue;
    }
    const sig = legacySignature(row.trade);
    const remaining = legacy.get(sig) ?? 0;
    if (remaining > 0) {
      legacy.set(sig, remaining - 1);
      plan.probableDuplicates++;
      plan.statuses.push({ row, status: "probable_duplicate" });
      continue;
    }
    knownKeys.add(row.key);
    plan.fresh.push(row);
    plan.statuses.push({ row, status: "accepted" });
  }
  return plan;
}
