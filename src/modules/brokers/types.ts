/**
 * Vocabulaire de la synchronisation broker — indépendant de tout broker.
 *
 * Un broker livre des EXÉCUTIONS (fills). Le journal, lui, raisonne en
 * TRADES : une position ouverte depuis le plat et refermée jusqu'au plat.
 * Tout ce module sert à passer de l'un à l'autre, de façon déterministe, pour
 * que le même historique d'exécutions donne toujours exactement les mêmes
 * trades — c'est ce qui rend la synchronisation rejouable sans doublons.
 */

/** Les brokers branchés. Ajouter un broker = ajouter un identifiant ici, un
 *  adaptateur pur (`tradovate.ts` en est le modèle) et son client serveur. */
export type BrokerId = "tradovate";

export type FillSide = "buy" | "sell";

/** Une exécution, normalisée. */
export interface BrokerFill {
  /** Identifiant stable chez le broker. */
  id: string;
  /** Compte broker qui a exécuté. */
  accountId: string;
  /** Contrat exact (échéance comprise). */
  contractId: string;
  /** Racine du produit (« MNQ », « ES ») — le symbole du journal. */
  symbol: string;
  /** Valeur d'un point de prix pour UN contrat, en monnaie du compte. */
  pointValue: number;
  side: FillSide;
  qty: number;
  price: number;
  /** Horodatage ISO 8601 (UTC). */
  time: string;
  /**
   * Frais de CETTE exécution (commission + frais d'échange…), ≥ 0 — ou `null`
   * quand le broker ne les a pas fournis (API de frais indisponible, exécution
   * absente de sa réponse). `null` n'est pas 0 : un P&L « net » calculé avec
   * 0 serait un P&L brut présenté comme net.
   */
  fee: number | null;
}

/** Un aller-retour complet : plat → position → plat. */
export interface RoundTrip {
  /**
   * Clé de déduplication : broker, ENVIRONNEMENT (live/démo), compte, première
   * exécution. Les identifiants de compte et d'exécution de Tradovate sont
   * propres à chaque environnement : sans lui, un trade démo et un trade live
   * pouvaient porter la même clé, et le second était ignoré en silence.
   */
  externalId: string;
  accountId: string;
  contractId: string;
  symbol: string;
  pointValue: number;
  direction: "long" | "short";
  /** Taille MAXIMALE atteinte par la position (contrats). */
  quantity: number;
  /** Prix moyen pondéré des exécutions d'entrée. */
  entryPrice: number;
  /** Prix moyen pondéré des exécutions de sortie. */
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  /** P&L brut, avant frais. */
  grossPnl: number;
  /** Somme des frais des exécutions, ou `null` si l'une d'elles est inconnue. */
  fees: number | null;
  /** P&L net = brut − frais : ce que le compte a réellement gagné. `null`
   *  quand les frais sont inconnus — jamais le brut déguisé en net. */
  netPnl: number | null;
  fillIds: string[];
}

/** Un ordre stop vu chez le broker — sert à retrouver le risque initial. */
export interface BrokerStopOrder {
  accountId: string;
  contractId: string;
  /** Sens de l'ordre stop (vendre pour protéger un long). */
  side: FillSide;
  /** Prix de déclenchement INITIAL (première version de l'ordre). */
  stopPrice: number;
  /** Création de l'ordre, ISO 8601. */
  time: string;
}
