import type { DetectedPattern, SessionLike, TradeLike } from "./detectors";

/**
 * Entre la base et les détecteurs — TRADUCTION, rien d'autre.
 *
 * Ces fonctions sont pures pour une raison précise : ce sont elles qui
 * décident ce qu'un détecteur voit. Une colonne mal lue (`r_multiple` absent
 * silencieusement remplacé par 0) ne produit pas une erreur, elle produit un
 * motif faux avec un `n` rassurant. Isolées ici, elles se testent sans base.
 *
 * RÈGLE : ce qui n'est pas mesuré ne devient pas zéro. Un trade sans
 * `r_multiple` est écarté du calcul en R plutôt que compté comme neutre — un
 * zéro inventé tire les moyennes vers le centre et fabrique de la modération là
 * où il n'y a que de l'absence.
 */

/**
 * Fenêtre d'observation, en jours.
 *
 * 90 : assez long pour que les tailles d'échantillon minimales soient
 * atteignables, assez court pour qu'un constat parle du trader d'aujourd'hui et
 * non de celui d'il y a deux ans.
 */
export const WINDOW_DAYS = 90;

/**
 * Début de fenêtre au format `YYYY-MM-DD`. Pur — l'horloge est injectée.
 *
 * EN UTC, DÉLIBÉRÉMENT — et c'est l'exception au reste du produit, qui date
 * tout dans le fuseau du trader. Cette fonction n'a qu'un appelant :
 * `handlePatternScanCron`, qui tourne sur le serveur. Il n'y a là aucun
 * « fuseau local » qui voudrait dire quelque chose (celui de Vercel est UTC),
 * et une borne de fenêtre qui dépendrait du fuseau de la machine rendrait le
 * balayage non reproductible d'un environnement à l'autre.
 *
 * L'arithmétique en millisecondes est sûre ici pour la même raison : UTC ne
 * connaît pas de changement d'heure, donc un jour y fait toujours 24 heures.
 */
export function windowStart(now: Date, days = WINDOW_DAYS): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface TradeRow {
  trade_date?: string | null;
  pnl?: number | string | null;
  r_multiple?: number | string | null;
  mistakes?: string[] | null;
  entry_time?: string | null;
}

export interface SessionRow {
  session_date?: string | null;
  readiness_score?: number | string | null;
}

/** `numeric` revient en chaîne depuis PostgREST ; `null` reste `null`. */
function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Les trades exploitables, dans l'ordre reçu.
 *
 * Un trade sans date, sans P&L ou sans R est ÉCARTÉ, pas complété. Les trois
 * champs sont ce sur quoi tous les détecteurs comptent ; en fabriquer un
 * reviendrait à inventer la donnée qu'on prétend observer.
 */
export function toTradeLikes(rows: TradeRow[]): TradeLike[] {
  const out: TradeLike[] = [];
  for (const row of rows) {
    const pnl = num(row.pnl);
    const r = num(row.r_multiple);
    if (!row.trade_date || pnl === null || r === null) continue;
    out.push({
      date: row.trade_date,
      pnl,
      rMultiple: r,
      mistakes: row.mistakes ?? null,
      entryTime: row.entry_time ?? null,
    });
  }
  return out;
}

/**
 * Les séances, `readiness_score` compris quand il existe.
 *
 * Une séance sans score de préparation est GARDÉE avec `readinessScore: null` :
 * le détecteur d'association a besoin de savoir combien de séances n'ont pas
 * de score, sinon il compare deux groupes dont il ignore la base.
 */
export function toSessionLikes(rows: SessionRow[]): SessionLike[] {
  const out: SessionLike[] = [];
  for (const row of rows) {
    if (!row.session_date) continue;
    out.push({ sessionDate: row.session_date, readinessScore: num(row.readiness_score) });
  }
  return out;
}

export interface KnownPatternRow {
  id: string;
  kind: string;
  cluster_id: string | null;
  dismissed_at: string | null;
}

export interface PatternWrite {
  /** Présent quand la ligne existe déjà : on met à jour, on n'empile pas. */
  id: string | null;
  kind: string;
  cluster_id: string | null;
  evidence: DetectedPattern["evidence"];
  impact_r: number | null;
}

/**
 * Ce qu'il faut écrire pour un passage donné.
 *
 * POURQUOI PAS UN `upsert`. L'unicité en base porte sur
 * `(user_id, kind, coalesce(cluster_id, ''))` — un index d'EXPRESSION, que
 * PostgREST ne sait pas viser avec `on_conflict`. Le rapprochement se fait donc
 * ici, sur les lignes déjà lues pour la règle d'oubli : aucune requête de plus,
 * et le comportement est visible plutôt que délégué à une clause qui échouerait
 * en silence.
 */
export function planWrites(patterns: DetectedPattern[], known: KnownPatternRow[]): PatternWrite[] {
  const index = new Map(known.map((k) => [`${k.kind}:${k.cluster_id ?? ""}`, k.id] as const));
  return patterns.map((p) => ({
    id: index.get(`${p.kind}:${p.clusterId ?? ""}`) ?? null,
    kind: p.kind,
    cluster_id: p.clusterId,
    evidence: p.evidence,
    impact_r: p.impactR,
  }));
}
