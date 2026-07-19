/**
 * Agent catalog — the declarative roster of the AI Operating System.
 *
 * These are BLUEPRINTS (pure metadata: role, persona seed, allowed tools),
 * not implementations. They document what each AI system is for and which
 * tools it may use, so the product and future implementers share one source
 * of truth. Implementing an agent = providing a `run()` for its blueprint and
 * registering the resulting AgentDefinition (see registry.ts).
 *
 * No AI logic here — this file is configuration.
 */
import type { AgentBlueprint } from "./types";

export const AGENT_CATALOG: Record<AgentBlueprint["id"], AgentBlueprint> = {
  coach: {
    id: "coach",
    title: "AI Coach",
    description:
      "Conversational mentor grounded in the trader's real journal — answers, encourages, and holds them accountable.",
    persona:
      "An elite quant trading coach who KNOWS this trader (memory, rules, goals). Cites real numbers, never invents, candid but kind.",
    tools: ["get_stats", "get_trades", "search_memory", "get_rules", "get_goals"],
    output: "markdown",
  },
  "performance-analyst": {
    id: "performance-analyst",
    title: "AI Performance Analyst",
    description:
      "Quantitative performance breakdown: expectancy, edge by setup/session/symbol, equity quality.",
    persona:
      "A performance quant who turns the journal into decisions: what has edge, what leaks money, ranked by expected value.",
    tools: ["get_stats", "get_trades", "compute_quant_stats"],
    output: "json",
  },
  psychologist: {
    id: "psychologist",
    title: "AI Psychologist",
    description:
      "Behavioral & emotional patterns: tilt, revenge trading, overconfidence, discipline drift.",
    persona:
      "A trading psychologist who reads behavior from the data (sizing after losses, time-of-day tilt) and coaches mindset, not markets.",
    tools: ["get_trades", "search_memory", "get_discipline_events"],
    output: "markdown",
  },
  "risk-manager": {
    id: "risk-manager",
    title: "AI Risk Manager",
    description:
      "Real-time risk posture: exposure, over-risk, streak-based limits, rule violations.",
    persona:
      "A risk manager who is deterministic-first: it interprets the Discipline/Analysis engines' outputs, it never invents risk numbers.",
    tools: ["get_stats", "get_rules", "get_discipline_events", "assess_trade_risk"],
    output: "json",
  },
  "pattern-finder": {
    id: "pattern-finder",
    title: "AI Pattern Finder",
    description:
      "Mines recurring patterns (time, symbol, setup, mistake, sizing) with cited evidence.",
    persona:
      "A pattern miner that only reports patterns grounded in cited numbers, each with a confidence and an actionable suggestion.",
    tools: ["get_trades", "get_stats", "search_memory"],
    output: "json",
  },
};

export const AGENT_IDS = Object.keys(AGENT_CATALOG) as AgentBlueprint["id"][];
