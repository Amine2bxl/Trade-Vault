/**
 * LES MODES DE FONCTIONNEMENT DE JARVIS — ce que les particules racontent.
 *
 * Chaque mode est une FORME (calculée sur la carte graphique, voir
 * `shaders.ts`) et une ÉNERGIE (vitesse, couleur, liaisons). Le passage d'un
 * mode à l'autre est un morphing : chaque particule quitte sa place dans
 * l'ancienne forme pour sa place dans la nouvelle, avec un léger décalage qui
 * rend le mouvement organique.
 *
 *   breathing     respire      — une sphère qui inspire et expire, au repos
 *   listening     écoute       — des ondes qui courent sur la sphère
 *   understanding comprend     — un vortex qui converge vers le noyau
 *   analyzing     analyse      — un réseau de neurones : grappes et synapses
 *   thinking      réfléchit    — une galaxie en spirale, rotation différentielle
 *   revising      révise       — une sphère en treillis balayée par un scan
 *   writing       rédige       — un anneau où l'information circule
 *   speaking      parle        — une sphère qui vibre, un noyau qui rayonne
 *
 * Module PUR : aucune dépendance au DOM, testable.
 */

export const JARVIS_MODES = [
  "breathing",
  "listening",
  "understanding",
  "analyzing",
  "thinking",
  "revising",
  "writing",
  "speaking",
] as const;

export type JarvisMode = (typeof JARVIS_MODES)[number];

export interface ModeLook {
  /** Index lu par le shader (ordre de `JARVIS_MODES`). */
  index: number;
  /** Deux teintes RGB 0..1 entre lesquelles chaque particule tire la sienne. */
  colorA: [number, number, number];
  colorB: [number, number, number];
  /** Vitesse de rotation de l'ensemble, en radians par seconde. */
  spin: number;
  /** Opacité des liaisons neuronales (0 = invisibles). */
  links: number;
  /** Éclat global des particules. */
  glow: number;
  /** Images par seconde visées : un repos lent n'a pas besoin de 120 Hz. */
  fps: number;
}

const rgb = (hex: number): [number, number, number] => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

/** L'émeraude de Jarvis (`.tv-orb`) et ses voisins froids : l'identité reste. */
const EMERALD = rgb(0x22e08a);
const MINT = rgb(0x6be3a8);
const CYAN = rgb(0x22d3ee);
const SKY = rgb(0x38bdf8);
const PALE = rgb(0xd4fdea);

export const MODE_LOOK: Record<JarvisMode, ModeLook> = {
  breathing: {
    index: 0,
    colorA: EMERALD,
    colorB: MINT,
    spin: 0.08,
    links: 0.35,
    glow: 0.8,
    fps: 30,
  },
  listening: { index: 1, colorA: MINT, colorB: CYAN, spin: 0.12, links: 0.25, glow: 0.95, fps: 60 },
  understanding: {
    index: 2,
    colorA: CYAN,
    colorB: EMERALD,
    spin: 0.25,
    links: 0.12,
    glow: 1,
    fps: 60,
  },
  analyzing: { index: 3, colorA: CYAN, colorB: SKY, spin: 0.14, links: 0.75, glow: 1, fps: 60 },
  thinking: { index: 4, colorA: SKY, colorB: CYAN, spin: 0.2, links: 0.2, glow: 1.05, fps: 60 },
  revising: { index: 5, colorA: CYAN, colorB: PALE, spin: 0.18, links: 0.3, glow: 0.95, fps: 60 },
  writing: { index: 6, colorA: EMERALD, colorB: PALE, spin: 0.1, links: 0.15, glow: 0.95, fps: 60 },
  speaking: { index: 7, colorA: MINT, colorB: CYAN, spin: 0.16, links: 0.45, glow: 1.1, fps: 60 },
};

/** Ce que l'appareil peut offrir, lu une fois (voir `deviceProfile`). */
export interface DeviceProfile {
  cores: number;
  /** Go de mémoire annoncés (`navigator.deviceMemory`), 4 si inconnu. */
  memoryGb: number;
  /** Écran tactile / pointeur grossier : téléphone ou tablette, le plus souvent. */
  coarse: boolean;
  /** Mode « économie de données » du navigateur. */
  saveData: boolean;
}

/**
 * LE BUDGET DE PARTICULES — assez pour être beau, jamais assez pour ramer.
 *
 * La densité se règle sur la SURFACE affichée (un orbe de 40 px n'a pas
 * besoin de dix mille points) puis se borne par la puissance de l'appareil.
 * Le moteur réduit encore ce budget en direct si les images arrivent en
 * retard (`engine.ts`).
 */
export function particleBudget(cssSize: number, device: DeviceProfile): number {
  const area = Math.max(0, cssSize) ** 2;
  // ~0,09 particule par pixel CSS² : 200 px → 3 600, 380 px → 13 000.
  const wanted = area * 0.09;
  const strong = device.cores >= 8 && device.memoryGb >= 8 && !device.coarse;
  const weak = device.saveData || device.cores <= 4 || device.memoryGb <= 2;
  const ceiling = weak ? 3_000 : strong ? 14_000 : device.coarse ? 6_000 : 9_000;
  return Math.round(Math.min(ceiling, Math.max(400, wanted)));
}

/** La densité de pixels du canevas : nette, mais jamais au-delà de 2. */
export function canvasDpr(devicePixelRatio: number, device: DeviceProfile): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, device.saveData || device.cores <= 4 ? 1.5 : 2);
}

/** Interpolation d'une couleur — pour les transitions de teinte entre modes. */
export function mixColor(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Courbe de transition entre deux modes (sortie douce, sans à-coup). */
export function easeInOut(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}
