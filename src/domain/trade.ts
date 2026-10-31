/** Le trade et ses statistiques — SOURCE UNIQUE du type (`app/types.ts` le ré-exporte). */

export type TradeDirection = "long" | "short" | "be";

export interface Trade {
  id: string;
  date: string;
  symbol: string;
  direction: TradeDirection;
  pnl: number;
  riskAmount: number;
  rMultiple: number;
  strategy: string;
  mistakes: string[];
  setupQuality: number;
  notes: string;
  screenshots: string[];
  entryTime: string;
  exitTime: string;
  confluences: string[];
  confidence: number;
  /** Maximum Adverse Excursion in $ — worst unrealized drawdown during the trade (optional) */
  mae?: number | null;
  /** Maximum Favorable Excursion in $ — best unrealized profit during the trade (optional) */
  mfe?: number | null;
  /** Slippage in $ (optional, mostly populated by broker imports) */
  slippage?: number | null;
  /** Demo trade inserted by onboarding — badged "Example" until the user edits it */
  isExample?: boolean;
  /**
   * Le compte de trading auquel ce trade appartient.
   *
   * PORTÉ PAR LE TRADE, et non déduit du compte actif au moment de l'écriture.
   * `tradeToRow` lisait `getActiveAccountId()` à chaque enregistrement, y
   * compris lors d'une MODIFICATION : corriger une note sur un trade du compte
   * A pendant que le compte B était sélectionné déplaçait silencieusement ce
   * trade vers B — il disparaissait de son compte d'origine sans que rien ne le
   * signale. Absent (import, création) : le compte actif s'applique, ce qui est
   * le comportement voulu à la CRÉATION.
   */
  accountId?: string | null;

  // ── Données d'exécution (import broker) ──────────────────────────────────
  // Optionnelles : une saisie manuelle n'en porte aucune, et aucune statistique
  // ne les exige. Elles existent pour que le trade importé arrive COMPLET dans
  // le formulaire (« 2 contrats, 18 012,25 → 18 031,50 ») et pour que le trader
  // puisse vérifier ce que le broker a réellement exécuté.

  /** Nombre de contrats (ou de lots) — la taille maximale de la position. */
  quantity?: number | null;
  /** Prix moyen d'entrée (prix de MARCHÉ : jamais recalibré). */
  entryPrice?: number | null;
  /** Prix moyen de sortie (prix de MARCHÉ : jamais recalibré). */
  exitPrice?: number | null;
  /** Commissions et frais en monnaie du compte, déjà déduits de `pnl`. */
  fees?: number | null;
  /** Broker d'origine (`tradovate`…) — absent pour une saisie manuelle. */
  broker?: string | null;
  /** Identifiant STABLE du trade chez le broker : la clé de déduplication. */
  externalId?: string | null;
  /** Nom du compte chez le broker (ex. « APEX-1234-07 »). */
  brokerAccount?: string | null;
  /**
   * Importé automatiquement et pas encore relu. Le formulaire du trade s'ouvre
   * de lui-même sur un trade dans cet état ; l'enregistrer le marque relu.
   */
  reviewPending?: boolean;
  /** Trade dont celui-ci est la COPIE (transfert entre comptes). */
  copiedFrom?: string | null;
}

export interface TradeStats {
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  avgWin: number;
  avgLoss: number;
  /** Gains bruts / pertes brutes ; null si aucune perte observée. */
  profitFactor: number | null;
  maxDrawdown: number;
  /** False if the input cannot establish reliable intraday ordering. */
  maxDrawdownOrderVerified: boolean;
  currentStreak: number;
  currentStreakType: "win" | "loss" | "be" | "none";
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  /** R réalisé moyen sur les trades au R mesurable (`measuredR`) ; null sans échantillon. */
  avgRR: number | null;
  /** Gain réalisé moyen en R, sur les gagnants à risque initial connu. */
  avgWinR: number | null;
  /** Perte réalisée moyenne signée en R, sur les perdants à risque connu. */
  avgLossR: number | null;
  /** Nombre de trades permettant de calculer un R observé. */
  rSampleSize: number;
  /** Part des trades avec un R effectivement mesurable (0..100). */
  rCoveragePct: number;
  dailyPnl: Record<string, number>;
  pnlByStrategy: Record<string, { pnl: number; count: number; wins: number; breakEven: number }>;
  pnlByDayOfWeek: Record<number, { pnl: number; count: number; wins: number; breakEven: number }>;
  equityCurve: { date: string; equity: number }[];
  mistakeStats: Record<string, { count: number; totalPnl: number }>;
}

/** Break-even is an outcome, not a trade direction. A broker can label a
 * position BE while commissions leave a genuinely negative net result. */
export function isBreakEven(t: Pick<Trade, "pnl">): boolean {
  return t.pnl === 0;
}

/** Les champs dont dépend la preuve d'un risque initial. */
export type RiskEvidence = Pick<Trade, "pnl" | "riskAmount" | "broker" | "reviewPending">;

/**
 * LE RISQUE INITIAL EST-IL UNE DONNÉE EXPLOITABLE ? — définition UNIQUE du
 * produit, partagée par le client, le serveur et Jarvis.
 *
 * Sept écrans recalculaient chacun leur propre règle : Analytics et le
 * Dashboard comptaient un import broker non relu, le Calendrier l'écartait,
 * les motifs nocturnes et le total R du Dashboard prenaient un risque inconnu
 * pour 0R. Le même trader lisait donc deux R moyens différents selon l'écran.
 *
 * Un risque est exploitable s'il est strictement positif, fini, et qu'il a été
 * saisi ou relu par le trader hors import broker :
 * - `reviewPending` : import pas encore relu, le risque n'est pas confirmé ;
 * - `broker` : la synchro substitue un « risque par défaut » déclaré à la
 *   connexion quand aucun stop n'est retrouvé, et la base ne conserve pas
 *   laquelle des deux sources a servi. Tant que cette provenance n'est pas
 *   persistée (lot 1), le R d'un trade broker reste INCONNU plutôt que
 *   d'additionner des stops observés et des risques forfaitaires.
 */
export function hasMeasuredRisk(t: Pick<RiskEvidence, "riskAmount" | "broker" | "reviewPending">) {
  return !t.reviewPending && !t.broker && Number.isFinite(t.riskAmount) && t.riskAmount > 0;
}

/**
 * Le R RÉALISÉ d'un trade — P&L net / risque initial — ou `null` s'il n'est
 * pas mesurable. `null` n'est jamais 0R : un trade sans risque connu n'a pas
 * de multiple, il n'a pas un multiple nul.
 */
export function measuredR(t: RiskEvidence): number | null {
  if (!hasMeasuredRisk(t) || !Number.isFinite(t.pnl)) return null;
  return t.pnl / t.riskAmount;
}

/**
 * Somme des R d'un ensemble, uniquement si CHAQUE trade a un R mesurable.
 * Un total partiel mélangerait l'échantillon mesuré et le reste en silence :
 * « +3R sur le mois » alors que la moitié des trades n'a pas de R.
 */
export function totalMeasuredR(trades: readonly RiskEvidence[]): number | null {
  if (trades.length === 0) return null;
  let sum = 0;
  for (const t of trades) {
    const r = measuredR(t);
    if (r === null) return null;
    sum += r;
  }
  return sum;
}
