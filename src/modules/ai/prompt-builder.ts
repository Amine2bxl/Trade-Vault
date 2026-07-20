/**
 * Prompt Builder — assembles a provider-agnostic `AIMessage[]` from parts:
 * a system identity, a task, grounded context blocks, prior conversation and
 * the current user turn, plus an optional output-format directive.
 *
 * It carries NO business persona: the identity and task are inputs, so agents
 * (built later) supply their own voice. This is the same message-threading the
 * live services use, extracted as reusable infrastructure.
 */
import type { AIMessage } from "@/modules/ai-provider";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface PromptSpec {
  /** Who the assistant is (persona / rules). Provided by the caller/agent. */
  identity: string;
  /** What to do this turn (the task instruction). */
  task?: string;
  /** Grounded data the model may cite (from the Context Builder). */
  contextBlocks?: string;
  /** Prior turns, for multi-turn continuity. */
  conversation?: ConversationTurn[];
  /** The current user input. */
  userTurn: string;
  /** Optional output-format directive appended to the system message. */
  outputFormat?: string;
}

function systemMessage(spec: PromptSpec): AIMessage {
  const parts = [spec.identity];
  if (spec.task) parts.push(spec.task);
  if (spec.outputFormat) parts.push(spec.outputFormat);
  return { role: "system", content: parts.join("\n\n") };
}

/**
 * Build the message array. When there is prior conversation, the context is
 * seeded as an opening exchange (so it stays out of the live turns) and the
 * real turns follow; otherwise the context is prepended to the single user
 * turn. Identical strategy to the production services.
 */
export function buildPrompt(spec: PromptSpec): AIMessage[] {
  const messages: AIMessage[] = [systemMessage(spec)];
  const blocks = spec.contextBlocks?.trim() ? spec.contextBlocks : "";
  const convo = spec.conversation ?? [];

  if (convo.length > 0) {
    messages.push({ role: "user", content: blocks || "(context above)" });
    messages.push({ role: "assistant", content: "Understood — I have the context." });
    for (const turn of convo) messages.push({ role: turn.role, content: turn.content });
    messages.push({ role: "user", content: spec.userTurn });
  } else {
    messages.push({
      role: "user",
      content: blocks ? `${blocks}\n\n${spec.userTurn}` : spec.userTurn,
    });
  }
  return messages;
}
