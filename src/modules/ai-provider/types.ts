/**
 * AI Provider abstraction — the application NEVER talks to a vendor API
 * directly and never knows which model answered. Swapping Gemini for
 * Claude/OpenAI/Mistral/Ollama = adding a provider file + changing the
 * AI_PROVIDER env var. Server-side only.
 */

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AIRequest {
  /** Full conversation, system prompt included as the first message. */
  messages: AIMessage[];
  /** Soft output budget; providers map it to their own parameter. */
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider for a strict-JSON answer when supported. */
  json?: boolean;
}

export interface AIResponse {
  text: string;
  /** Which provider actually served the call (telemetry only — never
   *  branch application logic on this). */
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AIProvider {
  readonly id: string;
  /** True when the provider has the credentials it needs. */
  isConfigured(): boolean;
  complete(req: AIRequest): Promise<AIResponse>;
}
