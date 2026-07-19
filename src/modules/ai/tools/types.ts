/**
 * Tool Calling — provider-agnostic function calling for agents.
 *
 * A Tool is a named, schema-described capability the model may invoke
 * (read the trader's stats, search memory, assess a trade's risk…). The
 * runtime — not the agent, and not the vendor SDK — executes the call and
 * feeds the result back. This keeps tool execution auditable, permissioned,
 * and identical whether the underlying model is Gemini, Claude, or an MCP-
 * bridged external tool.
 *
 * FOUNDATION ONLY: contracts + an empty registry. No tool is implemented.
 */

export type ToolName = string;

/** JSON-Schema fragment describing a tool's arguments (kept as a plain object
 *  so it maps 1:1 onto every provider's function-calling format). */
export type ToolInputSchema = Record<string, unknown>;

export interface ToolContext {
  /** The tool always runs on behalf of exactly one authenticated user. */
  userId: string;
  /** Correlates the call to an agent run for telemetry/audit. */
  runId?: string;
}

export interface ToolDefinition<Input = Record<string, unknown>, Output = unknown> {
  readonly name: ToolName;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
  /** true = the tool mutates state (write); false = pure read. The runtime
   *  can require confirmation / stricter auth for side-effecting tools. */
  readonly sideEffect: boolean;
  /** Where the tool lives — a local server function, or a bridged MCP tool. */
  readonly source: "local" | "mcp";
  execute(input: Input, ctx: ToolContext): Promise<Output>;
}

/** A model's request to run a tool. */
export interface ToolCall {
  id?: string;
  name: ToolName;
  arguments: Record<string, unknown>;
}

/** The result the runtime feeds back to the model. */
export interface ToolResult {
  id?: string;
  name: ToolName;
  output: unknown;
  error?: string;
}

// ── Registry ─────────────────────────────────────────────────────────────────
const registry = new Map<ToolName, ToolDefinition>();

export function registerTool(tool: ToolDefinition): () => void {
  registry.set(tool.name, tool as ToolDefinition);
  return () => {
    if (registry.get(tool.name) === tool) registry.delete(tool.name);
  };
}

export function getTool(name: ToolName): ToolDefinition | undefined {
  return registry.get(name);
}

/** The tool schemas an agent is allowed to use — handed to the provider as its
 *  function-calling manifest. Unknown/unregistered names are skipped. */
export function toolManifest(names: readonly ToolName[]): ToolDefinition[] {
  return names.map((n) => registry.get(n)).filter((t): t is ToolDefinition => !!t);
}
