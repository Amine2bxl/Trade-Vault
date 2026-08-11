/**
 * Scénario — ce qui relie l'historique du trader à une configuration de
 * simulation. Module PUR.
 *
 * Le moteur (`engine.ts`) prend une configuration déjà décidée. Ce module
 * fabrique cette décision à partir de ce qu'on SAIT du trader, et signale ce
 * qu'on ne sait pas plutôt que de le combler.
 *
 * ── LA RÈGLE QUI GOUVERNE TOUT CE FICHIER ──────────────────────────────────
 * Une cadence de trading est MESURÉE (`dataset.tradesPerDay`), jamais
 * supposée. Un horizon de 30 jours ne devient un nombre de trades que si
 * l'historique couvre assez de jours pour que cette conversion ait un sens.
 * Quand ce n'est pas le cas, `buildScenario` rend `null` avec un motif, et
 * l'interface demande au trader ce qui manque. Inventer « 3 trades par jour »
 * produirait une probabilité d'apparence rigoureuse fondée sur rien.
 *
 * ── LA GRAINE ──────────────────────────────────────────────────────────────
 * Elle est DÉRIVÉE du scénario, pas tirée au hasard. Deux conséquences
 * voulues : rouvrir la même simulation redonne exactement les mêmes chiffres
 * (un trader qui voit 62 % puis 59 % sans rien changer cesse d'y croire), et
 * changer une seule variable change bien la séquence tirée — ce que
 * l'analyse de sensibilité neutralise ensuite en réutilisant explicitement la
 * graine du scénario de base.
 */

import { seedFrom } from "./rng";
import { tradesForDays, type SimDataset } from "./dataset";
import type { SimulationConfig } from "./engine";
import type { AccountRules } from "./rules";
import { assessSample, MIN_SIMULATABLE, type SampleAssessment } from "./sample";

/** Horizon demandé par le trader : en jours de bourse, ou directement en
 *  trades quand il n'a pas de cadence exploitable. */
export type Horizon = { unit: "days"; value: number } | { unit: "trades"; value: number };

export interface ScenarioInput {
  rules: AccountRules;
  horizon: Horizon;
  /** Nombre de trajectoires. Plus il est grand, plus le chiffre est stable —
   *  sans devenir plus vrai pour autant (voir `sample.ts`). */
  runs?: number;
  riskMultiplier?: number;
  stopAfterLosses?: number | null;
  /** Cadence imposée par le trader, quand il veut simuler autre chose que sa
   *  cadence historique. */
  tradesPerDay?: number | null;
  /** Rend la graine explicite (rejouer une simulation sauvegardée). */
  seed?: number;
}

/** Pourquoi un scénario n'est pas simulable. Chaque motif appelle une action
 *  précise de l'interface, jamais un message d'erreur générique. */
export type ScenarioBlocker =
  | "noTrades" // journal vide
  | "tooFewTrades" // historique trop court pour rééchantillonner
  | "noCadence" // horizon en jours impossible à convertir
  | "noBalance"; // solde de départ manquant ou absurde

export type ScenarioBuild =
  | { ok: true; config: SimulationConfig; sample: SampleAssessment }
  | { ok: false; blocker: ScenarioBlocker; sample: SampleAssessment };

/** Valeur par défaut du nombre de trajectoires : assez pour que le chiffre ne
 *  bouge plus visiblement d'un affichage à l'autre, assez peu pour rester
 *  instantané dans le navigateur. */
export const DEFAULT_RUNS = 2000;

/**
 * Construit la configuration, ou dit précisément ce qui manque.
 *
 * Aucun garde-fou n'est décoratif ici : chacun correspond à un cas qui, sans
 * lui, produirait un chiffre affichable et faux.
 */
export function buildScenario(dataset: SimDataset, input: ScenarioInput): ScenarioBuild {
  const sample = assessSample(dataset.trades.length, dataset.rCoverage);

  if (dataset.trades.length === 0) return { ok: false, blocker: "noTrades", sample };
  if (dataset.trades.length < MIN_SIMULATABLE)
    return { ok: false, blocker: "tooFewTrades", sample };
  if (!Number.isFinite(input.rules.startingBalance) || input.rules.startingBalance <= 0)
    return { ok: false, blocker: "noBalance", sample };

  // La cadence sert à deux choses distinctes : convertir un horizon en jours,
  // et découper la trajectoire en journées (perte journalière, trailing EOD).
  // Elle reste nécessaire même quand l'horizon est déjà exprimé en trades.
  const perDay = input.tradesPerDay ?? dataset.tradesPerDay;

  let tradesPerPath: number | null;
  if (input.horizon.unit === "trades") {
    tradesPerPath = input.horizon.value > 0 ? Math.round(input.horizon.value) : null;
  } else {
    tradesPerPath = tradesForDays(dataset, input.horizon.value, input.tradesPerDay);
  }
  if (!tradesPerPath || tradesPerPath <= 0) return { ok: false, blocker: "noCadence", sample };

  // Sans cadence mesurable, on joue la trajectoire comme une seule journée
  // plutôt que d'inventer un rythme. Conséquence assumée et à afficher : les
  // règles journalières deviennent alors bien plus permissives.
  const effectivePerDay = perDay && perDay > 0 ? Math.max(1, Math.round(perDay)) : tradesPerPath;

  const config: SimulationConfig = {
    rules: input.rules,
    tradesPerPath,
    tradesPerDay: effectivePerDay,
    runs: Math.max(1, Math.round(input.runs ?? DEFAULT_RUNS)),
    riskMultiplier: input.riskMultiplier ?? 1,
    stopAfterLosses: input.stopAfterLosses ?? null,
    seed: input.seed ?? scenarioSeed(input, tradesPerPath, effectivePerDay),
  };

  return { ok: true, config, sample };
}

/** Graine déterministe dérivée des paramètres qui définissent le scénario. */
export function scenarioSeed(
  input: ScenarioInput,
  tradesPerPath: number,
  tradesPerDay: number,
): number {
  const r = input.rules;
  return seedFrom(
    [
      r.startingBalance,
      r.profitTarget ?? "",
      r.maxDrawdown ?? "",
      r.drawdownType ?? "static",
      r.trailingFreezeAt ?? "",
      r.dailyLossLimit ?? "",
      r.minTradingDays ?? "",
      r.maxTradingDays ?? "",
      r.maxBestDayShare ?? "",
      tradesPerPath,
      tradesPerDay,
      input.riskMultiplier ?? 1,
      input.stopAfterLosses ?? "",
    ].join("|"),
  );
}
