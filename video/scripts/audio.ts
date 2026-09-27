/* LA BANDE-SON DE L'ÉTAPE 1, calculée — aucun fichier externe.
   Musique et SFX lisent la même grille que l'image (src/beats.ts) et les
   événements du montage (src/events.ts) : rien ne peut se décaler.
   Sortie : public/audio/synth.wav + TIMECODES.md.   `bun run audio` */
import { mkdirSync, writeFileSync } from "node:fs";
import { BEATS, BPM, FPB, FPS, f, timecode } from "../src/beats";
import { events, type Ev } from "../src/events";
import { CTA, MONTAGE, SCENES, SILENCE } from "../src/scenes";

const SR = 48000;
const SPB = 60 / BPM;
const LEN = Math.round(BEATS * SPB * SR);
const sec = (beat: number) => beat * SPB;

/* Bus : la musique passe dans le sidechain (elle « pompe » sous le kick),
   la batterie et les SFX non ; `send` alimente la réverbération. */
const bus = () => [new Float32Array(LEN), new Float32Array(LEN)];
const mus = bus();
const drm = bus();
const sfx = bus();
const send = new Float32Array(LEN);
const kicks: number[] = [];

let seed = 1234567;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rnd() * 2 - 1;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Ajoute un échantillon, panoramique à puissance constante (-1 … 1). */
const put = (b: Float32Array[], i: number, v: number, pan = 0, rev = 0) => {
  if (i < 0 || i >= LEN) return;
  const a = ((pan + 1) * Math.PI) / 4;
  b[0][i] += v * Math.cos(a) * Math.SQRT2;
  b[1][i] += v * Math.sin(a) * Math.SQRT2;
  if (rev) send[i] += v * rev;
};

class Biquad {
  b0 = 0;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  x1 = 0;
  x2 = 0;
  y1 = 0;
  y2 = 0;
  constructor(private type: "lp" | "hp" | "bp") {}
  set(fc: number, q = 0.707) {
    const w = (2 * Math.PI * Math.min(fc, SR * 0.45)) / SR;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const [b0, b1, b2] =
      this.type === "lp"
        ? [(1 - c) / 2, 1 - c, (1 - c) / 2]
        : this.type === "hp"
          ? [(1 + c) / 2, -(1 + c), (1 + c) / 2]
          : [al, 0, -al];
    const a0 = 1 + al;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - al) / a0;
    return this;
  }
  run(x: number) {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Dent de scie sans repliement (PolyBLEP). */
const blep = (t: number, dt: number) => {
  if (t < dt) return ((t /= dt), t + t - t * t - 1);
  if (t > 1 - dt) return ((t = (t - 1) / dt), t * t + t + t + 1);
  return 0;
};
const saw = (ph: number, dt: number) => 2 * ph - 1 - blep(ph, dt);

/* ── INSTRUMENTS ─────────────────────────────────────────────────────── */

/** Kick : une onde basse qui plonge d'un coup (155 → 45 Hz). */
const kick = (t0: number, g = 1) => {
  kicks.push(t0);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < 0.45 * SR; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (45 + 110 * Math.exp(-t / 0.035))) / SR;
    const click = k < 0.004 * SR ? noise() * (1 - k / (0.004 * SR)) * 0.5 : 0;
    put(
      drm,
      i0 + k,
      (Math.tanh(Math.sin(ph) * 1.8) * Math.exp(-t / 0.16) * Math.min(1, t / 0.002) + click) * g,
    );
  }
};

/** Charleston : du bruit taillé dans l'aigu. */
const hat = (t0: number, open = false, g = 1) => {
  const hp = new Biquad("hp").set(7500, 0.8);
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < (open ? 0.22 : 0.05) * SR; k++) {
    put(drm, i0 + k, hp.run(noise()) * Math.exp(-k / SR / (open ? 0.07 : 0.014)) * g * 0.5, 0.3);
  }
};

/** Clap : trois micro-rafales puis la queue. */
const clap = (t0: number, g = 1) => {
  const bp = new Biquad("bp").set(1400, 1.1);
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < 0.3 * SR; k++) {
    const t = k / SR;
    const burst = [0, 0.011, 0.022].reduce(
      (a, o) => a + (t >= o ? Math.exp(-(t - o) / 0.006) : 0),
      0,
    );
    const env = burst + (t >= 0.022 ? 0.55 * Math.exp(-(t - 0.022) / 0.1) : 0);
    put(drm, i0 + k, bp.run(noise()) * env * g * 1.5, -0.1, 0.3);
  }
};

const bass = (t0: number, dur: number, m: number, g = 1) => {
  const fr = mtof(m);
  const lp = new Biquad("lp");
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < (dur + 0.05) * SR; k++) {
    const t = k / SR;
    ph = (ph + fr / SR) % 1;
    if (k % 32 === 0) lp.set(180 + 1400 * Math.exp(-t / 0.06), 1.1);
    const env = Math.min(1, t / 0.004) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.015));
    put(mus, i0 + k, (lp.run(saw(ph, fr / SR)) * 0.6 + Math.sin(2 * Math.PI * ph) * 0.7) * env * g);
  }
};

/** Supersaw : 7 dents de scie désaccordées par note, étalées en stéréo. */
const DET = [-0.11, -0.06, -0.025, 0, 0.025, 0.06, 0.11];
const chord = (
  t0: number,
  dur: number,
  notes: number[],
  o: { g?: number; cut?: (t: number) => number; atk?: number; rel?: number; rev?: number } = {},
) => {
  const { g = 1, cut = () => 2600, atk = 0.01, rel = 0.3, rev = 0.2 } = o;
  const lpL = new Biquad("lp");
  const lpR = new Biquad("lp");
  const osc = notes.flatMap((m) =>
    DET.map((d, j) => ({
      fr: mtof(m + d),
      ph: rnd(),
      pan: (j % 2 ? -1 : 1) * (Math.abs(d) / 0.11) * 0.8,
    })),
  );
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < (dur + rel) * SR && i0 + k < LEN; k++) {
    const t = k / SR;
    if (k % 64 === 0) {
      lpL.set(cut(t), 0.9);
      lpR.set(cut(t), 0.9);
    }
    let l = 0;
    let r = 0;
    for (const v of osc) {
      v.ph = (v.ph + v.fr / SR) % 1;
      const s = saw(v.ph, v.fr / SR);
      l += s * (1 - v.pan) * 0.5;
      r += s * (1 + v.pan) * 0.5;
    }
    const env = Math.min(1, t / atk) * (t < dur ? 1 : Math.exp(-(t - dur) / (rel / 4)));
    const sc = (env * g * 2.2) / osc.length;
    const L = lpL.run(l) * sc;
    const R = lpR.run(r) * sc;
    mus[0][i0 + k] += L;
    mus[1][i0 + k] += R;
    send[i0 + k] += (L + R) * 0.5 * rev;
  }
};

const pluck = (t0: number, m: number, g = 1, pan = 0) => {
  const fr = mtof(m);
  const lp = new Biquad("lp");
  const i0 = Math.round(t0 * SR);
  let ph = rnd();
  for (let k = 0; k < 0.2 * SR; k++) {
    const t = k / SR;
    ph = (ph + fr / SR) % 1;
    if (k % 32 === 0) lp.set(300 + 4200 * Math.exp(-t / 0.05), 1.3);
    put(
      mus,
      i0 + k,
      lp.run(saw(ph, fr / SR)) * Math.exp(-t / 0.09) * Math.min(1, t / 0.002) * g,
      pan,
      0.35,
    );
  }
};

/* ── SFX ─────────────────────────────────────────────────────────────── */

const riser = (t0: number, t1: number, g = 1) => {
  const bp = new Biquad("bp");
  const i0 = Math.round(t0 * SR);
  const n = Math.round((t1 - t0) * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const p = k / n;
    if (k % 32 === 0) bp.set(300 * 40 ** p, 2.5);
    ph += (2 * Math.PI * 180 * 2 ** (p * 3)) / SR;
    put(
      sfx,
      i0 + k,
      (bp.run(noise()) * 1.3 + Math.sin(ph) * 0.12) * p ** 2.2 * g,
      Math.sin(p * Math.PI * 6) * 0.3,
      0.3,
    );
  }
};

/** Coup de fouet : souffle filtré qui culmine SUR la coupe et traverse la stéréo. */
const whoosh = (tc: number, dir = 0, g = 1) => {
  const a = 0.32;
  const b = 0.38;
  const bp = new Biquad("bp");
  const i0 = Math.round((tc - a) * SR);
  for (let k = 0; k < (a + b) * SR; k++) {
    const t = k / SR - a;
    const env = t < 0 ? (1 + t / a) ** 3 : Math.exp(-t / 0.09);
    if (k % 32 === 0)
      bp.set(t < 0 ? 400 + 3200 * (1 + t / a) ** 2 : 300 + 3600 * Math.exp(-t / 0.12), 1.4);
    put(sfx, i0 + k, bp.run(noise()) * env * g * 1.3, dir * Math.tanh(t / 0.12), 0.15);
  }
};

/** Balayage du Monte Carlo : un souffle qui monte pendant tout le « tracé ». */
const sweep = (t0: number, dur: number, g = 1) => {
  const bp = new Biquad("bp");
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < dur * SR; k++) {
    const p = k / (dur * SR);
    if (k % 32 === 0) bp.set(500 * 12 ** p, 3);
    put(sfx, i0 + k, bp.run(noise()) * Math.sin(Math.PI * p) * g * 1.2, p * 1.6 - 0.8, 0.2);
  }
};

const impact = (t0: number, g = 1) => {
  const lp = new Biquad("lp").set(900, 0.7);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < 2.5 * SR; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (38 + 60 * Math.exp(-t / 0.05))) / SR;
    const crack = lp.run(noise()) * Math.exp(-t / 0.12) * 1.4 + noise() * Math.exp(-t / 0.02) * 0.4;
    put(sfx, i0 + k, (Math.tanh(Math.sin(ph) * Math.exp(-t / 0.5) * 1.6) * 0.9 + crack) * g);
    send[i0 + k] += crack * g * 0.6;
  }
};

const subdrop = (t0: number, g = 1) => {
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < 1.6 * SR; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (30 + 42 * Math.exp(-t / 0.45))) / SR;
    put(sfx, i0 + k, Math.sin(ph) * Math.min(1, t / 0.01) * Math.exp(-t / 0.7) * g);
  }
};

/** Tic d'interface, accordé sur fa mineur (fa, la♭, do, fa). */
const TICK = [89, 92, 96, 101];
const tick = (t0: number, n = 0, g = 1) => {
  const fr = mtof(TICK[n % 4]);
  const hp = new Biquad("hp").set(3000, 0.7);
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < 0.08 * SR; k++) {
    const t = k / SR;
    put(
      sfx,
      i0 + k,
      (Math.sin(2 * Math.PI * fr * t) * Math.exp(-t / 0.014) +
        hp.run(noise()) * Math.exp(-t / 0.004) * 0.6) *
        g *
        0.5,
      0.15,
      0.25,
    );
  }
};

const thud = (t0: number, g = 1) => {
  const lp = new Biquad("lp").set(400, 0.8);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < 0.3 * SR; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (50 + 45 * Math.exp(-t / 0.04))) / SR;
    put(sfx, i0 + k, (Math.sin(ph) + lp.run(noise()) * 0.5) * Math.exp(-t / 0.09) * g * 0.8);
  }
};

const glitch = (t0: number, g = 1) => {
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < 0.16 * SR; k++) {
    const t = k / SR;
    const seg = Math.floor(t / 0.018);
    const fr = 200 + ((1800 * (((Math.sin(seg * 91.7) * 43758.5) % 1) + 1)) % 1);
    const sq = Math.sign(Math.sin(2 * Math.PI * fr * t));
    const env = (t < 0.14 ? 1 : Math.exp(-(t - 0.14) / 0.008)) * (seg % 2 ? 1 : 0.5);
    put(
      sfx,
      i0 + k,
      (sq * 0.35 + (Math.round(noise() * 4) / 4) * 0.35) * env * g,
      seg % 2 ? -0.4 : 0.4,
    );
  }
};

const typeTick = (t0: number, n: number, g = 1) => {
  const hp = new Biquad("hp").set(4000, 0.7);
  const fr = 3000 * (0.9 + ((n * 0.37) % 0.2));
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < 0.025 * SR; k++) {
    const t = k / SR;
    put(
      sfx,
      i0 + k,
      (hp.run(noise()) * Math.exp(-t / 0.003) +
        Math.sin(2 * Math.PI * fr * t) * Math.exp(-t / 0.006) * 0.4) *
        g *
        0.3,
      n % 2 ? 0.2 : -0.2,
    );
  }
};

/** Claquement du montage : caisse claire courte, qui monte d'un cran à chaque écran. */
const snap = (t0: number, n: number, g = 1) => {
  const bp = new Biquad("bp").set(2200 + n * 250, 1);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < 0.14 * SR; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (180 + n * 12)) / SR;
    put(
      sfx,
      i0 + k,
      (bp.run(noise()) * 1.6 * Math.exp(-t / 0.05) + Math.sin(ph) * Math.exp(-t / 0.04) * 0.6) *
        g *
        (0.6 + n * 0.06),
      0,
      0.2,
    );
  }
};

/* ── ARRANGEMENT — fa mineur : Fm, Db, Ab, Eb ─────────────────────────── */
const DROP = SCENES.find((s) => s.impact)?.beat ?? 4;
const BUILD = MONTAGE.beat;
const STOP = SILENCE.beat;
const PROG = [
  [53, 56, 60],
  [49, 53, 56],
  [51, 56, 60],
  [51, 55, 58],
];
const ROOT = [41, 37, 44, 39];
const bar = (b: number) => ((Math.floor((b - DROP) / 4) % 4) + 4) % 4;

// Intro : nappe de Db qui s'ouvre, sous un bourdon de fa, jusqu'à la chute.
chord(0, sec(DROP), PROG[1], {
  g: 0.6,
  cut: (t) => 250 * 14 ** (t / sec(DROP)),
  atk: sec(DROP) * 0.6,
  rel: 0.05,
  rev: 0.6,
});
for (let k = 0; k < sec(DROP) * SR; k++)
  put(mus, k, Math.sin((2 * Math.PI * mtof(29) * k) / SR) * 0.22 * (k / (sec(DROP) * SR)) ** 2);

for (let b = DROP; b < STOP; b++) {
  kick(sec(b));
  if (b >= DROP + 4 && b < BUILD && (b - DROP) % 2 === 1) clap(sec(b), 0.55);
  bass(sec(b + 0.5), 0.2, ROOT[bar(b)], 0.5);
  if (b + 0.5 < STOP) hat(sec(b + 0.5), b >= 12 && b < BUILD, 0.35);
  if (b >= 24) for (const q of [0.25, 0.75]) if (b + q < STOP) hat(sec(b + q), false, 0.2);
  if (b >= 20 && b < BUILD)
    [0, 1, 2, 1].forEach((j, q) =>
      pluck(sec(b + q / 4), PROG[bar(b)][j] + 12, 0.25, q % 2 ? -0.4 : 0.4),
    );
}
for (let b = DROP; b < BUILD; b += 4) {
  const open =
    b >= 24 ? (t: number) => 1800 * (1 + ((b - 24) * SPB + t) / (8 * SPB)) ** 1.6 : () => 1800;
  chord(sec(b), sec(4), PROG[bar(b)], { g: 0.8, cut: open, rel: 0.08 });
}
chord(sec(BUILD), sec(STOP - BUILD), PROG[3], {
  g: 0.85,
  cut: (t) => 3000 + 5000 * (t / sec(STOP - BUILD)),
  rel: 0.02,
});
// La chute : fa mineur plein, ouvert puis refermé, qui sonne jusqu'à la fin.
kick(sec(CTA.beat), 1.1);
chord(sec(CTA.beat), sec(BEATS - CTA.beat) - 0.4, [41, 48, 53, 56, 60, 65], {
  g: 0.9,
  cut: (t) => 1100 + 4500 * Math.exp(-t / 1.2),
  rel: 1.2,
  rev: 0.7,
});

const EVENTS = events();
for (const e of EVENTS) {
  const t = sec(e.beat);
  if (e.sfx === "impact") impact(t);
  if (e.sfx === "subdrop") subdrop(t, 0.8);
  if (e.sfx === "whoosh") whoosh(t, e.pan ?? 0, 0.6);
  if (e.sfx === "sweep") sweep(t, sec(e.len ?? 1), 0.5);
  if (e.sfx === "tick") tick(t, e.n, 0.9);
  if (e.sfx === "thud") thud(t, 0.9);
  if (e.sfx === "glitch") glitch(t, 0.5);
  if (e.sfx === "type") typeTick(t, e.n ?? 0);
  if (e.sfx === "riser") riser(t, t + sec(e.len ?? 2), 0.5);
  if (e.sfx === "snap") snap(t, e.n ?? 0);
}

/* ── MIX ─────────────────────────────────────────────────────────────── */

/** Réverbération type Freeverb : 8 filtres en peigne + 4 passe-tout, par canal. */
const reverb = (inp: Float32Array) =>
  [0, 23].map((spread) => {
    const cb = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => ({
      buf: new Float32Array(Math.round((d + spread) * (SR / 44100))),
      i: 0,
      lp: 0,
    }));
    const ab = [225, 556, 441, 341].map((d) => ({
      buf: new Float32Array(Math.round((d + spread) * (SR / 44100))),
      i: 0,
    }));
    const out = new Float32Array(LEN);
    for (let k = 0; k < LEN; k++) {
      const x = inp[k] * 0.015;
      let y = 0;
      for (const c of cb) {
        const o = c.buf[c.i];
        c.lp = o * 0.75 + c.lp * 0.25;
        c.buf[c.i] = x + c.lp * 0.84;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      for (const a of ab) {
        const o = a.buf[a.i];
        a.buf[a.i] = y + o * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = o - y;
      }
      out[k] = y;
    }
    return out;
  });
const wet = reverb(send);

// Sidechain : la musique s'efface à 30 % sur chaque kick, revient en 200 ms.
const duck = new Float32Array(LEN).fill(1);
for (const tk of kicks) {
  const i0 = Math.round(tk * SR);
  for (let k = 0; k < 0.4 * SR && i0 + k < LEN; k++) {
    const t = k / SR;
    duck[i0 + k] = Math.min(duck[i0 + k], 1 - 0.7 * Math.min(1, t / 0.003) * Math.exp(-t / 0.1));
  }
}

// Silence total (réverb comprise) + fondu de fin de 250 ms.
const s0 = Math.round(sec(STOP) * SR);
const s1 = Math.round(sec(STOP + SILENCE.len) * SR);
const gate = (k: number) =>
  Math.min(
    k < s0 ? 1 : k >= s1 ? Math.min(1, (k - s1) / (0.002 * SR)) : 0,
    k < s0 ? Math.min(1, (s0 - k) / (0.002 * SR)) : 1,
    Math.min(1, (LEN - k) / (0.25 * SR)),
  );

const out = [new Float32Array(LEN), new Float32Array(LEN)];
const stats: Record<string, number> = {};
for (const ch of [0, 1]) {
  const hp = new Biquad("hp").set(24, 0.707);
  for (let k = 0; k < LEN; k++) {
    out[ch][k] =
      hp.run(drm[ch][k] + mus[ch][k] * duck[k] * 0.9 + sfx[ch][k] + wet[ch][k] * 2.5) * gate(k);
  }
}
let peak = 0;
for (const ch of out) for (const v of ch) peak = Math.max(peak, Math.abs(v));
// Limiteur doux (tanh), puis crête à -1 dBFS.
const drive = 1.6 / peak;
let peak2 = 0;
for (const ch of out)
  for (let k = 0; k < LEN; k++) {
    ch[k] = Math.tanh(ch[k] * drive);
    peak2 = Math.max(peak2, Math.abs(ch[k]));
  }
const norm = 0.891 / peak2;

/* ── WAV 16 bits stéréo ──────────────────────────────────────────────── */
const buf = Buffer.alloc(44 + LEN * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + LEN * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(LEN * 4, 40);
for (let k = 0; k < LEN; k++)
  for (const ch of [0, 1])
    buf.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, out[ch][k] * norm)) * 32767),
      44 + k * 4 + ch * 2,
    );
mkdirSync("public/audio", { recursive: true });
writeFileSync("public/audio/synth.wav", buf);

// Contrôle de niveau par section (RMS en dBFS) — sans écouter, on vérifie l'équilibre.
const rms = (a: number, b: number) => {
  let s = 0;
  const i0 = Math.round(sec(a) * SR);
  const i1 = Math.round(sec(b) * SR);
  for (let k = i0; k < i1; k++) s += (out[0][k] * norm) ** 2 + (out[1][k] * norm) ** 2;
  return (10 * Math.log10(s / (2 * (i1 - i0)) + 1e-12)).toFixed(1);
};
stats["intro 0-4"] = +rms(0, DROP);
stats["couplet 4-20"] = +rms(DROP, 20);
stats["montée 20-32"] = +rms(20, BUILD);
stats["montage 32-33.8"] = +rms(BUILD, STOP);
stats["silence"] = +rms(STOP, STOP + SILENCE.len);
stats["fin 34-40"] = +rms(CTA.beat, BEATS);

/* ── TIMECODES.md ────────────────────────────────────────────────────── */
const rows: string[] = [];
for (let i = 0; i < EVENTS.length; i++) {
  const e = EVENTS[i];
  let j = i;
  while (
    j + 1 < EVENTS.length &&
    EVENTS[j + 1].sfx === e.sfx &&
    EVENTS[j + 1].note === e.note &&
    ["type", "snap"].includes(e.sfx)
  )
    j++;
  const span =
    j > i
      ? ` ×${j - i + 1} (→ temps ${+EVENTS[j].beat.toFixed(3)})`
      : e.len
        ? ` (${+e.len.toFixed(3)} temps)`
        : "";
  rows.push(
    `| ${+e.beat.toFixed(3)} | ${f(e.beat)} | ${timecode(f(e.beat))} | ${e.sfx} | ${e.note}${span} |`,
  );
  i = j;
}
writeFileSync(
  "TIMECODES.md",
  `# TIMECODES\n\n> Généré par \`bun run audio\` depuis \`src/scenes.ts\` — ne pas éditer à la main.\n\n` +
    `${BPM} BPM · ${FPS} fps · 1 temps = ${FPB} frames = ${SPB} s · TC = mm:ss:frames\n\n` +
    `| Temps | Frame | TC | Événement | Note |\n|---|---|---|---|---|\n${rows.join("\n")}\n`,
);
console.log(
  `synth.wav : ${(LEN / SR).toFixed(2)} s, ${EVENTS.length} événements, crête avant limiteur ${peak.toFixed(2)}`,
);
console.log(stats);
export type { Ev };
