/**
 * LES CONTRATS FUTURES — une seule fiche technique, partagée par le
 * calculateur de taille, la fenêtre d'ajout de trade et Jarvis.
 *
 * ── POURQUOI ICI ───────────────────────────────────────────────────────────
 * « Combien je risque avec 3 MNQ et un stop de 12 points ? » est la question
 * la plus concrète qu'un trader NQ pose à Jarvis. Sans fiche partagée, le
 * modèle faisait la multiplication de tête — exactement ce que le produit
 * interdit (un chiffre inventé a l'aplomb d'un vrai), et la validation des
 * chiffres le signalait ensuite comme « non vérifié ». Le calcul vit donc dans
 * un module PUR, testé, et Jarvis le lit par l'outil `get_contract_math`.
 *
 * Les valeurs sont les spécifications publiées du CME (taille du tick, valeur
 * du tick). Elles ne bougent pas d'un contrat à l'autre ; aucun prix de marché
 * n'est ici, et aucun n'est inventé.
 */

export interface FuturesSpec {
  symbol: string;
  name: string;
  /** Plus petit pas de cotation, en points. */
  tickSize: number;
  /** Valeur d'un tick pour UN contrat, en dollars. */
  tickValue: number;
  /** Valeur d'un point pour UN contrat, en dollars (= tickValue / tickSize). */
  pointValue: number;
  /** Le contrat micro (ou mini) correspondant, quand il existe. */
  pair?: string;
}

export const FUTURES_SPECS: Record<string, FuturesSpec> = {
  NQ: {
    symbol: "NQ",
    name: "E-mini Nasdaq-100",
    tickSize: 0.25,
    tickValue: 5,
    pointValue: 20,
    pair: "MNQ",
  },
  MNQ: {
    symbol: "MNQ",
    name: "Micro E-mini Nasdaq-100",
    tickSize: 0.25,
    tickValue: 0.5,
    pointValue: 2,
    pair: "NQ",
  },
  ES: {
    symbol: "ES",
    name: "E-mini S&P 500",
    tickSize: 0.25,
    tickValue: 12.5,
    pointValue: 50,
    pair: "MES",
  },
  MES: {
    symbol: "MES",
    name: "Micro E-mini S&P 500",
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5,
    pair: "ES",
  },
  YM: { symbol: "YM", name: "E-mini Dow", tickSize: 1, tickValue: 5, pointValue: 5, pair: "MYM" },
  MYM: {
    symbol: "MYM",
    name: "Micro E-mini Dow",
    tickSize: 1,
    tickValue: 0.5,
    pointValue: 0.5,
    pair: "YM",
  },
  RTY: {
    symbol: "RTY",
    name: "E-mini Russell 2000",
    tickSize: 0.1,
    tickValue: 5,
    pointValue: 50,
    pair: "M2K",
  },
  M2K: {
    symbol: "M2K",
    name: "Micro E-mini Russell 2000",
    tickSize: 0.1,
    tickValue: 0.5,
    pointValue: 5,
    pair: "RTY",
  },
  CL: {
    symbol: "CL",
    name: "Crude Oil",
    tickSize: 0.01,
    tickValue: 10,
    pointValue: 1000,
    pair: "MCL",
  },
  MCL: {
    symbol: "MCL",
    name: "Micro Crude Oil",
    tickSize: 0.01,
    tickValue: 1,
    pointValue: 100,
    pair: "CL",
  },
  GC: { symbol: "GC", name: "Gold", tickSize: 0.1, tickValue: 10, pointValue: 100, pair: "MGC" },
  MGC: {
    symbol: "MGC",
    name: "Micro Gold",
    tickSize: 0.1,
    tickValue: 1,
    pointValue: 10,
    pair: "GC",
  },
};

/** Racines testées de la plus longue à la plus courte : « MES » avant « ES ». */
const ROOTS = Object.keys(FUTURES_SPECS).sort((a, b) => b.length - a.length);

/**
 * « NQ », « nq1! », « CME_MINI:NQ1! », « NQZ5 », « MNQ DEC25 » → la fiche.
 * `null` pour un CFD (« NAS100 », « US100 ») : sa taille de contrat dépend du
 * courtier, et la deviner serait inventer.
 */
export function futuresSpecFor(raw: string): FuturesSpec | null {
  let s = (raw ?? "").toUpperCase().trim();
  if (s.includes(":")) s = s.slice(s.lastIndexOf(":") + 1);
  s = s.replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  if (FUTURES_SPECS[s]) return FUTURES_SPECS[s];
  for (const root of ROOTS) {
    if (!s.startsWith(root)) continue;
    const rest = s.slice(root.length);
    // Continu (« 1 », « 2 »), daté (« Z5 », « H26 ») ou mois écrit (« DEC25 »).
    if (/^([12]|[FGHJKMNQUVXZ]\d{1,2}|[A-Z]{3}\d{2,4})$/.test(rest)) return FUTURES_SPECS[root];
  }
  return null;
}

export interface ContractsResult {
  contracts: number;
  effectiveRisk: number;
}

/** contracts = floor(risk / (stop distance × $ par point)) ; `null` si une entrée manque. */
export function calcContracts(
  riskDollar: number,
  stopPoints: number,
  pointValue: number,
): ContractsResult | null {
  if (riskDollar <= 0 || stopPoints <= 0 || pointValue <= 0) return null;
  const contracts = Math.floor(riskDollar / (stopPoints * pointValue));
  return { contracts, effectiveRisk: contracts * stopPoints * pointValue };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const positive = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export interface ContractMathInput {
  symbol?: unknown;
  /** Une distance en points… */
  points?: unknown;
  /** …ou en ticks… */
  ticks?: unknown;
  /** …ou un montant en dollars à convertir en distance. */
  dollars?: unknown;
  /** Nombre de contrats (défaut : 1). */
  contracts?: unknown;
  /** Dimensionnement : risque en dollars + stop en points. */
  riskDollars?: unknown;
  stopPoints?: unknown;
}

export type ContractMathOutput =
  | { error: string }
  | {
      contract: FuturesSpec;
      move?: {
        points: number;
        ticks: number;
        /** La distance tombe-t-elle sur la grille de cotation ? */
        onTickGrid: boolean;
        contracts: number;
        dollarsPerContract: number;
        dollarsTotal: number;
      };
      sizing?: {
        riskDollars: number;
        stopPoints: number;
        riskPerContract: number;
        maxContracts: number;
        riskAtMaxContracts: number;
        /** Le même risque exprimé dans le contrat jumeau (micro ↔ mini). */
        pairContract?: { symbol: string; maxContracts: number; riskAtMaxContracts: number };
      };
    };

/**
 * L'arithmétique d'un contrat, déterministe. Une distance (points, ticks ou
 * dollars) se convertit dans les deux autres pour N contrats ; un risque en
 * dollars et un stop en points donnent le nombre de contrats maximal.
 */
export function contractMath(input: ContractMathInput): ContractMathOutput {
  const spec = typeof input.symbol === "string" ? futuresSpecFor(input.symbol) : null;
  if (!spec) {
    return {
      error:
        `Unknown futures contract. Supported: ${Object.keys(FUTURES_SPECS).join(", ")}. ` +
        "CFD symbols (NAS100, US100…) have broker-specific contract sizes and are not covered.",
    };
  }
  const contracts = Math.max(1, Math.floor(positive(input.contracts) ?? 1));
  const out: Extract<ContractMathOutput, { contract: FuturesSpec }> = { contract: spec };

  let points = positive(input.points);
  const ticks = positive(input.ticks);
  const dollars = positive(input.dollars);
  if (points === undefined && ticks !== undefined) points = ticks * spec.tickSize;
  if (points === undefined && dollars !== undefined)
    points = dollars / (spec.pointValue * contracts);
  if (points !== undefined) {
    const t = points / spec.tickSize;
    out.move = {
      points: r2(points),
      ticks: r2(t),
      onTickGrid: Math.abs(t - Math.round(t)) < 1e-9,
      contracts,
      dollarsPerContract: r2(points * spec.pointValue),
      dollarsTotal: r2(points * spec.pointValue * contracts),
    };
  }

  const risk = positive(input.riskDollars);
  const stop = positive(input.stopPoints);
  if (risk !== undefined && stop !== undefined) {
    const sized = calcContracts(risk, stop, spec.pointValue)!;
    const pair = spec.pair ? FUTURES_SPECS[spec.pair] : undefined;
    const pairSized = pair ? calcContracts(risk, stop, pair.pointValue)! : undefined;
    out.sizing = {
      riskDollars: r2(risk),
      stopPoints: r2(stop),
      riskPerContract: r2(stop * spec.pointValue),
      maxContracts: sized.contracts,
      riskAtMaxContracts: r2(sized.effectiveRisk),
      ...(pair && pairSized
        ? {
            pairContract: {
              symbol: pair.symbol,
              maxContracts: pairSized.contracts,
              riskAtMaxContracts: r2(pairSized.effectiveRisk),
            },
          }
        : {}),
    };
  }

  // Sans distance ni risque, la fiche seule est déjà une réponse
  // (« combien vaut un point de NQ ? »).
  return out;
}
