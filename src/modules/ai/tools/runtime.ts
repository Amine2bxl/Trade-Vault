/**
 * Tool System — runtime. The registry + contracts live in `./types`; this is
 * the execution side: converting registered tools into a provider manifest,
 * running the tool calls a model requests, and threading the results back into
 * the conversation in a provider-agnostic way.
 *
 * Execution is centralized here (never in the agent, never in the vendor SDK)
 * so every call is auditable and permission-checkable. No business tool is
 * registered by this module — it is pure infrastructure.
 */
import type { AIMessage, ProviderTool, ProviderToolCall } from "@/modules/ai-provider";
import { getTool, type ToolContext, type ToolResult } from "./types";

/** Turn registered tool definitions into the provider function-calling manifest. */
export function toProviderTools(names: readonly string[]): ProviderTool[] {
  const out: ProviderTool[] = [];
  for (const name of names) {
    const tool = getTool(name);
    if (tool) {
      out.push({ name: tool.name, description: tool.description, parameters: tool.inputSchema });
    }
  }
  return out;
}

export interface ExecuteOptions {
  /** Audit hook fired after each tool run (telemetry / logging). */
  onResult?: (result: ToolResult, durationMs: number) => void;
  /** Deny side-effecting tools unless explicitly allowed (safe default). */
  allowSideEffects?: boolean;
}

/** Execute the tool calls a model requested. Never throws: a failing or unknown
 *  tool becomes a `ToolResult.error`, which the model can react to. */
export async function executeToolCalls(
  calls: readonly ProviderToolCall[],
  ctx: ToolContext,
  opts: ExecuteOptions = {},
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of calls) {
    const started = Date.now();
    const tool = getTool(call.name);
    let result: ToolResult;
    if (!tool) {
      result = { id: call.id, name: call.name, output: null, error: `Unknown tool: ${call.name}` };
    } else if (tool.sideEffect && !opts.allowSideEffects) {
      result = {
        id: call.id,
        name: call.name,
        output: null,
        error: `Tool "${call.name}" has side effects and is not allowed in this context.`,
      };
    } else {
      try {
        const output = await tool.execute(call.arguments, ctx);
        result = { id: call.id, name: call.name, output };
      } catch (e) {
        result = {
          id: call.id,
          name: call.name,
          output: null,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    results.push(result);
    opts.onResult?.(result, Date.now() - started);
  }
  return results;
}

/** Assistant turn recording which tools the model asked to run — keeps the
 *  transcript coherent across providers. */
export function toolCallsToAssistantMessage(calls: readonly ProviderToolCall[]): AIMessage {
  const summary = calls.map((c) => `${c.name}(${JSON.stringify(c.arguments)})`).join(", ");
  return { role: "assistant", content: `Calling tools: ${summary}` };
}

/** Feeds tool outputs back to the model as a provider-agnostic user turn. */
export function resultsToMessage(results: readonly ToolResult[]): AIMessage {
  const payload = results.map((r) => ({
    tool: r.name,
    ...(r.error ? { error: r.error } : { output: r.output }),
  }));
  return {
    role: "user",
    content: `TOOL RESULTS (use these to answer, do not call the same tool again):\n${JSON.stringify(
      payload,
    )}`,
  };
}
