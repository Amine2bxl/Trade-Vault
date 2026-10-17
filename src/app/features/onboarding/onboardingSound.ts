/**
 * LE SON DE L'ONBOARDING — synthétisé, pas téléchargé.
 *
 * Chaque effet est fabriqué à la volée par Web Audio (oscillateurs, bruit
 * filtré, enveloppes) : aucun fichier à charger, aucun poids ajouté au
 * premier écran, et une palette cohérente — des blips secs, un souffle
 * filtré, une impulsion grave. L'esthétique d'un terminal, pas d'un jeu.
 *
 * Contrat, non négociable :
 *   • JAMAIS de son avant un geste du trader. Les navigateurs l'interdisent,
 *     et c'est juste : le contexte audio naît au clic sur « Lancer ».
 *   • JAMAIS bloquant. Pas de Web Audio, contexte suspendu, onglet caché :
 *     chaque appel devient silencieux, aucune exception ne remonte.
 *   • COUPABLE à tout instant, et le choix est retenu (`tv.onboarding.sound`).
 *   • Discret : un bus maître bas, des sons de 20 à 600 ms. Le seul plus long
 *     est l'allumage, joué une fois.
 */

export type Sfx =
  | "tick"
  | "select"
  | "advance"
  | "back"
  | "boot"
  | "lock"
  | "unlock"
  | "type"
  | "data"
  | "launch"
  | "error";

const SOUND_KEY = "tv.onboarding.sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* best-effort */
  }
  if (master && ctx) master.gain.setTargetAtTime(on ? MASTER_GAIN : 0, ctx.currentTime, 0.02);
}

const MASTER_GAIN = 0.22;

/** À appeler DANS un gestionnaire de clic : crée ou réveille le contexte. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = soundEnabled() ? MASTER_GAIN : 0;
      // Un compresseur doux : plusieurs sons simultanés ne saturent jamais.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
    master = null;
  }
}

/** Ferme le contexte quand l'onboarding se termine : rien ne reste ouvert. */
export function releaseAudio(): void {
  const c = ctx;
  ctx = null;
  master = null;
  noiseBuffer = null;
  if (c) window.setTimeout(() => void c.close().catch(() => {}), 1500);
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(c.sampleRate * 1.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** Une note : oscillateur → enveloppe rapide → bus maître. */
function tone(
  c: AudioContext,
  out: AudioNode,
  {
    freq,
    to,
    type = "sine",
    start = 0,
    attack = 0.004,
    decay = 0.12,
    gain = 0.2,
  }: {
    freq: number;
    to?: number;
    type?: OscillatorType;
    start?: number;
    attack?: number;
    decay?: number;
    gain?: number;
  },
) {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(env);
  env.connect(out);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

/** Un souffle : bruit blanc → passe-bande qui balaie → enveloppe. */
function whoosh(
  c: AudioContext,
  out: AudioNode,
  {
    from,
    to,
    dur,
    gain,
    start = 0,
  }: { from: number; to: number; dur: number; gain: number; start?: number },
) {
  const t = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp);
  bp.connect(env);
  env.connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Un clic sec : bruit très court, filtré dans l'aigu. */
function click(c: AudioContext, out: AudioNode, gain: number, start = 0) {
  const t = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3200;
  const env = c.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
  src.connect(hp);
  hp.connect(env);
  env.connect(out);
  src.start(t);
  src.stop(t + 0.03);
}

export function play(s: Sfx): void {
  const c = ctx;
  const out = master;
  if (!c || !out || c.state !== "running" || !soundEnabled()) return;
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    switch (s) {
      case "tick":
        tone(c, out, { freq: 2100, decay: 0.035, gain: 0.07 });
        break;
      case "type":
        click(c, out, 0.035);
        break;
      case "select":
        tone(c, out, { freq: 880, decay: 0.09, gain: 0.16 });
        tone(c, out, { freq: 1320, start: 0.045, decay: 0.14, gain: 0.13 });
        break;
      case "advance":
        whoosh(c, out, { from: 280, to: 2600, dur: 0.38, gain: 0.18 });
        tone(c, out, { freq: 140, to: 90, decay: 0.22, gain: 0.18 });
        break;
      case "back":
        whoosh(c, out, { from: 2200, to: 320, dur: 0.3, gain: 0.12 });
        break;
      case "lock":
        click(c, out, 0.12);
        tone(c, out, { freq: 2400, type: "square", decay: 0.012, gain: 0.05 });
        tone(c, out, { freq: 150, to: 95, start: 0.01, decay: 0.1, gain: 0.22 });
        break;
      case "unlock":
        tone(c, out, { freq: 620, to: 420, decay: 0.09, gain: 0.1 });
        break;
      case "data":
        tone(c, out, { freq: 1568, decay: 0.05, gain: 0.08 });
        tone(c, out, { freq: 2093, start: 0.04, decay: 0.06, gain: 0.06 });
        break;
      case "boot": {
        // L'allumage : une impulsion grave qui gonfle, un souffle qui monte,
        // puis l'accord qui « verrouille » le système.
        const t = c.currentTime;
        const sub = c.createOscillator();
        const subEnv = c.createGain();
        sub.type = "sine";
        sub.frequency.setValueAtTime(42, t);
        sub.frequency.exponentialRampToValueAtTime(64, t + 1.1);
        subEnv.gain.setValueAtTime(0.0001, t);
        subEnv.gain.exponentialRampToValueAtTime(0.42, t + 0.9);
        subEnv.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
        sub.connect(subEnv);
        subEnv.connect(out);
        sub.start(t);
        sub.stop(t + 2);
        whoosh(c, out, { from: 180, to: 5200, dur: 1.15, gain: 0.16 });
        for (const [i, f] of [523.25, 783.99, 1046.5, 1567.98].entries()) {
          tone(c, out, { freq: f, start: 1.12 + i * 0.05, attack: 0.01, decay: 1.4, gain: 0.09 });
        }
        click(c, out, 0.14, 1.1);
        break;
      }
      case "launch": {
        for (const [i, f] of [392, 523.25, 659.25, 783.99, 1046.5].entries()) {
          tone(c, out, { freq: f, start: i * 0.07, attack: 0.006, decay: 0.7, gain: 0.1 });
        }
        whoosh(c, out, { from: 400, to: 6000, dur: 0.9, gain: 0.14, start: 0.18 });
        tone(c, out, { freq: 98, to: 49, start: 0.3, decay: 0.8, gain: 0.26 });
        break;
      }
      case "error":
        tone(c, out, { freq: 440, decay: 0.12, gain: 0.12 });
        tone(c, out, { freq: 330, start: 0.12, decay: 0.18, gain: 0.12 });
        break;
    }
  } catch {
    /* le son n'est jamais une raison d'interrompre le parcours */
  }
}
