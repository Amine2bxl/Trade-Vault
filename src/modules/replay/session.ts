/**
 * Session de rejeu — sérialisation, résumé, cycle de vie.
 *
 * Le terminal persiste une session en un seul JSONB (l'état complet), ce qui
 * rend la reprise littérale : ordres, positions, horloge, dessins, compte —
 * tout repart exactement où le trader s'est arrêté. Ce module produit/valide
 * cette représentation et les chiffres du résumé de fin de session.
 */

import { Drawing, OhlcBar, ReplaySessionState } from "./types";
import { markPriceAt } from "./engine";
import { nyDateOf, nyTimeOf } from "./calendar";

/** Version du format d'état — incrémenter quand l'état ne se migre pas en douceur. */
export const STATE_VERSION = 1;

/** La forme d'une ligne en base. */
export interface ReplaySessionRow {
  id: string;
  user_id: string;
  account_id: string;
  instrument: string;
  start_date: string;
  start_time: string;
  timeframe: string;
  status: "setup" | "active" | "finished" | "abandoned";
  state: string;
  created_at: string;
  updated_at: string;
}

/** Sérialise l'état en JSONB versionné. */
export function serializeState(state: ReplaySessionState): string {
  return JSON.stringify({ v: STATE_VERSION, ...state });
}

/** Dé-sérialise un état, en protégeant les lectures d'anciennes versions. */
export function deserializeState(raw: string | null | undefined): ReplaySessionState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ReplaySessionState & { v?: number };
    if (!parsed || parsed.account == null) return null;
    if (parsed.v !== STATE_VERSION) {
      console.warn(`[replay] version d'état inconnue ${parsed.v}, session ignorée`);
      return null;
    }
    const clean = { ...parsed };
    delete (clean as { v?: number }).v;
    if (!Array.isArray(clean.orders)) clean.orders = [];
    if (!Array.isArray(clean.positions)) clean.positions = [];
    if (!Array.isArray(clean.closedTrades)) clean.closedTrades = [];
    if (!Array.isArray(clean.executions)) clean.executions = [];
    if (!Array.isArray(clean.drawings)) clean.drawings = [];
    return clean;
  } catch {
    return null;
  }
}

/** Marque le prix comme à jour après une session reprise. */
export function stateWithMark(state: ReplaySessionState, bars: OhlcBar[]): ReplaySessionState {
  const now = state.now;
  const copy: ReplaySessionState = JSON.parse(serializeState(state)) as ReplaySessionState;
  copy.appliedUpTo = bars.reduce((a, b) => (b.time + 60_000 <= now ? b.time : a), 0);
  return copy;
}

// ── Résumé de fin de session ───────────────────────────────────────────────
export interface SessionSummary {
  tradesCount: number;
  netPnl: number;
  commissions: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  avgR: number;
  /** PnL du dernier ordre sortant (fin de session forcée incluse). */
}

export function summarize(state: ReplaySessionState): SessionSummary {
  const trades = state.closedTrades;
  const net = trades.reduce((s, t) => s + t.realizedPnl, 0);
  const wins = trades.filter((t) => t.realizedPnl > 0);
  const totalR = trades.reduce((s, t) => s + t.rMultiple, 0);
  return {
    tradesCount: trades.length,
    netPnl: Math.round(net * 100) / 100,
    commissions: Math.round(state.account.commissions * 100) / 100,
    winRate: trades.length ? wins.length / trades.length : 0,
    bestTrade: trades.length ? Math.max(...trades.map((t) => t.realizedPnl)) : 0,
    worstTrade: trades.length ? Math.min(...trades.map((t) => t.realizedPnl)) : 0,
    avgR: trades.length ? totalR / trades.length : 0,
  };
}

/** Description courte d'un instant simulé (« 2025-01-14 · 09:42 »). */
export function clockLabel(ms: number): string {
  return `${nyDateOf(ms)} · ${nyTimeOf(ms)}`;
}

/** Dessin vierge à l'instant donné (prêt à être ancré). */
export function emptyDrawing(kind: Drawing["kind"], x: number, y: number): Drawing {
  return {
    id: `drw:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    color: "var(--tv-accent)",
    points: [{ x, y }],
  };
}

export { markPriceAt };
