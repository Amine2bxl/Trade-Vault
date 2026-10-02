/**
 * AI telemetry — audit trail of every agent invocation (ai_agent_runs).
 *
 * Why a first-class record: an AI OS spends money and makes claims about a
 * user's trading, so every run must be observable (latency, tokens, cost),
 * attributable (which agent, which model), and reproducible (input/output
 * summaries). It also feeds per-user rate/cost governance later.
 *
 * Le writer vit dans `backend/telemetry.server.ts` (service role) : la table
 * n'a aucune politique d'insertion, pour qu'un client ne puisse pas fabriquer
 * de fausses métriques.
 */
import type { AgentId } from "./agents/types";
import type { AiIntent } from "./router/types";

export interface AgentRun {
  id: string;
  userId: string;
  agent: AgentId;
  intent: AiIntent;
  provider: string;
  model: string;
  /**
   * `fallback` = la réponse déterministe a été servie (aucun provider
   * disponible, ou texte vide). C'est un état DISTINCT d'une erreur : le
   * trader a bien obtenu une réponse fondée sur ses données. Les confondre
   * masquerait le taux de repli, qui est précisément ce qu'il faut surveiller.
   */
  status: "ok" | "error" | "fallback";
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  /** Short, non-sensitive summaries — never the full prompt/answer. */
  inputSummary?: string;
  outputSummary?: string;
  error?: string;
  createdAt: string;
  /**
   * OBSERVABILITÉ D'UNE QUESTION (LOT 2) — des métadonnées, jamais de contenu.
   * Tous optionnels : un appelant historique (extraction de mémoire) ne les
   * renseigne pas.
   */
  /** Niveau de difficulté 1–4 et emplacement de modèle choisi. */
  tier?: number;
  slot?: string;
  /** Domaines routés, ambiguïté, routage par modèle, étiquettes du lexique. */
  route?: { domains: string[]; ambiguous: boolean; modelRouted: boolean; signals: string[] };
  /** Outils exécutés par la boucle, et lectures préparées. */
  tools?: string[];
  toolCalls?: number;
  prefetch?: { tool: string; ok: boolean; ms: number }[];
  /** Appels modèle de la question (routage, boucle, réparation). */
  modelCalls?: number;
  thinkingTokens?: number;
  cachedInputTokens?: number;
  /** Coût estimé en $ (`null` = prix d'un modèle inconnu). */
  costUsd?: number | null;
  /** Résultat de la vérification des chiffres. */
  validation?: "ok" | "repaired" | "flagged" | "skipped";
  unsupportedFigures?: number;
  /** Taille du contexte envoyé au premier appel, en caractères. */
  contextChars?: number;
}

export interface TelemetryRecorder {
  record(run: Omit<AgentRun, "id" | "createdAt">): Promise<void>;
}
