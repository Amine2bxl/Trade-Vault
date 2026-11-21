import { makeRng } from "@/modules/probability/rng";
import { NODE_CATEGORIES, type NodeCategory } from "./types";

/**
 * DISPOSITION 3D — force dirigée, déterministe, module PUR.
 *
 * Trois forces, chacune avec une raison :
 *   • répulsion à courte portée (grille de hachage spatiale : O(n·k), pas
 *     O(n²)) — deux nœuds ne se recouvrent pas ;
 *   • ressorts le long des liens — ce qui est relié se rapproche ;
 *   • ancrage faible de chaque famille sur un point de la sphère — le trading,
 *     le comportement, le marché, l'IA forment des « lobes » qu'on reconnaît
 *     d'une visite à l'autre, au lieu d'une pelote différente à chaque calcul.
 *
 * Même graine, mêmes nœuds → mêmes positions. Les nœuds déjà placés (graphe
 * déplié, nouvelle donnée) gardent leur place de départ : la vue ne se
 * réarrange pas sous les yeux du trader à chaque ajout.
 */

export interface LayoutInputNode {
  id: string;
  category: NodeCategory;
}

export interface LayoutInputEdge {
  source: string;
  target: string;
  /** 0–1 : un lien fort tire plus. */
  weight: number;
}

const ANCHOR_RADIUS = 220;
const REPULSION = 1800;
const CUTOFF = 70;
const SPRING = 0.04;
const REST = 34;
const ANCHOR_PULL = 0.006;
const DAMPING = 0.82;
const MAX_SPEED = 24;

/** Points répartis sur une sphère (spirale de Fibonacci) : un par famille. */
export function categoryAnchors(
  radius = ANCHOR_RADIUS,
): Record<NodeCategory, [number, number, number]> {
  const out = {} as Record<NodeCategory, [number, number, number]>;
  const n = NODE_CATEGORIES.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  NODE_CATEGORIES.forEach((c, i) => {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    out[c] = [Math.cos(theta) * r * radius, y * radius * 0.7, Math.sin(theta) * r * radius];
  });
  return out;
}

export class ForceLayout3D {
  readonly ids: string[];
  readonly index = new Map<string, number>();
  /** x, y, z par nœud. */
  readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly anchor: Float32Array;
  private readonly edgeA: Int32Array;
  private readonly edgeB: Int32Array;
  private readonly edgeW: Float32Array;
  private readonly fixed: Uint8Array;
  /** Température : 1 au départ, la disposition est figée sous `MIN_ALPHA`. */
  alpha = 1;
  static readonly MIN_ALPHA = 0.02;

  constructor(
    nodes: readonly LayoutInputNode[],
    edges: readonly LayoutInputEdge[],
    opts: { seed: number; initial?: ReadonlyMap<string, readonly [number, number, number]> },
  ) {
    const n = nodes.length;
    this.ids = nodes.map((x) => x.id);
    this.ids.forEach((id, i) => this.index.set(id, i));
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.anchor = new Float32Array(n * 3);
    this.fixed = new Uint8Array(n);
    const anchors = categoryAnchors();
    const rng = makeRng(opts.seed);
    let reused = 0;
    nodes.forEach((node, i) => {
      const a = anchors[node.category];
      this.anchor.set(a, i * 3);
      const prev = opts.initial?.get(node.id);
      if (prev) {
        this.pos.set(prev, i * 3);
        reused++;
        return;
      }
      // Un nouveau nœud naît près d'un voisin déjà placé quand il en a un,
      // sinon près de l'ancre de sa famille.
      const spread = 60;
      this.pos[i * 3] = a[0] + (rng() - 0.5) * spread;
      this.pos[i * 3 + 1] = a[1] + (rng() - 0.5) * spread;
      this.pos[i * 3 + 2] = a[2] + (rng() - 0.5) * spread;
    });

    const valid = edges.filter((e) => this.index.has(e.source) && this.index.has(e.target));
    this.edgeA = new Int32Array(valid.length);
    this.edgeB = new Int32Array(valid.length);
    this.edgeW = new Float32Array(valid.length);
    valid.forEach((e, k) => {
      this.edgeA[k] = this.index.get(e.source)!;
      this.edgeB[k] = this.index.get(e.target)!;
      this.edgeW[k] = Math.max(0.1, Math.min(1, e.weight));
    });

    if (opts.initial && reused) {
      // Placer chaque nouveau nœud à côté d'un voisin déjà placé.
      for (let k = 0; k < valid.length; k++) {
        const a = this.edgeA[k];
        const b = this.edgeB[k];
        const aKnown = opts.initial.has(this.ids[a]);
        const bKnown = opts.initial.has(this.ids[b]);
        if (aKnown === bKnown) continue;
        const [from, to] = aKnown ? [a, b] : [b, a];
        for (let d = 0; d < 3; d++)
          this.pos[to * 3 + d] = this.pos[from * 3 + d] + (rng() - 0.5) * REST;
      }
      // La vue est déjà là : on ne relance qu'un refroidissement court.
      this.alpha = reused === n ? 0 : 0.4;
    }
  }

  get settled(): boolean {
    return this.alpha < ForceLayout3D.MIN_ALPHA;
  }

  /** Épingle un nœud (glissé par le trader) ou le libère. */
  pin(id: string, pinned: boolean): void {
    const i = this.index.get(id);
    if (i !== undefined) this.fixed[i] = pinned ? 1 : 0;
  }

  /** Un pas de simulation. Rend la température restante. */
  step(): number {
    const n = this.ids.length;
    if (!n || this.settled) return this.alpha;
    const p = this.pos;
    const v = this.vel;
    const alpha = this.alpha;

    // Répulsion à courte portée via une grille de hachage.
    const cells = new Map<string, number[]>();
    const cellOf = (x: number) => Math.floor(x / CUTOFF);
    for (let i = 0; i < n; i++) {
      const k = `${cellOf(p[i * 3])},${cellOf(p[i * 3 + 1])},${cellOf(p[i * 3 + 2])}`;
      let list = cells.get(k);
      if (!list) cells.set(k, (list = []));
      list.push(i);
    }
    for (let i = 0; i < n; i++) {
      const cx = cellOf(p[i * 3]);
      const cy = cellOf(p[i * 3 + 1]);
      const cz = cellOf(p[i * 3 + 2]);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const list = cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!list) continue;
            for (const j of list) {
              if (j <= i) continue;
              let ddx = p[i * 3] - p[j * 3];
              let ddy = p[i * 3 + 1] - p[j * 3 + 1];
              let ddz = p[i * 3 + 2] - p[j * 3 + 2];
              let d2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (d2 > CUTOFF * CUTOFF) continue;
              if (d2 < 0.01) {
                // Deux nœuds confondus : un écart déterministe les sépare.
                ddx = ((i * 7 + j) % 3) - 1 || 0.5;
                ddy = ((i + j * 5) % 3) - 1 || 0.5;
                ddz = 0.5;
                d2 = 1;
              }
              const f = (REPULSION * alpha) / d2;
              const d = Math.sqrt(d2);
              const fx = (ddx / d) * f;
              const fy = (ddy / d) * f;
              const fz = (ddz / d) * f;
              v[i * 3] += fx;
              v[i * 3 + 1] += fy;
              v[i * 3 + 2] += fz;
              v[j * 3] -= fx;
              v[j * 3 + 1] -= fy;
              v[j * 3 + 2] -= fz;
            }
          }
    }

    // Ressorts.
    for (let k = 0; k < this.edgeA.length; k++) {
      const a = this.edgeA[k];
      const b = this.edgeB[k];
      const dx = p[b * 3] - p[a * 3];
      const dy = p[b * 3 + 1] - p[a * 3 + 1];
      const dz = p[b * 3 + 2] - p[a * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const f = (SPRING * this.edgeW[k] * (d - REST) * alpha) / d;
      v[a * 3] += dx * f;
      v[a * 3 + 1] += dy * f;
      v[a * 3 + 2] += dz * f;
      v[b * 3] -= dx * f;
      v[b * 3 + 1] -= dy * f;
      v[b * 3 + 2] -= dz * f;
    }

    // Ancrage des familles, amortissement, intégration.
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < 3; d++) {
        const idx = i * 3 + d;
        v[idx] += (this.anchor[idx] - p[idx]) * ANCHOR_PULL * alpha;
        v[idx] *= DAMPING;
        if (v[idx] > MAX_SPEED) v[idx] = MAX_SPEED;
        else if (v[idx] < -MAX_SPEED) v[idx] = -MAX_SPEED;
        if (!this.fixed[i]) p[idx] += v[idx];
        else v[idx] = 0;
      }
    }
    this.alpha *= 0.975;
    return this.alpha;
  }

  /** Simule jusqu'au repos (tests, rendu sans animation). */
  run(maxSteps = 400): void {
    for (let s = 0; s < maxSteps && !this.settled; s++) this.step();
  }

  positionOf(id: string): [number, number, number] | null {
    const i = this.index.get(id);
    return i === undefined ? null : [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
  }

  /** Les positions par identifiant — à réinjecter dans la disposition suivante. */
  snapshot(): Map<string, [number, number, number]> {
    const out = new Map<string, [number, number, number]>();
    this.ids.forEach((id, i) =>
      out.set(id, [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]),
    );
    return out;
  }
}
