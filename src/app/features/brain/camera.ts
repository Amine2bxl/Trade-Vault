/**
 * La caméra orbitale du Neural Brain — module PUR (testé sans navigateur).
 *
 * Une caméra qui tourne AUTOUR d'une cible : lacet (gauche/droite), tangage
 * (haut/bas, borné pour ne jamais passer « par-dessus » et retourner la vue),
 * distance (zoom). La projection est une perspective simple : ce qui est loin
 * rétrécit et s'efface, ce qui est derrière la caméra n'est pas dessiné.
 */

export interface Camera {
  yaw: number;
  pitch: number;
  distance: number;
  target: [number, number, number];
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Facteur d'échelle à cette profondeur (1 à la distance de la cible). */
  scale: number;
  /** Profondeur depuis la caméra — plus grand = plus loin. */
  depth: number;
}

export const DEFAULT_CAMERA: Camera = { yaw: 0.6, pitch: 0.28, distance: 640, target: [0, 0, 0] };
export const MIN_DISTANCE = 60;
export const MAX_DISTANCE = 2400;
const PITCH_LIMIT = 1.45;
const NEAR = 12;

export function clampCamera(c: Camera): Camera {
  return {
    yaw: c.yaw,
    pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, c.pitch)),
    distance: Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, c.distance)),
    target: c.target,
  };
}

/** Focale : la cible tient à l'écran quelle que soit la taille du canevas. */
export function focalOf(v: Viewport): number {
  return Math.min(v.width, v.height) * 0.9;
}

/** Coordonnées dans le repère de la caméra (x droite, y haut, z profondeur). */
function toView(p: readonly [number, number, number], c: Camera): [number, number, number] {
  const x = p[0] - c.target[0];
  const y = p[1] - c.target[1];
  const z = p[2] - c.target[2];
  const cy = Math.cos(c.yaw);
  const sy = Math.sin(c.yaw);
  const x1 = cy * x + sy * z;
  const z1 = -sy * x + cy * z;
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  const y2 = cp * y - sp * z1;
  const z2 = sp * y + cp * z1;
  return [x1, y2, z2 + c.distance];
}

export function project(
  p: readonly [number, number, number],
  c: Camera,
  v: Viewport,
): Projected | null {
  const [x, y, depth] = toView(p, c);
  if (depth < NEAR) return null;
  const f = focalOf(v);
  const scale = f / depth;
  return {
    x: v.width / 2 + x * scale,
    y: v.height / 2 - y * scale,
    scale: c.distance / depth,
    depth,
  };
}

/** Glisser en orbite : `dx`, `dy` en pixels. */
export function orbit(c: Camera, dx: number, dy: number): Camera {
  return clampCamera({ ...c, yaw: c.yaw + dx * 0.006, pitch: c.pitch + dy * 0.006 });
}

/** Zoom multiplicatif (molette, pincement, touches). */
export function zoom(c: Camera, factor: number): Camera {
  return clampCamera({ ...c, distance: c.distance * factor });
}

/**
 * Déplacer la cible dans le plan de l'écran : le point sous le doigt suit le
 * doigt, à la profondeur de la cible.
 */
export function pan(c: Camera, dx: number, dy: number, v: Viewport): Camera {
  const k = c.distance / focalOf(v);
  const cy = Math.cos(c.yaw);
  const sy = Math.sin(c.yaw);
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  // Axes « droite » et « haut » de l'écran, exprimés dans le repère du monde.
  const right: [number, number, number] = [cy, 0, sy];
  const up: [number, number, number] = [-sy * sp, cp, cy * sp];
  const mx = -dx * k;
  const my = dy * k;
  return {
    ...c,
    target: [
      c.target[0] + right[0] * mx + up[0] * my,
      c.target[1] + right[1] * mx + up[1] * my,
      c.target[2] + right[2] * mx + up[2] * my,
    ],
  };
}

/** Interpolation de deux caméras (vol vers un nœud), `t` ∈ [0, 1]. */
export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  const k = 1 - Math.pow(1 - t, 3); // sortie douce, sans accélération au départ
  const m = (x: number, y: number) => x + (y - x) * k;
  return {
    yaw: m(a.yaw, b.yaw),
    pitch: m(a.pitch, b.pitch),
    distance: m(a.distance, b.distance),
    target: [m(a.target[0], b.target[0]), m(a.target[1], b.target[1]), m(a.target[2], b.target[2])],
  };
}

/** L'indice du point projeté le plus proche de (x, y) dans son rayon, ou -1. */
export function pick(
  x: number,
  y: number,
  xs: Float32Array,
  ys: Float32Array,
  rs: Float32Array,
  count: number,
  slop = 6,
): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < count; i++) {
    const r = rs[i];
    if (r <= 0) continue;
    const d = Math.hypot(xs[i] - x, ys[i] - y);
    if (d <= r + slop && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}
