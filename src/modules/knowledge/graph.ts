import { NODE_KINDS, type KnowledgeEdge, type KnowledgeNode, type NodeKind } from "./types";

/**
 * Le graphe en mémoire et ses requêtes — module PUR.
 *
 * Un nœud ou un lien porte un identifiant STABLE (`kind:clé`, `type|a|b`) :
 * reconstruire le graphe après un nouveau trade redonne les mêmes
 * identifiants, ce qui garde la sélection, le fil d'Ariane et les liens
 * profonds valides d'un calcul à l'autre.
 */
export class KnowledgeGraph {
  readonly nodes = new Map<string, KnowledgeNode>();
  readonly edges = new Map<string, KnowledgeEdge>();
  private readonly adjacency = new Map<string, Set<string>>();

  static nodeId(kind: NodeKind, key: string): string {
    return `${kind}:${key}`;
  }

  /** Ajoute un nœud ; un second ajout du même identifiant est ignoré. */
  addNode(node: Omit<KnowledgeNode, "category">): KnowledgeNode {
    const existing = this.nodes.get(node.id);
    if (existing) return existing;
    const full: KnowledgeNode = { ...node, category: NODE_KINDS[node.kind].category };
    this.nodes.set(full.id, full);
    return full;
  }

  /**
   * Ajoute un lien entre deux nœuds EXISTANTS. Un lien vers un nœud absent est
   * refusé : un nœud qui ne mène nulle part, ou un lien qui pointe dans le
   * vide, serait exactement ce que la vue ne doit jamais montrer.
   */
  addEdge(edge: Omit<KnowledgeEdge, "id">): KnowledgeEdge | null {
    if (edge.source === edge.target) return null;
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) return null;
    const id = `${edge.type}|${edge.source}|${edge.target}`;
    const existing = this.edges.get(id);
    if (existing) return existing;
    const full = { ...edge, id };
    this.edges.set(id, full);
    this.link(edge.source, id);
    this.link(edge.target, id);
    return full;
  }

  private link(nodeId: string, edgeId: string) {
    let set = this.adjacency.get(nodeId);
    if (!set) this.adjacency.set(nodeId, (set = new Set()));
    set.add(edgeId);
  }

  /** Les liens d'un nœud (dans les deux sens). */
  edgesOf(nodeId: string): KnowledgeEdge[] {
    const ids = this.adjacency.get(nodeId);
    if (!ids) return [];
    const out: KnowledgeEdge[] = [];
    for (const id of ids) {
      const e = this.edges.get(id);
      if (e) out.push(e);
    }
    return out;
  }

  /** L'autre extrémité d'un lien, vue depuis `nodeId`. */
  static other(edge: KnowledgeEdge, nodeId: string): string {
    return edge.source === nodeId ? edge.target : edge.source;
  }

  neighbors(nodeId: string): KnowledgeNode[] {
    const out: KnowledgeNode[] = [];
    for (const e of this.edgesOf(nodeId)) {
      const n = this.nodes.get(KnowledgeGraph.other(e, nodeId));
      if (n) out.push(n);
    }
    return out;
  }

  degree(nodeId: string): number {
    return this.adjacency.get(nodeId)?.size ?? 0;
  }

  /**
   * Le plus court chemin (en nombre de liens) entre deux nœuds, ou `null`.
   * Parcours en largeur borné : au-delà de `maxDepth`, deux entités ne sont
   * plus « reliées » au sens où un trader le lirait.
   */
  shortestPath(from: string, to: string, maxDepth = 6): string[] | null {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return null;
    if (from === to) return [from];
    const prev = new Map<string, string>([[from, from]]);
    let frontier = [from];
    for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const e of this.edgesOf(id)) {
          const o = KnowledgeGraph.other(e, id);
          if (prev.has(o)) continue;
          prev.set(o, id);
          if (o === to) {
            const path = [to];
            let cur = to;
            while (cur !== from) {
              cur = prev.get(cur)!;
              path.push(cur);
            }
            return path.reverse();
          }
          next.push(o);
        }
      }
      frontier = next;
    }
    return null;
  }

  /**
   * Recherche plein texte sur le libellé et la clé, insensible à la casse et
   * aux accents. Les moyeux passent devant les feuilles à pertinence égale.
   */
  search(query: string, limit = 20): KnowledgeNode[] {
    const q = fold(query.trim());
    if (!q) return [];
    const scored: { node: KnowledgeNode; score: number }[] = [];
    for (const node of this.nodes.values()) {
      const label = fold(node.label);
      const key = fold(node.key);
      const at = Math.min(
        label.indexOf(q) === -1 ? Infinity : label.indexOf(q),
        key.indexOf(q) === -1 ? Infinity : key.indexOf(q),
      );
      if (at === Infinity) continue;
      const score =
        (label === q || key === q ? 0 : at === 0 ? 1 : 2) + (NODE_KINDS[node.kind].leaf ? 0.5 : 0);
      scored.push({ node, score });
    }
    scored.sort(
      (a, b) =>
        a.score - b.score ||
        this.degree(b.node.id) - this.degree(a.node.id) ||
        a.node.id.localeCompare(b.node.id),
    );
    return scored.slice(0, limit).map((s) => s.node);
  }
}

/** Minuscules sans diacritiques — « Équilibré » se trouve en tapant « equi ». */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
