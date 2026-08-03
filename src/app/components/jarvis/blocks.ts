/**
 * Jarvis — contrat de blocs (fondation d'architecture, Phase 0).
 *
 * TOUT contenu produit par Jarvis transite par un unique système de blocs
 * (`BlockRenderer`, construit en Phase P2). Ces types ne sont PAS encore
 * rendus — ils fixent le contrat pour éviter toute refonte future.
 *
 * `ToolBlock` est prévu dès maintenant : il permet à Jarvis de proposer des
 * ACTIONS dans l'interface (créer un objectif, ajouter un trade, exporter un
 * rapport…) plutôt que de seulement répondre. Non rendu dans les premières
 * phases, mais présent dans le type de données dès aujourd'hui.
 */

export type JarvisBlockKind =
  | "markdown"
  | "table"
  | "chart"
  | "card"
  | "stats"
  | "recommendation"
  | "checklist"
  | "comparison"
  | "report"
  | "timeline"
  | "alert"
  | "notification"
  | "tool";

/** Actions que Jarvis pourra proposer d'exécuter dans TradeVault. */
export type JarvisToolKind =
  | "createGoal"
  | "createChecklist"
  | "addTrade"
  | "deleteTrade"
  | "updateSetting"
  | "exportReport"
  | "importCsv"
  | "runAnalysis"
  | "createAlert"
  | "openPage";

export interface JarvisToolBlock {
  type: "tool";
  tool: JarvisToolKind;
  label: string;
  /** Données nécessaires à l'exécution de l'action (fournies par le backend). */
  payload?: Record<string, unknown>;
  /** Requiert une confirmation utilisateur avant exécution. */
  confirm?: boolean;
  /** Cible de navigation pour `openPage` (id de page TradeVault). */
  targetPage?: string;
}

export interface JarvisMarkdownBlock {
  type: "markdown";
  content: string;
}

export interface JarvisStatsBlock {
  type: "stats";
  title?: string;
  metrics: { label: string; value: string; trend?: "up" | "down" | "neutral" }[];
}

export interface JarvisCardBlock {
  type: "card";
  title: string;
  body: string;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
}

export interface JarvisChecklistBlock {
  type: "checklist";
  title?: string;
  items: { label: string; done?: boolean }[];
}

export interface JarvisAlertBlock {
  type: "alert";
  level: "info" | "warning" | "danger" | "success";
  message: string;
}

/** Ligne du Hero : la voix de Jarvis, structurée. */
export interface JarvisHeroLine {
  kind: "context" | "observation" | "impact" | "action";
  text: string;
}

/** Le briefing vocal d'ouverture (≤ 5 phrases : Contexte → Observation → Impact → Action). */
export interface JarvisHeroBlock {
  type: "hero";
  lines: JarvisHeroLine[];
}

/** La preuve chiffrée d'un pattern détecté. */
export interface JarvisInsightBlock {
  type: "insight";
  patternLabel: string;
  metrics: { label: string; value: string; tone?: "up" | "down" | "neutral" }[];
  impact?: string;
}

/** La mission du jour : actions immédiates, éventuellement exécutables (ToolBlock futur). */
export interface JarvisMissionBlock {
  type: "mission";
  title: string;
  items: string[];
  /** Action optionnelle. `payload`/`targetPage` sont nécessaires pour que le
   *  CTA soit RÉELLEMENT exécutable : sans eux, le handler ne peut rien écrire
   *  (ajout additif, rétro-compatible — les blocs existants restent valides). */
  cta?: {
    label: string;
    tool?: JarvisToolKind;
    payload?: Record<string, unknown>;
    targetPage?: string;
  };
}

/**
 * Message produit par Jarvis : une liste de blocs (jamais un blob de texte
 * seul). `text` reste supporté comme repli pour les réponses markdown simples.
 */
export interface JarvisMessage {
  role: "user" | "assistant" | "error";
  id: string;
  blocks: JarvisBlock[];
  createdAt: string;
}

export type JarvisBlock =
  | JarvisMarkdownBlock
  | JarvisStatsBlock
  | JarvisCardBlock
  | JarvisChecklistBlock
  | JarvisAlertBlock
  | JarvisHeroBlock
  | JarvisInsightBlock
  | JarvisMissionBlock
  | JarvisToolBlock
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "chart"; kind: "line" | "bar" | "area"; data: unknown }
  | { type: "recommendation"; title: string; body: string; priority: "high" | "medium" | "low" }
  | { type: "comparison"; title: string; rows: string[][] }
  | { type: "report"; title: string; summary: string; url?: string }
  | { type: "timeline"; events: { time: string; label: string; tone?: string }[] }
  | {
      type: "notification";
      title: string;
      body: string;
      kind: "info" | "success" | "warning" | "danger";
    };

/** Émetteur d'action Jarvis → TradeVault (consommé en Phase P6+). */
export type JarvisToolHandler = (block: JarvisToolBlock) => void;
