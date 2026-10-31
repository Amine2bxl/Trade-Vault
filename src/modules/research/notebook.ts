import { seedFrom } from "@/modules/probability/rng";
import { MIN_SESSIONS, MIN_TRADES } from "@/modules/patterns/thresholds";
import { sessionBlockBootstrap, type BootstrapResult } from "./bootstrap";
import {
  dimensionValue,
  sessionKey,
  EDGE_LAB_VERSION,
  type EdgeDimension,
  type EdgeTrade,
} from "./edgeLab";

/**
 * RESEARCH NOTEBOOK — le protocole d'une hypothèse (lot 2). Module pur.
 *
 * Une hypothèse se FIGE avant d'être confrontée : la valeur suivie, le sens de
 * l'écart observé, la date à partir de laquelle commence le holdout, la
 * version de la méthode, la graine et l'empreinte des données
 * d'apprentissage. Le holdout est PROSPECTIF : il commence le jour qui suit
 * la dernière séance connue. Ce que le trader a déjà vu ne peut donc pas
 * servir à confirmer ce qu'il en a déduit.
 *
 * L'évaluation dit aussi quand la comparaison n'est plus valide : des trades
 * ajoutés, modifiés ou supprimés dans la période d'apprentissage (nouvel
 * import, correction) ou une méthode qui a changé depuis l'écriture.
 */

export interface ProtocolSnapshot {
  /** Trades d'apprentissage (séances antérieures au holdout). */
  trainTrades: number;
  lastTrainDay: string | null;
  /** Empreinte (FNV-1a) des trades d'apprentissage : id, P&L, valeur suivie. */
  hash: string;
  /** Sens de l'écart observé à l'écriture : +1 positif, −1 négatif. */
  direction: 1 | -1;
}

export interface ResearchProtocol {
  hypothesis: string;
  dimension: EdgeDimension;
  cellKey: string;
  /** Premier jour (`AAAA-MM-JJ`) jugé hors échantillon. */
  holdoutStart: string;
  methodVersion: number;
  seed: number;
  dataSnapshot: ProtocolSnapshot;
}

export type ProtocolVerdict = "insufficient" | "supported" | "contradicted" | "inconclusive";

export interface ProtocolEvaluation {
  verdict: ProtocolVerdict;
  holdoutN: number;
  holdoutSessions: number;
  holdoutExpectancy: number | null;
  bootstrap: BootstrapResult | null;
  /** Trades et séances encore nécessaires avant de conclure. */
  missingTrades: number;
  missingSessions: number;
  /** La période d'apprentissage a changé depuis l'écriture. */
  trainingChanged: boolean;
  /** La méthode n'est plus celle de l'écriture. */
  methodChanged: boolean;
}

const nextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

function snapshotOf(
  trades: readonly EdgeTrade[],
  dimension: EdgeDimension,
  holdoutStart: string,
  direction: 1 | -1,
): ProtocolSnapshot {
  const train = trades.filter((t) => sessionKey(t) < holdoutStart);
  const lines = train
    .map((t) => `${t.id}:${t.pnl}:${dimensionValue(t, dimension) ?? ""}`)
    .sort()
    .join("|");
  const days = train.map(sessionKey).sort();
  return {
    trainTrades: train.length,
    lastTrainDay: days.at(-1) ?? null,
    hash: seedFrom(lines).toString(16).padStart(8, "0"),
    direction,
  };
}

/**
 * Le protocole d'une hypothèse écrite AUJOURD'HUI sur l'historique connu.
 * `today` : jour civil local (`todayLocalDate()`), pour que le holdout ne
 * commence jamais dans le passé.
 */
export function draftProtocol(
  trades: readonly EdgeTrade[],
  input: { dimension: EdgeDimension; cellKey: string; hypothesis: string; direction: 1 | -1 },
  today: string,
): ResearchProtocol {
  const lastDay = trades.map(sessionKey).sort().at(-1);
  const afterData = lastDay ? nextDay(lastDay) : today;
  const holdoutStart = afterData > today ? afterData : today;
  return {
    hypothesis: input.hypothesis.trim().slice(0, 1000),
    dimension: input.dimension,
    cellKey: input.cellKey,
    holdoutStart,
    methodVersion: EDGE_LAB_VERSION,
    seed: seedFrom(`notebook:${input.dimension}:${input.cellKey}:${holdoutStart}`),
    dataSnapshot: snapshotOf(trades, input.dimension, holdoutStart, input.direction),
  };
}

/** Confronte l'hypothèse aux seules séances du holdout. */
export function evaluateProtocol(
  protocol: ResearchProtocol,
  trades: readonly EdgeTrade[],
): ProtocolEvaluation {
  const current = snapshotOf(
    trades,
    protocol.dimension,
    protocol.holdoutStart,
    protocol.dataSnapshot.direction,
  );
  const holdout = trades.filter(
    (t) =>
      sessionKey(t) >= protocol.holdoutStart &&
      dimensionValue(t, protocol.dimension) === protocol.cellKey &&
      Number.isFinite(t.pnl),
  );
  const bySession = new Map<string, number[]>();
  for (const t of holdout) {
    const k = sessionKey(t);
    bySession.set(k, [...(bySession.get(k) ?? []), t.pnl]);
  }
  const sessions = [...bySession.keys()].sort().map((k) => bySession.get(k)!);
  const missingTrades = Math.max(0, MIN_TRADES - holdout.length);
  const missingSessions = Math.max(0, MIN_SESSIONS - sessions.length);
  const enough = missingTrades === 0 && missingSessions === 0;
  const bootstrap = enough ? sessionBlockBootstrap(sessions, { seed: protocol.seed }) : null;
  let verdict: ProtocolVerdict = "insufficient";
  if (bootstrap) {
    const dir = protocol.dataSnapshot.direction;
    const supports = dir > 0 ? bootstrap.low > 0 : bootstrap.high < 0;
    const contradicts = dir > 0 ? bootstrap.high < 0 : bootstrap.low > 0;
    verdict = supports ? "supported" : contradicts ? "contradicted" : "inconclusive";
  }
  return {
    verdict,
    holdoutN: holdout.length,
    holdoutSessions: sessions.length,
    holdoutExpectancy:
      holdout.length > 0 ? holdout.reduce((s, t) => s + t.pnl, 0) / holdout.length : null,
    bootstrap,
    missingTrades,
    missingSessions,
    trainingChanged:
      current.hash !== protocol.dataSnapshot.hash ||
      current.trainTrades !== protocol.dataSnapshot.trainTrades,
    methodChanged: protocol.methodVersion !== EDGE_LAB_VERSION,
  };
}
