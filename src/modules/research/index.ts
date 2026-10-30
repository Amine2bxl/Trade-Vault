// Point d'entrée du moteur de recherche (lot 2) : EdgeLab (conditions de
// performance, bootstrap par séances, tests multiples, hors échantillon) et
// BehaviorLab (scénarios comportementaux HYPOTHÉTIQUES). Moteur PUR : aucune
// I/O, aucun React. Méthode et seuils : `docs/FEATURES.md` (indicateurs).

export {
  sessionBlockBootstrap,
  BOOTSTRAP_METHOD,
  BOOTSTRAP_VERSION,
  DEFAULT_ITERATIONS,
  type BootstrapResult,
} from "./bootstrap";
export { benjaminiHochberg } from "./fdr";
export {
  analyzeDimension,
  chronologicalSplit,
  dimensionValue,
  outOfSample,
  sessionKey,
  EDGE_LAB_VERSION,
  FDR_ALPHA,
  type EdgeCell,
  type EdgeDimension,
  type EdgeReport,
  type EdgeTrade,
  type EdgeVerdict,
  type HoldoutStatus,
  type OutOfSampleCell,
} from "./edgeLab";
export {
  stopAfterLossesScenario,
  BEHAVIOR_LAB_VERSION,
  type ScenarioTrade,
  type StopAfterLossesScenario,
} from "./behaviorLab";
export {
  draftProtocol,
  evaluateProtocol,
  type ProtocolEvaluation,
  type ProtocolSnapshot,
  type ProtocolVerdict,
  type ResearchProtocol,
} from "./notebook";
