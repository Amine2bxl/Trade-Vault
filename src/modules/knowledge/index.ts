// Point d'entrée du graphe de connaissance (Neural Brain) : construction
// déterministe depuis les enregistrements, découvertes testées, disposition
// 3D, niveau de détail. Moteur PUR : aucune I/O, aucun React.
// Architecture et règles : `docs/NEURAL_BRAIN.md`.

export { KnowledgeGraph, fold } from "./graph";
export {
  buildKnowledgeGraph,
  mentions,
  riskBandOf,
  GRAPH_VERSION,
  RISK_BANDS,
  type KnowledgeInput,
  type RiskBand,
} from "./build";
export {
  addDiscoveriesToGraph,
  fingerprintOf,
  runDiscoveries,
  DATA_GAP_COVERAGE,
  DISCOVERY_VERSION,
  SIMULATION_RISK_SHARE,
  SIMULATION_RISK_TOLERANCE,
  type AlternativeKey,
  type DetectorId,
  type Discovery,
  type DiscoveryCategory,
  type DiscoveryEvidence,
  type DiscoveryInput,
  type DiscoveryRun,
  type EvidenceUnit,
  type ExperimentKey,
} from "./discovery";
export {
  ForceLayout3D,
  categoryAnchors,
  type LayoutInputEdge,
  type LayoutInputNode,
} from "./layout";
export {
  visibleGraph,
  leafCount,
  DEFAULT_MAX_NODES,
  type ViewState,
  type VisibleGraph,
} from "./view";
export {
  sessionBlockDiff,
  sessionBlockSpearman,
  spearman,
  DIFF_METHOD,
  DIFF_VERSION,
  type DiffResult,
} from "./stats";
export {
  detectSignatures,
  hasEntryClock,
  instantsOf,
  median,
  sequence,
  sessionOf,
  ERROR_LIBRARY,
  REVENGE_WINDOW_MIN,
  type BehaviorContext,
  type ErrorEntry,
  type ErrorFamily,
  type Sequenced,
} from "./behavior";
export {
  runScenario,
  projectSessions,
  pathStats,
  SIMULATION_VERSION,
  type PathStats,
  type Projection,
  type ScenarioResult,
  type ScenarioRule,
} from "./simulate";
export {
  computeEvolution,
  EVOLUTION_VERSION,
  RECENT_EVOLUTION_SHARE,
  type BehaviourTrend,
  type Evolution,
  type EvolutionWindow,
  type TrendStatus,
} from "./evolution";
export * from "./types";
