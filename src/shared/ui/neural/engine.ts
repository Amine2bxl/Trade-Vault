import { LINE_FRAGMENT, LINE_VERTEX, POINT_FRAGMENT, POINT_VERTEX } from "./shaders";
import { MODE_LOOK, easeInOut, mixColor, type JarvisMode } from "./modes";

/**
 * LE MOTEUR DU CŒUR NEURONAL — WebGL brut, sans dépendance.
 *
 * ══ POURQUOI PAS three.js ══
 * Une bibliothèque 3D complète pour dessiner des points : ~150 Ko compressés
 * à télécharger et analyser, pour un usage qui tient en deux programmes. Le
 * moteur fait ~300 lignes et n'ajoute rien au reste du site.
 *
 * ══ CE QUI LE REND LÉGER ══
 *   • Aucun calcul par particule sur le CPU : une dizaine d'uniformes par image.
 *   • Aucune allocation dans la boucle : pas de ramasse-miettes en cours de route.
 *   • Il ne dessine que s'il est VISIBLE (à l'écran, onglet actif).
 *   • Il vise la cadence utile du mode : 30 images/s pour respirer, la fréquence
 *     de l'écran (60, 120, 144 Hz…) pour le reste.
 *   • Au repos prolongé, il s'arrête : une image fixe ne coûte rien.
 *   • S'il voit ses images arriver en retard, il dessine moins de particules
 *     et baisse sa résolution — d'abord la fluidité, ensuite la densité.
 *   • GPU « basse consommation » demandé : sur un portable à deux cartes, la
 *     carte dédiée ne se réveille pas pour un orbe.
 */

export interface NeuralEngine {
  setMode(mode: JarvisMode): void;
  /** Taille CSS du canevas et densité de pixels. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  /** Inclinaison au pointeur, −1..1 sur chaque axe. */
  setTilt(x: number, y: number): void;
  /** Le canevas est visible (à l'écran, onglet actif) : la boucle peut tourner. */
  setVisible(visible: boolean): void;
  /** Réveille un moteur endormi par le repos prolongé. */
  wake(): void;
  destroy(): void;
}

export interface NeuralEngineOptions {
  count: number;
  mode: JarvisMode;
  /** `prefers-reduced-motion` : une image fixe par mode, aucune boucle. */
  reducedMotion: boolean;
  /** Appelé si le contexte WebGL est perdu (pilote, mémoire) : repli sur l'orbe CSS. */
  onLost?: () => void;
}

/** Durée d'un morphing entre deux modes. */
const TRANSITION_MS = 850;
/** Au repos (« respire ») depuis plus longtemps, la boucle s'arrête. */
const IDLE_FREEZE_MS = 45_000;
/** Nombre minimal de particules quand le moteur se dégrade. */
const MIN_DRAW = 300;

/** Générateur pseudo-aléatoire graine fixe : la même forme à chaque visite. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function compile(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("[neural] shader", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const v = make(gl.VERTEX_SHADER, vs);
  const f = make(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[neural] link", gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

/**
 * Les graines des particules. Une particule sur neuf appartient au NOYAU ; le
 * motif est entrelacé pour qu'un tirage réduit (moteur dégradé) garde la même
 * proportion de noyau et d'enveloppe.
 */
export function buildParticles(count: number, seed = 7) {
  const rand = mulberry32(seed);
  const seeds = new Float32Array(count * 4);
  const kinds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < 4; j++) seeds[i * 4 + j] = rand();
    kinds[i] = i % 9 === 0 ? 1 : 0;
  }
  return { seeds, kinds };
}

/**
 * Les liaisons neuronales : des paires de particules d'enveloppe. La moitié
 * relie des voisines sur la sphère (le maillage des modes « respire » et
 * « parle »), l'autre moitié des particules d'une même grappe (le réseau du
 * mode « analyse »). Calculé une fois, en O(n²) sur quelques centaines de nœuds.
 */
export function buildLinks(seeds: Float32Array, count: number, maxNodes = 260): Uint16Array {
  const nodes: number[] = [];
  for (let i = 0; i < count && nodes.length < maxNodes; i++) if (i % 9 !== 0) nodes.push(i);
  const dir = (i: number) => {
    const th = Math.PI * 2 * seeds[i * 4];
    const z = seeds[i * 4 + 1] * 2 - 1;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return [r * Math.cos(th), z, r * Math.sin(th)];
  };
  const dirs = nodes.map(dir);
  const pairs = new Set<string>();
  const out: number[] = [];
  const add = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || pairs.has(key)) return;
    pairs.add(key);
    out.push(a, b);
  };
  for (let n = 0; n < nodes.length; n++) {
    // Deux plus proches voisines sur la sphère.
    const best: [number, number][] = [];
    for (let m = 0; m < nodes.length; m++) {
      if (m === n) continue;
      const d =
        (dirs[n][0] - dirs[m][0]) ** 2 +
        (dirs[n][1] - dirs[m][1]) ** 2 +
        (dirs[n][2] - dirs[m][2]) ** 2;
      best.push([d, m]);
    }
    best.sort((x, y) => x[0] - y[0]);
    for (const [, m] of best.slice(0, 2)) add(nodes[n], nodes[m]);
    // Une voisine de grappe (même cluster dans le mode « analyse »).
    const cluster = Math.floor(seeds[nodes[n] * 4] * 9);
    for (let m = n + 1; m < nodes.length; m++) {
      const i = nodes[m];
      if (Math.floor(seeds[i * 4] * 9) === cluster && seeds[i * 4 + 3] < 0.62) {
        add(nodes[n], i);
        break;
      }
    }
  }
  return new Uint16Array(out);
}

export function createNeuralEngine(
  canvas: HTMLCanvasElement,
  opts: NeuralEngineOptions,
): NeuralEngine | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
    desynchronized: true,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const points = compile(gl, POINT_VERTEX, POINT_FRAGMENT);
  const lines = compile(gl, LINE_VERTEX, LINE_FRAGMENT);
  if (!points || !lines) return null;

  const count = Math.max(MIN_DRAW, Math.floor(opts.count));
  const { seeds, kinds } = buildParticles(count);
  const links = buildLinks(seeds, count);
  const lineCount = links.length / 2;

  // ── Tampons : écrits UNE fois, jamais réécrits ──────────────────────────
  const buffer = (data: Float32Array) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  };
  const seedBuf = buffer(seeds);
  const kindBuf = buffer(kinds);
  // Chaque liaison = deux sommets portant les graines des DEUX bouts.
  const lineA = new Float32Array(lineCount * 2 * 4);
  const lineB = new Float32Array(lineCount * 2 * 4);
  const lineEnd = new Float32Array(lineCount * 2);
  for (let l = 0; l < lineCount; l++) {
    const a = links[l * 2];
    const b = links[l * 2 + 1];
    for (let v = 0; v < 2; v++) {
      const o = (l * 2 + v) * 4;
      for (let j = 0; j < 4; j++) {
        lineA[o + j] = seeds[a * 4 + j];
        lineB[o + j] = seeds[b * 4 + j];
      }
      lineEnd[l * 2 + v] = v;
    }
  }
  const lineABuf = buffer(lineA);
  const lineBBuf = buffer(lineB);
  const lineEndBuf = buffer(lineEnd);

  const uniforms = (prog: WebGLProgram, names: string[]) =>
    Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<
      string,
      WebGLUniformLocation | null
    >;
  const common = ["uTime", "uFrom", "uTo", "uMix", "uLevel", "uRot", "uTilt", "uScale"];
  const pu = uniforms(points, [...common, "uColorA", "uColorB", "uPointSize", "uGlow"]);
  const lu = uniforms(lines, [...common, "uColorA", "uLinks"]);
  const pAttr = {
    seed: gl.getAttribLocation(points, "aSeed"),
    kind: gl.getAttribLocation(points, "aKind"),
  };
  const lAttr = {
    seed: gl.getAttribLocation(lines, "aSeed"),
    seedB: gl.getAttribLocation(lines, "aSeedB"),
    end: gl.getAttribLocation(lines, "aEnd"),
  };

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  // Mélange additif sur des couleurs prémultipliées : là où les points se
  // superposent, la lumière s'additionne. C'est le « glow », sans post-traitement.
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  // ── État ────────────────────────────────────────────────────────────────
  let from: JarvisMode = opts.mode;
  let to: JarvisMode = opts.mode;
  let mixStart = -Infinity;
  let rot = 0;
  let tiltX = 0;
  let tiltY = 0;
  let tiltTX = 0;
  let tiltTY = 0;
  let cssSize = 1;
  let scaleX = 1;
  let scaleY = 1;
  let drawCount = count;
  let visible = false;
  let raf = 0;
  let last = 0;
  let lastRender = 0;
  let idleSince = performance.now();
  let destroyed = false;
  // Mesure de la cadence : la plus courte image observée ≈ l'écran ; une
  // moyenne qui s'en éloigne durablement = le moteur coûte trop.
  let bestFrame = Infinity;
  let avgFrame = 0;
  let slowFrames = 0;
  const start = performance.now();

  /** Lie un attribut (ignoré si le compilateur l'a retiré : location −1). */
  const attach = (loc: number, buf: WebGLBuffer | null, size: number) => {
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  /** Désactive après le tracé : un attribut resté actif d'un programme à
   *  l'autre ferait valider un tampon trop court au tracé suivant. */
  const detach = (...locs: number[]) => {
    for (const loc of locs) if (loc >= 0) gl.disableVertexAttribArray(loc);
  };
  const bindPoints = () => {
    gl.useProgram(points);
    attach(pAttr.seed, seedBuf, 4);
    attach(pAttr.kind, kindBuf, 1);
  };
  const bindLines = () => {
    gl.useProgram(lines);
    attach(lAttr.seed, lineABuf, 4);
    attach(lAttr.seedB, lineBBuf, 4);
    attach(lAttr.end, lineEndBuf, 1);
  };

  const setCommon = (
    u: Record<string, WebGLUniformLocation | null>,
    t: number,
    mix: number,
    level: number,
  ) => {
    gl.uniform1f(u.uTime, t);
    gl.uniform1f(u.uFrom, MODE_LOOK[from].index);
    gl.uniform1f(u.uTo, MODE_LOOK[to].index);
    gl.uniform1f(u.uMix, mix);
    gl.uniform1f(u.uLevel, level);
    gl.uniform1f(u.uRot, rot);
    gl.uniform2f(u.uTilt, tiltX, tiltY);
    gl.uniform2f(u.uScale, scaleX, scaleY);
  };

  const render = (now: number) => {
    const t = (now - start) / 1000;
    const raw = (now - mixStart) / TRANSITION_MS;
    const mix = opts.reducedMotion ? 1 : easeInOut(raw);
    if (raw >= 1 && from !== to) from = to;
    const a = MODE_LOOK[from];
    const b = MODE_LOOK[to];
    const k = from === to ? 1 : mix;
    const colorA = mixColor(a.colorA, b.colorA, k);
    const colorB = mixColor(a.colorB, b.colorB, k);
    const glow = a.glow + (b.glow - a.glow) * k;
    const linksAlpha = a.links + (b.links - a.links) * k;
    // Une voix n'a pas d'amplitude lisible ici : une modulation qui imite le
    // débit d'une phrase (syllabes rapides, souffle lent).
    const level = 0.75 + 0.25 * Math.sin(t * 9.3) * Math.sin(t * 2.1);

    gl.clear(gl.COLOR_BUFFER_BIT);
    if (lineCount > 0 && linksAlpha > 0.01) {
      bindLines();
      setCommon(lu, t, from === to ? 1 : mix, level);
      gl.uniform3f(lu.uColorA, colorA[0], colorA[1], colorA[2]);
      gl.uniform1f(lu.uLinks, linksAlpha);
      gl.drawArrays(gl.LINES, 0, lineCount * 2);
      detach(lAttr.seed, lAttr.seedB, lAttr.end);
    }
    bindPoints();
    setCommon(pu, t, from === to ? 1 : mix, level);
    gl.uniform3f(pu.uColorA, colorA[0], colorA[1], colorA[2]);
    gl.uniform3f(pu.uColorB, colorB[0], colorB[1], colorB[2]);
    gl.uniform1f(pu.uGlow, glow);
    // Taille des points en pixels du canevas : proportionnelle à l'orbe,
    // bornée pour rester un point et jamais une tache.
    gl.uniform1f(
      pu.uPointSize,
      Math.min(3.2, Math.max(1.6, cssSize / 110)) * (canvas.width / Math.max(1, cssSize)),
    );
    gl.drawArrays(gl.POINTS, 0, drawCount);
    detach(pAttr.seed, pAttr.kind);
  };

  const loop = (now: number) => {
    raf = 0;
    if (destroyed || !visible) return;
    const dt = last ? Math.min(now - last, 100) : 16;
    last = now;
    const look = MODE_LOOK[to];
    rot += (look.spin * dt) / 1000;
    tiltX += (tiltTX - tiltX) * 0.06;
    tiltY += (tiltTY - tiltY) * 0.06;

    // Repos prolongé : une dernière image, puis plus rien jusqu'au réveil.
    if (to === "breathing" && from === to && now - idleSince > IDLE_FREEZE_MS) {
      render(now);
      return;
    }

    // Cadence du mode : on saute les images inutiles (30 i/s pour respirer).
    const minGap = 1000 / look.fps - 2;
    if (now - lastRender >= minGap) {
      const frame = lastRender ? now - lastRender : minGap;
      lastRender = now;
      render(now);
      // Adaptation : on ne compare que des images rendues à pleine cadence.
      if (look.fps >= 60) {
        bestFrame = Math.min(bestFrame, frame);
        avgFrame = avgFrame ? avgFrame * 0.9 + frame * 0.1 : frame;
        slowFrames = avgFrame > Math.max(bestFrame * 1.6, 20) ? slowFrames + 1 : 0;
        if (slowFrames > 45 && drawCount > MIN_DRAW) {
          drawCount = Math.max(MIN_DRAW, Math.floor(drawCount * 0.7));
          slowFrames = 0;
          avgFrame = 0;
        }
      }
    }
    raf = requestAnimationFrame(loop);
  };

  const kick = () => {
    if (destroyed || !visible || raf) return;
    if (opts.reducedMotion) {
      // Moins de mouvement : une image juste, sans boucle.
      render(performance.now());
      return;
    }
    last = 0;
    raf = requestAnimationFrame(loop);
  };

  const onLost = (e: Event) => {
    e.preventDefault();
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    opts.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    setMode(mode) {
      if (mode === to) return;
      // Changement en pleine transition : on repart de la forme la plus proche.
      const progress = (performance.now() - mixStart) / TRANSITION_MS;
      if (progress >= 0.5) from = to;
      to = mode;
      mixStart = performance.now();
      idleSince = performance.now();
      kick();
    },
    resize(cssWidth, cssHeight, dpr) {
      const w = Math.max(1, Math.round(cssWidth * dpr));
      const h = Math.max(1, Math.round(cssHeight * dpr));
      cssSize = Math.max(1, Math.min(cssWidth, cssHeight));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      // Garder l'orbe rond quel que soit le format du canevas.
      const side = Math.min(w, h);
      scaleX = (0.72 * side) / w;
      scaleY = (0.72 * side) / h;
      if (opts.reducedMotion || !raf) render(performance.now());
    },
    setTilt(x, y) {
      tiltTX = x;
      tiltTY = y;
      idleSince = performance.now();
      kick();
    },
    setVisible(next) {
      visible = next;
      if (next) kick();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    wake() {
      idleSince = performance.now();
      kick();
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("webglcontextlost", onLost);
      for (const b of [seedBuf, kindBuf, lineABuf, lineBBuf, lineEndBuf]) gl.deleteBuffer(b);
      gl.deleteProgram(points);
      gl.deleteProgram(lines);
      // Les tampons et programmes sont libérés ci-dessus. Ne pas forcer la
      // perte du contexte : StrictMode réutilise le même canevas au second
      // montage d'effet, qui compilerait alors dans un contexte déjà perdu.
    },
  };
}
