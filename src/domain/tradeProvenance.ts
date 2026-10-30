import type { RiskSource, Trade, TradeSource } from "./trade";

/**
 * LA PROVENANCE D'UN TRADE EN BASE — module pur, partagé par le client
 * (`app/store/trades`) et le serveur (synchro broker, Jarvis, rapports,
 * motifs), pour qu'une seule règle dise ce qui s'écrit et ce qui se lit.
 *
 * Les colonnes viennent de la migration `data_integrity_provenance` (lot 1).
 * L'application peut tourner AVANT elle (aperçu branché sur la base réelle,
 * déploiement en avance) : une requête qui nomme une colonne inexistante est
 * refusée en entier. Chaque lecture et chaque écriture sait donc retomber sur
 * les colonnes historiques — la provenance est alors INCONNUE, jamais devinée.
 */

export const PROVENANCE_COLUMNS = [
  "source",
  "risk_source",
  "source_timezone",
  "entry_at",
  "exit_at",
  "import_key",
] as const;

/** À concaténer à une liste de colonnes PostgREST. */
export const PROVENANCE_SELECT = `, ${PROVENANCE_COLUMNS.join(", ")}`;

export interface ProvenanceRow {
  source?: string | null;
  risk_source?: string | null;
  source_timezone?: string | null;
  entry_at?: string | null;
  exit_at?: string | null;
  import_key?: string | null;
}

export type TradeProvenance = Pick<
  Trade,
  "source" | "riskSource" | "sourceTimezone" | "entryAt" | "exitAt" | "importKey"
>;

const TRADE_SOURCES: readonly TradeSource[] = ["manual", "csv", "broker", "copy"];
const RISK_SOURCES: readonly RiskSource[] = ["user", "csv", "broker_stop", "broker_default"];

/** Une valeur connue de la liste, sinon `null` (inconnue) — jamais devinée. */
function oneOf<T extends string>(v: string | null | undefined, allowed: readonly T[]): T | null {
  return allowed.includes(v as T) ? (v as T) : null;
}

/** Ligne SQL → provenance. Une colonne absente se lit comme inconnue. */
export function provenanceFromRow(r: ProvenanceRow): TradeProvenance {
  return {
    source: oneOf(r.source, TRADE_SOURCES),
    riskSource: oneOf(r.risk_source, RISK_SOURCES),
    sourceTimezone: r.source_timezone ?? null,
    entryAt: r.entry_at ?? null,
    exitAt: r.exit_at ?? null,
    importKey: r.import_key ?? null,
  };
}

/**
 * Provenance → colonnes, seulement celles qui sont CONNUES : une valeur absente
 * n'écrase jamais une valeur en base.
 *
 * Exception, les instants : `null` EXPLICITE les efface. C'est le seul moyen
 * de retirer un instant qui ne prouve plus les heures affichées (heure
 * corrigée par le trader, `provenanceAfterEdit`) ; `undefined` les laisse
 * intacts.
 */
export function provenanceColumns(t: Partial<TradeProvenance>): ProvenanceRow {
  const row: ProvenanceRow = {};
  if (t.source) row.source = t.source;
  if (t.riskSource) row.risk_source = t.riskSource;
  if (t.sourceTimezone) row.source_timezone = t.sourceTimezone;
  if (t.entryAt !== undefined) row.entry_at = t.entryAt || null;
  if (t.exitAt !== undefined) row.exit_at = t.exitAt || null;
  if (t.importKey) row.import_key = t.importKey;
  return row;
}

/**
 * Refus « colonne inconnue » portant sur une colonne de provenance :
 * `PGRST204` à l'écriture (cache de schéma), `42703` à la lecture.
 */
export function isMissingProvenanceColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const text = `${e.code ?? ""} ${e.message ?? ""}`;
  if (!/PGRST204|42703|column/i.test(text)) return false;
  return PROVENANCE_COLUMNS.some((c) => text.includes(c));
}

/**
 * Exécute une lecture AVEC les colonnes de provenance, et la rejoue sans elles
 * si la base ne les a pas encore. `run` reçoit le suffixe à ajouter au select.
 */
export async function selectWithProvenance<R extends { error: unknown }>(
  run: (extraColumns: string) => PromiseLike<R>,
): Promise<R> {
  const first = await run(PROVENANCE_SELECT);
  if (first.error && isMissingProvenanceColumn(first.error)) return run("");
  return first;
}

/**
 * La provenance d'un trade APRÈS une saisie dans le formulaire.
 *
 *   • nouveau trade : `manual`, et un risque saisi est un risque `user` ;
 *   • risque modifié : il devient `user` — le trader l'a déclaré, même sur un
 *     import broker qui n'avait qu'un forfait. Inchangé, il garde sa source :
 *     enregistrer sans toucher n'est pas déclarer ;
 *   • date ou heures modifiées : les instants UTC ne prouvent plus les heures
 *     affichées. Ils passent à `null` — effacés en base, pas seulement oubliés
 *     (voir `provenanceColumns`) — plutôt que de contredire la saisie ;
 *   • le reste (source, fuseau, clé d'import) voyage avec le trade.
 */
export function provenanceAfterEdit(
  before: (Pick<Trade, "date" | "entryTime" | "exitTime" | "riskAmount"> & TradeProvenance) | null,
  after: Pick<Trade, "date" | "entryTime" | "exitTime" | "riskAmount">,
): TradeProvenance {
  if (!before) {
    return {
      source: "manual",
      riskSource: after.riskAmount > 0 ? "user" : null,
      sourceTimezone: null,
      entryAt: null,
      exitAt: null,
      importKey: null,
    };
  }
  const riskChanged = Math.abs((before.riskAmount || 0) - (after.riskAmount || 0)) >= 0.005;
  const clockChanged =
    before.date !== after.date ||
    (before.entryTime ?? "") !== (after.entryTime ?? "") ||
    (before.exitTime ?? "") !== (after.exitTime ?? "");
  return {
    source: before.source ?? null,
    riskSource: riskChanged ? (after.riskAmount > 0 ? "user" : null) : (before.riskSource ?? null),
    sourceTimezone: before.sourceTimezone ?? null,
    entryAt: clockChanged ? null : (before.entryAt ?? null),
    exitAt: clockChanged ? null : (before.exitAt ?? null),
    importKey: before.importKey ?? null,
  };
}
