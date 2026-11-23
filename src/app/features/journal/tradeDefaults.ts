/**
 * LES DÉFAUTS D'UN COMPTE — ce que le trader encode presque toujours là.
 *
 * Après chaque NOUVEAU trade enregistré, son symbole, son setup et son risque
 * deviennent les valeurs de départ du prochain trade SUR CE COMPTE (un compte
 * de challenge et un compte financé n'ont ni le même risque ni le même
 * marché). Ils ne remplissent qu'un champ VIDE : un relais de la séance, un
 * brouillon ou une saisie gardent toujours le dernier mot.
 *
 * Synchronisés d'un appareil à l'autre (`user_preferences`, clé `tradeDefaults`).
 */

import { loadUserPref, saveUserPref } from "@/app/utils/userPrefs";

export interface TradeDefaults {
  symbol: string;
  strategy: string;
  riskAmount: string;
  riskType: "dollar" | "percent";
}

const KEY = "tradeDefaults";
const NO_ACCOUNT = "none";

type Store = Record<string, TradeDefaults>;

export async function loadTradeDefaults(
  userId: string,
  accountId: string | null,
): Promise<TradeDefaults | null> {
  const all = await loadUserPref<Store>(userId, KEY);
  const d = all?.[accountId ?? NO_ACCOUNT];
  return d && typeof d === "object" ? d : null;
}

export async function rememberTradeDefaults(
  userId: string,
  accountId: string | null,
  d: TradeDefaults,
): Promise<void> {
  const all = (await loadUserPref<Store>(userId, KEY)) ?? {};
  saveUserPref(userId, KEY, { ...all, [accountId ?? NO_ACCOUNT]: d });
}

/**
 * Les défauts posés sur un formulaire : seulement là où rien n'est écrit. Le
 * setup « Scalping » du formulaire vierge n'est pas un choix du trader.
 */
export function applyDefaults<
  F extends { symbol: string; strategy: string; riskAmount: string; riskType: string },
>(form: F, d: TradeDefaults, blankStrategy: string): F {
  const riskEmpty = form.riskAmount.trim() === "";
  return {
    ...form,
    symbol: form.symbol.trim() ? form.symbol : d.symbol,
    strategy: form.strategy === blankStrategy && d.strategy ? d.strategy : form.strategy,
    riskAmount: riskEmpty ? d.riskAmount : form.riskAmount,
    riskType: riskEmpty ? d.riskType : form.riskType,
  };
}
