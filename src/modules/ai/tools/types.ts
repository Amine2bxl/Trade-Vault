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
 * CE MODULE NE CONTIENT QUE LES CONTRATS ET LE REGISTRE — délibérément vide au
 * chargement. Les outils réels vivent côté serveur (`backend/ai-tools/`), parce
 * qu'ils lisent la base avec le client de service : les mettre ici les
 * rendrait importables depuis le navigateur, où ils n'auraient aucune raison
 * d'exister. Le registre se remplit par un appel explicite, jamais par un effet
 * d'import.
 */

export type ToolName = string;

/** JSON-Schema fragment describing a tool's arguments (kept as a plain object
 *  so it maps 1:1 onto every provider's function-calling format). */
export type ToolInputSchema = Record<string, unknown>;

export interface ToolContext {
  /** The tool always runs on behalf of exactly one authenticated user. */
  userId: string;
  /**
   * Le sous-compte actif du trader, quand il en a plusieurs.
   *
   * Il vit dans le CONTEXTE et non dans les arguments d'outil, délibérément :
   * le modèle ne doit pas pouvoir changer de compte, pas plus qu'il ne peut
   * changer d'utilisateur. Un outil qui répondrait sur le compte prop alors que
   * le trader regarde son compte perso citerait des chiffres réels, vrais, et
   * faux pour lui — la pire sorte d'erreur dans un produit d'analyse.
   *
   * `null`/absent = tous les comptes, ce qui est la règle de lecture du
   * journal côté client (`app/store/trades.ts`).
   */
  accountId?: string | null;
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
