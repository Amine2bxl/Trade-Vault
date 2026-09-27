/* LES ÉVÉNEMENTS SONORES, déduits du montage — jamais saisis à la main.
   Une transition, un surlignage, une frappe, un impact : chacun devient un
   événement daté en TEMPS. La synthèse (étape 1) et TIMECODES.md les lisent ;
   à l'étape 2, les vrais fichiers SFX se poseront sur ces mêmes dates. */
import { CTA, MONTAGE, SCENES, SILENCE } from "./scenes";

export type Sfx =
  | "cut"
  | "impact"
  | "subdrop"
  | "whoosh"
  | "sweep"
  | "tick"
  | "thud"
  | "glitch"
  | "type"
  | "riser"
  | "snap"
  | "silence";
/** `pan` : -1 gauche → 1 droite (sens du mouvement) ; `len` en temps ; `n` : rang dans une série. */
export type Ev = { beat: number; sfx: Sfx; note: string; pan?: number; len?: number; n?: number };

const chars = (text: string) => text.replaceAll("*", "").length;

export const events = (): Ev[] => {
  const ev: Ev[] = [];
  SCENES.forEach((s) => {
    const e = s.enter ?? "cut";
    ev.push({ beat: s.beat, sfx: "cut", note: `${s.id} (${e})` });
    if (s.impact) {
      ev.push({
        beat: Math.max(0, s.beat - 4),
        sfx: "riser",
        note: `riser → ${s.id}`,
        len: Math.min(4, s.beat),
      });
      ev.push(
        { beat: s.beat, sfx: "impact", note: s.id },
        { beat: s.beat, sfx: "subdrop", note: s.id },
      );
    }
    if (e.startsWith("whip"))
      ev.push({
        beat: s.beat,
        sfx: "whoosh",
        note: s.id,
        pan: e === "whip-left" ? -1 : e === "whip-right" ? 1 : 0,
      });
    if (e === "zoom")
      ev.push(
        { beat: s.beat, sfx: "whoosh", note: s.id },
        { beat: s.beat, sfx: "thud", note: s.id },
      );
    if (e === "wipe") ev.push({ beat: s.beat, sfx: "sweep", note: s.id, len: 1 });
    s.marks?.forEach((m, n) =>
      ev.push({
        beat: s.beat + m.at,
        sfx: m.tone === "red" ? "thud" : "tick",
        note: `${s.id} — surlignage`,
        n,
      }),
    );
    s.copy?.forEach((l) => {
      if (l.fx === "glitch")
        ev.push({ beat: s.beat + l.at, sfx: "glitch", note: `${s.id} — texte` });
      if (l.fx === "type")
        for (let n = 0; n < chars(l.text); n++)
          ev.push({ beat: s.beat + l.at + n / 8, sfx: "type", note: `${s.id} — frappe`, n });
    });
  });
  ev.push({
    beat: MONTAGE.beat - 2,
    sfx: "riser",
    note: "riser → silence",
    len: SILENCE.beat - MONTAGE.beat + 2,
  });
  MONTAGE.flashes.forEach((fl, n) =>
    ev.push({
      beat: MONTAGE.beat + n * MONTAGE.step,
      sfx: "snap",
      note: `montage — ${fl.shot}`,
      n,
    }),
  );
  ev.push({ beat: SILENCE.beat, sfx: "silence", note: "noir + silence total", len: SILENCE.len });
  ev.push(
    { beat: CTA.beat, sfx: "cut", note: "cta" },
    { beat: CTA.beat, sfx: "impact", note: "cta" },
    { beat: CTA.beat, sfx: "subdrop", note: "cta" },
  );
  CTA.steps
    .slice(1)
    .forEach((b, n) =>
      ev.push({ beat: CTA.beat + b, sfx: "tick", note: "cta — apparition", n: n + 1 }),
    );
  return ev.sort((a, b) => a.beat - b.beat);
};
