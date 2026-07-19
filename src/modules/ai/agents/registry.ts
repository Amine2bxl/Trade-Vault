/**
 * Agent registry — runtime home for implemented agents. Same shape as the AI
 * Provider registry: register a plug-in, resolve it by id. Empty in the
 * foundation (no agents implemented yet); the router resolves through here.
 */
import type { AgentDefinition, AgentId } from "./types";

const registry = new Map<AgentId, AgentDefinition>();

/** Register an implemented agent. Returns an unregister function. */
export function registerAgent(agent: AgentDefinition): () => void {
  registry.set(agent.id, agent);
  return () => {
    if (registry.get(agent.id) === agent) registry.delete(agent.id);
  };
}

export function getAgent(id: AgentId): AgentDefinition | undefined {
  return registry.get(id);
}

/** Only agents that are both registered and configured. */
export function listReadyAgents(): AgentDefinition[] {
  return [...registry.values()].filter((a) => a.isConfigured());
}

export function isAgentReady(id: AgentId): boolean {
  return !!registry.get(id)?.isConfigured();
}
