import { createClient } from "@supabase/supabase-js";
import type { AgentRun } from "@/modules/ai/telemetry";

/**
 * Écriture de la télémétrie IA (`ai_agent_runs`).
 *
 * POURQUOI CÔTÉ SERVEUR, avec la clé service role
 * -----------------------------------------------
 * La table n'a AUCUNE politique d'insertion : un client ne doit pas pouvoir
 * fabriquer de fausses métriques, puisqu'elles serviront à des décisions
 * produit (choix de modèle, budget de tokens, arbitrages de coût). Seul le
 * serveur écrit.
 *
 * `modules/ai/telemetry.ts` définissait déjà le contrat `TelemetryRecorder`
 * avec la mention « FOUNDATION ONLY: no writer yet ». Ce fichier est ce writer
 * — le contrat n'est pas redéfini, il est implémenté.
 *
 * RÈGLE ABSOLUE : jamais de contenu de conversation. Ni le prompt, ni la
 * réponse, ni la question. Cette table sert au diagnostic, elle ne doit pas
 * devenir une copie des échanges du trader.
 */

type RunInput = Omit<AgentRun, "id" | "createdAt" | "inputSummary" | "outputSummary"> & {
  status: "ok" | "error" | "fallback";
};

/**
 * Enregistre un appel IA. **Best-effort et non bloquant** : une panne de
 * télémétrie ne doit jamais empêcher le trader d'obtenir sa réponse. En cas
 * d'échec on log côté serveur et on continue — perdre une mesure est acceptable,
 * perdre une réponse ne l'est pas.
 */
export async function recordAgentRun(run: RunInput): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Environnement sans clé service (développement local, preview partielle) :
  // on n'échoue pas, on ne mesure simplement pas.
  if (!url || !serviceKey) return;

  try {
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    await sb.from("ai_agent_runs").insert({
      user_id: run.userId,
      agent: run.agent,
      intent: run.intent,
      provider: run.provider || null,
      model: run.model || null,
      status: run.status,
      input_tokens: run.inputTokens ?? null,
      output_tokens: run.outputTokens ?? null,
      latency_ms: run.latencyMs,
      error: run.error ? run.error.slice(0, 500) : null,
    });
  } catch (e) {
    console.warn("[telemetry] écriture ignorée", e);
  }
}

/**
 * Rétention de `ai_agent_runs` — 90 jours.
 *
 * POURQUOI UNE RÉTENTION. La table reçoit une ligne par appel IA et ne
 * supprimait rien : elle croît linéairement avec l'usage, indéfiniment. Sur un
 * produit qui vise des dizaines de milliers d'utilisateurs, c'est le genre de
 * table qui finit par coûter plus cher que le service qu'elle mesure.
 *
 * POURQUOI 90 JOURS. C'est la fenêtre au-delà de laquelle la donnée ne sert
 * plus : les décisions qu'elle éclaire (quel modèle, quel budget de tokens,
 * quel coût acceptable) portent sur des semaines, pas sur des trimestres. Et
 * l'écran de diagnostic ne lit que 7 jours.
 *
 * POURQUOI PAS `pg_cron`. L'extension est disponible sur le projet mais NON
 * INSTALLÉE ; l'installer et planifier une suppression récurrente serait une
 * opération sur la base de production. Le produit dispose déjà d'un tick
 * quotidien (`/api/cron/lifecycle-emails`) qui enchaîne des tâches secondaires
 * en best-effort — c'est le motif existant, on le réutilise plutôt que d'en
 * introduire un second.
 *
 * AUCUNE DONNÉE UTILISATEUR N'EST TOUCHÉE : cette table ne contient ni prompt,
 * ni réponse, ni question — uniquement des mesures techniques.
 */
export const AGENT_RUNS_RETENTION_DAYS = 90;

export async function purgeOldAgentRuns(): Promise<{ purged: boolean }> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { purged: false };

  const cutoff = new Date(
    Date.now() - AGENT_RUNS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error } = await sb.from("ai_agent_runs").delete().lt("created_at", cutoff);
    if (error) {
      // La table peut ne pas exister (migration non appliquée) : on le log et
      // on continue. Une purge ratée n'est jamais une raison de faire échouer
      // le cron qui l'héberge.
      console.warn("[telemetry] purge failed", error);
      return { purged: false };
    }
    return { purged: true };
  } catch (e) {
    console.warn("[telemetry] purge failed", e);
    return { purged: false };
  }
}
