/**
 * MCP (Model Context Protocol) adapter foundation.
 *
 * MCP is bidirectional and both directions reduce to the Tool contract, so the
 * agent runtime never has to care whether a tool is local or remote:
 *
 *   - client: connect to an external MCP server and BRIDGE its tools into our
 *     ToolRegistry as ToolDefinition{ source: "mcp" }. Agents call them like
 *     any other tool.
 *   - server: EXPOSE selected local tools as an MCP server so external agents
 *     (or the user's own Claude) can operate on TradeVault.
 *
 * Keeping MCP behind the same Tool abstraction means MCP is an integration
 * detail, not an architectural fork.
 *
 * FOUNDATION ONLY: contracts. No transport/handshake is implemented.
 */
import type { ToolDefinition } from "../tools/types";

export interface McpServerConfig {
  /** Stable name used to namespace bridged tool names (e.g. "brokerage"). */
  name: string;
  /** Transport endpoint (stdio command or URL) — resolved by the adapter. */
  endpoint: string;
  /** Which of the server's tools to expose (allow-list); empty = none. */
  allow?: string[];
}

/** Consumes an external MCP server, surfacing its tools as local ToolDefinitions. */
export interface McpClientAdapter {
  readonly config: McpServerConfig;
  isConnected(): boolean;
  connect(): Promise<void>;
  /** Bridged tools, ready to hand to registerTool(). */
  listTools(): Promise<ToolDefinition[]>;
}

/** Exposes selected local tools to external MCP clients. */
export interface McpServerExposer {
  /** The local tools published over MCP (an allow-listed subset). */
  exposedTools(): ToolDefinition[];
}
