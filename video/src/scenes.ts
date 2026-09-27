/* ★ LE FICHIER DE MONTAGE ★
   Tout ce qui se change sans toucher à l'animation est ici : l'ordre des plans,
   leur temps de départ et leur durée (en TEMPS — 1 temps = 0,5 s à 120 BPM),
   la capture, le cadrage, le texte, les surlignages. La musique et les SFX
   (scripts/audio.ts) et TIMECODES.md se recalculent depuis ce fichier. */
import type { Flash, Scene } from "./types";

/** Bords de bandes réguliers : `rows(0.24, 0.058)` → 0.24, 0.298, … jusqu'à 1. */
const rows = (from: number, step: number) => {
  const out: number[] = [];
  for (let y = from; y < 0.999; y += step) out.push(+y.toFixed(3));
  return [...out, 1];
};

export const SCENES: Scene[] = [
  {
    // L'ACCROCHE — le produit est là dès la frame 1, mais éteint : c'est le problème.
    id: "hook",
    beat: 0,
    len: 4,
    shot: "dashboard",
    look: "dim",
    cam: [
      { fx: 0.5, fy: 0.46, z: 1.1 },
      { fx: 0.5, fy: 0.46, z: 1.2 },
    ],
    ease: "linear",
    pos: "center",
    size: 104,
    copy: [
      { at: 0, text: "You know how to *trade.*" },
      { at: 2, text: "Broken rules *cost you.*", fx: "glitch" },
    ],
  },
  {
    // LA RÉPONSE — l'écran s'allume sur le temps 4, puis recule en composition de héros LP.
    id: "dashboard",
    beat: 4,
    len: 4,
    shot: "dashboard",
    enter: "fade",
    impact: true,
    halo: true,
    cam: [
      { fx: 0.5, fy: 0.46, z: 1.2 },
      { fx: 0.5, fy: 0.5, z: 0.64, ax: 0.69, ay: 0.52, rx: 4, ry: -14 },
    ],
    ease: "expo",
    pos: "left",
    label: "Dashboard",
    copy: [{ at: 0.75, text: "Your *edge*, one screen." }],
  },
  {
    id: "journal",
    beat: 8,
    len: 4,
    shot: "journal",
    enter: "whip-left",
    cam: [
      { fx: 0.5, fy: 0.6, z: 1.16, ax: 0.56, ay: 0.42, rx: 14 },
      { fx: 0.5, fy: 0.5, z: 1.24, ax: 0.56, ay: 0.42, rx: 8 },
    ],
    bands: [0, 0.198, ...rows(0.241, 0.0577)],
    stagger: 2,
    label: "Journal",
    copy: [{ at: 0.25, text: "Log *every* trade." }],
  },
  {
    id: "checklist",
    beat: 12,
    len: 4,
    shot: "checklist",
    enter: "whip-left",
    cam: [
      { fx: 0.34, fy: 0.31, z: 1.58, ax: 0.5, ay: 0.4 },
      { fx: 0.38, fy: 0.31, z: 1.5, ax: 0.5, ay: 0.4 },
    ],
    label: "Pre-market checklist",
    copy: [{ at: 0.25, text: "Rules *before* entry." }],
    // Une coche par temps, puis en croches : l'accélération qui lance le plan suivant.
    marks: [
      { at: 1, box: [0.025, 0.2785, 0.154, 0.0413], pill: true, check: [0.04, 0.2988] },
      { at: 2, box: [0.186, 0.2785, 0.1795, 0.0413], pill: true, check: [0.201, 0.2988] },
      { at: 2.5, box: [0.3725, 0.2785, 0.158, 0.0413], pill: true, check: [0.3875, 0.2988] },
      { at: 3, box: [0.5375, 0.2785, 0.1565, 0.0413], pill: true, check: [0.5525, 0.2988] },
    ],
  },
  {
    id: "mistakes",
    beat: 16,
    len: 4,
    shot: "mistakes",
    enter: "zoom",
    cam: [
      { fx: 0.47, fy: 0.44, z: 1.22, ay: 0.42 },
      { fx: 0.47, fy: 0.42, z: 1.34, ay: 0.42 },
    ],
    label: "Mistakes",
    copy: [{ at: 0.25, text: "See the *pattern.*" }],
    marks: [
      { at: 1, box: [0.025, 0.2235, 0.3, 0.13], tone: "red" },
      { at: 2, box: [0.5025, 0.4045, 0.4125, 0.182] },
    ],
  },
  {
    id: "analytics",
    beat: 20,
    len: 4,
    shot: "analytics",
    enter: "whip-up",
    cam: [
      { fx: 0.5, fy: 0.14, z: 1.24, ax: 0.5, ay: 0.42 },
      { fx: 0.5, fy: 0.4, z: 1.24, ax: 0.5, ay: 0.42 },
    ],
    ease: "linear",
    label: "Analytics",
    copy: [{ at: 0.25, text: "Numbers, not *feelings.*" }],
  },
  {
    id: "montecarlo",
    beat: 24,
    len: 4,
    shot: "montecarlo",
    enter: "wipe",
    cam: [
      { fx: 0.37, fy: 0.56, z: 1.32, ax: 0.56, ay: 0.42 },
      { fx: 0.35, fy: 0.52, z: 1.24, ax: 0.56, ay: 0.42 },
    ],
    label: "Monte Carlo",
    copy: [{ at: 0.5, text: "Stress-test your *edge.*" }],
  },
  {
    id: "jarvis",
    beat: 28,
    len: 4,
    shot: "jarvis",
    enter: "whip-left",
    cam: [
      { fx: 0.72, fy: 0.16, z: 1.6, ax: 0.56, ay: 0.36 },
      { fx: 0.5, fy: 0.6, z: 1.12, ax: 0.5, ay: 0.42 },
    ],
    ease: "expo",
    // La réponse de Jarvis arrive bloc par bloc, comme un flux.
    bands: [0, 0.21, 0.39, 0.63, 0.78, 0.86, 1],
    stagger: 6,
    label: "Jarvis",
    copy: [{ at: 0.25, text: "One fix for *tomorrow.*", fx: "type" }],
  },
];

/** LE MONTAGE — un écran par double-croche, du temps 32 jusqu'au silence. */
export const MONTAGE = {
  beat: 32,
  step: 0.25,
  flashes: [
    { shot: "dashboard", cam: { fx: 0.24, fy: 0.13, z: 2 } },
    { shot: "journal", cam: { fx: 0.45, fy: 0.45, z: 1.8 } },
    { shot: "checklist", cam: { fx: 0.2, fy: 0.3, z: 1.9 } },
    { shot: "mistakes", cam: { fx: 0.16, fy: 0.2, z: 2 } },
    { shot: "analytics", cam: { fx: 0.45, fy: 0.22, z: 1.7 } },
    { shot: "montecarlo", cam: { fx: 0.1, fy: 0.14, z: 2 } },
    { shot: "jarvis", cam: { fx: 0.7, fy: 0.53, z: 1.9 } },
  ] satisfies Flash[],
};

/** 0,1 s de noir et de silence total juste avant la chute (0.2 temps = 6 frames). */
export const SILENCE = { beat: 33.8, len: 0.2 };

export const CTA = {
  beat: 34,
  eyebrow: "For prop-firm challenges and serious retail",
  button: "Get Started",
  url: "tradevault.be",
  /** Apparitions, en temps depuis la chute : logo, nom, sur-titre, bouton, adresse. */
  steps: [0, 0.5, 1.25, 2, 2.5],
};

/** Le HUD de régie dans les coins (timecode, compteur de plans). */
export const HUD = true;

/** Flou de bougé : 10 sous-images moyennées par frame, obturateur à 180°.
    Baisser `samples` à 1 pour une preview Studio fluide. */
export const MOTION_BLUR = { samples: 10, shutter: 0.5 };

/** La bande-son de l'étape 1 (calculée par `bun run audio`). */
export const AUDIO = "audio/synth.wav";
