/**
 * Agrégation de la télémétrie IA — module PUR.
 *
 * Séparé de la lecture base pour être testable : ce sont ces chiffres qui
 * serviront à trancher des arbitrages (quel modèle, quel budget de tokens,
 * quel coût acceptable). Un agrégat faux oriente des décisions produit
 * pendant des mois sans que personne ne s'en aperçoive.
 */

export interface AgentRunRow {
  model: string | null;
  provider: string | null;
  status: "ok" | "error" | "fallback";
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface ModelSummary {
  model: string;
  runs: number;
  /** Latence médiane — plus honnête que la moyenne, qu'un seul timeout fausse. */
  medianMs: number;
  /** 95e centile : ce que vit le trader le plus mal servi, pas le cas moyen. */
  p95Ms: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

export interface TelemetrySummary {
  total: number;
  ok: number;
  errors: number;
  /** Réponses déterministes servies — l'indicateur de santé le plus parlant. */
  fallbacks: number;
  /** % d'appels n'ayant PAS abouti à une réponse du modèle. */
  degradedPct: number;
  medianMs: number;
  p95Ms: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: ModelSummary[];
}

/** Centile sur une liste NON triée. Renvoie 0 sur liste vide plutôt que NaN. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

/**
 * Résume une série d'appels.
 *
 * DEUX CHOIX DE MESURE, qui changent ce qu'on voit :
 *
 * - **Médiane et p95 plutôt que moyenne.** Un seul timeout à 10 s fausse une
 *   moyenne sur 20 appels et fait croire à une régression générale. Le p95 dit
 *   ce que vit le trader le plus mal servi — c'est lui qui abandonne.
 * - **Les latences nulles ou absentes sont EXCLUES** du calcul. Un appel dont
 *   la latence n'a pas été capturée (repli immédiat, aucun provider configuré)
 *   n'a pas mis 0 ms : le compter tirerait la médiane vers le bas et
 *   maquillerait les performances.
 */
export function summarizeRuns(rows: AgentRunRow[]): TelemetrySummary {
  const latencies = rows.map((r) => r.latency_ms ?? 0).filter((v) => v > 0);
  const ok = rows.filter((r) => r.status === "ok").length;
  const errors = rows.filter((r) => r.status === "error").length;
  const fallbacks = rows.filter((r) => r.status === "fallback").length;

  const byModelMap = new Map<string, AgentRunRow[]>();
  for (const r of rows) {
    // Un appel sans modèle est un appel qui n'a jamais atteint de provider :
    // le nommer explicitement vaut mieux que de le masquer.
    const key = r.model || "(aucun)";
    const list = byModelMap.get(key) ?? [];
    list.push(r);
    byModelMap.set(key, list);
  }

  const byModel: ModelSummary[] = [...byModelMap.entries()]
    .map(([model, list]) => {
      const lat = list.map((r) => r.latency_ms ?? 0).filter((v) => v > 0);
      return {
        model,
        runs: list.length,
        medianMs: percentile(lat, 50),
        p95Ms: percentile(lat, 95),
        avgInputTokens: avg(list.map((r) => r.input_tokens ?? 0).filter((v) => v > 0)),
        avgOutputTokens: avg(list.map((r) => r.output_tokens ?? 0).filter((v) => v > 0)),
      };
    })
    .sort((a, b) => b.runs - a.runs);

  return {
    total: rows.length,
    ok,
    errors,
    fallbacks,
    degradedPct: rows.length === 0 ? 0 : Math.round(((errors + fallbacks) / rows.length) * 100),
    medianMs: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    totalInputTokens: rows.reduce((s, r) => s + (r.input_tokens ?? 0), 0),
    totalOutputTokens: rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0),
    byModel,
  };
}
