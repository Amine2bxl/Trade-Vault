import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import {
  ForceLayout3D,
  NODE_KINDS,
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

/**
 * LE CANEVAS 3D — rendu Canvas 2D en perspective, sans dépendance.
 *
 * Pourquoi pas WebGL / three.js : la vue montre au plus ~1 200 nœuds (niveau
 * de détail de `modules/knowledge/view`), que Canvas 2D dessine bien sous les
 * 16 ms ; une scène three.js ajouterait ~600 Ko au chunk pour un gain que ce
 * volume ne demande pas. Si la vue devait un jour dépasser quelques milliers
 * de nœuds visibles, c'est ici que se ferait le passage au GPU.
 *
 * Rien ne bouge en boucle : la disposition se pose (animation qui a une
 * fonction : on voit les familles se former), puis le canevas ne se redessine
 * qu'à une interaction. Sous `prefers-reduced-motion`, la disposition se
 * calcule hors écran et la vue apparaît posée ; le vol vers un nœud saute.
 */

export interface GraphHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  flyTo(id: string): void;
}

interface Props {
  nodes: readonly KnowledgeNode[];
  edges: readonly KnowledgeEdge[];
  /** Positions connues (partagées entre deux vues) — mises à jour au repos. */
  positions: Map<string, [number, number, number]>;
  seed: number;
  selected: ReadonlySet<string>;
  labelOf: (node: KnowledgeNode) => string;
  onSelect: (id: string | null, additive: boolean) => void;
  onActivate: (id: string) => void;
  onHover?: (id: string | null) => void;
  initialCamera?: Camera | null;
  onCameraIdle?: (camera: Camera) => void;
  onSettled?: (settled: boolean) => void;
  ariaLabel: string;
  ref?: Ref<GraphHandle>;
}

const FLY_MS = 300;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function baseRadius(n: KnowledgeNode, degree: number): number {
  if (n.kind === "account") return 9;
  if (NODE_KINDS[n.kind].leaf) return n.kind === "trade" ? 3 : 2.4;
  const weight = n.metrics?.n ?? degree;
  return Math.min(14, 3.6 + 1.5 * Math.sqrt(Math.max(1, weight)));
}

export function GraphCanvas({
  nodes,
  edges,
  positions,
  seed,
  selected,
  labelOf,
  onSelect,
  onActivate,
  onHover,
  initialCamera,
  onCameraIdle,
  onSettled,
  ariaLabel,
  ref,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Camera>(clampCamera(initialCamera ?? DEFAULT_CAMERA));
  const fitted = useRef(!!initialCamera);
  const flight = useRef<{ from: Camera; to: Camera; start: number } | null>(null);
  const layout = useRef<ForceLayout3D | null>(null);
  const hovered = useRef<string | null>(null);
  const size = useRef({ width: 0, height: 0, dpr: 1 });
  const colors = useRef<Record<ColorVar, string>>({} as Record<ColorVar, string>);
  const frame = useRef(0);
  const dirty = useRef(true);
  const proj = useRef({
    xs: new Float32Array(0),
    ys: new Float32Array(0),
    rs: new Float32Array(0),
  });
  // Les props lues par la boucle : un rendu React ne relance pas la boucle.
  const live = useRef({
    selected,
    labelOf,
    onSelect,
    onActivate,
    onHover,
    onCameraIdle,
    onSettled,
  });
  live.current = { selected, labelOf, onSelect, onActivate, onHover, onCameraIdle, onSettled };

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

  // ── Couleurs : lues dans le CSS (thème, familles), relues si le thème change.
  useEffect(() => {
    const read = () => {
      const el = wrapRef.current;
      if (!el) return;
      const style = getComputedStyle(el);
      const out = {} as Record<ColorVar, string>;
      for (const v of COLOR_VARS) out[v] = style.getPropertyValue(v).trim() || "#888";
      colors.current = out;
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

  // ── Taille du canevas (densité de pixels comprise).
  useEffect(() => {
    const el = wrapRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { width: r.width, height: r.height, dpr };
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      request();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Disposition : reconstruite quand la vue change, en gardant les positions.
  useEffect(() => {
    layout.current = new ForceLayout3D(
      nodes.map((n) => ({ id: n.id, category: n.category })),
      edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
      { seed, initial: positions },
    );
    live.current.onSettled?.(layout.current.settled);
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, seed]);

  // Le compteur revient à zéro : sinon, après un démontage (mode strict,
  // changement de page), `request` croirait une frame déjà planifiée.
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  function fitCamera(): Camera {
    const l = layout.current;
    if (!l || !l.ids.length) return DEFAULT_CAMERA;
    let cx = 0,
      cy = 0,
      cz = 0;
    const n = l.ids.length;
    for (let i = 0; i < n; i++) {
      cx += l.pos[i * 3];
      cy += l.pos[i * 3 + 1];
      cz += l.pos[i * 3 + 2];
    }
    cx /= n;
    cy /= n;
    cz /= n;
    // Le 90e centile du rayon, pas le maximum : un nœud isolé au loin ne doit
    // pas réduire tout le graphe à une pastille.
    const radii: number[] = [];
    for (let i = 0; i < n; i++)
      radii.push(Math.hypot(l.pos[i * 3] - cx, l.pos[i * 3 + 1] - cy, l.pos[i * 3 + 2] - cz));
    radii.sort((a, b) => a - b);
    const r = radii[Math.min(n - 1, Math.floor(n * 0.9))] ?? 0;
    return clampCamera({ ...cam.current, target: [cx, cy, cz], distance: Math.max(160, r * 2.1) });
  }

  function flyTo(to: Camera) {
    if (reducedMotion()) {
      cam.current = to;
      live.current.onCameraIdle?.(to);
    } else flight.current = { from: cam.current, to, start: performance.now() };
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
  }));

  function tick() {
    frame.current = 0;
    const l = layout.current;
    let again = false;
    if (l && !l.settled) {
      const budget = performance.now() + 8;
      do l.step();
      while (!l.settled && performance.now() < budget);
      dirty.current = true;
      if (l.settled) {
        for (const [id, p] of l.snapshot()) positions.set(id, p);
        live.current.onSettled?.(true);
        if (!fitted.current) {
          fitted.current = true;
          cam.current = fitCamera();
        }
      } else again = true;
    }
    if (flight.current) {
      const f = flight.current;
      const t = Math.min(1, (performance.now() - f.start) / FLY_MS);
      cam.current = lerpCamera(f.from, f.to, t);
      dirty.current = true;
      if (t >= 1) {
        flight.current = null;
        live.current.onCameraIdle?.(cam.current);
      } else again = true;
    }
    // Sous mouvement réduit, la disposition se pose hors écran.
    const hideWhileSettling = reducedMotion() && l && !l.settled;
    if (dirty.current && !hideWhileSettling) {
      dirty.current = false;
      draw();
    }
    if (again) frame.current = requestAnimationFrame(tick);
  }

  function draw() {
    const canvas = canvasRef.current;
    const l = layout.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !l) return;
    const { width, height, dpr } = size.current;
    if (!width || !height) return;
    const { nodes, edges, adjacency, index, radii } = data.current;
    const c = colors.current;
    const camera = cam.current;
    const view = { width, height };
    const sel = live.current.selected;
    const hover = hovered.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c["--tv-bg"] || "#000";
    ctx.fillRect(0, 0, width, height);

    const n = nodes.length;
    if (proj.current.xs.length !== n) {
      proj.current = { xs: new Float32Array(n), ys: new Float32Array(n), rs: new Float32Array(n) };
    }
    const { xs, ys, rs } = proj.current;
    const depth = new Float32Array(n);
    const fogOf = (d: number) => Math.max(0.16, Math.min(1, 1.3 - d / (camera.distance * 2.1)));
    for (let i = 0; i < n; i++) {
      const p = project([l.pos[i * 3], l.pos[i * 3 + 1], l.pos[i * 3 + 2]], camera, view);
      if (!p) {
        rs[i] = 0;
        depth[i] = Infinity;
        continue;
      }
      xs[i] = p.x;
      ys[i] = p.y;
      depth[i] = p.depth;
      rs[i] = radii[i] * Math.max(0.35, Math.min(2.4, p.scale));
    }

    // Ce qui est mis en avant : la sélection, le survol, et leurs voisins.
    const lit = new Set<string>();
    for (const id of sel) {
      lit.add(id);
      for (const o of adjacency.get(id) ?? []) lit.add(o);
    }
    if (hover) {
      lit.add(hover);
      for (const o of adjacency.get(hover) ?? []) lit.add(o);
    }
    const dimming = sel.size > 0;

    // Liens : regroupés par opacité et épaisseur (peu de tracés par image).
    const BUCKETS = 4;
    const paths: number[][] = Array.from({ length: BUCKETS * 2 }, () => []);
    const hot: number[] = [];
    for (const e of edges) {
      const a = index.get(e.source);
      const b = index.get(e.target);
      if (a === undefined || b === undefined || !rs[a] || !rs[b]) continue;
      const touches =
        sel.has(e.source) ||
        sel.has(e.target) ||
        (hover !== null && (e.source === hover || e.target === hover));
      if (touches) {
        hot.push(xs[a], ys[a], xs[b], ys[b]);
        continue;
      }
      let alpha = (0.1 + e.weight * 0.22) * fogOf((depth[a] + depth[b]) / 2);
      if (dimming) alpha *= 0.3;
      const bucket = Math.min(BUCKETS - 1, Math.floor(alpha * BUCKETS * 2.4));
      const thick = e.weight >= 0.75 ? 1 : 0;
      paths[bucket * 2 + thick].push(xs[a], ys[a], xs[b], ys[b]);
    }
    ctx.strokeStyle = c["--brain-edge"];
    for (let k = 0; k < paths.length; k++) {
      const seg = paths[k];
      if (!seg.length) continue;
      ctx.globalAlpha = (Math.floor(k / 2) + 0.6) / (BUCKETS * 2.4);
      ctx.lineWidth = k % 2 ? 1.2 : 0.7;
      ctx.beginPath();
      for (let s = 0; s < seg.length; s += 4) {
        ctx.moveTo(seg[s], seg[s + 1]);
        ctx.lineTo(seg[s + 2], seg[s + 3]);
      }
      ctx.stroke();
    }
    if (hot.length) {
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = c["--tv-accent"];
      ctx.beginPath();
      for (let s = 0; s < hot.length; s += 4) {
        ctx.moveTo(hot[s], hot[s + 1]);
        ctx.lineTo(hot[s + 2], hot[s + 3]);
      }
      ctx.stroke();
    }

    // Nœuds : du plus loin au plus proche.
    const order = Array.from({ length: n }, (_, i) => i).filter((i) => rs[i] > 0);
    order.sort((a, b) => depth[b] - depth[a]);
    for (const i of order) {
      const node = nodes[i];
      let alpha = fogOf(depth[i]);
      if (dimming && !lit.has(node.id)) alpha *= 0.22;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c[colorVarOf(node)];
      ctx.beginPath();
      traceShape(ctx, CATEGORY_SHAPE[node.category], xs[i], ys[i], rs[i]);
      ctx.fill();
      if (sel.has(node.id) || node.id === hover) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = sel.has(node.id) ? 2 : 1.25;
        ctx.strokeStyle = sel.has(node.id) ? c["--tv-accent"] : c["--tv-text-primary"];
        ctx.beginPath();
        traceShape(ctx, CATEGORY_SHAPE[node.category], xs[i], ys[i], rs[i] + 3.5);
        ctx.stroke();
      }
    }

    // Libellés : sélection et survol d'abord, puis les plus gros moyeux, sans
    // chevauchement (grille d'occupation grossière).
    ctx.globalAlpha = 1;
    ctx.font = `500 11px ${getComputedStyle(canvas).fontFamily || "system-ui"}`;
    ctx.textBaseline = "middle";
    const wanted: number[] = [];
    for (const id of sel) {
      const i = index.get(id);
      if (i !== undefined && rs[i]) wanted.push(i);
    }
    if (hover) {
      const i = index.get(hover);
      if (i !== undefined && rs[i]) wanted.push(i);
    }
    const hubs = order
      .filter(
        (i) =>
          !NODE_KINDS[nodes[i].kind].leaf && rs[i] >= 5.5 && (!dimming || lit.has(nodes[i].id)),
      )
      .sort((a, b) => rs[b] - rs[a])
      .slice(0, 30);
    const taken: [number, number, number, number][] = [];
    for (const i of [...new Set([...wanted, ...hubs])]) {
      const text = live.current.labelOf(nodes[i]);
      const w = Math.min(180, ctx.measureText(text).width);
      const x = xs[i] + rs[i] + 6;
      const y = ys[i];
      const box: [number, number, number, number] = [x - 2, y - 8, w + 4, 16];
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
      ctx.fillStyle = c["--tv-bg"];
      ctx.globalAlpha = 0.72;
      ctx.fillRect(box[0], box[1], box[2], box[3]);
      ctx.globalAlpha = important ? 1 : 0.85;
      ctx.fillStyle = important ? c["--tv-text-primary"] : c["--tv-text-secondary"];
      ctx.fillText(text, x, y, 180);
    }
    ctx.globalAlpha = 1;
  }

  // ── Interactions : orbite, panoramique, zoom, sélection, survol, clavier.
  useEffect(() => {
    const canvas = canvasRef.current;
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
    const local = (e: PointerEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hitAt = (x: number, y: number): string | null => {
      const { xs, ys, rs } = proj.current;
      const i = pick(x, y, xs, ys, rs, data.current.nodes.length);
      return i >= 0 ? data.current.nodes[i].id : null;
    };
    const view = () => ({ width: size.current.width, height: size.current.height });

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      flight.current = null;
      if (pointers.size === 1)
        down = { ...p, t: performance.now(), moved: 0, button: e.button, shift: e.shiftKey };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        // Survol (souris sans bouton) : un nœud sous le curseur.
        const id = hitAt(p.x, p.y);
        if (id !== hovered.current) {
          hovered.current = id;
          live.current.onHover?.(id);
          canvas.style.cursor = id ? "pointer" : "";
          request();
        }
        return;
      }
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      pointers.set(e.pointerId, p);
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
      const p = local(e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (down && pointers.size === 0) {
        const click = down.moved < 5 && performance.now() - down.t < 600 && down.button === 0;
        if (click) live.current.onSelect(hitAt(p.x, p.y), e.shiftKey || e.metaKey || e.ctrlKey);
        down = null;
      }
    };
    const onDbl = (e: MouseEvent) => {
      const p = local(e);
      const id = hitAt(p.x, p.y);
      if (id) live.current.onActivate(id);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      flight.current = null;
      cam.current = zoom(cam.current, Math.exp(e.deltaY * 0.0015));
      idle();
      request();
    };
    const onLeave = () => {
      if (hovered.current) {
        hovered.current = null;
        live.current.onHover?.(null);
        request();
      }
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
      else if (k === "Escape") return live.current.onSelect(null, false);
      else return;
      e.preventDefault();
      idle();
      request();
    };
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sélection ou libellés changés : un seul nouveau dessin.
  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, labelOf]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="brain-canvas"
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
      />
    </div>
  );
}
