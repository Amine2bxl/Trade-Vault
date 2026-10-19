import type { TradingRule } from "@/domain/ruleCheck";
import { loadProfileRow, updateProfile } from "../store/profileRow";

/**
 * Persistance des règles du trader (colonne `trading_rules` de `profiles`).
 *
 * La VÉRIFICATION vit dans `ruleCheck.ts` — module pur et testable. Ce fichier
 * ne garde que les entrées/sorties, et ré-exporte le reste pour que les
 * appelants existants continuent d'importer depuis `tradingRules`.
 */

export * from "@/domain/ruleCheck";

export async function loadTradingRules(userId: string): Promise<TradingRule[]> {
  const raw = (await loadProfileRow(userId))?.trading_rules;
  return Array.isArray(raw) ? (raw as unknown as TradingRule[]) : [];
}

export async function saveTradingRules(userId: string, rules: TradingRule[]): Promise<void> {
  await updateProfile(userId, { trading_rules: rules });
}

// ── Evaluation ───────────────────────────────────────────────────────────────
