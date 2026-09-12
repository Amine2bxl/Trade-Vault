/**
 * Les instruments — V1 ne démarre qu'avec NQ, mais l'architecture d'accueil
 * (taille de tick, valeur de tick, heures, libellés) est celle qui permettra
 * d'ajouter ES, YM, RTY puis le FX par simple inscription dans la table.
 */

export interface InstrumentSpec {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  /** Unité de prix minimum — 0.25 pour le NQ. */
  tickSize: number;
  /** Valeur en $ d'un tick, pour 1 contrat. */
  tickValue: number;
  /** Multiplicateur du contrat ($ du point = tickValue / tickSize). */
  multiplier: number;
  /** Points de prix typiques pour le cadrage automatique (jour). */
  typicalRange: { min: number; max: number };
}

export const NQ: InstrumentSpec = {
  id: "NQ",
  symbol: "NQ",
  name: "Nasdaq-100 E-mini",
  exchange: "CME",
  tickSize: 0.25,
  tickValue: 5,
  multiplier: 20,
  typicalRange: { min: 15000, max: 26000 },
};

/** Registre — ajouter un instrument = ajouter une ligne ici + sa synthèse. */
export const REPLAY_INSTRUMENTS: InstrumentSpec[] = [NQ];

export function instrumentOf(symbol: string): InstrumentSpec {
  return REPLAY_INSTRUMENTS.find((i) => i.id === symbol) ?? NQ;
}

/** Arrondit un prix au tick près (0.25 ≈ 21 000.25, 21 000.5…). */
export function roundToTick(price: number, spec: InstrumentSpec = NQ): number {
  return Math.round(price / spec.tickSize) * spec.tickSize;
}

/** Points entre deux prix (toujours positifs, triés à l'appelant si besoin). */
export function pointsBetween(a: number, b: number): number {
  return Math.abs(a - b);
}

/** Ticks entre deux prix. */
export function ticksBetween(a: number, b: number, spec: InstrumentSpec = NQ): number {
  return Math.round(Math.abs(a - b) / spec.tickSize);
}

/** Valeur en $ d'un mouvement en points, pour `qty` contrats. */
export function dollarPerPoint(spec: InstrumentSpec = NQ): number {
  return spec.multiplier;
}

/** PnL d'une position, en $. */
export function pnlOf(
  side: "long" | "short",
  qty: number,
  entry: number,
  mark: number,
  spec: InstrumentSpec = NQ,
): number {
  const dir = side === "long" ? 1 : -1;
  return (mark - entry) * dir * qty * spec.multiplier;
}

/** $ par tick pour `qty` contrats. */
export function dollarPerTick(qty: number, spec: InstrumentSpec = NQ): number {
  return qty * spec.tickValue;
}

/** Alias descriptif — dollars d'un tick, pour `qty` contrats. */
export function tickValueDollars(qty: number, spec: InstrumentSpec = NQ): number {
  return dollarPerTick(qty, spec);
}

/** Dollars d'un mouvement de `pts` points pour `qty` contrats. */
export function pointsDollars(pts: number, qty: number, spec: InstrumentSpec = NQ): number {
  return pts * qty * spec.multiplier;
}
