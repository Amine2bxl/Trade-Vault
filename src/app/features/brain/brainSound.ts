/**
 * Les sons du Neural Brain — synthétisés (Web Audio), aucun fichier.
 *
 * Cinq sons, chacun lié à un geste qui a un sens : entrer, choisir un nœud,
 * révéler une découverte, changer de vue, quitter. Volume bas, durées courtes.
 * Coupables d'un clic (préférence par appareil) ; le contexte audio ne
 * s'ouvre qu'après un geste du trader, comme l'exigent les navigateurs.
 */

export type BrainSfx = "enter" | "select" | "discover" | "transition" | "exit";

const KEY = "tv.brain.sound";
let ctx: AudioContext | null = null;

export function brainSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setBrainSound(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* préférence non mémorisée : le réglage vaut pour la visite */
  }
  if (!on) void ctx?.suspend();
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // Sans geste préalable du trader, le navigateur refuse l'audio : on se tait.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gain: number,
  type: OscillatorType = "sine",
  glideTo?: number,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

function air(c: AudioContext, dur: number, gain: number, from: number, to: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(from, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export function playBrain(s: BrainSfx): void {
  if (!brainSoundEnabled()) return;
  const c = audio();
  if (!c) return;
  switch (s) {
    case "enter":
      air(c, 1.1, 0.035, 300, 1800);
      tone(c, 220, 0.25, 0.9, 0.03);
      tone(c, 330, 0.45, 0.9, 0.022);
      return;
    case "select":
      tone(c, 880, 0, 0.07, 0.018, "triangle");
      return;
    case "discover":
      tone(c, 660, 0, 0.35, 0.025);
      tone(c, 990, 0.09, 0.45, 0.018);
      return;
    case "transition":
      air(c, 0.32, 0.03, 1400, 500);
      return;
    case "exit":
      air(c, 0.45, 0.03, 1600, 300);
      tone(c, 330, 0, 0.4, 0.02, "sine", 220);
      return;
  }
}
