/**
 * environment — LES DEUX MONDES DE TRADEVAULT.
 *
 * Le produit n'a pas « des comptes » : il a DEUX ENVIRONNEMENTS, et des
 * comptes dans chacun.
 *
 *  • RÉEL — le journal du trader. Comptes personnels, prop firm, démo, live.
 *    Ce qui s'y trouve s'est passé sur un vrai marché, avec un vrai risque.
 *  • REJEU — le bac à sable historique. Chaque trade y est le produit d'une
 *    séance rejouée, jamais d'une exécution réelle.
 *
 * ILS SONT ÉTANCHES, et ce n'est pas une préférence d'affichage : mélanger
 * un backtest à un historique réel fausse toute statistique qu'on en tire —
 * win rate, espérance, drawdown, tout. Un trader qui lit « 68 % de réussite »
 * doit savoir de quel monde vient le chiffre.
 *
 * L'étanchéité est déjà STRUCTURELLE : chaque trade porte son `account_id`, et
 * toutes les pages lisent par compte actif (`useTrades(userId, activeId)`).
 * Aucune requête ne peut donc ramener les deux à la fois. Ce fichier ne
 * réinvente pas cette garantie — il lui donne un NOM, pour que l'interface
 * puisse dire dans quel monde on se trouve au lieu de le laisser deviner.
 */

import type { Account, AccountType } from "../store";

export type TradingEnvironment = "live" | "replay";

/** Le monde auquel appartient un type de compte. */
export function environmentOfType(type: AccountType): TradingEnvironment {
  return type === "replay" ? "replay" : "live";
}

/** Le monde auquel appartient un compte. `null` → réel, faute de mieux. */
export function environmentOf(account: Account | null | undefined): TradingEnvironment {
  return account ? environmentOfType(account.type) : "live";
}

/** Les comptes d'un monde donné, dans leur ordre d'origine. */
export function accountsOf(accounts: readonly Account[], env: TradingEnvironment): Account[] {
  return accounts.filter((a) => environmentOf(a) === env);
}

/**
 * Passe-t-on d'un monde à l'autre ?
 *
 * C'est CE prédicat qui déclenche la séquence de transition. Changer de compte
 * DANS un monde ne la joue pas : un voile plein écran entre deux comptes prop
 * firm serait du théâtre, et il ralentirait un geste qu'on fait dix fois par
 * jour. Changer de MONDE, en revanche, change le thème, la nature des données
 * et ce qu'on a le droit d'en conclure — cela mérite d'être marqué.
 */
export function isEnvironmentChange(
  from: Account | null | undefined,
  to: Account | null | undefined,
): boolean {
  if (!from || !to) return false;
  return environmentOf(from) !== environmentOf(to);
}

/** La clé i18n du nom d'un monde. */
export function environmentLabelKey(env: TradingEnvironment): "env.live" | "env.replay" {
  return env === "replay" ? "env.replay" : "env.live";
}
