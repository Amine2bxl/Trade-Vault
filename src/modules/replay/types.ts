/**
 * Replay — types du noyau de rejeu historique.
 *
 * Ce module est PUR (pas de React, pas de Supabase, pas de navigateur) : le
 * moteur de rejeu, le générateur de données et la logique d'ordres vivent ici
 * pour pouvoir être testés et réutilisés sans interface.
 */

/** Une bougie OHLC. `open` = ms epoch (UTC) du début de la bougie. */
export interface OhlcBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Position de marché. */
export type Side = "long" | "short";

export type OrderSide = Side;

export type OrderType = "market" | "limit" | "stop";

export type OrderStatus = "working" | "filled" | "cancelled" | "expired";

/** Un ordre du carnet. Les ordres de bracket (SL/TP) sont des lignes avec
 *  `reduceOnly`, reliées à la position qu'elles protègent par `parentId`. */
export interface Order {
  id: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  /** Prix limite / déclencheur. Nul pour un ordre au marché. */
  price: number | null;
  status: OrderStatus;
  /** Ms epoch simulé du placement. */
  placedAt: number;
  /** Ms epoch simulé de l'exécution, `null` tant que l'ordre n'est pas exécuté. */
  filledAt: number | null;
  /** Prix d'exécution effectif (avec glissement), `null` tant que working. */
  fillPrice: number | null;
  /** Qté réellement exécutée (partials possibles). */
  filledQty: number;
  /** Ordre de sortie (bracket) : réduit la position au lieu de l'ouvrir. */
  reduceOnly: boolean;
  /** Id de la position à laquelle ce bracket est attaché (SL/TP). */
  parentId: string | null;
  /** Id de la position OUVRANTE (ordres d'entrée). */
  opensPositionId: string | null;
  /** Label humain (« Entry », « SL », « TP ») — affiché sur le graphe. */
  label: string;
  /** Prix du stop / take profit embarqués dans un ordre d'entrée (bracket). */
  bracketSl: number | null;
  bracketTp: number | null;
}

/** Position ouverte. */
export interface Position {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  /** Prix d'entrée moyen (moyenne pondérée des fills d'entrée). */
  avgEntry: number;
  /** Ms epoch simulé de l'ouverture. */
  openedAt: number;
  /** Risque initial ($) de la position, figé à l'ouverture (stop − entrée). */
  riskAmount: number;
  /** Ordre de sortie si présent (must-exist, retiré au fill). */
  stop: Order | null;
  /** Ordre de prise de bénéfice si présent. */
  target: Order | null;
  /** Pilliers du bracket — prix fixés au placement. */
  stopPrice: number | null;
  targetPrice: number | null;
  /** PnL réalisé accumulé (négatif = perte) pendant la vie de la position. */
  realizedPnl: number;
  /** Commissions accumulées. */
  commissions: number;
  /** Qté totale déjà refermée (sorties partielles). */
  totalClosedQty: number;
  /** Somme pondérée des prix de sortie (pour le prix de sortie moyen). */
  closedWeightedPrice?: number;
}

/** Un trade CLOS, prêt à rejoindre le journal. */
export interface ReplayTrade {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  /** PnL réalisé en $, commissions déjà déduites. */
  realizedPnl: number;
  riskAmount: number;
  rMultiple: number;
  entryTime: number;
  exitTime: number;
  /** Prix du stop à l'ouverture — pour le calcul de risque. */
  stopPrice: number | null;
  commissions: number;
  /** Ordres qui ont refermé le trade (SL, TP, sorties manuelles). */
  exitReason: "stop" | "target" | "manual" | "session-end";
}

/** État public du compte pendant le rejeu. */
export interface ReplayAccountState {
  startingBalance: number;
  balance: number;
  realizedPnl: number;
  openPnl: number;
  commissions: number;
  /** Risque actif (positions ouvertes), en $. */
  activeRisk: number;
  equity: number;
}

/** L'état complet d'une session, sérialisable en JSON. */
export interface ReplaySessionState {
  account: ReplayAccountState;
  orders: Order[];
  positions: Position[];
  /** Trades clos pendant le rejeu. */
  closedTrades: ReplayTrade[];
  /** Ilot des ordres ayant déjà exécuté (pour l'historique). */
  executions: {
    id: string;
    orderId: string;
    at: number;
    price: number;
    qty: number;
    side: OrderSide;
  }[];
  /** Horloge canonique simulée, ms epoch. */
  now: number;
  /** Timeframe de VUE courant. Change sans réinitialiser l'horloge. */
  viewTimeframe: string;
  /** Vitesse de lecture. */
  playbackSpeed: number;
  /** Fini — refait pointer statut `finished`. */
  finished: boolean;
  /** Dernière 1m appliquée par la simulation (incrémentale), en ms. */
  appliedUpTo: number | null;
  /** Instrument du rejeu (id dans le registre, ex. `NQ`). */
  symbol: string;
  /** Commissions $/contrat (rejouées pour la reconstruction). */
  commissionPerContract: number;
  /** Glissement en ticks (rejoué pour la reconstruction). */
  slippageTicks: number;
  /** Dessins du graphe — ancrés prix/temps, persistants avec la session. */
  drawings: Drawing[];
}

/** Un dessin d'analyse technique, ancré à des coordonnées prix/temps. */
export interface Drawing {
  id: string;
  kind: DrawingKind;
  /** Couleur (variable de thème ou hex). */
  color: string;
  /** Ancre PRIX-TEMPS : temps en ms, prix en points instrument. */
  points: { x: number; y: number }[];
  text?: string;
}

export type DrawingKind =
  | "hline"
  | "vline"
  | "trend"
  | "ray"
  | "rect"
  | "horizontalRay"
  | "measured"
  | "text"
  | "zone";

/** Aperçu d'un ordre pour l'historique de la session. */
export interface OrderHistoryRow {
  id: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price: number | null;
  status: OrderStatus;
  placedAt: number;
  filledAt: number | null;
  fillPrice: number | null;
  label: string;
  pnl: number | null;
}

/** Configuration de départ choisie par le trader. */
export interface ReplaySessionConfig {
  symbol: string;
  /** Date de session `YYYY-MM-DD` en fuseau NY. */
  date: string;
  /** `HH:MM` en fuseau NY. */
  startTime: string;
  timeframe: string;
  startingBalance: number;
  /** Commissions $ par contrat, aller et retour. */
  commissionPerContract: number;
  /** Glissement par défaut, en ticks, sur les ordres au marché. */
  slippageTicks: number;
}
