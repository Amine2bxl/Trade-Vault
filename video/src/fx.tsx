import React from "react";
import { AbsoluteFill, Freeze, interpolate, useCurrentFrame } from "remotion";
import { BPM, FPB, f, timecode } from "./beats";
import { CTA, SCENES } from "./scenes";
import { C, EASE, MONO, RGB } from "./theme";

/* Le fond de la LP : la menthe très haut à droite, l'indigo qui donne au noir
   une température, la trame de terminal qui s'efface vers le bas.
   (La trame passe de 1,6 % à 2,5 % : à 1,6 % le h264 l'efface.) */
export const Backdrop: React.FC<{ glow?: number }> = ({ glow = 1 }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <AbsoluteFill
      style={{
        background: [
          // Mêmes lueurs que la LP, avec une décroissance en plusieurs paliers : en vidéo
          // un dégradé linéaire aussi sombre « marche » (banding) ; celui-ci fond.
          `radial-gradient(68rem 42rem at 72% -8%, rgb(${RGB.accent} / ${0.085 * glow}), rgb(${RGB.accent} / ${0.045 * glow}) 28%, rgb(${RGB.accent} / ${0.012 * glow}) 50%, transparent 66%)`,
          `radial-gradient(56rem 40rem at 6% 18%, rgb(${RGB.indigo} / 0.07), rgb(${RGB.indigo} / 0.035) 28%, rgb(${RGB.indigo} / 0.01) 48%, transparent 64%)`,
          `radial-gradient(70rem 50rem at 50% 108%, rgb(${RGB.indigo} / 0.05), rgb(${RGB.indigo} / 0.025) 30%, transparent 66%)`,
        ].join(","),
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(rgb(255 255 255 / 0.025) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.025) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "linear-gradient(to bottom, #000 0%, transparent 78%)",
      }}
    />
  </AbsoluteFill>
);

/** Flou de bougé réel : N sous-images CENTRÉES sur la frame, moyennées.
    Centrées (et non en avance) pour que `Math.round(frame)` désigne la même
    image dans chaque sous-image : les coupes franches restent franches. */
export const MotionBlur: React.FC<{
  samples: number;
  shutter: number;
  children: React.ReactNode;
}> = ({ samples, shutter, children }) => {
  const frame = useCurrentFrame();
  if (samples <= 1) return <>{children}</>;
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      {Array.from({ length: samples }, (_, i) => (
        <AbsoluteFill
          key={i}
          style={{ mixBlendMode: "plus-lighter", filter: `opacity(${1 / samples})` }}
        >
          <Freeze frame={Math.max(0, frame + (i / (samples - 1) - 0.5) * shutter)}>
            {children}
          </Freeze>
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

/** Grain de pellicule : un bruit différent à chaque frame. */
export const Grain: React.FC = () => {
  const frame = Math.round(useCurrentFrame());
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.14, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={2}
            seed={frame % 97}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgb(0 0 0 / 0.5) 100%)",
    }}
  />
);

/** Le flash des impacts (temps 4, puis la chute finale). */
export const Impacts: React.FC = () => {
  const frame = useCurrentFrame();
  const beats = [...SCENES.filter((s) => s.impact).map((s) => s.beat), CTA.beat];
  let o = 0;
  for (const b of beats) {
    const d = frame - f(b);
    if (d >= 0 && d < 16) o = Math.max(o, interpolate(d, [0, 16], [0.2, 0], { easing: EASE.expo }));
  }
  if (!o) return null;
  return (
    <AbsoluteFill
      style={{
        opacity: o,
        mixBlendMode: "screen",
        background: `radial-gradient(ellipse 70% 60% at 50% 50%, rgb(207 251 233), rgb(${RGB.accent} / 0.4) 60%, transparent)`,
      }}
    />
  );
};

/** Le HUD de régie : lisible sur n'importe quel fond grâce à `difference`. */
export const Hud: React.FC = () => {
  const frame = Math.round(useCurrentFrame());
  const beat = frame / FPB;
  if (beat >= CTA.beat - 0.2) return null;
  let idx = 0;
  SCENES.forEach((s, i) => beat >= s.beat && (idx = i));
  const pad = (n: number) => String(n).padStart(2, "0");
  const cell: React.CSSProperties = { position: "absolute" };
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "difference",
        color: "#fff",
        opacity: interpolate(frame, [0, 20], [0, 0.45], { extrapolateRight: "clamp" }),
        fontFamily: MONO,
        fontSize: 15,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
      }}
    >
      <div style={{ ...cell, left: 48, top: 42 }}>TradeVault</div>
      <div style={{ ...cell, right: 48, top: 42 }}>
        Shot {pad(idx + 1)}/{pad(SCENES.length)}
      </div>
      <div style={{ ...cell, left: 48, bottom: 42 }}>TC {timecode(frame)}</div>
      <div style={{ ...cell, right: 48, bottom: 42 }}>
        {BPM} BPM · Beat {pad(Math.floor(beat) + 1)}
      </div>
    </AbsoluteFill>
  );
};
