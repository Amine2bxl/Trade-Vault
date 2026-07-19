/**
 * AI Core — public facade. Components call these THROUGH server functions
 * (never a vendor SDK) and get typed results back.
 *
 *   AI.chat(...)               → coached Q&A on the trader's real data
 *   AI.generateDailyBrief(...) → pre-market brief
 *   AI.generateWeeklyReview(..)→ weekly synthesis
 *   AI.analyzeTrade(...)       → mentor debrief of one analyzed trade
 *   AI.detectPatterns(...)     → structured recurring-pattern list
 *   AI.generateLessons(...)    → durable lessons from mistakes
 *
 * Memory helpers (loadMemory/remember/forget) persist what the coach
 * learns so every future call starts already knowing the trader.
 */

export {
  aiChat,
  aiGenerateDailyBrief,
  aiGenerateWeeklyReview,
  aiAnalyzeTrade,
  aiDetectPatterns,
  aiGenerateLessons,
} from "@/lib/ai.functions";

export { loadMemory, remember, forget } from "./memory";
export type { MemoryKind, MemoryEntry } from "./memory";
export { contextBlocks, languageName } from "./context";
export type { AIUserContext, AITradeSummary } from "./context";

import {
  aiChat,
  aiGenerateDailyBrief,
  aiGenerateWeeklyReview,
  aiAnalyzeTrade,
  aiDetectPatterns,
  aiGenerateLessons,
} from "@/lib/ai.functions";

export const AI = {
  chat: aiChat,
  generateDailyBrief: aiGenerateDailyBrief,
  generateWeeklyReview: aiGenerateWeeklyReview,
  analyzeTrade: aiAnalyzeTrade,
  detectPatterns: aiDetectPatterns,
  generateLessons: aiGenerateLessons,
} as const;

// ── AI Operating System foundation ───────────────────────────────────────────
// Contracts + registries only — NO agent, tool, retriever, or job is
// implemented yet. See docs/AI-ARCHITECTURE.md for the design and data flows.
export { AGENT_CATALOG, AGENT_IDS } from "./agents/catalog";
export { registerAgent, getAgent, listReadyAgents, isAgentReady } from "./agents/registry";
export type {
  AgentId,
  AgentBlueprint,
  AgentDefinition,
  AgentRequest,
  AgentResult,
} from "./agents/types";

export { registerTool, getTool, toolManifest } from "./tools/types";
export type { ToolDefinition, ToolCall, ToolResult, ToolContext, ToolName } from "./tools/types";

export { defaultRouter } from "./router/router";
export { INTENT_AGENT } from "./router/types";
export type { AIRouter, AiIntent, RoutingRequest, RoutingDecision } from "./router/types";

export type {
  EmbeddingProvider,
  Retriever,
  RagDocument,
  RetrievedChunk,
  EmbeddingSource,
} from "./rag/types";

export { registerJobHandler, getJobHandler } from "./jobs/types";
export type { AiJob, JobKind, JobStatus, JobHandler, JobQueue } from "./jobs/types";

export type { McpClientAdapter, McpServerExposer, McpServerConfig } from "./mcp/types";
export type { AgentRun, TelemetryRecorder } from "./telemetry";
