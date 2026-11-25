/* ★ LE MONTAGE VERTICAL (9:16) ★
   Même grille que la pub 16:9 (120 BPM, 60 fps, 40 temps = 20 s) et donc la
   MÊME bande-son, au temps près : chaque coupe tombe sur un whoosh, chaque
   coche sur un tic, le CTA sur l'impact du temps 34. Seul le cadre change :
   un téléphone, les captures `-m`, le texte en haut, dans la zone que
   TikTok/Reels ne recouvrent pas.

   Honnêteté : les captures viennent du banc `/dev/ui`, nourri de trades
   d'EXEMPLE. La vidéo le dit à l'écran (`demo`), comme la vitrine. */
import type { Mark } from "../types";
import type { ShotId } from "../assets";

export type Lang = "fr" | "en";
/** Deux accroches à tester l'une contre l'autre (A/B). */
export type Hook = "a" | "b";

/** Caméra sur le téléphone : le point (fx, fy) de la capture est posé au point
    (ax, ay) de l'écran, z = grossissement (1 → écran du téléphone de 640 px). */
export type VCam = {
  fx: number;
  fy: number;
  z: number;
  ax?: number;
  ay?: number;
  rx?: number;
  ry?: number;
};

export type VEnter = "cut" | "fade" | "whip-left" | "whip-up" | "zoom" | "wipe";

export type VLine = { at: number; text: string; fx?: "rise" | "type" | "glitch" | "punch" };

export type VScene = {
  id: string;
  beat: number;
  len: number;
  shot: ShotId;
  cam: [VCam, VCam];
  enter?: VEnter;
  ease?: "expo" | "linear" | "inOut";
  look?: "dim";
  /** Pastille au-dessus du titre. */
  label?: Record<Lang, string>;
  copy: Record<Lang, VLine[]>;
  marks?: Mark[];
};

const HOOKS: Record<Hook, Record<Lang, VLine[]>> = {
  a: {
    fr: [
      { at: 0, text: "Tu sais *trader.*", fx: "punch" },
      { at: 2, text: "Tu casses tes règles *quand ça compte.*", fx: "glitch" },
    ],
    en: [
      { at: 0, text: "You know how to *trade.*", fx: "punch" },
      { at: 2, text: "You break your rules *when it counts.*", fx: "glitch" },
    ],
  },
  b: {
    fr: [
      { at: 0, text: "Ce n'est pas ta stratégie", fx: "punch" },
      { at: 2, text: "*qui te fait perdre.*", fx: "glitch" },
    ],
    en: [
      { at: 0, text: "It's not your strategy", fx: "punch" },
      { at: 2, text: "*that's costing you.*", fx: "glitch" },
    ],
  },
};

export const vScenes = (hook: Hook): VScene[] => [
  {
    // L'ACCROCHE — le produit est là, mais éteint : c'est le problème.
    id: "hook",
    beat: 0,
    len: 4,
    shot: "dashboard",
    look: "dim",
    cam: [
      { fx: 0.5, fy: 0.36, z: 1.08, ay: 0.56 },
      { fx: 0.5, fy: 0.36, z: 1.16, ay: 0.56 },
    ],
    ease: "linear",
    copy: HOOKS[hook],
  },
  {
    id: "dashboard",
    beat: 4,
    len: 4,
    shot: "dashboard",
    enter: "fade",
    cam: [
      { fx: 0.5, fy: 0.2, z: 1.42, ay: 0.6 },
      { fx: 0.5, fy: 0.42, z: 0.94, ay: 0.66, rx: 10, ry: -12 },
    ],
    label: { fr: "TradeVault", en: "TradeVault" },
    copy: {
      fr: [{ at: 0.5, text: "Il te montre *pourquoi.*" }],
      en: [{ at: 0.5, text: "It shows you *why.*" }],
    },
  },
  {
    id: "journal",
    beat: 8,
    len: 4,
    shot: "journal",
    enter: "whip-left",
    cam: [
      { fx: 0.5, fy: 0.36, z: 1.3, ay: 0.6, ry: 8 },
      { fx: 0.5, fy: 0.4, z: 1.38, ay: 0.6, ry: 2 },
    ],
    label: { fr: "Journal", en: "Journal" },
    copy: {
      fr: [{ at: 0.25, text: "Chaque trade, *décortiqué.*" }],
      en: [{ at: 0.25, text: "Every trade, *dissected.*" }],
    },
    marks: [{ at: 1.5, box: [0.045, 0.313, 0.91, 0.198] }],
  },
  {
    id: "checklist",
    beat: 12,
    len: 4,
    shot: "checklist",
    enter: "whip-left",
    cam: [
      { fx: 0.42, fy: 0.565, z: 1.46, ay: 0.62 },
      { fx: 0.44, fy: 0.565, z: 1.4, ay: 0.62 },
    ],
    label: { fr: "Checklist pré-market", en: "Pre-market checklist" },
    copy: {
      fr: [{ at: 0.25, text: "Tes règles *avant* l'entrée." }],
      en: [{ at: 0.25, text: "Your rules *before* the entry." }],
    },
    // Une coche par tic de la bande-son (temps 13, 14, 14.5, 15).
    marks: [
      { at: 1, box: [0.05, 0.495, 0.8, 0.027], pill: true, check: [0.093, 0.5085] },
      { at: 2, box: [0.05, 0.525, 0.8, 0.027], pill: true, check: [0.093, 0.5385] },
      { at: 2.5, box: [0.05, 0.554, 0.8, 0.027], pill: true, check: [0.093, 0.5675] },
      { at: 3, box: [0.05, 0.583, 0.8, 0.027], pill: true, check: [0.093, 0.5965] },
    ],
  },
  {
    id: "mistakes",
    beat: 16,
    len: 4,
    shot: "mistakes",
    enter: "zoom",
    cam: [
      { fx: 0.5, fy: 0.5, z: 1.16, ay: 0.64 },
      { fx: 0.5, fy: 0.54, z: 1.24, ay: 0.64 },
    ],
    label: { fr: "Erreurs", en: "Mistakes" },
    copy: {
      fr: [{ at: 0.25, text: "Tes erreurs, *chiffrées.*" }],
      en: [{ at: 0.25, text: "Your mistakes, *priced.*" }],
    },
    marks: [
      { at: 1, box: [0.045, 0.398, 0.91, 0.1], tone: "red" },
      { at: 2, box: [0.045, 0.672, 0.91, 0.125] },
    ],
  },
  {
    id: "analytics",
    beat: 20,
    len: 4,
    shot: "analytics",
    enter: "whip-up",
    cam: [
      { fx: 0.5, fy: 0.32, z: 1.2, ay: 0.62 },
      { fx: 0.5, fy: 0.62, z: 1.2, ay: 0.62 },
    ],
    ease: "linear",
    label: { fr: "Analyses", en: "Analytics" },
    copy: {
      fr: [{ at: 0.25, text: "Des chiffres, *pas des émotions.*" }],
      en: [{ at: 0.25, text: "Numbers, *not feelings.*" }],
    },
  },
  {
    id: "calendar",
    beat: 24,
    len: 4,
    shot: "calendar",
    enter: "wipe",
    cam: [
      { fx: 0.5, fy: 0.42, z: 1.3, ay: 0.62, ry: -6 },
      { fx: 0.5, fy: 0.46, z: 1.38, ay: 0.62, ry: 0 },
    ],
    label: { fr: "Calendrier", en: "Calendar" },
    copy: {
      fr: [{ at: 0.5, text: "Tes jours rouges, *d'un coup d'œil.*" }],
      en: [{ at: 0.5, text: "Your red days, *at a glance.*" }],
    },
    marks: [{ at: 1.5, box: [0.035, 0.4, 0.93, 0.115] }],
  },
  {
    id: "jarvis",
    beat: 28,
    len: 4,
    shot: "jarvis",
    enter: "whip-left",
    cam: [
      { fx: 0.5, fy: 0.24, z: 1.42, ay: 0.58 },
      { fx: 0.5, fy: 0.44, z: 1.22, ay: 0.62 },
    ],
    ease: "expo",
    label: { fr: "Jarvis · coach IA", en: "Jarvis · AI coach" },
    copy: {
      fr: [{ at: 0.25, text: "Une priorité *pour demain.*", fx: "type" }],
      en: [{ at: 0.25, text: "One fix *for tomorrow.*", fx: "type" }],
    },
    marks: [
      { at: 1.5, box: [0.035, 0.31, 0.93, 0.2] },
      { at: 2.5, box: [0.035, 0.515, 0.93, 0.05], pill: true },
    ],
  },
];

/** Le montage éclair : un écran par double-croche, plein cadre ; (fx, fy) = le
    point de la capture `-m` posé au centre. */
export const V_MONTAGE = {
  beat: 32,
  step: 0.25,
  flashes: [
    { shot: "dashboard", fx: 0.5, fy: 0.16 },
    { shot: "journal", fx: 0.5, fy: 0.42 },
    { shot: "checklist", fx: 0.5, fy: 0.56 },
    { shot: "mistakes", fx: 0.5, fy: 0.45 },
    { shot: "analytics", fx: 0.5, fy: 0.68 },
    { shot: "calendar", fx: 0.5, fy: 0.45 },
    { shot: "jarvis", fx: 0.5, fy: 0.42 },
  ] satisfies { shot: ShotId; fx: number; fy: number }[],
};

export const V_SILENCE = { beat: 33.8, len: 0.2 };

/** L'écran de fin — la promesse, le CTA et son lever de risque. */
export const V_CTA = {
  beat: 34,
  steps: [0, 0.5, 1.25, 2, 2.5],
  text: {
    fr: {
      tagline: "Le coach IA qui te montre *pourquoi tu perds.*",
      button: "Commencer gratuitement",
      risk: "Gratuit pour toujours · sans carte bancaire",
    },
    en: {
      tagline: "The AI coach that shows you *why you lose.*",
      button: "Get started free",
      risk: "Free forever · No credit card",
    },
  } satisfies Record<Lang, { tagline: string; button: string; risk: string }>,
  url: "tradevault.be",
};

/** La mention qui accompagne chaque plan produit. */
export const DEMO: Record<Lang, string> = {
  fr: "Vraie app · données d'exemple",
  en: "Real app · example data",
};

/** Flou de bougé seulement autour des coupes : ailleurs, l'image est nette et le rendu rapide. */
export const V_BLUR = { samples: 8, shutter: 0.5, around: 12 };
