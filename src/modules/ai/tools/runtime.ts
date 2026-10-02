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
import type {
  AIMessage,
  ProviderTool,
  ProviderToolCall,
  ProviderTurn,
} from "@/modules/ai-provider";
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

/**
 * Donne un id à chaque appel. Un fournisseur qui n'en rend pas (Gemini 2.5)
 * reçoit `tvcall_<n>` : le même id voyage dans le tour assistant ET dans le
 * résultat, ce qui permet à chaque adaptateur de les apparier. Le préfixe dit
 * aux adaptateurs que l'id est synthétique (Gemini ne le renvoie donc pas).
 */
export function withCallIds(calls: readonly ProviderToolCall[]): ProviderToolCall[] {
  return calls.map((c, i) => (c.id ? c : { ...c, id: `tvcall_${i}` }));
}

/** Execute the tool calls a model requested. Never throws: a failing or unknown
 *  tool becomes a `ToolResult.error`, which the model can react to.
 *
 *  EN PARALLÈLE. Les outils de Jarvis sont en lecture seule et indépendants :
 *  les exécuter l'un après l'autre additionnait leurs latences (trois lectures
 *  de base à la suite pour une question qui en demande trois). L'ordre des
 *  résultats reste celui des appels. */
export async function executeToolCalls(
  calls: readonly ProviderToolCall[],
  ctx: ToolContext,
  opts: ExecuteOptions = {},
): Promise<ToolResult[]> {
  const run = async (call: ProviderToolCall): Promise<ToolResult> => {
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
    opts.onResult?.(result, Date.now() - started);
    return result;
  };
  // Un outil à effet de bord n'est jamais lancé en parallèle d'autres : s'il est
  // un jour autorisé, son ordre d'exécution doit rester celui du modèle.
  if (opts.allowSideEffects) {
    const out: ToolResult[] = [];
    for (const call of calls) out.push(await run(call));
    return out;
  }
  return Promise.all(calls.map(run));
}

/** Assistant turn recording which tools the model asked to run — keeps the
 *  transcript coherent across providers.
 *
 *  Le texte (`content`) reste la forme universelle ; les appels (ids compris)
 *  et le tour NATIF du fournisseur l'accompagnent pour qu'il soit rejoué tel
 *  quel — signatures de réflexion comprises. */
export function toolCallsToAssistantMessage(
  calls: readonly ProviderToolCall[],
  providerTurn?: ProviderTurn,
): AIMessage {
  const summary = calls.map((c) => `${c.name}(${JSON.stringify(c.arguments)})`).join(", ");
  return {
    role: "assistant",
    content: `Calling tools: ${summary}`,
    toolCalls: [...calls],
    ...(providerTurn ? { providerTurn } : {}),
  };
}

/** Feeds tool outputs back to the model as a provider-agnostic user turn —
 *  plus, pour les fournisseurs qui les comprennent, les résultats natifs. */
export function resultsToMessage(results: readonly ToolResult[]): AIMessage {
  const payload = results.map((r) => ({
    tool: r.name,
    ...(r.error ? { error: r.error } : { output: r.output }),
  }));
  /* « do not call the same tool again » CONTREDISAIT le protocole d'outils, qui
     demande d'appeler `get_stats` deux fois pour comparer deux périodes (bug
     B8) : après le premier résultat, le modèle n'osait plus lire la seconde
     fenêtre et répondait sur une seule. Ce qui est interdit, c'est de redemander
     EXACTEMENT la même chose — pas de relire avec d'autres arguments. */
  return {
    role: "user",
    content: `TOOL RESULTS (measured data — use it to answer; call a tool again only with different arguments, when the question still needs data that is not here):\n${JSON.stringify(
      payload,
    )}`,
    toolResults: results.map((r) => ({
      id: r.id ?? "",
      name: r.name,
      ...(r.error ? { error: r.error } : { output: r.output }),
    })),
  };
}
