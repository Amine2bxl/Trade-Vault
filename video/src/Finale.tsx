import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { logo } from "./assets";
import { FPB, f } from "./beats";
import { Backdrop } from "./fx";
import { CTA, MONTAGE, SILENCE } from "./scenes";
import { lerpCam } from "./math";
import { Plate } from "./Scene";
import { C, EASE, FONT, RGB } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Aberration chromatique VRAIE : trois couches R, V, B décalées puis recomposées. */
const RgbSplit: React.FC<{ amount: number; children: React.ReactNode }> = ({
  amount,
  children,
}) => {
  if (amount < 0.5) return <>{children}</>;
  const M = {
    r: "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
    g: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0",
    b: "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0",
  };
  return (
    <AbsoluteFill style={{ background: "#000", isolation: "isolate" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        {(Object.keys(M) as (keyof typeof M)[]).map((c) => (
          <filter key={c} id={`ch-${c}`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={`${M[c]} 0 0 0 1 0`} />
          </filter>
        ))}
      </svg>
      {(["r", "g", "b"] as const).map((c, i) => (
        <AbsoluteFill
          key={c}
          style={{
            filter: `url(#ch-${c})`,
            transform: `translateX(${(i - 1) * amount}px)`,
            mixBlendMode: i ? "screen" : "normal",
          }}
        >
          {children}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

/** Le montage : un écran par double-croche, coupe franche + frappe chromatique. */
export const Montage: React.FC = () => {
  const frame = useCurrentFrame();
  const rf = Math.round(frame);
  const start = f(MONTAGE.beat);
  if (rf < start || rf >= f(SILENCE.beat)) return null;
  const step = MONTAGE.step * FPB;
  const k = Math.min(MONTAGE.flashes.length - 1, Math.floor((rf - start) / step));
  const fl = MONTAGE.flashes[k];
  const t = frame - start - k * step;
  const punch = interpolate(t, [0, 8], [1.1, 1], { ...clamp, easing: EASE.expo });
  const cam = lerpCam(fl.cam, fl.cam, 0);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <RgbSplit amount={interpolate(t, [0, 4], [16, 0], clamp)}>
        <AbsoluteFill style={{ background: C.bg }}>
          <Plate shot={fl.shot} cam={{ ...cam, z: cam.z * punch }} />
        </AbsoluteFill>
      </RgbSplit>
    </AbsoluteFill>
  );
};

/** L'écran de fin : la lumière monte, le logo se pose, l'appel à l'action. */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const s = f(CTA.beat);
  if (Math.round(frame) < s) return null;
  const t = frame - s;
  const [logoAt, wordAt, eyebrowAt, buttonAt, urlAt] = CTA.steps;
  const at = (b: number, dur = 20, easing = EASE.expo) =>
    interpolate(t - b * FPB, [0, dur], [0, 1], { ...clamp, easing });
  const lg = at(logoAt, 26);
  const wd = at(wordAt, 22);
  const eb = at(eyebrowAt, 18);
  const bt = at(buttonAt, 16, EASE.back);
  const ur = at(urlAt, 18);
  const rise = (p: number): React.CSSProperties => ({
    opacity: Math.min(1, p),
    transform: `translateY(${(1 - p) * 18}px)`,
  });
  return (
    <AbsoluteFill>
      <Backdrop glow={interpolate(t, [0, 60], [1.6, 1.2], clamp)} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <Img
          src={logo}
          style={{
            width: 128,
            height: 128,
            opacity: Math.min(1, lg * 1.4),
            transform: `scale(${0.7 + 0.3 * lg})`,
            filter: `blur(${(1 - lg) * 16}px)`,
          }}
        />
        <div style={{ marginTop: 28, overflow: "hidden", padding: "0 0.05em 0.14em" }}>
          <div
            style={{
              fontSize: 96,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              color: C.text,
              transform: `translateY(${(1 - wd) * 110}%)`,
            }}
          >
            <span style={{ fontWeight: 500, opacity: 0.65 }}>Trade</span>
            <span style={{ fontWeight: 800 }}>Vault</span>
          </div>
        </div>
        <div
          style={{
            ...rise(eb),
            marginTop: 20,
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.muted,
          }}
        >
          {CTA.eyebrow}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "20px 34px",
              borderRadius: 14,
              background: C.accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: 30,
              textShadow: "0 1px 2px rgb(4 18 11 / 0.55)",
              boxShadow: `0 0 48px -14px rgb(${RGB.accent} / 0.45)`,
              opacity: Math.min(1, bt * 1.5),
              transform: `scale(${0.86 + 0.14 * bt})`,
            }}
          >
            {CTA.button}
            <svg
              width={26}
              height={26}
              viewBox="0 0 24 24"
              style={{ transform: `translateX(${(1 - bt) * -10}px)` }}
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                fill="none"
                stroke="#fff"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              ...rise(ur),
              fontSize: 30,
              fontWeight: 500,
              color: C.muted,
              letterSpacing: "-0.01em",
            }}
          >
            {CTA.url}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
