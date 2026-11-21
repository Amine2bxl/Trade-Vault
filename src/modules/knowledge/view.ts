import { KnowledgeGraph } from "./graph";
import {
  NODE_KINDS,
  type KnowledgeEdge,
  type KnowledgeNode,
  type NodeCategory,
  type RelationType,
} from "./types";

/**
 * CE QUI EST VISIBLE — niveau de détail du graphe, module PUR.
 *
 * L'historique complet ne tient pas lisiblement à l'écran : un an de journal,
 * c'est des milliers de trades, de jours et de captures. La vue montre donc
 * les MOYEUX (setups, symboles, erreurs, séances, mois, découvertes…) et ne
 * déplie les FEUILLES (trades, jours, captures, annonces) que là où le trader
 * le demande : un moyeu déplié, un nœud en focus, ou « tout montrer ».
 *
 * Au-delà de `maxNodes`, les nœuds les moins reliés sont écartés et COMPTÉS :
 * la vue dit ce qu'elle cache, elle ne le tait pas.
 */

export interface ViewState {
  /** Familles masquées. */
  hiddenCategories: ReadonlySet<NodeCategory>;
  /** Relations masquées. */
  hiddenRelations: ReadonlySet<RelationType>;
  /** Moyeux dont les feuilles sont montrées. */
  expanded: ReadonlySet<string>;
  /** Montrer toutes les feuilles (dans la limite de `maxNodes`). */
  showLeaves: boolean;
  /** Fenêtre de la frise, jours civils inclusifs. */
  from?: string | null;
  to?: string | null;
  /** Mode focus : le nœud et son voisinage seulement. */
  focus?: string | null;
  /** Nœuds toujours montrés (sélection, fil d'Ariane). */
  pinned?: ReadonlySet<string>;
  maxNodes: number;
}

/** Au plus ce nombre de liens agrégés par moyeu (les plus forts). */
export const AGGREGATE_PER_HUB = 6;

export interface VisibleGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  /** Nœuds qui passaient les filtres mais dépassaient `maxNodes`. */
  truncated: number;
}

export const DEFAULT_MAX_NODES = 1200;

function inRange(node: KnowledgeNode, from?: string | null, to?: string | null): boolean {
  if (!node.date) return true;
  if (from && node.date < from) return false;
  if (to && node.date > to) return false;
  return true;
}

export function visibleGraph(g: KnowledgeGraph, s: ViewState): VisibleGraph {
  const pinned = s.pinned ?? new Set<string>();
  let candidates: KnowledgeNode[];

  if (s.focus && g.nodes.has(s.focus)) {
    // Focus : le nœud, ses voisins, et les voisins des voisins qui sont des
    // moyeux (le contexte), sans les milliers de feuilles du second cercle.
    const keep = new Set<string>([s.focus]);
    for (const n of g.neighbors(s.focus)) keep.add(n.id);
    for (const id of [...keep]) {
      if (id === s.focus) continue;
      for (const n of g.neighbors(id)) if (!NODE_KINDS[n.kind].leaf) keep.add(n.id);
    }
    for (const id of pinned) keep.add(id);
    candidates = [...keep].map((id) => g.nodes.get(id)!).filter(Boolean);
  } else {
    candidates = [...g.nodes.values()].filter((n) => {
      if (pinned.has(n.id)) return true;
      if (!NODE_KINDS[n.kind].leaf) return true;
      if (s.showLeaves) return true;
      return g.neighbors(n.id).some((m) => s.expanded.has(m.id));
    });
  }

  candidates = candidates.filter(
    (n) =>
      pinned.has(n.id) ||
      n.id === s.focus ||
      (!s.hiddenCategories.has(n.category) && inRange(n, s.from, s.to)),
  );

  let truncated = 0;
  if (candidates.length > s.maxNodes) {
    // Les plus reliés d'abord ; à degré égal, l'ordre des identifiants (stable).
    candidates.sort(
      (a, b) =>
        Number(pinned.has(b.id) || b.id === s.focus) -
          Number(pinned.has(a.id) || a.id === s.focus) ||
        Number(NODE_KINDS[a.kind].leaf) - Number(NODE_KINDS[b.kind].leaf) ||
        g.degree(b.id) - g.degree(a.id) ||
        a.id.localeCompare(b.id),
    );
    truncated = candidates.length - s.maxNodes;
    candidates = candidates.slice(0, s.maxNodes);
  }

  const ids = new Set(candidates.map((n) => n.id));
  const edges: KnowledgeEdge[] = [];
  for (const e of g.edges.values()) {
    if (s.hiddenRelations.has(e.type)) continue;
    if (ids.has(e.source) && ids.has(e.target)) edges.push(e);
  }
  if (!s.hiddenRelations.has("shares_trades")) edges.push(...sharedTradeEdges(g, ids));
  return { nodes: candidates, edges, truncated };
}

/**
 * LES LIENS DE LA VUE D'ENSEMBLE. Trades masqués, un setup et un symbole
 * n'auraient aucun trait entre eux alors que 40 trades les relient. Pour
 * chaque trade MASQUÉ, ses moyeux visibles sont reliés deux à deux ; le lien
 * porte le nombre de trades partagés (un TOTAL, vrai à toute taille) et les
 * trades eux-mêmes comme source. Seuls les plus forts de chaque moyeu restent :
 * une pelote de liens ne montre plus rien.
 */
function sharedTradeEdges(g: KnowledgeGraph, visible: ReadonlySet<string>): KnowledgeEdge[] {
  const pairs = new Map<string, { a: string; b: string; trades: string[] }>();
  for (const n of g.nodes.values()) {
    if (n.kind !== "trade" || visible.has(n.id)) continue;
    const hubs = g
      .neighbors(n.id)
      .filter((m) => visible.has(m.id) && !NODE_KINDS[m.kind].leaf && m.kind !== "month")
      .map((m) => m.id)
      .sort();
    for (let i = 0; i < hubs.length; i++)
      for (let j = i + 1; j < hubs.length; j++) {
        const k = `${hubs[i]}\u0000${hubs[j]}`;
        let p = pairs.get(k);
        if (!p) pairs.set(k, (p = { a: hubs[i], b: hubs[j], trades: [] }));
        p.trades.push(n.key);
      }
  }
  const candidates = [...pairs.values()]
    .filter((p) => p.trades.length >= 2)
    .map((p) => {
      const na = g.nodes.get(p.a)?.metrics?.n ?? p.trades.length;
      const nb = g.nodes.get(p.b)?.metrics?.n ?? p.trades.length;
      return { ...p, weight: Math.min(1, p.trades.length / Math.max(1, Math.min(na, nb))) };
    })
    .sort(
      (x, y) => y.trades.length - x.trades.length || y.weight - x.weight || x.a.localeCompare(y.a),
    );
  const perHub = new Map<string, number>();
  const out: KnowledgeEdge[] = [];
  for (const p of candidates) {
    if ((perHub.get(p.a) ?? 0) >= AGGREGATE_PER_HUB && (perHub.get(p.b) ?? 0) >= AGGREGATE_PER_HUB)
      continue;
    perHub.set(p.a, (perHub.get(p.a) ?? 0) + 1);
    perHub.set(p.b, (perHub.get(p.b) ?? 0) + 1);
    out.push({
      id: `shares_trades|${p.a}|${p.b}`,
      source: p.a,
      target: p.b,
      type: "shares_trades",
      weight: p.weight,
      provenance: {
        origin: "derived",
        validation: "fact",
        methodology: "shared-hidden-trades",
        confidence: 1,
        createdAt: "",
        sources: p.trades.slice(0, 50).map((id) => ({ table: "trades", id })),
        evidence: { trades: p.trades.length },
      },
    });
  }
  return out;
}

/** Nombre de feuilles qu'un moyeu déplierait (affiché sur le bouton). */
export function leafCount(g: KnowledgeGraph, id: string): number {
  return g.neighbors(id).filter((n) => NODE_KINDS[n.kind].leaf).length;
}
