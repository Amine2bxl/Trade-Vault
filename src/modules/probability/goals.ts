/**
 * Objectifs × moteur probabiliste — module PUR.
 *
 * CE QUE ÇA CHANGE POUR LE TRADER. Un objectif de capital affiche aujourd'hui
 * une barre de progression : où il en est. Il ne dit rien de la seule chose
 * qui compte encore — est-ce que ça va se faire ? Un trader à 30 % de son
 * objectif au bout de trois mois ne sait pas s'il est en avance, en retard, ou
 * en train de viser quelque chose que son trading actuel ne produira jamais.
 *
 * Ce module répond avec son propre historique : « au rythme et au risque
 * actuels, cet objectif a X % de chances d'être atteint dans le temps qui
 * reste ».
 *
 * ── UN SEUL TYPE D'OBJECTIF EST SIMULABLE ──────────────────────────────────
 * Le capital, et lui seul. Le moteur rééchantillonne des résultats de trades :
 * il sait donc dire où un solde peut atterrir. Il ne sait RIEN dire d'un
 * objectif de win rate, de profit factor ou de discipline — ces grandeurs ne
 * se déduisent pas d'une trajectoire de P&L rééchantillonnée, et produire un
 * pourcentage pour elles serait fabriquer un chiffre.
 *
 * L'appelant reçoit donc `null` pour ces objectifs, et l'interface n'affiche
 * simplement rien. Un blanc honnête vaut mieux qu'une probabilité inventée.
 */

import { runSimulation, type SimulationResult } from "./engine";
import { tradesForDays, type SimDataset } from "./dataset";
import { seedFrom } from "./rng";
import { assessSample, MIN_SIMULATABLE, type SampleAssessment } from "./sample";

export interface CapitalGoal {
  /** Solde actuel du compte, point de départ de la projection. */
  currentBalance: number;
  /** Solde visé. */
  targetBalance: number;
  /** Jours de bourse restants avant l'échéance. */
  daysRemaining: number;
}

export interface GoalForecast {
  /** 0..1 — part des trajectoires atteignant l'objectif dans le temps restant. */
  probability: number;
  sample: SampleAssessment;
  /** Jours nécessaires sur les seules trajectoires gagnantes — répond à
   *  « et si j'y arrive, quand ? ». `null` si aucune n'y arrive. */
  medianDaysToTarget: number | null;
  /** Résultat brut, pour qui veut afficher plus sans relancer le moteur. */
  result: SimulationResult;
}

/** Nombre de trajectoires. Suffisant pour que le chiffre soit stable d'un
 *  affichage à l'autre, assez peu pour rester instantané dans une liste
 *  d'objectifs où plusieurs projections tournent d'affilée. */
const RUNS = 1500;

/**
 * Probabilité d'atteindre un objectif de capital dans le temps restant.
 *
 * Rend `null` quand la question n'a pas de réponse honnête :
 *   - historique trop court pour rééchantillonner ;
 *   - cadence de trading non mesurable, donc horizon inconvertible ;
 *   - échéance dépassée, ou objectif déjà atteint — dans ces deux cas il n'y a
 *     plus rien à projeter, et l'interface doit dire autre chose qu'un
 *     pourcentage.
 *
 * AUCUN OBJECTIF DE DRAWDOWN N'EST APPLIQUÉ. Un objectif personnel n'est pas
 * un challenge : rien ne « perd » le compte, la trajectoire va jusqu'au bout
 * de l'horizon. Ajouter une règle de perte inventerait une contrainte que le
 * trader n'a jamais posée et ferait chuter la probabilité sans raison.
 */
export function forecastCapitalGoal(dataset: SimDataset, goal: CapitalGoal): GoalForecast | null {
  const sample = assessSample(dataset.trades.length, dataset.rCoverage);
  if (dataset.trades.length < MIN_SIMULATABLE) return null;
  if (goal.daysRemaining <= 0) return null;
  if (!Number.isFinite(goal.currentBalance) || goal.currentBalance <= 0) return null;

  const gain = goal.targetBalance - goal.currentBalance;
  if (!Number.isFinite(gain) || gain <= 0) return null;

  const tradesPerPath = tradesForDays(dataset, goal.daysRemaining);
  if (!tradesPerPath) return null;

  const perDay = Math.max(1, Math.round(dataset.tradesPerDay ?? 1));

  const result = runSimulation(dataset, {
    rules: { startingBalance: goal.currentBalance, profitTarget: gain },
    tradesPerPath,
    tradesPerDay: perDay,
    runs: RUNS,
    // Graine dérivée de l'objectif : rouvrir la page d'objectifs redonne
    // exactement le même pourcentage. Un chiffre qui bouge tout seul entre
    // deux visites détruit la confiance plus vite qu'un chiffre pessimiste.
    seed: seedFrom(`${goal.currentBalance}|${goal.targetBalance}|${goal.daysRemaining}`),
  });

  return {
    probability: result.passProbability,
    sample,
    medianDaysToTarget: result.daysToTarget ? result.daysToTarget.median : null,
    result,
  };
}
