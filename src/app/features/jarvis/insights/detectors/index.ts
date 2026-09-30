import type { Detector } from "./types";
import { riskAfterLossDetector } from "./riskAfterLoss";
import { overtradingDetector } from "./overtrading";
import { costliestMistakeDetector } from "./costliestMistake";
import { disciplineStreakDetector } from "./disciplineStreak";
import { ruleKeptDetector } from "./ruleKept";

/** Tous les détecteurs Phase 1 — un détecteur = un fichier, testable seul. */
export const DETECTORS: Detector[] = [
  riskAfterLossDetector,
  overtradingDetector,
  costliestMistakeDetector,
  disciplineStreakDetector,
  ruleKeptDetector,
];
