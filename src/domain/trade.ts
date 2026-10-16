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
  profitFactor: number;
  maxDrawdown: number;
  currentStreak: number;
  currentStreakType: "win" | "loss" | "be" | "none";
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  avgRR: number;
  dailyPnl: Record<string, number>;
  pnlByStrategy: Record<string, { pnl: number; count: number; wins: number; breakEven: number }>;
  pnlByDayOfWeek: Record<number, { pnl: number; count: number; wins: number; breakEven: number }>;
  equityCurve: { date: string; equity: number }[];
  mistakeStats: Record<string, { count: number; totalPnl: number }>;
}

export function isBreakEven(t: Trade): boolean {
  return t.direction === "be";
}
