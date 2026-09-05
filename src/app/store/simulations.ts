/**
 * Scénarios de simulation — accès aux données.
 *
 * Couche IO pure : elle lit et écrit, elle ne calcule rien. Tout ce qui touche
 * aux probabilités vit dans `modules/probability`, et cette frontière est ce
 * qui garantit qu'un scénario rejoué en base et un scénario calculé à l'écran
 * donnent le même chiffre.
 *
 * CE QU'ON ÉCRIT. L'entrée (règles, horizon, risque) et un RÉSUMÉ du résultat.
 * Jamais les trajectoires ni les distributions : elles se recalculent à
 * l'identique depuis `seed` + `engineVersion` en quelques millisecondes.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AccountRules } from "@/modules/probability/rules";
import type { Horizon } from "@/modules/probability/scenario";

export interface SavedScenario {
  id: string;
  accountId: string | null;
  name: string;
  rules: AccountRules;
  horizon: Horizon;
  riskMultiplier: number;
  stopAfterLosses: number | null;
  runs: number;
  /** Reproductibilité : sans ces deux champs, un résultat sauvegardé n'est
   *  plus interprétable une fois la méthode changée. */
  seed: number | null;
  engineVersion: string | null;
  lastPassProbability: number | null;
  lastRiskOfRuin: number | null;
  lastSampleSize: number | null;
  lastRunAt: string | null;
  updatedAt: string;
}

interface Row {
  id: string;
  account_id: string | null;
  name: string | null;
  rules: unknown;
  horizon_unit: string;
  horizon_value: number;
  risk_multiplier: number | string;
  stop_after_losses: number | null;
  runs: number;
  seed: number | string | null;
  engine_version: string | null;
  last_pass_probability: number | string | null;
  last_risk_of_ruin: number | string | null;
  last_sample_size: number | null;
  last_run_at: string | null;
  updated_at: string;
}

/** `numeric` revient en texte depuis PostgREST ; le convertir ici évite que
 *  chaque appelant refasse la conversion — et l'oublie une fois sur deux. */
function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToScenario(r: Row): SavedScenario {
  const rules = (r.rules && typeof r.rules === "object" ? r.rules : {}) as AccountRules;
  return {
    id: r.id,
    accountId: r.account_id,
    name: r.name ?? "",
    rules,
    horizon: {
      unit: r.horizon_unit === "trades" ? "trades" : "days",
      value: r.horizon_value,
    },
    riskMultiplier: num(r.risk_multiplier) ?? 1,
    stopAfterLosses: r.stop_after_losses,
    runs: r.runs,
    seed: num(r.seed),
    engineVersion: r.engine_version,
    lastPassProbability: num(r.last_pass_probability),
    lastRiskOfRuin: num(r.last_risk_of_ruin),
    lastSampleSize: r.last_sample_size,
    lastRunAt: r.last_run_at,
    updatedAt: r.updated_at,
  };
}

/** Les scénarios d'un compte, le plus récemment utilisé en premier. */
export async function loadScenarios(accountId: string | null): Promise<SavedScenario[]> {
  let query = supabase
    .from("simulation_scenarios")
    .select("*")
    .order("updated_at", { ascending: false });
  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  // La table est arrivée après le code qui la lit : un déploiement où la
  // migration n'a pas encore tourné doit rendre une liste vide, pas casser la
  // page. C'est exactement le scénario qui avait fait disparaître les
  // sous-comptes lors du recalibrage.
  if (error) return [];
  return ((data as Row[] | null) ?? []).map(rowToScenario);
}

export interface ScenarioDraft {
  accountId: string | null;
  name: string;
  rules: AccountRules;
  horizon: Horizon;
  riskMultiplier: number;
  stopAfterLosses: number | null;
  runs: number;
  seed: number | null;
  engineVersion: string | null;
  lastPassProbability: number | null;
  lastRiskOfRuin: number | null;
  lastSampleSize: number | null;
}

function draftToRow(d: ScenarioDraft, userId: string) {
  return {
    user_id: userId,
    account_id: d.accountId,
    name: d.name,
    // Colonne `jsonb` : le schéma généré la type `Json`, un type récursif que
    // TypeScript ne déduit pas d'une interface applicative.
    rules: d.rules as unknown as Json,
    horizon_unit: d.horizon.unit,
    horizon_value: Math.max(1, Math.round(d.horizon.value)),
    risk_multiplier: d.riskMultiplier,
    stop_after_losses: d.stopAfterLosses,
    runs: d.runs,
    seed: d.seed,
    engine_version: d.engineVersion,
    last_pass_probability: d.lastPassProbability,
    last_risk_of_ruin: d.lastRiskOfRuin,
    last_sample_size: d.lastSampleSize,
    last_run_at: d.lastPassProbability === null ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function saveScenario(
  userId: string,
  draft: ScenarioDraft,
): Promise<SavedScenario | null> {
  const { data, error } = await supabase
    .from("simulation_scenarios")
    .insert(draftToRow(draft, userId))
    .select("*")
    .single();
  if (error) throw error;
  return data ? rowToScenario(data as Row) : null;
}

export async function updateScenario(
  userId: string,
  id: string,
  draft: ScenarioDraft,
): Promise<void> {
  // `user_id` est réaffirmé dans le filtre alors que RLS le garantit déjà :
  // une politique désactivée par erreur ne doit pas suffire à laisser écrire
  // chez quelqu'un d'autre.
  const { error } = await supabase
    .from("simulation_scenarios")
    .update(draftToRow(draft, userId))
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteScenario(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("simulation_scenarios")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
