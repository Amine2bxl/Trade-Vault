import type { Trade } from "../../../../types";
import { computeStats } from "../../../../utils/tradeCalcs";
import { computeBehaviorSignals } from "../../../../utils/behaviorSignals";
import { deriveDailyRule } from "../../../../utils/edgeScore";
import type { JarvisHomeData, JarvisMemory } from "../types";

/**
 * Fixtures — journaux synthétiques déterministes pour tester l'Insight Engine.
 * Chaque scénario déclenche UN pattern précis, pour que chaque insight produit
 * soit vérifiable indépendamment.
 */

let idCounter = 0;

export function makeTrade(
  date: string,
  pnl: number,
  opts: { riskAmount?: number; mistakes?: string[] } = {},
): Trade {
  idCounter += 1;
  return {
    id: `t-${idCounter}`,
    date,
    symbol: "NQ",
    direction: "long",
    pnl,
    riskAmount: opts.riskAmount ?? 100,
    rMultiple: pnl >= 0 ? 1 : -1,
    strategy: "Scalping",
    mistakes: opts.mistakes ?? [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: 70,
  };
}

/** Jour séquentiel déterministe (mai 2026). */
const day = (i: number): string => {
  const d = new Date(2026, 4, 1 + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function buildHomeData(trades: Trade[]): JarvisHomeData {
  const stats = computeStats(trades);
  return {
    trades,
    stats,
    signals: computeBehaviorSignals(trades),
    rule: deriveDailyRule(stats),
    profile: {
      firstName: "Amine",
      style: "Scalping",
      weakness: "Revenge",
      strength: "Patience",
      goal: "+5R/mois",
      completedAt: "2026-07-01",
    },
    onboarding: {
      goal: "+5R/mois",
      assets: ["NQ"],
      style: "Scalping",
      experience: "intermediate",
      usesIct: false,
      brokers: [],
      pain: "revenge",
      monthlyTarget: 5,
      onboardedAt: "2026-07-01",
      skipped: false,
    },
  };
}

export const EMPTY_MEMORY: JarvisMemory = {
  lastShownDate: "",
  lastPattern: null,
  lastPriority: null,
  ignoredPatterns: [],
  seenCount: 0,
};

/** Moins de 5 trades → aucun signal, aucun pattern. */
export function thinJournal(): Trade[] {
  return [
    makeTrade(day(0), 40),
    makeTrade(day(1), -30),
    makeTrade(day(2), 50),
    makeTrade(day(3), -25),
  ];
}

/** 40 trades sains, risque constant, aucune erreur → aucun warning. */
export function normalTrader(): Trade[] {
  return Array.from({ length: 40 }, (_, i) => makeTrade(day(i), i % 5 < 3 ? 40 : -25));
}

/** [Perte -100, Revenge -150 (risk 150), Win +50] × 11 + perte finale → risk_after_loss. */
export function riskAfterLossTrader(): Trade[] {
  const trades: Trade[] = [];
  let d = 0;
  for (let i = 0; i < 11; i++) {
    trades.push(makeTrade(day(d++), -100));
    trades.push(makeTrade(day(d++), -150, { riskAmount: 150 }));
    trades.push(makeTrade(day(d++), 50));
  }
  trades.push(makeTrade(day(d++), -100));
  return trades;
}

/** 3 jours chargés perdants (6 trades à -10) + 5 jours calmes gagnants → overtrading. */
export function overtradingTrader(): Trade[] {
  const trades: Trade[] = [];
  let d = 0;
  for (let b = 0; b < 3; b++) {
    for (let t = 0; t < 6; t++) trades.push(makeTrade(day(d), -10));
    d++;
  }
  trades.push(makeTrade(day(d++), 20));
  trades.push(makeTrade(day(d++), -15));
  trades.push(makeTrade(day(d++), 20));
  trades.push(makeTrade(day(d++), 20));
  trades.push(makeTrade(day(d++), -15)); // finit sur une perte → pas de série
  return trades;
}

/** 5 trades mixtes + 5 victoires consécutives → discipline_streak. */
export function disciplineStreakTrader(): Trade[] {
  const trades: Trade[] = [];
  for (let i = 0; i < 5; i++) trades.push(makeTrade(day(i), i % 2 === 0 ? 40 : -30));
  for (let i = 5; i < 10; i++) trades.push(makeTrade(day(i), 50));
  return trades;
}

/** 12 trades propres + 10 fois l'erreur « FOMO entry » (-100) → costliest_mistake. */
export function costliestMistakeTrader(): Trade[] {
  const trades: Trade[] = [];
  for (let i = 0; i < 12; i++) trades.push(makeTrade(day(i), 30));
  for (let i = 12; i < 22; i++) trades.push(makeTrade(day(i), -100, { mistakes: ["FOMO entry"] }));
  return trades;
}

/** risk_after_loss + série de victoires finale → deux candidats validés. */
export function combinedPatternsTrader(): Trade[] {
  const trades = riskAfterLossTrader();
  let d = trades.length;
  for (let i = 0; i < 5; i++) trades.push(makeTrade(day(d++), 50));
  return trades;
}
