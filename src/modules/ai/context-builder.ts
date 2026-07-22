/**
 * Context Builder — a typed, capped builder that assembles the grounded
 * `AIUserContext` handed to the model. It centralizes the size caps (so no
 * single call can blow the token budget) and reuses `contextBlocks` for the
 * grounded serialization. Pure and business-agnostic: it shapes whatever data
 * a caller provides, it never fetches or knows what a "coach" is.
 */
import { contextBlocks, type AITradeSummary, type AIUserContext } from "./context";

/** Caps mirror the server-side Zod limits in `backend/ai.functions.ts`. */
export const CONTEXT_CAPS = {
  trades: 500,
  goals: 10,
  mistakes: 40,
  rules: 30,
  memory: 60,
  memoryContent: 2000,
  conversation: 20,
  conversationContent: 8000,
} as const;

type Goal = NonNullable<AIUserContext["goals"]>[number];
type Mistake = NonNullable<AIUserContext["mistakes"]>[number];
type Rule = NonNullable<AIUserContext["rules"]>[number];
type Memory = NonNullable<AIUserContext["memory"]>[number];
type Turn = NonNullable<AIUserContext["conversation"]>[number];

export class ContextBuilder {
  private ctx: AIUserContext = {};

  withTrades(trades: AITradeSummary[]): this {
    this.ctx.trades = trades.slice(0, CONTEXT_CAPS.trades);
    return this;
  }

  withStats(stats: Record<string, number | string | null>): this {
    this.ctx.stats = stats;
    return this;
  }

  withGoals(goals: Goal[]): this {
    this.ctx.goals = goals.slice(0, CONTEXT_CAPS.goals);
    return this;
  }

  withMistakes(mistakes: Mistake[]): this {
    this.ctx.mistakes = mistakes.slice(0, CONTEXT_CAPS.mistakes);
    return this;
  }

  withRules(rules: Rule[]): this {
    this.ctx.rules = rules.slice(0, CONTEXT_CAPS.rules);
    return this;
  }

  withMemory(memory: Memory[]): this {
    this.ctx.memory = memory.slice(0, CONTEXT_CAPS.memory).map((m) => ({
      kind: m.kind,
      content: m.content.slice(0, CONTEXT_CAPS.memoryContent),
    }));
    return this;
  }

  withConversation(turns: Turn[]): this {
    this.ctx.conversation = turns.slice(-CONTEXT_CAPS.conversation).map((t) => ({
      role: t.role,
      content: t.content.slice(0, CONTEXT_CAPS.conversationContent),
    }));
    return this;
  }

  withLanguage(language: string | undefined): this {
    if (language) this.ctx.language = language;
    return this;
  }

  /** The normalized, capped context object. */
  build(): AIUserContext {
    return this.ctx;
  }

  /** The grounded prompt blocks (the data the model may cite). */
  blocks(): string {
    return contextBlocks(this.ctx);
  }
}

export function createContextBuilder(): ContextBuilder {
  return new ContextBuilder();
}
