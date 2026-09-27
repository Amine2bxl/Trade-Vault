/* LA GRILLE. Tout se compte en temps (beats), jamais en secondes : l'image
   et le son lisent les mêmes numéros, ils ne peuvent pas se décaler.
   120 BPM à 60 fps → 1 temps = 30 frames, 40 temps = 20 s. */
export const W = 1920;
export const H = 1080;
export const BPM = 120;
export const FPS = 60;
export const BEATS = 40;
export const FPB = (FPS * 60) / BPM;

/** Temps → frame (les fractions sont permises : 0.25 = une double-croche). */
export const f = (beat: number) => Math.round(beat * FPB);
export const DURATION = f(BEATS);

/** Frame → « 00:04:12 » (secondes:frames), pour le HUD et TIMECODES.md. */
export const timecode = (frame: number) => {
  const fr = Math.round(frame);
  const s = Math.floor(fr / FPS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(fr % FPS)}`;
};
