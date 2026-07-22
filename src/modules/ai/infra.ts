/**
 * AI Platform — infrastructure barrel.
 *
 * The provider-agnostic plumbing of the AI Platform, with NO business agents:
 * providers, the provider service (generate + tool loop), the context builder,
 * the prompt builder, the tool system, the response formatter and the router.
 *
 * Import from here to build features on the platform:
 *
 *   import { generate, runWithTools, createContextBuilder, buildPrompt } from "@/modules/ai/infra";
 */

// Provider layer (wire adapters + resolution)
export {
  resolveProvider,
  resolveToolCapableProvider,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type AIMessage,
  type AIRole,
  type ProviderTool,
  type ProviderToolCall,
  type ToolChoice,
  type FinishReason,
} from "@/modules/ai-provider";

// AI Provider Service
export {
  generate,
  runWithTools,
  type GenerateOptions,
  type ToolLoopOptions,
  type UsageEvent,
} from "./provider-service";

// Context Builder
export { ContextBuilder, createContextBuilder, CONTEXT_CAPS } from "./context-builder";
export { contextBlocks, languageName, type AIUserContext, type AITradeSummary } from "./context";

// Prompt Builder
export { buildPrompt, type PromptSpec, type ConversationTurn } from "./prompt-builder";

// Tool System
export {
  registerTool,
  getTool,
  toolManifest,
  type ToolDefinition,
  type ToolCall,
  type ToolResult,
  type ToolContext,
  type ToolName,
  type ToolInputSchema,
} from "./tools/types";
export {
  toProviderTools,
  executeToolCalls,
  resultsToMessage,
  toolCallsToAssistantMessage,
  type ExecuteOptions,
} from "./tools/runtime";

// Response Formatter
export {
  formatWith,
  registerFormatter,
  getFormatter,
  tryParseJson,
  toFormatted,
  stripCodeFence,
  type FormattedResponse,
  type Formatter,
  type JsonParse,
} from "./response-formatter";

// Router
export { createRouter, defaultRouter, type RouterOptions } from "./router/router";
export {
  INTENT_AGENT,
  type AIRouter,
  type AiIntent,
  type RoutingRequest,
  type RoutingDecision,
} from "./router/types";
