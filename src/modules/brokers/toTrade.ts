/**
 * D'un aller-retour broker à une ligne de journal.
 *
 * Tout ce qui est STRUCTUREL est rempli : date, heures d'entrée et de sortie,
 * symbole, sens, contrats, prix moyens, frais, P&L net — et, quand le stop
 * initial a été retrouvé chez le broker, le risque et le R. Tout ce qui est
 * JUGEMENT est laissé au trader : setup, confluences, erreurs, qualité,
 * notes, captures. Le formulaire du trade s'ouvre sur cette ligne pour qu'il
 * le complète (`reviewPending`).
 *
 * Aucun chiffre n'est inventé : sans stop retrouvé ni risque par défaut
 * déclaré, le risque reste à 0 et le R à 0 — le formulaire le demandera.
 */

import type { Trade } from "@/domain/trade";
import type { BrokerId, BrokerStopOrder, RoundTrip } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Date civile `AAAA-MM-JJ` et heure `HH:MM` d'un instant, DANS le fuseau du
 *  trader : un trade de 22 h 30 à New York est un trade du jour, pas du
 *  lendemain UTC. Un fuseau invalide retombe sur UTC plutôt que de lever. */
export function localDateTime(iso: string, timeZone: string): { date: string; time: string } {
  const d = new Date(iso);
  let tz = timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** Marge avant l'entrée : un ordre bracket est souvent horodaté quelques
 *  millisecondes AVANT l'exécution qu'il protège. */
const STOP_LEAD_MS = 5_000;

/**
 * Le risque INITIAL d'un aller-retour, d'après le premier stop posé sur la
 * position : |entrée − stop| × contrats × valeur du point.
 *
 * Seul un stop du BON côté compte (sous l'entrée pour un long). Un stop déjà
 * remonté au-dessus de l'entrée protège un gain, il ne mesure pas un risque.
 */
export function initialRisk(trip: RoundTrip, stops: readonly BrokerStopOrder[]): number | null {
  const protectSide = trip.direction === "long" ? "sell" : "buy";
  const start = Date.parse(trip.entryTime) - STOP_LEAD_MS;
  const end = Date.parse(trip.exitTime);
  const candidates = stops
    .filter(
      (s) =>
        s.accountId === trip.accountId &&
        s.contractId === trip.contractId &&
        s.side === protectSide &&
        Date.parse(s.time) >= start &&
        Date.parse(s.time) <= end,
    )
    .sort((a, b) => (a.time < b.time ? -1 : 1));
  for (const s of candidates) {
    const distance =
      trip.direction === "long" ? trip.entryPrice - s.stopPrice : s.stopPrice - trip.entryPrice;
    if (distance > 0) return round2(distance * trip.quantity * trip.pointValue);
  }
  return null;
}

export interface TradeContext {
  broker: BrokerId;
  id: string;
  accountId: string | null;
  brokerAccountName: string;
  timeZone: string;
  /** Risque par trade déclaré à la connexion, utilisé faute de stop. */
  defaultRisk: number | null;
  stops: readonly BrokerStopOrder[];
}

export function roundTripToTrade(trip: RoundTrip, ctx: TradeContext): Trade {
  const entry = localDateTime(trip.entryTime, ctx.timeZone);
  const exit = localDateTime(trip.exitTime, ctx.timeZone);
  const risk =
    initialRisk(trip, ctx.stops) ?? (ctx.defaultRisk && ctx.defaultRisk > 0 ? ctx.defaultRisk : 0);
  const pnl = trip.netPnl;
  // Le R est le RAPPORT exact P&L / risque : arrondi au centième, il ferait
  // dériver le P&L d'un cent quand le formulaire le recalcule.
  const rMultiple = risk > 0 ? Math.round((pnl / risk) * 10000) / 10000 : 0;
  return {
    id: ctx.id,
    date: entry.date,
    symbol: trip.symbol.toUpperCase().slice(0, 20),
    // Un aller-retour à P&L brut nul reste un long ou un short : « BE » est
    // un jugement du trader, pas une donnée du broker.
    direction: trip.direction,
    pnl,
    riskAmount: risk,
    rMultiple,
    strategy: "Other",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: entry.time,
    exitTime: exit.time,
    confluences: [],
    confidence: 50,
    mae: null,
    mfe: null,
    slippage: null,
    accountId: ctx.accountId,
    quantity: trip.quantity,
    entryPrice: trip.entryPrice,
    exitPrice: trip.exitPrice,
    fees: trip.fees,
    broker: ctx.broker,
    externalId: trip.externalId,
    brokerAccount: ctx.brokerAccountName,
    reviewPending: true,
  };
}
