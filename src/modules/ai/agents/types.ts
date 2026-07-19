/**
 * AI Agent abstraction — the extension point for every AI system in the OS
 * (Coach, Performance Analyst, Psychologist, Risk Manager, Pattern Finder …).
 *
 * Mirrors the AI Provider pattern on purpose: an agent is a self-contained
 * plug-in registered in a registry, so a new AI system is added by dropping in
 * one file + one registration — never by editing another agent. Agents are
 * provider-agnostic (they go through the AI Provider layer) and side-effect
 * free at the type level (their intents to persist memory / call tools are
 * *returned*, executed by the runtime — see AgentResult).
 *
 * FOUNDATION ONLY: this file defines contracts. No agent is implemented yet.
 */
import type { AIUserContext } from "../context";
import type { ToolCall, ToolName } from "../tools/types";
import type { RetrievedChunk } from "../rag/types";

export type AgentId =
  | "coach"
  | "performance-analyst"
  | "psychologist"
  | "risk-manager"
  | "pattern-finder";

/** Declarative metadata describing an agent's role — pure config, no logic.
 *  The catalog of blueprints documents the *planned* roster; a blueprint
 *  becomes a live AgentDefinition once someone implements `run`. */
export interface AgentBlueprint {
  readonly id: AgentId;
  readonly title: string;
  readonly description: string;
  /** System persona seed (declarative; the runtime composes the final prompt). */
  readonly persona: string;
  /** Tools this agent is authorized to call, by name. */
  readonly tools: readonly ToolName[];
  /** Whether the agent produces prose (markdown) or a structured JSON result. */
  readonly output: "markdown" | "json";
}

export interface AgentRequest {
  userId: string;
  /** Natural-language ask or a structured trigger serialized to string. */
  input: string;
  /** Grounded context the agent may cite (trades, stats, memory, goals…). */
  context: AIUserContext;
  /** Extra passages retrieved by RAG for this request (optional). */
  retrieved?: RetrievedChunk[];
  /** Results of tools already executed in a prior turn of the calling loop. */
  toolResults?: { name: ToolName; output: unknown }[];
  language?: string;
  /** Correlates multi-turn sessions and telemetry. */
  sessionId?: string;
}

export interface AgentResult {
  agent: AgentId;
  /** Markdown answer, or a JSON string for structured agents. */
  content: string;
  /** Parsed structured payload for `output: "json"` agents. */
  data?: unknown;
  /** Tools the agent wants the runtime to execute, then loop back. */
  toolCalls?: ToolCall[];
  /** Durable memory the agent asks to persist (executed by the runtime). */
  remember?: { kind: string; content: string }[];
  usage?: { provider: string; model: string; inputTokens?: number; outputTokens?: number };
}

/** A registered, runnable agent. Implementations are added later; the
 *  foundation ships only the contract. */
export interface AgentDefinition extends AgentBlueprint {
  /** True when the agent's dependencies (provider keys, data) are ready. */
  isConfigured(): boolean;
  /** Execute one turn. NOT IMPLEMENTED in the foundation. */
  run(req: AgentRequest): Promise<AgentResult>;
}
