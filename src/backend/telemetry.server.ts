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
