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
import { InstrumentSpec, NQ, instrumentOf, pnlOf, roundToTick } from "./instruments";
import { markPriceAt } from "./engine";
import { intrabarSlice } from "./intrabar";

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
// Le spec vient du REGISTRE, pas d'une constante : figer NQ ici rendait
// silencieusement faux tout P&L, tout arrondi au tick et tout glissement dès
// l'inscription d'un second instrument (ES, YM, RTY…).
const ctx = (symbol: string, commission: number, slippage: number): SimContext => ({
  spec: instrumentOf(symbol),
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
  days?: number;
  maxDailyLossPct?: number;
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
    // Tout ce qui a CLOS avant l'instant de départ est déjà de l'histoire.
    // Laisser `null` faisait rejouer la séance entière depuis 18 h au premier
    // appel de `processBars` : un ordre posé à 09:31 pouvait se remplir sur une
    // bougie de la nuit, donc à un prix antérieur à son propre placement. La
    // minute qui CONTIENT le départ, elle, reste à jouer.
    appliedUpTo: seed.now - 60_000,
    symbol: seed.symbol,
    days: seed.days ?? 1,
    maxDailyLossPct: seed.maxDailyLossPct,
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
  // UN ORDRE EN CARNET A BESOIN D'UN PRIX RÉEL. Sans cette garde, un champ de
  // prix laissé vide arrivait ici à 0 : l'ordre s'inscrivait au carnet, ne se
  // remplissait jamais, et se dessinait si loin sous le graphe qu'il en
  // devenait invisible. Refuser tout de suite vaut mieux qu'un ordre fantôme.
  if (input.type !== "market" && !(Number(input.price) > 0)) {
    throw new Error("un ordre limite ou stop exige un prix strictement positif");
  }
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
  o.cancelledAt = state.now;
  // Si c'est un bracket, la position le perd.
  for (const p of state.positions) {
    if (p.stop?.id === o.id) p.stop = null;
    if (p.target?.id === o.id) p.target = null;
  }
}

/**
 * Déplace un ordre en carnet (drag sur le graphe ou édition du ticket).
 *
 * LE BRACKET SUIT L'ENTRÉE. Déplacer un ordre limite de vingt points sans
 * emmener son stop, c'est changer le risque du trade à l'insu du trader : la
 * distance qu'il avait choisie n'existe plus. On translate donc le stop et
 * l'objectif du même écart — c'est ce que fait Project X, et c'est la seule
 * lecture qui préserve l'intention.
 */
export function moveWorkingOrder(
  state: ReplaySessionState,
  orderId: string,
  price: number,
  /**
   * Le prix courant du marché. Fourni, il fait BASCULER le sens d'un ordre
   * d'entrée qu'on traîne de l'autre côté du marché (voir plus bas).
   */
  mark?: number,
): void {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== "working" || o.type === "market") return;
  const spec = simContextOf(state).spec;
  const next = roundToTick(price, spec);
  const delta = o.price != null ? next - o.price : 0;
  o.price = next;
  if (delta !== 0) {
    if (o.bracketSl != null) o.bracketSl = roundToTick(o.bracketSl + delta, spec);
    if (o.bracketTp != null) o.bracketTp = roundToTick(o.bracketTp + delta, spec);
  }

  // ── LE SENS SUIT LE CÔTÉ DU MARCHÉ ───────────────────────────────────────
  // Traîner une entrée de l'autre côté du prix la retourne : au-dessus du
  // marché, une limite ne peut être qu'une VENTE ; en dessous, qu'un ACHAT.
  // (Pour un stop, c'est l'inverse : il se déclenche dans le sens de la
  // cassure.) Sans cette bascule, on obtenait un ordre impossible — un achat
  // limite posé au-dessus du marché se remplirait à l'instant même — et il
  // fallait l'annuler pour en reposer un dans l'autre sens.
  if (mark == null || !Number.isFinite(mark) || o.reduceOnly) return;
  const wanted: OrderSide =
    o.type === "limit" ? (next > mark ? "short" : "long") : next > mark ? "long" : "short";
  if (wanted === o.side) return;
  o.side = wanted;
  // Le bracket se retourne AUTOUR DE L'ENTRÉE en gardant ses distances : le
  // trader a choisi « quarante ticks de risque », pas « un stop à tel prix ».
  const mirror = (v: number | null): number | null =>
    v == null ? null : roundToTick(2 * next - v, spec);
  o.bracketSl = mirror(o.bracketSl);
  o.bracketTp = mirror(o.bracketTp);
}

/**
 * Change le bracket d'un ordre ENCORE EN CARNET.
 *
 * Tant que l'entrée n'est pas remplie, son stop et son objectif ne sont pas
 * des ordres : ce sont deux nombres portés par l'entrée, qui deviendront des
 * ordres au remplissage (`fillEntry` → `setPositionBracket`). Les déplacer se
 * fait donc ici, et non en passant par la position — qui n'existe pas encore.
 *
 * Le côté est contraint : un stop d'achat est SOUS l'entrée, son objectif
 * au-dessus. Accepter l'inverse aurait produit un ordre qui se déclenche à
 * l'instant même du remplissage.
 *
 * Trois valeurs, trois sens : un nombre pose le niveau, `null` le retire,
 * `undefined` n'y touche pas. Glisser le stop ne doit pas effacer l'objectif
 * qu'on n'a pas touché.
 */
export function setOrderBracket(
  state: ReplaySessionState,
  orderId: string,
  sl: number | null | undefined,
  tp: number | null | undefined,
): void {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== "working" || o.reduceOnly) return;
  const spec = simContextOf(state).spec;
  const entry = o.price;
  const isBuy = o.side === "long";
  const ok = (v: number, wantBelow: boolean): boolean =>
    entry == null || (wantBelow ? v < entry : v > entry);
  // `null` retire le niveau ; un prix du mauvais côté est IGNORÉ plutôt que
  // corrigé — le trait s'arrête au bord de l'entrée, il ne saute pas.
  if (sl === null) o.bracketSl = null;
  else if (sl !== undefined && ok(sl, isBuy)) o.bracketSl = roundToTick(sl, spec);
  if (tp === null) o.bracketTp = null;
  else if (tp !== undefined && ok(tp, !isBuy)) o.bracketTp = roundToTick(tp, spec);
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
  let forming: OhlcBar | null = null;
  for (const bar of snapshot) {
    if (bar.time <= applied) continue;
    if (bar.time + 60_000 > state.now) {
      // Bougie encore en formation : elle n'est pas « appliquée », mais ce qui
      // en est DÉJÀ visible peut déclencher un ordre.
      if (bar.time <= state.now) forming = bar;
      break;
    }
    processBar(state, bar, c);
    state.appliedUpTo = bar.time;
  }
  if (forming) processPartialBar(state, forming, c);
  refreshValuation(state, snapshot);
}

/**
 * Évalue les ordres contre la part VISIBLE de la minute en cours.
 *
 * Sans cela, le terminal était incohérent avec lui-même : le graphe montrait la
 * mèche pousser jusqu'au stop, et l'ordre attendait la clôture de la minute
 * pour se déclencher. Le prix marqué traversant désormais tout le chemin
 * intra-bougie, on évalue au même endroit que ce qu'on affiche.
 *
 * La bougie n'est jamais marquée « appliquée » : à sa clôture, `processBar` la
 * traitera normalement, et les ordres déjà remplis n'y sont plus éligibles. Le
 * déclenchement reste une fonction pure de (bougie, fraction écoulée), donc
 * `rebuildState` le reproduit à l'identique.
 */
function processPartialBar(state: ReplaySessionState, bar: OhlcBar, c: SimContext): void {
  processBar(state, bar, c, state.now);
}

/**
 * Évalue les ordres contre une bougie, jusqu'à l'instant `until`.
 *
 * `until` borne ce que la bougie a le droit de déclencher : la fin de la minute
 * quand elle est close, l'horloge quand elle est en formation. Chaque ordre
 * n'est confronté qu'à la TRANCHE qu'il a traversée — un ordre posé à 09:31:40
 * ne peut pas se remplir sur le creux de 09:31:10.
 */
function processBar(
  state: ReplaySessionState,
  bar: OhlcBar,
  c: SimContext,
  until = bar.time + 60_000,
): void {
  const end = Math.min(bar.time + 60_000, until);
  const working = state.orders
    .filter((o) => o.status === "working")
    // Les sorties (SL/TP) ont priorité sur les entrées si les deux touchent
    // dans la même bougie : le cas hostile se règle d'abord.
    .sort((a, b) => Number(b.reduceOnly) - Number(a.reduceOnly));
  for (const o of working) {
    const from = Math.max(bar.time, o.placedAt);
    if (from >= end) continue; // l'ordre n'a rien vécu de cette bougie
    const slice =
      from > bar.time || end < bar.time + 60_000
        ? intrabarSlice(bar, (from - bar.time) / 60_000, (end - bar.time) / 60_000)
        : bar;
    const fillPrice = evalBarFill(o, slice);
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
  const spec = instrumentOf(state.symbol);
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
  const c = simContextOf(seed);
  const fresh = createInitialState({
    symbol: seed.symbol,
    startingBalance: seed.account.startingBalance,
    now: targetNow,
    commissionPerContract: seed.commissionPerContract,
    slippageTicks: seed.slippageTicks,
    days: seed.days,
    maxDailyLossPct: seed.maxDailyLossPct,
  });
  fresh.viewTimeframe = seed.viewTimeframe;
  fresh.playbackSpeed = seed.playbackSpeed;
  fresh.drawings = seed.drawings;

  // ── Les intentions, jamais les résultats ─────────────────────────────────
  // Rejouer les exécutions ENREGISTRÉES faisait remonter le futur dans le
  // passé : reculer à la 10e minute ressuscitait une position ouverte à la
  // 41e, au prix de la 41e. Seuls les GESTES du trader sont rejoués ; fills,
  // positions et brackets sont recalculés à partir des bougies.
  const entries = seed.orders
    .filter((o) => !o.reduceOnly && o.placedAt <= targetNow)
    .map((o) => ({ at: o.placedAt, rank: 0, order: o }));

  // Les brackets d'une position sont posés d'un seul geste (SL et TP partagent
  // leur `placedAt`) : on regroupe pour rejouer la pose, pas les deux ordres —
  // les republier tels quels les DOUBLAIT à chaque reconstruction.
  const poses = new Map<
    string,
    { at: number; parentId: string; sl: number | null; tp: number | null }
  >();
  for (const o of seed.orders) {
    if (!o.reduceOnly || o.parentId == null || o.placedAt > targetNow) continue;
    const key = `${o.parentId}@${o.placedAt}`;
    const g = poses.get(key) ?? { at: o.placedAt, parentId: o.parentId, sl: null, tp: null };
    if (o.label === "SL") g.sl = o.price;
    else g.tp = o.price;
    poses.set(key, g);
  }
  const brackets = [...poses.values()].map((g) => ({ at: g.at, rank: 1, bracket: g }));

  // Une annulation n'a de sens qu'à sa date : sans elle, l'ordre disparaissait
  // du carnet dès son placement.
  const cancels = seed.orders
    .filter((o) => o.status === "cancelled" && o.cancelledAt != null && o.cancelledAt <= targetNow)
    .map((o) => ({ at: o.cancelledAt as number, rank: 2, orderId: o.id }));

  type Intent = (typeof entries)[number] | (typeof brackets)[number] | (typeof cancels)[number];
  // `rank` départage les gestes simultanés : une entrée crée la position que
  // le bracket vise, et l'annulation vient après ce qu'elle annule.
  const intents: Intent[] = [...entries, ...brackets, ...cancels].sort(
    (a, b) => a.at - b.at || a.rank - b.rank,
  );

  let idx = 0;
  const apply = (it: Intent): void => {
    fresh.now = it.at;
    if ("order" in it) {
      const src = it.order;
      // L'ordre repart VIERGE de toute exécution : ce qui doit arriver sera
      // décidé par les bougies, pas recopié.
      const o: Order = {
        ...src,
        status: "working",
        filledAt: null,
        fillPrice: null,
        filledQty: 0,
        cancelledAt: null,
      };
      fresh.orders.push(o);
      // Seul l'ordre au marché se remplit à l'instant du geste ; son prix est
      // recalculé depuis les bougies, donc identique à l'original.
      if (o.type === "market") {
        const mark = markPriceAt(bars, it.at);
        const slide = c.slippageTicks * c.spec.tickSize;
        o.fillPrice = roundToTick(o.side === "long" ? mark + slide : mark - slide, c.spec);
        o.filledAt = it.at;
        o.status = "filled";
        fillEntry(fresh, o, c);
      }
      return;
    }
    if ("bracket" in it) {
      const g = it.bracket;
      // Idempotent : `setPositionBracket` annule la pose précédente avant de
      // reposer, donc rejouer la pose initiale puis ses ajustements converge.
      if (fresh.positions.some((p) => p.id === g.parentId)) {
        setPositionBracket(fresh, g.parentId, g.sl, g.tp);
      }
      return;
    }
    cancelOrder(fresh, it.orderId);
  };

  const applyBefore = (until: number): void => {
    while (idx < intents.length && intents[idx].at < until) {
      apply(intents[idx]);
      idx += 1;
    }
  };

  let applied = 0;
  for (const bar of bars) {
    if (bar.time + 60_000 > targetNow) break;
    applyBefore(bar.time + 60_000);
    fresh.now = bar.time + 60_000;
    processBar(fresh, bar, c);
    applied = bar.time;
  }

  // La dernière minute n'est pas close : ses gestes n'ont encore produit aucun
  // remplissage, mais ils existent. Les omettre faisait DISPARAÎTRE du carnet
  // tout ordre posé depuis la dernière bougie fermée.
  fresh.now = targetNow;
  applyBefore(targetNow + 1);

  // Puis la part visible de cette minute, comme le fait le chemin incrémental.
  const forming = bars.find((b) => b.time <= targetNow && b.time + 60_000 > targetNow);
  if (forming) processBar(fresh, forming, c, targetNow);

  fresh.now = targetNow;
  fresh.appliedUpTo = applied || null;
  refreshValuation(fresh, bars);
  return fresh;
}

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
