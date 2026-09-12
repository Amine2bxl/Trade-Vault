/**
 * Simulation d'exécution — remplissage, brackets, positions, P&L.
 *
 * Le moteur dit OÙ L'ON EST ; ce module décide CE QUI SE PASSE. Il consomme des
 * bougies 1m fermées (jamais futures), évalue les ordres au contact des highs
 * et lows, applique commissions et glissement, et réécrit positions et P&L —
 * toujours de façon DÉTERMINISTE, pour que « bougie précédente » puisse
 * reconstruire l'état exact en rejouant le passé.
 *
 * Aucun module de ce fichier ne touche au DOM ni à Supabase : c'est le cœur
 * réutilisable et testable du terminal.
 */

import {
  OhlcBar,
  Order,
  OrderHistoryRow,
  OrderSide,
  OrderType,
  Position,
  ReplaySessionState,
  ReplayTrade,
} from "./types";
import { InstrumentSpec, NQ, pnlOf, roundToTick } from "./instruments";
import { markPriceAt } from "./engine";

export interface SimContext {
  spec: InstrumentSpec;
  commissionPerContract: number;
  slippageTicks: number;
}

// ── Identifiants déterministes et lisibles ─────────────────────────────────
let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}:${Date.now().toString(36)}-${seq}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const ctx = (symbol: string, commission: number, slippage: number): SimContext => ({
  spec: NQ,
  commissionPerContract: commission,
  slippageTicks: slippage,
});

/** Contexte courant d'une session (uniquement pour la lisibilité du module). */
function simContextOf(state: ReplaySessionState): SimContext {
  return ctx(state.symbol, state.commissionPerContract, state.slippageTicks);
}

// ── Création de l'état initial ─────────────────────────────────────────────
export function createInitialState(seed: {
  symbol: string;
  startingBalance: number;
  now: number;
  commissionPerContract: number;
  slippageTicks: number;
}): ReplaySessionState {
  return {
    account: {
      startingBalance: seed.startingBalance,
      balance: seed.startingBalance,
      realizedPnl: 0,
      openPnl: 0,
      commissions: 0,
      activeRisk: 0,
      equity: seed.startingBalance,
    },
    orders: [],
    positions: [],
    closedTrades: [],
    executions: [],
    now: seed.now,
    viewTimeframe: "5m",
    playbackSpeed: 1,
    finished: false,
    appliedUpTo: null,
    symbol: seed.symbol,
    commissionPerContract: seed.commissionPerContract,
    slippageTicks: seed.slippageTicks,
    drawings: [],
  };
}

// ── Placement d'ordres ─────────────────────────────────────────────────────
export interface PlaceOrderInput {
  side: OrderSide;
  type: OrderType;
  qty: number;
  /** limit/stop seulement. */
  price?: number | null;
  /** Bracket posé EN MÊME TEMPS que l'entrée. */
  bracketSl?: number | null;
  bracketTp?: number | null;
}

export interface PlaceOrderCall {
  state: ReplaySessionState;
  input: PlaceOrderInput;
  /** Bars connus (1m du moteur) — sert au prix marqué des ordres au marché. */
  bars: OhlcBar[];
}

/**
 * Place un ordre. Seuls les ordres AU MARCHÉ se remplissent immédiatement ;
 * limit/stop entrent au carnet, évalués bougie par bougie par `processBars`.
 */
export function placeOrder(call: PlaceOrderCall): Order {
  const { state, input, bars } = call;
  const c = simContextOf(state);
  const now = state.now;
  if (input.qty <= 0) throw new Error("qty <= 0");
  const isBuy = input.side === "long";

  const base: Order = {
    id: nextId("ord"),
    side: input.side,
    type: input.type,
    qty: input.qty,
    price: input.type === "market" ? null : roundToTick(input.price ?? 0, c.spec),
    status: "working",
    placedAt: now,
    filledAt: null,
    fillPrice: null,
    filledQty: 0,
    reduceOnly: false,
    parentId: null,
    opensPositionId: null,
    label: input.type === "market" ? "MKT" : input.type === "limit" ? "LMT" : "STP",
    bracketSl: input.bracketSl ?? null,
    bracketTp: input.bracketTp ?? null,
  };

  if (input.type === "market") {
    const mark = markPriceAt(bars, now);
    const slide = c.slippageTicks * c.spec.tickSize;
    const fillPrice = roundToTick(isBuy ? mark + slide : mark - slide, c.spec);
    base.status = "filled";
    base.filledAt = now;
    base.fillPrice = fillPrice;
    state.orders.push(base);
    fillEntry(state, base, c);
    return base;
  }

  state.orders.push(base);
  return base;
}

export function cancelOrder(state: ReplaySessionState, orderId: string): void {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== "working") return;
  o.status = "cancelled";
  // Si c'est un bracket, la position le perd.
  for (const p of state.positions) {
    if (p.stop?.id === o.id) p.stop = null;
    if (p.target?.id === o.id) p.target = null;
  }
}

/** Déplace un ordre en carnet (drag sur le graphe ou édition du ticket). */
export function moveWorkingOrder(state: ReplaySessionState, orderId: string, price: number): void {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== "working" || o.type === "market") return;
  o.price = roundToTick(price, simContextOf(state).spec);
}

// ── Bracket d'une position ─────────────────────────────────────────────────
/** Remplace le bracket d'une position par {sl, tp} (null = retiré). */
export function setPositionBracket(
  state: ReplaySessionState,
  positionId: string,
  sl: number | null,
  tp: number | null,
): void {
  const c = simContextOf(state);
  const pos = state.positions.find((p) => p.id === positionId);
  if (!pos) return;
  // Retirer les ordres brackets existants.
  for (const o of state.orders) {
    if (o.parentId === pos.id && o.status === "working") o.status = "cancelled";
  }
  const bracket = (which: "stop" | "target", price: number): void => {
    // Un bracket protège la position, donc il est TOUJOURS du coté opposé :
    // un long se sort par un sell stop (SL) ou un sell limit (TP).
    const outSide: OrderSide = pos.side === "long" ? "short" : "long";
    const o: Order = {
      id: nextId(`ord-${which}`),
      side: outSide,
      type: which === "stop" ? "stop" : "limit",
      qty: pos.qty,
      price: roundToTick(price, c.spec),
      status: "working",
      placedAt: state.now,
      filledAt: null,
      fillPrice: null,
      filledQty: 0,
      reduceOnly: true,
      parentId: pos.id,
      opensPositionId: null,
      label: which === "stop" ? "SL" : "TP",
      bracketSl: null,
      bracketTp: null,
    };
    state.orders.push(o);
    if (which === "stop") pos.stop = o;
    else pos.target = o;
  };
  if (sl != null) bracket("stop", sl);
  if (tp != null) bracket("target", tp);
  pos.stopPrice = sl != null ? roundToTick(sl, c.spec) : null;
  pos.targetPrice = tp != null ? roundToTick(tp, c.spec) : null;
  if (sl != null) {
    pos.riskAmount = riskDollars(pos.avgEntry, roundToTick(sl, c.spec), pos.qty, c.spec);
  }
}

// ── Remplissages ───────────────────────────────────────────────────────────
/** Le prix d'exécution d'un ordre au contact de la bougie, ou null. */
export function evalBarFill(o: Order, bar: OhlcBar): number | null {
  if (o.type === "market" || o.price == null) return null;
  const isBuy = o.side === "long";
  if (o.type === "limit") {
    if (isBuy) return bar.low <= o.price ? Math.min(bar.open, o.price) : null;
    return bar.high >= o.price ? Math.max(bar.open, o.price) : null;
  }
  if (isBuy) return bar.high >= o.price ? Math.max(bar.open, o.price) : null;
  return bar.low <= o.price ? Math.min(bar.open, o.price) : null;
}

/** Applique toutes les bougies 1m fermées jusqu'à `state.now`. Incrémental. */
export function processBars(state: ReplaySessionState, bars: OhlcBar[]): void {
  const c = simContextOf(state);
  const applied = state.appliedUpTo ?? (bars[0] ? bars[0].time - 60_000 : 0);
  const snapshot = [...bars];
  for (const bar of snapshot) {
    if (bar.time <= applied) continue;
    if (bar.time + 60_000 > state.now) break; // bougie encore en formation
    processBar(state, bar, c);
    state.appliedUpTo = bar.time;
  }
  refreshValuation(state, snapshot);
}

function processBar(state: ReplaySessionState, bar: OhlcBar, c: SimContext): void {
  const working = state.orders
    .filter((o) => o.status === "working")
    // Les sorties (SL/TP) ont priorité sur les entrées si les deux touchent
    // dans la même bougie : le cas hostile se règle d'abord.
    .sort((a, b) => Number(b.reduceOnly) - Number(a.reduceOnly));
  for (const o of working) {
    const fillPrice = evalBarFill(o, bar);
    if (fillPrice == null) continue;
    if (o.reduceOnly) {
      const pos = state.positions.find((p) => p.id === o.parentId);
      if (!pos) {
        o.status = "cancelled";
        continue;
      }
      fillReduce(state, pos, o, fillPrice, c, o.label === "SL" ? "stop" : "target");
    } else {
      o.fillPrice = roundToTick(fillPrice, c.spec);
      o.filledAt = state.now;
      o.status = "filled";
      fillEntry(state, o, c);
    }
  }
}

function fillEntry(state: ReplaySessionState, order: Order, c: SimContext): void {
  const price = order.fillPrice ?? order.price ?? 0;
  const notionalQty = order.qty - order.filledQty;
  const qty = Math.max(0, notionalQty);
  if (qty <= 0) return;
  order.filledQty += qty;

  // Un ordre opposé existe ? On referme d'abord (retournement).
  const opposite = state.positions.find((p) => p.side !== order.side && p.qty > 0);
  if (opposite) {
    fillReduce(state, opposite, order, price, c, "manual");
  }

  const remaining = order.filledQty;
  if (remaining <= 0) return;

  const same = state.positions.find((p) => p.side === order.side && p.qty > 0);
  if (same) {
    const total = same.qty + remaining;
    same.avgEntry = (same.avgEntry * same.qty + price * remaining) / total;
    same.qty = total;
    return;
  }
  const pos: Position = {
    id: order.opensPositionId ?? nextId("pos"),
    symbol: state.symbol,
    side: order.side,
    qty: remaining,
    avgEntry: roundToTick(price, c.spec),
    openedAt: order.filledAt ?? state.now,
    riskAmount: 0,
    stop: null,
    target: null,
    stopPrice: null,
    targetPrice: null,
    realizedPnl: 0,
    commissions: 0,
    totalClosedQty: 0,
  };
  state.positions.push(pos);
  order.opensPositionId = pos.id;
  if (order.bracketSl != null || order.bracketTp != null) {
    const p = order.price ?? price;
    void p;
    setPositionBracket(state, pos.id, order.bracketSl, order.bracketTp);
  }
}

function fillReduce(
  state: ReplaySessionState,
  pos: Position,
  order: Order,
  fillPrice: number,
  c: SimContext,
  reason: ReplayTrade["exitReason"],
): void {
  const remainingOrderQty = order.qty - order.filledQty;
  const qty = Math.min(remainingOrderQty, pos.qty);
  if (qty <= 0) return;
  const dir = pos.side === "long" ? 1 : -1;
  const gross = (fillPrice - pos.avgEntry) * dir * qty * c.spec.multiplier;
  const fee = qty * c.commissionPerContract;
  pos.realizedPnl += gross - fee;
  pos.commissions += fee;
  pos.qty -= qty;
  pos.totalClosedQty += qty;
  pos.closedWeightedPrice = (pos.closedWeightedPrice ?? 0) + fillPrice * qty;

  order.status = "filled";
  order.filledAt = state.now;
  order.fillPrice = roundToTick(fillPrice, c.spec);
  order.filledQty += qty;
  state.executions.push({
    id: nextId("ex"),
    orderId: order.id,
    at: state.now,
    price: roundToTick(fillPrice, c.spec),
    qty,
    side: order.side,
  });

  if (pos.qty <= 0) closePositionFully(state, pos, reason);
}

/** Ferme une position au prix donné (sortie manuelle, réductions incluses). */
export function closePosition(
  state: ReplaySessionState,
  positionId: string,
  price: number,
  reason: ReplayTrade["exitReason"],
): void {
  const c = simContextOf(state);
  const pos = state.positions.find((p) => p.id === positionId);
  if (!pos || pos.qty <= 0) return;
  const dir = pos.side === "long" ? 1 : -1;
  const gross = (price - pos.avgEntry) * dir * pos.qty * c.spec.multiplier;
  const fee = pos.qty * c.commissionPerContract;
  pos.realizedPnl += gross - fee;
  pos.commissions += fee;
  pos.totalClosedQty += pos.qty;
  pos.closedWeightedPrice = (pos.closedWeightedPrice ?? 0) + price * pos.qty;
  pos.qty = 0;
  for (const o of state.orders) {
    if (o.parentId === pos.id && o.status === "working") o.status = "cancelled";
  }
  closePositionFully(state, pos, reason);
}

function closePositionFully(
  state: ReplaySessionState,
  pos: Position,
  reason: ReplayTrade["exitReason"],
): void {
  const exitPrice = (pos.closedWeightedPrice ?? 0) / (pos.totalClosedQty || 1);
  const net = round2(pos.realizedPnl);
  const r = pos.riskAmount > 0 ? net / pos.riskAmount : 0;
  const trade: ReplayTrade = {
    id: pos.id,
    symbol: pos.symbol,
    side: pos.side,
    qty: pos.totalClosedQty,
    entryPrice: round2(pos.avgEntry),
    exitPrice: round2(exitPrice),
    realizedPnl: net,
    riskAmount: round2(pos.riskAmount),
    rMultiple: round2(r),
    entryTime: pos.openedAt,
    exitTime: state.now,
    stopPrice: pos.stopPrice,
    commissions: round2(pos.commissions),
    exitReason: reason,
  };
  state.closedTrades.push(trade);
  state.positions = state.positions.filter((p) => p.id !== pos.id);
  for (const o of state.orders) {
    if (o.parentId === pos.id && o.status === "working") o.status = "cancelled";
  }
}

/** Ferme tout : liquide les positions restantes au prix marqué (fin de session). */
export function flattenPositions(state: ReplaySessionState, bars: OhlcBar[]): void {
  const mark = markPriceAt(bars, state.now);
  for (const pos of [...state.positions]) {
    closePosition(state, pos.id, mark, "session-end");
  }
}

// ── Valorisation ───────────────────────────────────────────────────────────
/** Recalcule balance, open P&L, equity et risque depuis l'état courant. */
export function refreshValuation(state: ReplaySessionState, bars: OhlcBar[]): void {
  const mark = markPriceAt(bars, state.now);
  const spec = NQ;
  let open = 0;
  let activeRisk = 0;
  let realized = 0;
  let commissions = 0;
  for (const t of state.closedTrades) {
    realized += t.realizedPnl;
    commissions += t.commissions;
  }
  for (const pos of state.positions) {
    open += pnlOf(pos.side, pos.qty, pos.avgEntry, mark, spec);
    if (pos.stopPrice != null) {
      const riskPer =
        pos.side === "long" ? pos.avgEntry - pos.stopPrice : pos.stopPrice - pos.avgEntry;
      activeRisk += Math.max(0, riskPer) * pos.qty * spec.multiplier;
    }
  }
  state.account.realizedPnl = round2(realized);
  state.account.commissions = round2(commissions);
  state.account.openPnl = round2(open);
  state.account.activeRisk = round2(activeRisk);
  state.account.balance = round2(state.account.startingBalance + realized - commissions);
  state.account.equity = round2(state.account.balance + open);
}

/**
 * Reconstruit l'état complet à `targetNow` en rejouant l'HISTORIQUE des ordres.
 *
 * Base de la « bougie précédente » : le résultat est exactement celui du chemin
 * incrémental (déterminisme), sans dépendre d'aucune mémoire de fills passés.
 */
export function rebuildState(
  seed: ReplaySessionState,
  bars: OhlcBar[],
  targetNow: number,
): ReplaySessionState {
  const fresh = createInitialState({
    symbol: seed.symbol,
    startingBalance: seed.account.startingBalance,
    now: targetNow,
    commissionPerContract: seed.commissionPerContract,
    slippageTicks: seed.slippageTicks,
  });
  fresh.viewTimeframe = seed.viewTimeframe;
  fresh.playbackSpeed = seed.playbackSpeed;

  const timeline = [...seed.orders]
    .filter((o) => o.placedAt <= targetNow)
    .sort((a, b) => a.placedAt - b.placedAt);
  let idx = 0;

  const activate = (bar: OhlcBar) => {
    const end = bar.time + 60_000;
    while (idx < timeline.length && timeline[idx].placedAt < end) {
      const src = timeline[idx];
      idx += 1;
      if (src.status === "cancelled") {
        fresh.orders.push({ ...src });
        continue;
      }
      // Filled : on rejoue l'exécution avec le prix déjà enregistré.
      if (src.status === "filled" && src.fillPrice != null) {
        const o: Order = { ...src, filledQty: 0, status: "working" };
        fresh.orders.push(o);
        o.fillPrice = null;
        o.filledAt = null;
        if (o.reduceOnly) {
          const pos = fresh.positions.find((p) => p.id === o.parentId);
          if (!pos) {
            o.status = "cancelled";
            continue;
          }
          // `filledQty = 0` ENSUITE : fillReduce calcule le reste à partir de
          // `qty - filledQty`, sinon la réduction était comptée d'avance.
          o.status = "filled";
          o.filledAt = src.filledAt;
          o.fillPrice = src.fillPrice;
          o.filledQty = 0;
          fillReduce(
            fresh,
            pos,
            o,
            o.fillPrice,
            simContextOf(seed),
            o.label === "SL" ? "stop" : "target",
          );
        } else {
          o.status = "filled";
          o.filledAt = src.filledAt;
          o.fillPrice = src.fillPrice;
          o.filledQty = 0; // fillEntry recompute le remplissage
          fillEntry(fresh, o, simContextOf(seed));
        }
        continue;
      }
      // Working : on remet l'ordre au carnet à sa date de placement.
      const o: Order = { ...src, status: "working" };
      fresh.orders.push(o);
      if (o.reduceOnly) {
        const pos = fresh.positions.find((p) => p.id === o.parentId);
        if (pos) {
          if (o.label === "SL") pos.stop = o;
          else pos.target = o;
        }
      }
    }
  };

  for (const bar of bars) {
    if (bar.time + 60_000 > targetNow) break;
    activate(bar);
    processBar(fresh, bar, simContextOf(seed));
  }
  fresh.appliedUpTo = bars.reduce((a, b) => (b.time + 60_000 <= targetNow ? b.time : a), 0);
  refreshValuation(fresh, bars);
  return fresh;
}

// ── Vue historique ─────────────────────────────────────────────────────────
/** Ligne d'historique humaine d'un ordre (toutes les exécutions connues). */
export function orderHistory(state: ReplaySessionState): OrderHistoryRow[] {
  return state.orders.map((o) => ({
    id: o.id,
    side: o.side,
    type: o.type,
    qty: o.qty,
    price: o.price,
    status: o.status,
    placedAt: o.placedAt,
    filledAt: o.filledAt,
    fillPrice: o.fillPrice,
    label: o.label,
    pnl: o.reduceOnly ? (o.filledQty > 0 ? maybePnlOf(state, o) : null) : null,
  }));
}

/** PnL réalisé porté par un ordre réduisant (pour l'historique). */
function maybePnlOf(state: ReplaySessionState, o: Order): number | null {
  // Approximation raisonnable : le PnL est porté par les trades clos.
  const t = state.closedTrades.find((x) => x.exitTime === o.filledAt);
  return t ? t.realizedPnl : null;
}

// ── Raccourcis de calcul ───────────────────────────────────────────────────
export function riskDollars(
  entry: number,
  stop: number,
  qty: number,
  spec: InstrumentSpec = NQ,
): number {
  const perPoint = Math.abs(entry - stop);
  return perPoint * qty * spec.multiplier;
}
