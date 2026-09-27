import React from "react";
import { interpolate } from "remotion";
import { FPB } from "./beats";
import { rand } from "./math";
import { C, EASE, FONT } from "./theme";
import type { Scene } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** « Broken rules *cost you.* » → mots, chacun en segments (accent ou non). */
type Seg = { t: string; a: boolean };
const parse = (s: string): Seg[][] => {
  const words: Seg[][] = [];
  let cur: Seg[] = [];
  let buf = "";
  let a = false;
  const flush = () => {
    if (buf) cur.push({ t: buf, a });
    buf = "";
  };
  for (const ch of s) {
    if (ch === "*") {
      flush();
      a = !a;
    } else if (ch === " ") {
      flush();
      if (cur.length) words.push(cur);
      cur = [];
    } else buf += ch;
  }
  flush();
  if (cur.length) words.push(cur);
  return words;
};

const Word: React.FC<{ segs: Seg[]; mono?: boolean }> = ({ segs, mono }) => (
  <>
    {segs.map((s, i) => (
      <span key={i} style={{ color: s.a && !mono ? C.accent : undefined }}>
        {s.t}
      </span>
    ))}
  </>
);

const Words: React.FC<{ words: Seg[][]; mono?: boolean }> = ({ words, mono }) => (
  <>
    {words.map((w, i) => (
      <React.Fragment key={i}>
        {i > 0 && " "}
        <Word segs={w} mono={mono} />
      </React.Fragment>
    ))}
  </>
);

/** Chaque mot sort de son masque, un par double-croche. */
const Rise: React.FC<{ words: Seg[][]; t: number }> = ({ words, t }) => (
  <>
    {words.map((w, i) => {
      const p = interpolate(t - i * (FPB / 4), [0, 20], [0, 1], { ...clamp, easing: EASE.expo });
      return (
        <React.Fragment key={i}>
          {i > 0 && " "}
          <span
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "top",
              padding: "0 0.05em 0.16em",
              margin: "0 -0.05em -0.16em",
            }}
          >
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 115}%)` }}>
              <Word segs={w} />
            </span>
          </span>
        </React.Fragment>
      );
    })}
  </>
);

/** Frappe caractère par caractère, sur la grille des triples-croches. */
const Type: React.FC<{ words: Seg[][]; t: number }> = ({ words, t }) => {
  const chars: Seg[] = [];
  words.forEach((w, i) => {
    if (i > 0) chars.push({ t: " ", a: false });
    w.forEach((s) => [...s.t].forEach((ch) => chars.push({ t: ch, a: s.a })));
  });
  const shown = t < 0 ? 0 : Math.floor(t / (FPB / 8)) + 1;
  const blink = shown < chars.length || Math.floor(t / (FPB / 2)) % 2 === 0;
  return (
    <>
      {chars.map((c, i) => (
        <React.Fragment key={i}>
          <span style={{ color: c.a ? C.accent : undefined, opacity: i < shown ? 1 : 0 }}>
            {c.t}
          </span>
          {i === Math.min(shown, chars.length) - 1 && blink && (
            <span style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "0.06em",
                  top: "0.12em",
                  width: "0.07em",
                  height: "0.86em",
                  background: C.accent,
                }}
              />
            </span>
          )}
        </React.Fragment>
      ))}
    </>
  );
};

/** Entrée en glitch : tranches décalées + franges rouge/cyan, 12 frames. */
const Glitch: React.FC<{ words: Seg[][]; t: number }> = ({ words, t }) => {
  const k = interpolate(t, [0, 12], [1, 0], clamp);
  if (k <= 0) return <Words words={words} />;
  const fr = Math.round(t);
  const dx = 14 * k;
  const N = 7;
  const layer: React.CSSProperties = { position: "absolute", inset: 0, whiteSpace: "nowrap" };
  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
      <span style={{ visibility: "hidden" }}>
        <Words words={words} />
      </span>
      {Array.from({ length: N }, (_, i) => (
        <span
          key={i}
          style={{
            ...layer,
            clipPath: `inset(${(i / N) * 100}% 0 ${100 - ((i + 1) / N) * 100}% 0)`,
            transform: `translateX(${(rand(fr * 13 + i) - 0.5) * 70 * k}px)`,
          }}
        >
          <span
            style={{
              ...layer,
              color: "rgb(255 50 90)",
              mixBlendMode: "screen",
              transform: `translateX(${-dx}px)`,
            }}
          >
            <Words words={words} mono />
          </span>
          <span
            style={{
              ...layer,
              color: "rgb(40 225 255)",
              mixBlendMode: "screen",
              transform: `translateX(${dx}px)`,
            }}
          >
            <Words words={words} mono />
          </span>
          <span style={layer}>
            <Words words={words} />
          </span>
        </span>
      ))}
    </span>
  );
};

const BOX: Record<NonNullable<Scene["pos"]>, React.CSSProperties> = {
  center: {
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  left: { left: 128, top: "50%", width: 660, transform: "translateY(-50%)" },
  bottom: { left: 128, bottom: 150, maxWidth: 1200 },
};

/** Le texte d'un plan : la ligne active (jusqu'à la suivante ou la fin du plan). */
export const Copy: React.FC<{ scene: Scene; t: number }> = ({ scene, t }) => {
  const lines = scene.copy ?? [];
  const idx = lines.findIndex(
    (l, i) => t >= l.at * FPB && (i === lines.length - 1 || t < lines[i + 1].at * FPB),
  );
  if (idx < 0) return null;
  const line = lines[idx];
  const lt = t - line.at * FPB;
  const words = parse(line.text);
  const pos = scene.pos ?? "bottom";
  const lab = interpolate(t - lines[0].at * FPB, [0, 16], [0, 1], { ...clamp, easing: EASE.expo });
  return (
    <div style={{ position: "absolute", ...BOX[pos] }}>
      {scene.label && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.muted,
            opacity: lab,
            transform: `translateY(${(1 - lab) * 10}px)`,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.accent }} />
          {scene.label}
        </div>
      )}
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: scene.size ?? (pos === "left" ? 80 : 84),
          letterSpacing: "-0.035em",
          lineHeight: 1.04,
          color: C.text,
          textWrap: "balance",
        }}
      >
        {line.fx === "type" ? (
          <Type words={words} t={lt} />
        ) : line.fx === "glitch" ? (
          <Glitch words={words} t={lt} />
        ) : (
          <Rise words={words} t={lt} />
        )}
      </div>
    </div>
  );
};
