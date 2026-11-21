/**
 * LE GRAPHE DE CONNAISSANCE — vocabulaire (Neural Brain, lot 1).
 *
 * Le graphe n'est PAS une seconde base : il est DÉRIVÉ, à chaque calcul, des
 * enregistrements qui font foi (trades, setups manqués, séances, recherche,
 * conversations…). Rien n'y est recopié durablement, donc rien ne peut
 * diverger de la source. Chaque nœud dit d'où il vient ; chaque lien dit
 * pourquoi il existe, avec quelle méthode, et à quel point on le sait.
 *
 * Ajouter un type d'entité = une ligne dans `NODE_KINDS` + un extracteur.
 * Ajouter un type de relation = une ligne dans `RELATIONS`. Le rendu, les
 * filtres et l'inspecteur suivent sans autre changement.
 */

/** Les familles affichées (couleur + forme dans la vue 3D). */
export const NODE_CATEGORIES = [
  "trading",
  "performance",
  "behavior",
  "risk",
  "simulation",
  "ai",
  "documents",
  "market",
] as const;
export type NodeCategory = (typeof NODE_CATEGORIES)[number];

/**
 * Chaque type d'entité, sa famille, et s'il est une FEUILLE : une feuille
 * (un trade, une capture, une annonce) est masquée tant que son moyeu n'est
 * pas déplié — c'est ce qui garde la vue lisible quand l'historique grossit.
 */
export const NODE_KINDS = {
  account: { category: "trading", leaf: false },
  month: { category: "trading", leaf: false },
  day: { category: "trading", leaf: true },
  trade: { category: "trading", leaf: true },
  session: { category: "trading", leaf: false },
  strategy: { category: "trading", leaf: false },
  confluence: { category: "trading", leaf: false },
  missed: { category: "trading", leaf: true },
  symbol: { category: "market", leaf: false },
  economic_event: { category: "market", leaf: true },
  mistake: { category: "behavior", leaf: false },
  mistake_cluster: { category: "behavior", leaf: false },
  risk_band: { category: "risk", leaf: false },
  screenshot: { category: "documents", leaf: true },
  report: { category: "documents", leaf: false },
  simulation: { category: "simulation", leaf: false },
  conversation: { category: "ai", leaf: false },
  research_note: { category: "ai", leaf: false },
  experiment: { category: "ai", leaf: false },
  proposal: { category: "ai", leaf: false },
  discovery: { category: "performance", leaf: false },
} as const satisfies Record<string, { category: NodeCategory; leaf: boolean }>;
export type NodeKind = keyof typeof NODE_KINDS;

/** Agrégats déterministes d'un moyeu (trades rattachés). */
export interface NodeMetrics {
  /** Trades rattachés. */
  n: number;
  pnl: number;
  wins: number;
  losses: number;
  breakEven: number;
  /** Taux de réussite parmi les décisifs — `null` sous `MIN_BUCKET_SAMPLE` trades. */
  winRate: number | null;
  /** R réalisé moyen sur les seuls trades à R mesuré — `null` sous `MIN_BUCKET_SAMPLE`. */
  avgR: number | null;
  nR: number;
}

/** L'enregistrement d'origine d'un nœud — ce qu'on ouvre pour le vérifier. */
export interface SourceRef {
  table: string;
  id: string;
}

export interface KnowledgeNode {
  /** `kind:clé` — stable d'un calcul à l'autre, donc utilisable en lien profond. */
  id: string;
  kind: NodeKind;
  category: NodeCategory;
  /** La clé brute (nom du setup, symbole, date…) ; le libellé affiché se fait côté UI. */
  key: string;
  /** Libellé brut, non traduit : nom saisi par le trader, symbole, titre. */
  label: string;
  /** Jour civil (`AAAA-MM-JJ`) pour la frise, quand l'entité est datée. */
  date?: string;
  metrics?: NodeMetrics;
  /** Absente pour un moyeu dérivé (setup, symbole…) : il n'a pas de ligne à lui. */
  source?: SourceRef;
  /** Petites valeurs utiles à l'inspecteur (jamais un recalcul de statistique). */
  data?: Record<string, string | number | boolean | null>;
}

/** Ce qui justifie un lien — pas une impression. */
export type EdgeOrigin = "record" | "derived" | "statistical" | "text_match";

/**
 * `fact` : lu tel quel dans un enregistrement (le trade porte ce setup) ;
 * `observed_association` : une mesure sur un échantillon (n, écart, intervalle) ;
 * `hypothesis` : une correspondance plausible à vérifier (une mention de texte).
 * Aucun lien n'affirme une cause.
 */
export type EdgeValidation = "fact" | "observed_association" | "hypothesis";

export const RELATIONS = {
  occurred_on: { origin: "record" },
  part_of: { origin: "derived" },
  belongs_to: { origin: "record" },
  uses_setup: { origin: "record" },
  on_symbol: { origin: "record" },
  in_session: { origin: "derived" },
  has_mistake: { origin: "record" },
  has_confluence: { origin: "record" },
  classified_as: { origin: "derived" },
  in_risk_band: { origin: "derived" },
  has_screenshot: { origin: "record" },
  followed_by: { origin: "derived" },
  during_event: { origin: "derived" },
  same_day_as: { origin: "derived" },
  mentions: { origin: "text_match" },
  co_occurs_with: { origin: "statistical" },
  studies: { origin: "record" },
  simulates: { origin: "record" },
  covers: { origin: "record" },
  derived_from: { origin: "record" },
  supported_by: { origin: "statistical" },
  /** Vue d'ensemble seulement : deux moyeux qui partagent des trades masqués. */
  shares_trades: { origin: "derived" },
} as const satisfies Record<string, { origin: EdgeOrigin }>;
export type RelationType = keyof typeof RELATIONS;

export interface EdgeProvenance {
  origin: EdgeOrigin;
  validation: EdgeValidation;
  /** Clé de méthode, lisible et versionnée (`field:trades.strategy`, `lift>=1.5/n>=10`…). */
  methodology: string;
  /** 1 pour un fait lu ; sinon la confiance déclarée par la méthode, 0–1. */
  confidence: number;
  /** Instant de l'enregistrement source, ou du calcul pour un lien mesuré. */
  createdAt: string;
  /** Enregistrements qui portent la preuve. */
  sources: SourceRef[];
  /** Mesures attachées (n, lift…) — affichées telles quelles par l'inspecteur. */
  evidence?: Record<string, number | string | null>;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  /** Force 0–1 (épaisseur du trait) — dérivée de la mesure, jamais décorative. */
  weight: number;
  provenance: EdgeProvenance;
}

// ── Entrées : formes MINIMALES, structurellement compatibles avec l'app ─────
// Le module ne connaît pas `app/` (règle de dépendance) : il décrit ce dont il
// a besoin, et les types de l'app y correspondent sans conversion.

export interface MissedInput {
  id: string;
  date: string;
  symbol: string;
  reasonNotTaken: string;
  whatHappened: string;
  lessonLearned: string;
  nextTimePlan: string;
  /** R estimé par le trader après coup — HYPOTHÉTIQUE, jamais un résultat. */
  estimatedR: number;
  screenshots: string[];
}

export interface ConversationInput {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Texte des seuls messages du trader (ce qu'il a demandé). */
  userText: string;
}

export interface ResearchInput {
  id: string;
  createdAt: string;
  archived: boolean;
  hypothesis: string;
  dimension: "strategy" | "symbol" | "session" | "weekday" | "account";
  cellKey: string;
  verdict: string | null;
}

export interface ExperimentInput {
  id: string;
  createdAt: string;
  status: string;
  maxLosses: number;
  targetSessions: number;
  startDay: string;
}

export interface SimulationInput {
  id: string;
  name: string;
  updatedAt: string;
  /** Risque fixe par trade supposé par la simulation (monnaie du compte). */
  riskPerTrade: number | null;
  /** Hypothèses de résultat (parmi les trades décisifs), quand elles sont posées. */
  winRate: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  seed: number | null;
  /** D'où vient l'enregistrement : plan local du labo ou scénario enregistré. */
  origin: "lab_plan" | "scenario";
}

export interface ReportInput {
  id: string;
  /** `AAAA-MM`. */
  month: string;
  createdAt: string;
}

export interface ProposalInput {
  id: string;
  patternId: string | null;
  actionType: string;
  text: string;
  createdAt: string;
  n: number | null;
}
