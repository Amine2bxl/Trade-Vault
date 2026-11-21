import type { Page } from "@/app/types";
import { encodeFilter, type UnifiedFilter } from "@/app/trading/tradeFilter";
import type { KnowledgeGraph, KnowledgeNode, NodeKind } from "@/modules/knowledge";

/**
 * OÙ MÈNE UN NŒUD — son enregistrement d'origine dans l'application.
 *
 * `Record<NodeKind, …>` : un nouveau type d'entité qui n'aurait pas de
 * destination ne compile pas. Un nœud qui ne mène nulle part est exactement
 * ce que le Neural Brain s'interdit.
 */

export type Destination =
  | { type: "page"; page: Page; filter?: UnifiedFilter; open?: string; report?: string }
  | { type: "conversation"; id: string }
  | { type: "jarvis" }
  | { type: "discovery"; id: string };

const tradesOf = (g: KnowledgeGraph, node: KnowledgeNode) =>
  g
    .neighbors(node.id)
    .filter((n) => n.kind === "trade")
    .map((n) => n.key)
    .sort();

const RESOLVERS: Record<NodeKind, (node: KnowledgeNode, g: KnowledgeGraph) => Destination> = {
  account: () => ({ type: "page", page: "dashboard" }),
  month: () => ({ type: "page", page: "calendar" }),
  day: (n, g) => ({ type: "page", page: "journal", filter: { trades: tradesOf(g, n) } }),
  trade: (n) => ({ type: "page", page: "journal", filter: { trades: [n.key] }, open: n.key }),
  session: (n) => ({
    type: "page",
    page: "journal",
    filter: { session: n.key as UnifiedFilter["session"] },
  }),
  strategy: (n) => ({ type: "page", page: "journal", filter: { strategy: n.key } }),
  confluence: (n) => ({ type: "page", page: "journal", filter: { confluence: n.key } }),
  missed: (n) => ({ type: "page", page: "missed", open: n.key }),
  symbol: (n) => ({ type: "page", page: "journal", filter: { symbol: n.key } }),
  economic_event: () => ({ type: "page", page: "news" }),
  mistake: (n) => ({ type: "page", page: "journal", filter: { mistake: n.key } }),
  mistake_cluster: () => ({ type: "page", page: "mistakes" }),
  // Une signature observée : les trades qui la portent, dans le journal.
  error_pattern: (n, g) => ({ type: "page", page: "journal", filter: { trades: tradesOf(g, n) } }),
  risk_band: (n, g) => ({ type: "page", page: "journal", filter: { trades: tradesOf(g, n) } }),
  // Une capture s'ouvre avec son trade (ou son setup manqué).
  screenshot: (n) =>
    n.data?.owner === "missed"
      ? { type: "page", page: "missed", open: String(n.data.ownerId) }
      : {
          type: "page",
          page: "journal",
          filter: { trades: [String(n.data?.ownerId)] },
          open: String(n.data?.ownerId),
        },
  report: (n) => ({ type: "page", page: "reports", report: n.key }),
  simulation: () => ({ type: "page", page: "montecarlo" }),
  conversation: (n) => ({ type: "conversation", id: n.key }),
  research_note: () => ({ type: "page", page: "analytics" }),
  experiment: () => ({ type: "page", page: "mistakes" }),
  proposal: () => ({ type: "jarvis" }),
  discovery: (n) => ({ type: "discovery", id: n.key }),
};

export function destinationOf(node: KnowledgeNode, g: KnowledgeGraph): Destination {
  return RESOLVERS[node.kind](node, g);
}

/**
 * Suit une destination. La navigation passe par l'événement `tv:navigate` du
 * shell (qui pousse une entrée d'historique : « retour » ramène au graphe, sur
 * le nœud quitté), puis l'adresse de la NOUVELLE entrée reçoit ses paramètres
 * (`f`, `open`, `report`) — l'entrée du graphe garde les siens.
 */
export function followDestination(d: Destination, onDiscovery: (id: string) => void): void {
  if (typeof window === "undefined") return;
  if (d.type === "discovery") return onDiscovery(d.id);
  if (d.type === "conversation" || d.type === "jarvis") {
    window.dispatchEvent(
      new CustomEvent("tv:open-jarvis", {
        detail: d.type === "conversation" ? { conversationId: d.id } : null,
      }),
    );
    return;
  }
  const f = d.filter ? encodeFilter(d.filter) : "";
  window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page: d.page } }));
  const url = new URL(window.location.href);
  for (const k of ["node", "f", "open", "report"]) url.searchParams.delete(k);
  if (f) url.searchParams.set("f", f);
  if (d.open) url.searchParams.set("open", d.open);
  if (d.report) url.searchParams.set("report", d.report);
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
  window.dispatchEvent(new CustomEvent("tv:filter"));
}
