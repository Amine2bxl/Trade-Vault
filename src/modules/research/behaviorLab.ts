import type { Trade } from "@/domain/trade";
import { instantMs } from "@/domain/easternClock";
import { compareRealizedChronological, hasVerifiedRealizedOrder } from "@/domain/tradeOrder";
import { sessionKey } from "./edgeLab";

/**
 * BEHAVIORLAB — « et si je m'étais arrêté après N pertes ? » Module pur (lot 2).
 *
 * Un SCÉNARIO, jamais un gain : retirer après coup les trades qui ont suivi
 * N pertes consécutives dit ce que ces trades ont rapporté ou coûté, pas ce
 * qui se serait passé — un trader arrêté plus tôt n'aurait pas eu la même
 * séance. Le résultat porte l'étiquette `hypothetical`, que l'interface est
 * tenue d'afficher.
 *
 * Une séance n'est rejouée que si l'ordre des clôtures y est PROUVÉ et que
 * l'entrée de chaque trade suivant se place sans ambiguïté après la clôture
 * de la N-ième perte. Sinon elle est écartée et COMPTÉE à part : une séance
 * dont on ne connaît pas l'ordre ne se « rejoue » pas.
 *
 * Un trade à P&L nul (break-even) ne prolonge ni n'interrompt la série.
 */

export const BEHAVIOR_LAB_VERSION = 1;

export type ScenarioTrade = Pick<Trade, "id" | "date" | "pnl" | "entryTime" | "exitTime"> &
  Partial<Pick<Trade, "accountId" | "entryAt" | "exitAt">>;

export interface StopAfterLossesScenario {
  label: "hypothetical";
  maxLosses: number;
  /** Séances rejouées (ordre prouvé). */
  sessionsEvaluated: number;
  /** Séances écartées faute d'ordre ou d'horaires vérifiables. */
  sessionsUnknown: number;
  /** Séances où la règle se serait déclenchée. */
  sessionsTriggered: number;
  tradesRemoved: number;
  /** Somme du P&L des trades retirés (négatif = ces trades ont coûté). */
  removedPnl: number;
  /** P&L réel des séances rejouées seulement. */
  actualPnl: number;
  /** P&L de ces mêmes séances sans les trades retirés — HYPOTHÉTIQUE. */
  hypotheticalPnl: number;
  version: number;
}

const clock = (v: string | undefined | null) => {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((v ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
};

/** L'entrée de `t` est-elle après la clôture de `stop` ? `null` = indécidable. */
function enteredAfter(t: ScenarioTrade, stop: ScenarioTrade): boolean | null {
  const entry = instantMs(t.entryAt);
  const exit = instantMs(stop.exitAt);
  if (entry !== null && exit !== null) return entry >= exit;
  const e = clock(t.entryTime);
  const x = clock(stop.exitTime);
  if (!e || !x || t.date !== stop.date) return null;
  // Même minute : l'ordre n'est pas prouvé.
  if (e === x) return null;
  return e > x;
}

/** Le verdict d'UNE séance face à la règle « s'arrêter après N pertes ». */
export type SessionRuleStatus =
  /** Ordre des clôtures ou heures d'entrée non prouvés : ni respect ni écart. */
  | "unknown"
  /** N pertes d'affilée jamais atteintes : la règle n'a pas été éprouvée. */
  | "not_triggered"
  /** Déclenchée, et aucun trade ouvert après la N-ième perte. */
  | "complied"
  /** Déclenchée, et au moins un trade ouvert après la N-ième perte. */
  | "violated";

export interface SessionRuleResult {
  /** `compte|jour` de la séance. */
  key: string;
  /** Jour de la séance (New York prouvé, sinon date du journal). */
  day: string;
  status: SessionRuleStatus;
  pnl: number;
  tradesAfterStop: number;
  pnlAfterStop: number;
}

/**
 * Séance par séance — la SEULE lecture de la règle, partagée par le scénario
 * hypothétique et par les expériences de progression (`experiment.ts`).
 */
export function stopAfterLossesSessions(
  trades: readonly ScenarioTrade[],
  maxLosses: number,
): SessionRuleResult[] {
  const groups = new Map<string, ScenarioTrade[]>();
  for (const t of trades) {
    const k = `${t.accountId ?? ""}|${sessionKey(t)}`;
    const list = groups.get(k) ?? [];
    list.push(t);
    groups.set(k, list);
  }
  const out: SessionRuleResult[] = [];
  for (const [key, list] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const day = key.slice(key.indexOf("|") + 1);
    const pnl = list.reduce((s, t) => s + t.pnl, 0);
    const unknown: SessionRuleResult = {
      key,
      day,
      status: "unknown",
      pnl,
      tradesAfterStop: 0,
      pnlAfterStop: 0,
    };
    if (!hasVerifiedRealizedOrder(list)) {
      out.push(unknown);
      continue;
    }
    const ordered = [...list].sort(compareRealizedChronological);
    let streak = 0;
    let stop: ScenarioTrade | null = null;
    let removed = 0;
    let removedPnl = 0;
    let undecidable = false;
    for (const t of ordered) {
      if (stop) {
        const after = enteredAfter(t, stop);
        if (after === null) {
          undecidable = true;
          break;
        }
        // Entré AVANT l'arrêt : la position était déjà ouverte, elle reste.
        if (after) {
          removed++;
          removedPnl += t.pnl;
          continue;
        }
      }
      if (t.pnl < 0) {
        streak++;
        if (!stop && streak >= maxLosses) stop = t;
      } else if (t.pnl > 0) {
        streak = 0;
      }
    }
    if (undecidable) {
      out.push(unknown);
      continue;
    }
    out.push({
      key,
      day,
      status: !stop ? "not_triggered" : removed > 0 ? "violated" : "complied",
      pnl,
      tradesAfterStop: removed,
      pnlAfterStop: removedPnl,
    });
  }
  return out;
}

export function stopAfterLossesScenario(
  trades: readonly ScenarioTrade[],
  maxLosses: number,
): StopAfterLossesScenario {
  const out: StopAfterLossesScenario = {
    label: "hypothetical",
    maxLosses,
    sessionsEvaluated: 0,
    sessionsUnknown: 0,
    sessionsTriggered: 0,
    tradesRemoved: 0,
    removedPnl: 0,
    actualPnl: 0,
    hypotheticalPnl: 0,
    version: BEHAVIOR_LAB_VERSION,
  };
  for (const s of stopAfterLossesSessions(trades, maxLosses)) {
    if (s.status === "unknown") {
      out.sessionsUnknown++;
      continue;
    }
    out.sessionsEvaluated++;
    if (s.status !== "not_triggered") out.sessionsTriggered++;
    out.tradesRemoved += s.tradesAfterStop;
    out.removedPnl += s.pnlAfterStop;
    out.actualPnl += s.pnl;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  out.removedPnl = round2(out.removedPnl);
  out.actualPnl = round2(out.actualPnl);
  out.hypotheticalPnl = round2(out.actualPnl - out.removedPnl);
  return out;
}
