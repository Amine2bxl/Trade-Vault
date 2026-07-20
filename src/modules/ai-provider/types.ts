/**
 * AI Provider abstraction — the application NEVER talks to a vendor API
 * directly and never knows which model answered. Swapping Gemini for
 * Claude/OpenAI/Mistral/Ollama = adding a provider file + changing the
 * AI_PROVIDER env var. Server-side only.
 *
 * Tool-calling fields are OPTIONAL and additive: providers that don't support
 * function calling simply ignore `req.tools` and never set `res.toolCalls`, so
 * every existing caller keeps compiling and behaving identically.
 */

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

/**
 * Provider-agnostic tool spec handed to the model as its function-calling
 * manifest. `parameters` is a JSON-Schema object, which maps 1:1 onto both
 * OpenAI (`tools[].function.parameters`) and Anthropic (`tools[].input_schema`).
 */
export interface ProviderTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** How the model should decide whether to call a tool. */
export type ToolChoice = "auto" | "none" | "required";

/** A model's request to invoke a tool (normalized across providers). */
export interface ProviderToolCall {
  /** Provider-issued call id, echoed back when returning the tool result. */
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIRequest {
  /** Full conversation, system prompt included as the first message. */
  messages: AIMessage[];
  /** Soft output budget; providers map it to their own parameter. */
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider for a strict-JSON answer when supported. */
  json?: boolean;
  /** Function-calling manifest. Ignored by providers without tool support. */
  tools?: ProviderTool[];
  /** Tool-calling policy (default provider behaviour when omitted). */
  toolChoice?: ToolChoice;
}

/** Why the model stopped — normalized. `tool_calls` means it wants tools run. */
export type FinishReason = "stop" | "length" | "tool_calls" | "content_filter" | "unknown";

export interface AIResponse {
  text: string;
  /** Which provider actually served the call (telemetry only — never
   *  branch application logic on this). */
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Populated only when the model requested one or more tool invocations. */
  toolCalls?: ProviderToolCall[];
  finishReason?: FinishReason;
}

export interface AIProvider {
  readonly id: string;
  /** True when the provider has the credentials it needs. */
  isConfigured(): boolean;
  complete(req: AIRequest): Promise<AIResponse>;
  /**
   * Whether this provider natively supports the tool-calling fields above.
   * Optional for back-compat: treated as `false` when absent.
   */
  readonly supportsTools?: boolean;
}
