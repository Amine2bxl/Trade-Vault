import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import {
  ForceLayout3D,
  NODE_KINDS,
  NODE_CATEGORIES,
  type KnowledgeEdge,
  type KnowledgeNode,
} from "@/modules/knowledge";
import {
  DEFAULT_CAMERA,
  clampCamera,
  lerpCamera,
  orbit,
  pan,
  pick,
  project,
  zoom,
  type Camera,
} from "./camera";
import { CATEGORY_SHAPE, COLOR_VARS, colorVarOf, traceShape, type ColorVar } from "./presentation";
import {
  BrainRenderer,
  SHAPE_INDEX,
  parseColor,
  type EdgeDraw,
  type FlowDraw,
} from "./gl/renderer";

/**
 * LA SCÈNE — le graphe en 3D, vivant mais jamais décoratif.
 *
 * Rendu WebGL2 (`gl/renderer`) ; sans WebGL2, la même scène en Canvas 2D.
 * Chaque mouvement porte une information :
 *   • l'ENTRÉE allume les familles une à une pendant que la caméra approche
 *     (≤ 1,6 s, interrompue au premier geste, absente sous mouvement réduit) ;
 *   • les FLUX parcourent les liens de ce qui est choisi : sens et force ;
 *   • le PARCOURS d'une découverte allume ses preuves dans l'ordre ;
 *   • en mode simulation, la scène RECULE et s'efface derrière les courbes.
 * Hors de ces moments, rien ne bouge : l'image n'est redessinée qu'au geste.
 */

export interface SceneHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  flyTo(id: string): void;
  flyToSet(ids: readonly string[]): void;
}

interface Props {
  nodes: readonly KnowledgeNode[];
  edges: readonly KnowledgeEdge[];
  positions: Map<string, [number, number, number]>;
  seed: number;
  selected: ReadonlySet<string>;
  /** Nœuds mis en avant (cluster isolé, preuves) ; les autres s'effacent. */
  emphasis: ReadonlySet<string> | null;
  /** Parcours ordonné d'une découverte : allumé pas à pas, flux le long. */
  path: readonly string[] | null;
  /** La scène recule (simulation, évolution). */
  recede: boolean;
  intro: boolean;
  onIntroDone?: () => void;
  labelOf: (node: KnowledgeNode) => string;
  onSelect: (id: string | null, additive: boolean) => void;
  onActivate: (id: string) => void;
  onHoverEdge?: (edge: KnowledgeEdge | null, x: number, y: number) => void;
  initialCamera?: Camera | null;
  onCameraIdle?: (camera: Camera) => void;
  onSettled?: (settled: boolean) => void;
  ariaLabel: string;
  ref?: Ref<SceneHandle>;
}

const FLY_MS = 300;
const INTRO_MS = 1500;
const PATH_STEP_MS = 140;
/** Plafond de la lueur des nœuds (décision du 2026-11-21, canevas seulement). */
const GLOW = 0.55;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function baseRadius(n: KnowledgeNode, degree: number): number {
  if (n.kind === "account") return 9;
  if (NODE_KINDS[n.kind].leaf) return n.kind === "trade" ? 3 : 2.4;
  const weight = n.metrics?.n ?? degree;
  return Math.min(14, 3.6 + 1.5 * Math.sqrt(Math.max(1, weight)));
}

export function BrainScene(props: Props) {
  const { nodes, edges, positions, seed, ref } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<BrainRenderer | null>(null);
  const cam = useRef<Camera>(clampCamera(props.initialCamera ?? DEFAULT_CAMERA));
  const fitted = useRef(!!props.initialCamera);
  const dollied = useRef(false);
  const flight = useRef<{ from: Camera; to: Camera; start: number; ms: number } | null>(null);
  const intro = useRef<{ start: number } | null>(null);
  const pathStart = useRef(0);
  const layout = useRef<ForceLayout3D | null>(null);
  const hovered = useRef<string | null>(null);
  const hoveredEdge = useRef<string | null>(null);
  const size = useRef({ width: 0, height: 0, dpr: 1 });
  const colors = useRef<Record<ColorVar, string>>({} as Record<ColorVar, string>);
  const frame = useRef(0);
  const dirty = useRef(true);
  const glDirty = useRef({ nodes: true, edges: true });
  const proj = useRef({
    xs: new Float32Array(0),
    ys: new Float32Array(0),
    rs: new Float32Array(0),
  });
  const live = useRef(props);
  live.current = props;

  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [edges]);
  const index = useMemo(() => new Map(nodes.map((n, i) => [n.id, i])), [nodes]);
  const radii = useMemo(
    () => nodes.map((n) => baseRadius(n, adjacency.get(n.id)?.size ?? 0)),
    [nodes, adjacency],
  );
  const data = useRef({ nodes, edges, adjacency, index, radii });
  data.current = { nodes, edges, adjacency, index, radii };

  const request = () => {
    dirty.current = true;
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  };

  // ── Moteur : WebGL2 si possible, sinon le Canvas 2D fait tout.
  useEffect(() => {
    const c = glRef.current;
    if (!c) return;
    renderer.current = BrainRenderer.create(c, seed);
    glDirty.current = { nodes: true, edges: true };
    request();
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Couleurs : lues dans le CSS, relues si le thème change.
  useEffect(() => {
    const read = () => {
      const el = wrapRef.current;
      if (!el) return;
      const style = getComputedStyle(el);
      const out = {} as Record<ColorVar, string>;
      for (const v of COLOR_VARS) out[v] = style.getPropertyValue(v).trim() || "#888";
      colors.current = out;
      glDirty.current = { nodes: true, edges: true };
      request();
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme"],
    });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Taille des deux canevas.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { width: r.width, height: r.height, dpr };
      for (const c of [glRef.current, overlayRef.current]) {
        if (!c) continue;
        c.width = Math.max(1, Math.round(r.width * dpr));
        c.height = Math.max(1, Math.round(r.height * dpr));
      }
      request();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Disposition : reconstruite quand la vue change, positions gardées.
  useEffect(() => {
    layout.current = new ForceLayout3D(
      nodes.map((n) => ({ id: n.id, category: n.category })),
      edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
      { seed, initial: positions },
    );
    glDirty.current = { nodes: true, edges: true };
    live.current.onSettled?.(layout.current.settled);
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, seed]);

  // ── Entrée cinématique.
  useEffect(() => {
    if (!props.intro) return;
    if (reducedMotion()) {
      props.onIntroDone?.();
      return;
    }
    intro.current = { start: performance.now() };
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.intro]);

  // ── Parcours d'une découverte : il repart de zéro à chaque nouveau chemin.
  useEffect(() => {
    pathStart.current = performance.now();
    glDirty.current.edges = true;
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.path]);

  // ── Recul (simulation) ou retour.
  useEffect(() => {
    flyTo(props.recede ? zoom(cam.current, 2.2) : fitted.current ? fitCamera() : cam.current, 420);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.recede]);

  useEffect(() => {
    glDirty.current.edges = true;
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected, props.emphasis, props.labelOf]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  function centroid(ids?: readonly string[]): { c: [number, number, number]; r: number } | null {
    const l = layout.current;
    if (!l || !l.ids.length) return null;
    const list = (ids ?? l.ids)
      .map((id) => l.index.get(id))
      .filter((i): i is number => i !== undefined);
    if (!list.length) return null;
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const i of list) {
      cx += l.pos[i * 3];
      cy += l.pos[i * 3 + 1];
      cz += l.pos[i * 3 + 2];
    }
    cx /= list.length;
    cy /= list.length;
    cz /= list.length;
    // Le 90e centile du rayon : un nœud isolé au loin ne réduit pas tout à une pastille.
    const r = list
      .map((i) => Math.hypot(l.pos[i * 3] - cx, l.pos[i * 3 + 1] - cy, l.pos[i * 3 + 2] - cz))
      .sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * 0.9))];
    return { c: [cx, cy, cz], r };
  }

  function fitCamera(ids?: readonly string[]): Camera {
    const k = centroid(ids);
    if (!k) return cam.current;
    return clampCamera({ ...cam.current, target: k.c, distance: Math.max(160, k.r * 2.1) });
  }

  function flyTo(to: Camera, ms = FLY_MS) {
    if (reducedMotion()) {
      cam.current = to;
      live.current.onCameraIdle?.(to);
    } else flight.current = { from: cam.current, to, start: performance.now(), ms };
    request();
  }

  useImperativeHandle(ref, () => ({
    zoomIn: () => flyTo(zoom(cam.current, 0.75)),
    zoomOut: () => flyTo(zoom(cam.current, 1.33)),
    fit: () => flyTo(fitCamera()),
    flyTo: (id: string) => {
      const p = layout.current?.positionOf(id);
      if (!p) return;
      flyTo(
        clampCamera({ ...cam.current, target: p, distance: Math.min(cam.current.distance, 280) }),
      );
    },
    flyToSet: (ids: readonly string[]) => flyTo(fitCamera(ids), 380),
  }));

  // ── La boucle.
  function tick() {
    frame.current = 0;
    const l = layout.current;
    const now = performance.now();
    let again = false;
    if (l && !l.settled) {
      const budget = now + 8;
      do l.step();
      while (!l.settled && performance.now() < budget);
      glDirty.current.nodes = true;
      dirty.current = true;
      if (l.settled) {
        for (const [id, p] of l.snapshot()) positions.set(id, p);
        live.current.onSettled?.(true);
        // Une seule fois : la première pose cadre la vue (ou part de la caméra
        // mémorisée) et lance le travelling d'entrée. Une pose suivante (les
        // découvertes arrivent, un moyeu se déplie) ne touche plus la caméra.
        if (!dollied.current) {
          dollied.current = true;
          const target = fitted.current ? cam.current : fitCamera();
          fitted.current = true;
          if (intro.current) {
            // Le travelling d'entrée part de loin, en léger contre-champ.
            cam.current = clampCamera({
              ...target,
              distance: target.distance * 2.6,
              yaw: target.yaw - 0.9,
            });
            intro.current.start = performance.now();
            flight.current = {
              from: cam.current,
              to: target,
              start: performance.now(),
              ms: INTRO_MS,
            };
          } else cam.current = target;
        }
      } else again = true;
    }
    if (flight.current) {
      const f = flight.current;
      const t = Math.min(1, (now - f.start) / f.ms);
      cam.current = lerpCamera(f.from, f.to, t);
      dirty.current = true;
      if (t >= 1) {
        flight.current = null;
        live.current.onCameraIdle?.(cam.current);
      } else again = true;
    }
    let reveal = 1;
    if (intro.current) {
      // Tant que la disposition se pose, rien ne s'allume : l'entrée commence posée.
      reveal = l?.settled ? Math.min(1, (now - intro.current.start) / INTRO_MS) : 0;
      dirty.current = true;
      if (reveal >= 1 && l?.settled) {
        intro.current = null;
        live.current.onIntroDone?.();
      } else again = true;
    }
    const path = live.current.path;
    if (path?.length && !reducedMotion()) {
      const steps = (now - pathStart.current) / PATH_STEP_MS;
      if (steps < path.length + 1) again = true;
      glDirty.current.edges = true;
      dirty.current = true;
    }
    const flowing = !!renderer.current?.hasFlows && !reducedMotion();
    if (flowing) {
      dirty.current = true;
      again = true;
    }
    if (dirty.current && !(reducedMotion() && l && !l.settled)) {
      dirty.current = false;
      draw(now, reveal);
    }
    if (again && !document.hidden) frame.current = requestAnimationFrame(tick);
  }

  function draw(now: number, reveal: number) {
    const l = layout.current;
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext("2d");
    if (!l || !overlay || !ctx) return;
    const { width, height, dpr } = size.current;
    if (!width || !height) return;
    const { nodes, edges, adjacency, index, radii } = data.current;
    const p = live.current;
    const c = colors.current;
    const camera = cam.current;
    const view = { width, height };
    const n = nodes.length;
    const rnd = renderer.current;

    // Projection CPU : sélection au pointeur, libellés, ordre de dessin.
    if (proj.current.xs.length !== n)
      proj.current = { xs: new Float32Array(n), ys: new Float32Array(n), rs: new Float32Array(n) };
    const { xs, ys, rs } = proj.current;
    const depth = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const q = project([l.pos[i * 3], l.pos[i * 3 + 1], l.pos[i * 3 + 2]], camera, view);
      if (!q) {
        rs[i] = 0;
        depth[i] = Infinity;
        continue;
      }
      xs[i] = q.x;
      ys[i] = q.y;
      depth[i] = q.depth;
      rs[i] = radii[i] * Math.max(0.35, Math.min(2.4, q.scale));
    }
    const order = Array.from({ length: n }, (_, i) => i)
      .filter((i) => rs[i] > 0)
      .sort((a, b) => depth[b] - depth[a]);

    // Ce qui est allumé : sélection, survol, voisins, parcours révélé.
    const lit = new Set<string>();
    for (const id of p.selected) {
      lit.add(id);
      for (const o of adjacency.get(id) ?? []) lit.add(o);
    }
    const hover = hovered.current;
    if (hover) {
      lit.add(hover);
      for (const o of adjacency.get(hover) ?? []) lit.add(o);
    }
    const pathSteps = p.path?.length
      ? reducedMotion()
        ? p.path.length
        : Math.floor((now - pathStart.current) / PATH_STEP_MS)
      : 0;
    const revealed = new Set(p.path?.slice(0, pathSteps) ?? []);
    const focus = p.emphasis ?? (revealed.size ? revealed : null);
    const dimming = p.selected.size > 0 || !!focus;
    const recedeK = p.recede ? 0.28 : 1;

    const catDelay = (cat: string) =>
      NODE_CATEGORIES.indexOf(cat as (typeof NODE_CATEGORIES)[number]) * 0.07;
    const alphaOf = (i: number) => {
      const node = nodes[i];
      let a = recedeK;
      if (reveal < 1) a *= Math.max(0, Math.min(1, (reveal - catDelay(node.category)) / 0.35));
      if (dimming && !lit.has(node.id) && !(focus?.has(node.id) ?? false)) a *= focus ? 0.12 : 0.22;
      return a;
    };

    // Liens : nature, force, mise en avant.
    const edgeColor = (e: KnowledgeEdge): [number, number, number] => {
      if (e.provenance.validation === "hypothesis") return parseColor(c["--brain-behavior"]);
      if (e.provenance.validation === "observed_association")
        return parseColor(c["--brain-performance"]);
      return parseColor(c["--brain-edge"]);
    };
    const accent = parseColor(c["--tv-accent"]);
    const edgeDraws: EdgeDraw[] = [];
    const flows: FlowDraw[] = [];
    const pathEdge = (e: KnowledgeEdge) => revealed.has(e.source) && revealed.has(e.target);
    for (const e of edges) {
      const a = index.get(e.source);
      const b = index.get(e.target);
      if (a === undefined || b === undefined) continue;
      const touches =
        p.selected.has(e.source) ||
        p.selected.has(e.target) ||
        (hover !== null && (e.source === hover || e.target === hover)) ||
        hoveredEdge.current === e.id ||
        pathEdge(e);
      const ea = Math.min(alphaOf(a), alphaOf(b));
      const baseA = (0.1 + e.weight * 0.26) * (e.type === "shares_trades" ? 0.7 : 1);
      edgeDraws.push({
        a,
        b,
        rgba: touches ? [...accent, 0.85 * recedeK] : [...edgeColor(e), baseA * ea],
        dashed: e.provenance.validation === "hypothesis",
      });
      if (touches && e.provenance.validation !== "hypothesis")
        flows.push({
          a,
          b,
          rgb: accent,
          speed: 0.18 + e.weight * 0.35,
          count: 1 + Math.round(e.weight * 2),
        });
    }

    if (rnd && !rnd.lost) {
      // Les nœuds : couleurs, tailles, formes, état.
      if (glDirty.current.nodes) {
        const colorsArr = new Float32Array(n * 3);
        const sizes = new Float32Array(n);
        const shapes = new Float32Array(n);
        nodes.forEach((node, i) => {
          colorsArr.set(parseColor(c[colorVarOf(node)]), i * 3);
          sizes[i] = radii[i];
          shapes[i] = SHAPE_INDEX[CATEGORY_SHAPE[node.category]];
        });
        rnd.setNodes(colorsArr, sizes, shapes);
        rnd.setPositions(l.pos);
        glDirty.current.nodes = false;
      }
      const state = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        state[i * 2] = alphaOf(i);
        const id = nodes[i].id;
        state[i * 2 + 1] = p.selected.has(id) ? 2 : id === hover || revealed.has(id) ? 1 : 0;
      }
      rnd.setNodeState(state);
      rnd.setEdges(edgeDraws);
      rnd.setFlows(reducedMotion() ? [] : flows);
      rnd.render({
        camera,
        width,
        height,
        dpr,
        time: now / 1000,
        reveal,
        order: Uint32Array.from(order),
        bg: parseColor(c["--tv-bg"]),
        accent,
        glow: GLOW,
      });
    }

    // Surcouche 2D : libellés (et tout le dessin sans WebGL).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!rnd || rnd.lost) {
      ctx.fillStyle = c["--tv-bg"] || "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 0.8;
      for (const d of edgeDraws) {
        if (!rs[d.a] || !rs[d.b]) continue;
        ctx.strokeStyle = `rgba(${d.rgba
          .slice(0, 3)
          .map((v) => Math.round(v * 255))
          .join(",")},${d.rgba[3]})`;
        ctx.setLineDash(d.dashed ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(xs[d.a], ys[d.a]);
        ctx.lineTo(xs[d.b], ys[d.b]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const i of order) {
        ctx.globalAlpha = alphaOf(i);
        ctx.fillStyle = c[colorVarOf(nodes[i])];
        ctx.beginPath();
        traceShape(ctx, CATEGORY_SHAPE[nodes[i].category], xs[i], ys[i], rs[i]);
        ctx.fill();
        if (p.selected.has(nodes[i].id)) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2;
          ctx.strokeStyle = c["--tv-accent"];
          ctx.beginPath();
          traceShape(ctx, CATEGORY_SHAPE[nodes[i].category], xs[i], ys[i], rs[i] + 3.5);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    if (reveal < 0.6 || p.recede) return;
    ctx.font = `500 11px ${getComputedStyle(overlay).fontFamily || "system-ui"}`;
    ctx.textBaseline = "middle";
    const wanted: number[] = [];
    for (const id of [...p.selected, ...(hover ? [hover] : []), ...revealed]) {
      const i = index.get(id);
      if (i !== undefined && rs[i]) wanted.push(i);
    }
    const hubs = order
      .filter((i) => !NODE_KINDS[nodes[i].kind].leaf && rs[i] >= 5.5 && alphaOf(i) > 0.5)
      .sort((a, b) => rs[b] - rs[a])
      .slice(0, 28);
    const taken: [number, number, number, number][] = [];
    for (const i of [...new Set([...wanted, ...hubs])]) {
      const text = p.labelOf(nodes[i]);
      const w = Math.min(190, ctx.measureText(text).width);
      const x = xs[i] + rs[i] + 7;
      const y = ys[i];
      const box: [number, number, number, number] = [x - 3, y - 9, w + 6, 18];
      const important = wanted.includes(i);
      if (
        !important &&
        taken.some(
          (b) =>
            box[0] < b[0] + b[2] &&
            box[0] + box[2] > b[0] &&
            box[1] < b[1] + b[3] &&
            box[1] + box[3] > b[1],
        )
      )
        continue;
      taken.push(box);
      ctx.globalAlpha = important ? 0.86 : 0.6;
      ctx.fillStyle = c["--tv-bg"];
      ctx.fillRect(box[0], box[1], box[2], box[3]);
      ctx.globalAlpha = important ? 1 : 0.82;
      ctx.fillStyle = important ? c["--tv-text-primary"] : c["--tv-text-secondary"];
      ctx.fillText(text, x, y, 190);
    }
    ctx.globalAlpha = 1;
  }

  // ── Interactions : orbite, panoramique, zoom, sélection, survol, clavier.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let down: {
      x: number;
      y: number;
      t: number;
      moved: number;
      button: number;
      shift: boolean;
    } | null = null;
    let pinch: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const idle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => live.current.onCameraIdle?.(cam.current), 400);
    };
    const interrupt = () => {
      // Le premier geste termine l'entrée : on ne fait jamais attendre.
      if (intro.current) {
        intro.current = null;
        flight.current = null;
        cam.current = fitCamera();
        live.current.onIntroDone?.();
      }
    };
    const local = (e: PointerEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hitAt = (x: number, y: number): string | null => {
      const { xs, ys, rs } = proj.current;
      const i = pick(x, y, xs, ys, rs, data.current.nodes.length);
      return i >= 0 ? data.current.nodes[i].id : null;
    };
    const edgeAt = (x: number, y: number): KnowledgeEdge | null => {
      const { xs, ys, rs } = proj.current;
      let best: KnowledgeEdge | null = null;
      let bestD = 5;
      for (const e of data.current.edges) {
        const a = data.current.index.get(e.source);
        const b = data.current.index.get(e.target);
        if (a === undefined || b === undefined || !rs[a] || !rs[b]) continue;
        const dx = xs[b] - xs[a];
        const dy = ys[b] - ys[a];
        const len2 = dx * dx + dy * dy;
        if (!len2) continue;
        const t = Math.max(0, Math.min(1, ((x - xs[a]) * dx + (y - ys[a]) * dy) / len2));
        const d = Math.hypot(x - (xs[a] + t * dx), y - (ys[a] + t * dy));
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    };
    const view = () => ({ width: size.current.width, height: size.current.height });

    const onDown = (e: PointerEvent) => {
      interrupt();
      canvas.setPointerCapture(e.pointerId);
      const pt = local(e);
      pointers.set(e.pointerId, pt);
      flight.current = null;
      if (pointers.size === 1)
        down = { ...pt, t: performance.now(), moved: 0, button: e.button, shift: e.shiftKey };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const pt = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        const id = hitAt(pt.x, pt.y);
        const edge = id ? null : edgeAt(pt.x, pt.y);
        if (id !== hovered.current || (edge?.id ?? null) !== hoveredEdge.current) {
          hovered.current = id;
          hoveredEdge.current = edge?.id ?? null;
          canvas.style.cursor = id ? "pointer" : edge ? "help" : "";
          glDirty.current.edges = true;
          request();
        }
        live.current.onHoverEdge?.(edge, pt.x, pt.y);
        return;
      }
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      pointers.set(e.pointerId, pt);
      if (pointers.size === 2 && pinch !== null) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        cam.current = pan(zoom(cam.current, pinch / Math.max(1, d)), dx / 2, dy / 2, view());
        pinch = d;
      } else if (down) {
        down.moved += Math.abs(dx) + Math.abs(dy);
        cam.current =
          down.button === 2 || down.shift || e.altKey
            ? pan(cam.current, dx, dy, view())
            : orbit(cam.current, dx, dy);
      }
      idle();
      request();
    };
    const onUp = (e: PointerEvent) => {
      const pt = local(e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (down && pointers.size === 0) {
        const click = down.moved < 5 && performance.now() - down.t < 600 && down.button === 0;
        if (click) live.current.onSelect(hitAt(pt.x, pt.y), e.shiftKey || e.metaKey || e.ctrlKey);
        down = null;
      }
    };
    const onDbl = (e: MouseEvent) => {
      const pt = local(e);
      const id = hitAt(pt.x, pt.y);
      if (id) live.current.onActivate(id);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      interrupt();
      flight.current = null;
      cam.current = zoom(cam.current, Math.exp(e.deltaY * 0.0015));
      idle();
      request();
    };
    const onLeave = () => {
      hovered.current = null;
      hoveredEdge.current = null;
      live.current.onHoverEdge?.(null, 0, 0);
      request();
    };
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 60 : 24;
      const k = e.key;
      if (k === "ArrowLeft") cam.current = orbit(cam.current, -step, 0);
      else if (k === "ArrowRight") cam.current = orbit(cam.current, step, 0);
      else if (k === "ArrowUp") cam.current = orbit(cam.current, 0, -step);
      else if (k === "ArrowDown") cam.current = orbit(cam.current, 0, step);
      else if (k === "+" || k === "=") cam.current = zoom(cam.current, 0.85);
      else if (k === "-" || k === "_") cam.current = zoom(cam.current, 1.18);
      else if (k === "0") cam.current = fitCamera();
      else return;
      e.preventDefault();
      interrupt();
      idle();
      request();
    };
    const onVisible = () => !document.hidden && request();
    const noMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKey);
    canvas.addEventListener("contextmenu", noMenu);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKey);
      canvas.removeEventListener("contextmenu", noMenu);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={glRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <canvas
        ref={overlayRef}
        className="brain-canvas absolute inset-0"
        tabIndex={0}
        role="img"
        aria-label={props.ariaLabel}
      />
    </div>
  );
}
