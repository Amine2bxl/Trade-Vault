/**
 * Règles de compte et verdict pass/fail — module PUR.
 *
 * C'est la partie la plus exigeante du moteur : une règle mal implémentée
 * produit une probabilité de réussite fausse, et un trader peut acheter un
 * compte à 500 $ sur la foi de ce chiffre. L'exactitude prime ici sur tout le
 * reste.
 *
 * ── AUCUNE RÈGLE DE PROP FIRM N'EST CODÉE EN DUR ───────────────────────────
 * L'audit du dépôt est formel : TradeVault ne contient AUCUNE donnée de prop
 * firm — ni table, ni configuration, ni constante. Écrire « Apex 50k = 2 500 $
 * de drawdown » serait inventer une règle que personne n'a vérifiée, et qui
 * change plusieurs fois par an selon les firmes.
 *
 * Ce module fournit donc un moteur GÉNÉRIQUE : le trader saisit les règles de
 * son compte, telles qu'elles figurent sur son contrat. Le jour où le produit
 * embarquera des préréglages vérifiés, ils rempliront ce même `AccountRules`
 * sans qu'une ligne du moteur ne change.
 *
 * ── LES TROIS DRAWDOWNS SONT TROIS CHOSES DIFFÉRENTES ──────────────────────
 * Les confondre est l'erreur la plus courante des simulateurs, et elle rend
 * le résultat inutilisable :
 *
 *   `static`   — le plancher est fixé une fois pour toutes au départ.
 *                Plancher = solde initial − drawdown max. Gagner ne le
 *                remonte jamais.
 *
 *   `trailing` — le plancher suit le PLUS HAUT solde atteint, trade par
 *                trade (intraday). Plancher = plus haut − drawdown max. Un
 *                gain intra-journalier resserre immédiatement la marge, même
 *                si le trader rend ce gain avant la clôture. C'est le plus
 *                sévère des trois.
 *
 *   `trailingEod` — le plancher suit le plus haut solde de CLÔTURE de
 *                journée. Un pic atteint puis rendu dans la même séance ne
 *                compte pas. Sensiblement plus permissif que `trailing`.
 *
 * Beaucoup de firmes gèlent en outre le plancher une fois le solde initial
 * dépassé d'un certain montant (`trailingFreezeAt`) : le trailing cesse et le
 * plancher reste au niveau atteint. Sans cette option, la simulation
 * surestime fortement le taux d'échec des comptes financés.
 */

/** Comment le plancher de perte évolue. Voir le commentaire d'en-tête. */
export type DrawdownType = "static" | "trailing" | "trailingEod";

/**
 * Les règles d'un compte, telles que le trader les lit sur son contrat.
 *
 * Tout est optionnel sauf le solde de départ : une règle absente n'est pas
 * appliquée, et l'interface doit afficher « règle non configurée » plutôt que
 * de supposer une valeur. Simuler avec une contrainte inventée est pire que
 * simuler sans elle, parce que le trader croira le résultat.
 */
export interface AccountRules {
  startingBalance: number;
  /** Gain à atteindre, en devise. `null` = pas d'objectif (compte personnel). */
  profitTarget?: number | null;
  /** Perte maximale totale autorisée, en devise. */
  maxDrawdown?: number | null;
  drawdownType?: DrawdownType;
  /** Le trailing s'arrête quand le profit atteint ce montant. */
  trailingFreezeAt?: number | null;
  /** Perte maximale sur une seule journée, en devise (valeur positive). */
  dailyLossLimit?: number | null;
  /** Nombre minimum de jours tradés avant de pouvoir valider. */
  minTradingDays?: number | null;
  /** Au-delà, le challenge est perdu par dépassement de délai. */
  maxTradingDays?: number | null;
  /**
   * Règle de consistance : part maximale du profit total qu'un seul jour peut
   * représenter (ex. 0.4 pour 40 %). Vérifiée à l'atteinte de l'objectif —
   * c'est à ce moment que les firmes la contrôlent.
   */
  maxBestDayShare?: number | null;
}

export type Outcome = "passed" | "failed" | "open";

/** Pourquoi une trajectoire s'est arrêtée. `null` tant qu'elle est ouverte. */
export type FailReason = "maxDrawdown" | "dailyLoss" | "maxTradingDays" | "consistency" | null;

/** État vivant d'une trajectoire simulée. */
export interface AccountState {
  balance: number;
  /** Plus haut solde atteint, tous instants confondus (trailing intraday). */
  peak: number;
  /** Plus haut solde de CLÔTURE de journée (trailing EOD). */
  peakEod: number;
  /** Plancher courant : sous ce solde, le compte est perdu. */
  floor: number;
  /** P&L du jour en cours. */
  dayPnl: number;
  /** P&L cumulé par jour — sert à la règle de consistance. */
  dayPnls: number[];
  currentDay: number;
  tradingDays: number;
  maxDrawdown: number;
  outcome: Outcome;
  failReason: FailReason;
  /** Nombre de trades joués avant l'arrêt. */
  trades: number;
}

/** Le plancher de perte, selon le type de drawdown et le profit déjà réalisé. */
function computeFloor(rules: AccountRules, peak: number, peakEod: number): number {
  const dd = rules.maxDrawdown;
  if (!dd || dd <= 0) return Number.NEGATIVE_INFINITY; // aucune règle : jamais perdu
  const start = rules.startingBalance;
  const type = rules.drawdownType ?? "static";

  if (type === "static") return start - dd;

  const reference = type === "trailingEod" ? peakEod : peak;
  // Gel du trailing : au-delà du seuil, le plancher ne bouge plus.
  const freeze = rules.trailingFreezeAt;
  if (freeze && freeze > 0) {
    const frozenAt = start + freeze;
    if (reference >= frozenAt) return frozenAt - dd;
  }
  // Le plancher ne descend jamais sous celui du départ : un trailing qui
  // baisserait avec les pertes rendrait le compte impossible à perdre.
  return Math.max(start - dd, reference - dd);
}

export function initState(rules: AccountRules): AccountState {
  const start = rules.startingBalance;
  return {
    balance: start,
    peak: start,
    peakEod: start,
    floor: computeFloor(rules, start, start),
    dayPnl: 0,
    dayPnls: [],
    currentDay: 0,
    tradingDays: 0,
    maxDrawdown: 0,
    outcome: "open",
    failReason: null,
    trades: 0,
  };
}

/**
 * Joue un trade et met l'état à jour.
 *
 * ORDRE DES VÉRIFICATIONS — il détermine le verdict et n'est pas arbitraire :
 *   1. le drawdown, puis la perte journalière : une règle enfreinte l'est
 *      immédiatement, y compris par le trade qui atteindrait l'objectif.
 *      Un trader qui touche son plancher au trade qui l'amène à la cible a
 *      perdu, pas gagné — c'est ainsi que les firmes tranchent.
 *   2. l'objectif ensuite, avec le nombre de jours minimum et la consistance.
 *
 * L'état est MUTÉ en place. C'est délibéré : une simulation à 25 000
 * trajectoires × 100 trades fait 2,5 millions d'appels, et allouer un objet
 * à chacun ferait travailler le ramasse-miettes bien plus que le calcul
 * lui-même. La fonction n'est pas exportée comme utilitaire général : elle
 * est l'organe interne d'une boucle chaude.
 */
export function applyTrade(state: AccountState, pnl: number, rules: AccountRules): void {
  if (state.outcome !== "open") return;

  state.balance += pnl;
  state.dayPnl += pnl;
  state.trades++;

  if (state.balance > state.peak) state.peak = state.balance;
  const dd = state.peak - state.balance;
  if (dd > state.maxDrawdown) state.maxDrawdown = dd;

  state.floor = computeFloor(rules, state.peak, state.peakEod);

  if (state.balance <= state.floor) {
    state.outcome = "failed";
    state.failReason = "maxDrawdown";
    return;
  }

  const daily = rules.dailyLossLimit;
  if (daily && daily > 0 && state.dayPnl <= -daily) {
    state.outcome = "failed";
    state.failReason = "dailyLoss";
    return;
  }

  checkTarget(state, rules);
}

/** Vérifie l'atteinte de l'objectif, jours minimum et consistance compris. */
function checkTarget(state: AccountState, rules: AccountRules): void {
  const target = rules.profitTarget;
  if (!target || target <= 0) return;
  if (state.balance < rules.startingBalance + target) return;

  // Jours minimum : atteindre la cible en deux jours ne valide pas un
  // challenge qui en exige cinq. Le compte reste ouvert, il continue.
  const minDays = rules.minTradingDays;
  const daysSoFar = state.tradingDays + 1; // le jour courant compte
  if (minDays && daysSoFar < minDays) return;

  // Consistance : contrôlée AU MOMENT de l'atteinte, comme le font les firmes.
  const share = rules.maxBestDayShare;
  if (share && share > 0) {
    const totalProfit = state.balance - rules.startingBalance;
    const days = [...state.dayPnls, state.dayPnl];
    const best = Math.max(...days, 0);
    if (totalProfit > 0 && best / totalProfit > share) {
      state.outcome = "failed";
      state.failReason = "consistency";
      return;
    }
  }

  state.outcome = "passed";
}

/**
 * Clôture la journée : fige le P&L du jour, met à jour le plus haut de
 * clôture (trailing EOD) et applique la limite de durée.
 */
export function closeDay(state: AccountState, rules: AccountRules): void {
  if (state.outcome !== "open") return;

  state.dayPnls.push(state.dayPnl);
  state.tradingDays++;
  state.dayPnl = 0;
  state.currentDay++;

  if (state.balance > state.peakEod) state.peakEod = state.balance;
  state.floor = computeFloor(rules, state.peak, state.peakEod);

  const maxDays = rules.maxTradingDays;
  if (maxDays && state.tradingDays >= maxDays && state.outcome === "open") {
    state.outcome = "failed";
    state.failReason = "maxTradingDays";
  }
}
