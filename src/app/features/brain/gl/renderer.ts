import type { Camera } from "../camera";
import { focalOf } from "../camera";
import type { Shape } from "../presentation";
import { EDGE_FS, EDGE_VS, FLOW_FS, FLOW_VS, NODE_FS, NODE_VS, STAR_FS, STAR_VS } from "./shaders";

/**
 * Le moteur de rendu WebGL2 du Neural Brain — sans dépendance.
 *
 * Quatre passes, dans l'ordre : étoiles (profondeur), liens (faits pleins,
 * hypothèses en pointillés), nœuds (formes en SDF, lueur bornée), flux (des
 * particules qui parcourent les liens mis en avant : la relation a un SENS et
 * une force). Les données viennent de `BrainScene` ; ce module ne sait rien
 * du graphe, seulement des tableaux.
 *
 * `create` rend `null` sans WebGL2 : la scène retombe sur le Canvas 2D.
 */

export const SHAPE_INDEX: Record<Shape, number> = {
  circle: 0,
  square: 1,
  triangle: 2,
  diamond: 3,
  hexagon: 4,
  pentagon: 5,
  triangleDown: 6,
  star: 7,
};

export interface EdgeDraw {
  a: number;
  b: number;
  rgba: [number, number, number, number];
  dashed: boolean;
}

export interface FlowDraw {
  a: number;
  b: number;
  rgb: [number, number, number];
  /** Tours par seconde le long du lien. */
  speed: number;
  /** Particules sur ce lien. */
  count: number;
}

type Attr = { name: string; size: number };

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`brain shader (lost=${gl.isContextLost()}): ${log}`);
    }
    return sh;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("brain program link");
  return p;
}

class Layer {
  readonly vao: WebGLVertexArrayObject;
  readonly buffers = new Map<string, WebGLBuffer>();
  count = 0;
  constructor(
    private gl: WebGL2RenderingContext,
    readonly program: WebGLProgram,
    attrs: Attr[],
  ) {
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    for (const a of attrs) {
      const loc = gl.getAttribLocation(program, a.name);
      const buf = gl.createBuffer()!;
      this.buffers.set(a.name, buf);
      if (loc < 0) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
  }
  set(name: string, data: Float32Array, usage: number = this.gl.DYNAMIC_DRAW) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get(name)!);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  }
  dispose() {
    for (const b of this.buffers.values()) this.gl.deleteBuffer(b);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}

export class BrainRenderer {
  private nodes: Layer;
  private edges: Layer;
  private flows: Layer;
  private stars: Layer;
  private order: WebGLBuffer;
  private nodeCount = 0;
  private pos: Float32Array = new Float32Array(0);
  private edgeList: EdgeDraw[] = [];
  private flowList: FlowDraw[] = [];
  lost = false;

  static create(canvas: HTMLCanvasElement, seed: number): BrainRenderer | null {
    try {
      const gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      });
      if (!gl) return null;
      return new BrainRenderer(gl, canvas, seed);
    } catch (e) {
      // Repli Canvas 2D : la raison reste lisible pour le diagnostic.
      console.warn("[brain] WebGL2 indisponible, rendu 2D", e);
      return null;
    }
  }

  private constructor(
    private gl: WebGL2RenderingContext,
    canvas: HTMLCanvasElement,
    seed: number,
  ) {
    this.nodes = new Layer(gl, compile(gl, NODE_VS, NODE_FS), [
      { name: "a_pos", size: 3 },
      { name: "a_color", size: 3 },
      { name: "a_size", size: 1 },
      { name: "a_shape", size: 1 },
      { name: "a_state", size: 2 },
    ]);
    this.order = gl.createBuffer()!;
    gl.bindVertexArray(this.nodes.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.order);
    gl.bindVertexArray(null);
    this.edges = new Layer(gl, compile(gl, EDGE_VS, EDGE_FS), [
      { name: "a_pos", size: 3 },
      { name: "a_color", size: 4 },
      { name: "a_t", size: 1 },
      { name: "a_len", size: 1 },
      { name: "a_dash", size: 1 },
    ]);
    this.flows = new Layer(gl, compile(gl, FLOW_VS, FLOW_FS), [
      { name: "a_from", size: 3 },
      { name: "a_to", size: 3 },
      { name: "a_phase", size: 1 },
      { name: "a_speed", size: 1 },
      { name: "a_color", size: 3 },
    ]);
    this.stars = new Layer(gl, compile(gl, STAR_VS, STAR_FS), [
      { name: "a_pos", size: 3 },
      { name: "a_size", size: 1 },
      { name: "a_alpha", size: 1 },
    ]);
    this.buildStars(seed);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  /** Un ciel fixe, en trois couches de profondeur : il donne l'échelle du mouvement. */
  private buildStars(seed: number) {
    let a = seed >>> 0;
    const rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const N = 900;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const alpha = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const layer = i % 3;
      const r = [900, 1500, 2400][layer] * (0.85 + rnd() * 0.3);
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * r, u * r * 0.7, Math.sin(th) * s * r], i * 3);
      size[i] = [2.2, 1.6, 1.1][layer] * (0.7 + rnd() * 0.6);
      alpha[i] = [0.55, 0.38, 0.24][layer] * (0.5 + rnd() * 0.5);
    }
    this.stars.set("a_pos", pos, this.gl.STATIC_DRAW);
    this.stars.set("a_size", size, this.gl.STATIC_DRAW);
    this.stars.set("a_alpha", alpha, this.gl.STATIC_DRAW);
    this.stars.count = N;
  }

  setNodes(colors: Float32Array, sizes: Float32Array, shapes: Float32Array) {
    this.nodeCount = sizes.length;
    this.nodes.set("a_color", colors);
    this.nodes.set("a_size", sizes);
    this.nodes.set("a_shape", shapes);
    this.nodes.count = this.nodeCount;
  }

  /** Alpha et mise en avant (0 rien, 1 survol, 2 sélection) par nœud. */
  setNodeState(state: Float32Array) {
    this.nodes.set("a_state", state);
  }

  setPositions(pos: Float32Array) {
    this.pos = pos;
    this.nodes.set("a_pos", pos);
    this.rebuildEdges();
    this.rebuildFlows();
  }

  setEdges(list: EdgeDraw[]) {
    this.edgeList = list;
    this.rebuildEdges();
  }

  setFlows(list: FlowDraw[]) {
    this.flowList = list;
    this.rebuildFlows();
  }

  private rebuildEdges() {
    const list = this.edgeList;
    const p = this.pos;
    const n = list.length;
    const pos = new Float32Array(n * 6);
    const color = new Float32Array(n * 8);
    const t = new Float32Array(n * 2);
    const len = new Float32Array(n * 2);
    const dash = new Float32Array(n * 2);
    list.forEach((e, i) => {
      const ax = p[e.a * 3] ?? 0;
      const ay = p[e.a * 3 + 1] ?? 0;
      const az = p[e.a * 3 + 2] ?? 0;
      const bx = p[e.b * 3] ?? 0;
      const by = p[e.b * 3 + 1] ?? 0;
      const bz = p[e.b * 3 + 2] ?? 0;
      pos.set([ax, ay, az, bx, by, bz], i * 6);
      color.set([...e.rgba, ...e.rgba], i * 8);
      t[i * 2 + 1] = 1;
      const l = Math.hypot(bx - ax, by - ay, bz - az);
      len[i * 2] = len[i * 2 + 1] = l;
      dash[i * 2] = dash[i * 2 + 1] = e.dashed ? 1 : 0;
    });
    this.edges.set("a_pos", pos);
    this.edges.set("a_color", color);
    this.edges.set("a_t", t);
    this.edges.set("a_len", len);
    this.edges.set("a_dash", dash);
    this.edges.count = n * 2;
  }

  private rebuildFlows() {
    const p = this.pos;
    const total = this.flowList.reduce((s, f) => s + f.count, 0);
    const from = new Float32Array(total * 3);
    const to = new Float32Array(total * 3);
    const phase = new Float32Array(total);
    const speed = new Float32Array(total);
    const color = new Float32Array(total * 3);
    let k = 0;
    for (const f of this.flowList)
      for (let j = 0; j < f.count; j++, k++) {
        from.set([p[f.a * 3] ?? 0, p[f.a * 3 + 1] ?? 0, p[f.a * 3 + 2] ?? 0], k * 3);
        to.set([p[f.b * 3] ?? 0, p[f.b * 3 + 1] ?? 0, p[f.b * 3 + 2] ?? 0], k * 3);
        phase[k] = j / f.count;
        speed[k] = f.speed;
        color.set(f.rgb, k * 3);
      }
    this.flows.set("a_from", from);
    this.flows.set("a_to", to);
    this.flows.set("a_phase", phase);
    this.flows.set("a_speed", speed);
    this.flows.set("a_color", color);
    this.flows.count = total;
  }

  private uniforms(program: WebGLProgram, cam: Camera, w: number, h: number, dpr: number) {
    const gl = this.gl;
    const u = (n: string) => gl.getUniformLocation(program, n);
    gl.uniform3f(u("u_target"), cam.target[0], cam.target[1], cam.target[2]);
    gl.uniform1f(u("u_yaw"), cam.yaw);
    gl.uniform1f(u("u_pitch"), cam.pitch);
    gl.uniform1f(u("u_distance"), cam.distance);
    gl.uniform1f(u("u_focal"), focalOf({ width: w, height: h }));
    gl.uniform2f(u("u_view"), w, h);
    gl.uniform1f(u("u_dpr"), dpr);
    return u;
  }

  /**
   * Une image. `order` : indices des nœuds du plus loin au plus proche (le
   * fondu se compose dans le bon ordre sans tampon de profondeur).
   */
  render(opts: {
    camera: Camera;
    width: number;
    height: number;
    dpr: number;
    time: number;
    reveal: number;
    order: Uint32Array;
    bg: [number, number, number];
    accent: [number, number, number];
    glow: number;
  }) {
    if (this.lost) return;
    const gl = this.gl;
    const { camera, width: w, height: h, dpr } = opts;
    gl.viewport(0, 0, Math.round(w * dpr), Math.round(h * dpr));
    gl.clearColor(opts.bg[0], opts.bg[1], opts.bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // Étoiles et flux : lumière ajoutée. Liens et nœuds : fondu prémultiplié.
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.stars.program);
    let u = this.uniforms(this.stars.program, camera, w, h, dpr);
    gl.uniform1f(u("u_reveal"), Math.min(1, opts.reveal * 1.6));
    gl.bindVertexArray(this.stars.vao);
    gl.drawArrays(gl.POINTS, 0, this.stars.count);

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.edges.count) {
      gl.useProgram(this.edges.program);
      u = this.uniforms(this.edges.program, camera, w, h, dpr);
      gl.uniform1f(u("u_reveal"), Math.max(0, opts.reveal * 1.4 - 0.4));
      gl.bindVertexArray(this.edges.vao);
      gl.drawArrays(gl.LINES, 0, this.edges.count);
    }

    if (this.nodeCount) {
      gl.useProgram(this.nodes.program);
      u = this.uniforms(this.nodes.program, camera, w, h, dpr);
      gl.uniform1f(u("u_reveal"), Math.min(1, opts.reveal * 1.25));
      gl.uniform1f(u("u_glow"), opts.glow);
      gl.uniform3f(u("u_accent"), opts.accent[0], opts.accent[1], opts.accent[2]);
      gl.bindVertexArray(this.nodes.vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.order);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, opts.order, gl.DYNAMIC_DRAW);
      gl.drawElements(gl.POINTS, opts.order.length, gl.UNSIGNED_INT, 0);
    }

    if (this.flows.count) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.flows.program);
      u = this.uniforms(this.flows.program, camera, w, h, dpr);
      gl.uniform1f(u("u_time"), opts.time);
      gl.bindVertexArray(this.flows.vao);
      gl.drawArrays(gl.POINTS, 0, this.flows.count);
    }
    gl.bindVertexArray(null);
  }

  get hasFlows(): boolean {
    return this.flows.count > 0;
  }

  dispose() {
    for (const l of [this.nodes, this.edges, this.flows, this.stars]) l.dispose();
    this.gl.deleteBuffer(this.order);
    // Pas de `loseContext()` : un remontage (mode strict, retour sur la page)
    // récupère le MÊME contexte du canevas — perdu, il ne compilerait plus rien.
  }
}

/** `#rrggbb` ou `rgb(r g b)` → composantes 0–1 (couleurs lues dans le CSS). */
export function parseColor(css: string): [number, number, number] {
  const s = css.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const v = parseInt(hex[1], 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (short)
    return [1, 2, 3].map((i) => parseInt(short[i] + short[i], 16) / 255) as [
      number,
      number,
      number,
    ];
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  return [0.6, 0.6, 0.6];
}
