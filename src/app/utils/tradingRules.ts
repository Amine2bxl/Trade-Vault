import { supabase } from "@/integrations/supabase/client";
import type { TradingRule } from "./ruleCheck";

/**
 * Persistance des règles du trader (colonne `trading_rules` de `profiles`).
 *
 * La VÉRIFICATION vit dans `ruleCheck.ts` — module pur et testable. Ce fichier
 * ne garde que les entrées/sorties, et ré-exporte le reste pour que les
 * appelants existants continuent d'importer depuis `tradingRules`.
 */

export * from "./ruleCheck";

export async function loadTradingRules(userId: string): Promise<TradingRule[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("trading_rules")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const raw = data?.trading_rules;
  return Array.isArray(raw) ? (raw as unknown as TradingRule[]) : [];
}

export async function saveTradingRules(userId: string, rules: TradingRule[]): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ trading_rules: rules as any })
    .eq("id", userId);
  if (error) throw error;
}

// ── Evaluation ───────────────────────────────────────────────────────────────
