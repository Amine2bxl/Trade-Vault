import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SHOTS_M, logo } from "../assets";
import { FPB, f } from "../beats";
import { Glitch, Rise, Type } from "../Copy";
import { parse } from "../words";
import { Grain, MotionBlur } from "../fx";
import { AUDIO } from "../scenes";
import { C, EASE, FONT, MONO, RGB } from "../theme";
import type { Mark } from "../types";
import {
  DEMO,
  V_BLUR,
  V_CTA,
  V_MONTAGE,
  V_SILENCE,
  vScenes,
  type Hook,
  type Lang,
  type VCam,
  type VLine,
  type VScene,
} from "./script";

/* Format vertical : 1080 × 1920. Zones sûres TikTok/Reels — le haut (onglets)
   jusqu'à ~140 px, le bas (légende, musique) à partir de ~1500 px, la colonne
   d'actions à droite (~140 px). Le texte vit entre 200 et 760 px, à gauche. */
export const VW = 1080;
export const VH = 1920;

/** L'écran du téléphone à z = 1 : 640 px de large, au ratio des captures `-m` (780×1800). */
const SCREEN_W = 640;
const SCREEN_H = Math.round((SCREEN_W * 1800) / 780);
const BEZEL = 14;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (name?: VScene["ease"]) =>
  name === "linear" ? EASE.linear : name === "inOut" ? EASE.inOut : EASE.expo;

const lerp = (a: VCam, b: VCam, p: number) => {
  const m = (x: number | undefined, y: number | undefined, d: number) =>
    (x ?? d) + ((y ?? d) - (x ?? d)) * p;
  return {
    fx: m(a.fx, b.fx, 0.5),
    fy: m(a.fy, b.fy, 0.5),
    z: m(a.z, b.z, 1),
    ax: m(a.ax, b.ax, 0.5),
    ay: m(a.ay, b.ay, 0.62),
    rx: m(a.rx, b.rx, 0),
    ry: m(a.ry, b.ry, 0),
  };
};

/* ── LE FOND — le noir de la vitrine, une lueur menthe très légère (≤ 0,08),
   la trame qui s'efface. Rien d'autre ne rayonne. ─────────────────────── */
const VBackdrop: React.FC<{ glow?: number }> = ({ glow = 1 }) => (
  <AbsoluteFill style={{ background: "#050607" }}>
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(900px 700px at 78% 4%, rgb(${RGB.accent} / ${0.075 * glow}), rgb(${RGB.accent} / ${0.035 * glow}) 34%, rgb(${RGB.accent} / ${0.01 * glow}) 58%, transparent 72%)`,
          `radial-gradient(900px 900px at 0% 40%, rgb(${RGB.indigo} / 0.06), rgb(${RGB.indigo} / 0.02) 40%, transparent 68%)`,
        ].join(","),
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(rgb(255 255 255 / 0.028) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.028) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "linear-gradient(to bottom, #000 0%, transparent 60%)",
      }}
    />
  </AbsoluteFill>
);

/* ── UN SURLIGNAGE posé sur l'UI réelle, dans le repère de la capture. ── */
const MarkView: React.FC<{ m: Mark; t: number }> = ({ m, t }) => {
  const lt = t - m.at * FPB;
  if (lt < 0) return null;
  const p = interpolate(lt, [0, 14], [0, 1], { ...clamp, easing: EASE.expo });
  const [x, y, w, h] = m.box;
  const color = m.tone === "red" ? "rgb(248 113 113)" : C.accent;
  const rgb = m.tone === "red" ? RGB.red : RGB.accent;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x * SCREEN_W,
          top: y * SCREEN_H,
          width: w * SCREEN_W,
          height: h * SCREEN_H,
          borderRadius: m.pill ? 10 : 16,
          border: `2.5px solid ${color}`,
          background: `rgb(${rgb} / ${m.pill ? 0.1 : 0.06})`,
          opacity: p,
          transform: `scale(${1.08 - 0.08 * p})`,
        }}
      />
      {m.check && (
        <div
          style={{
            position: "absolute",
            left: m.check[0] * SCREEN_W - 10,
            top: m.check[1] * SCREEN_H - 10,
            width: 20,
            height: 20,
            borderRadius: 5,
            background: C.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${interpolate(lt, [0, 10], [0.2, 1], { ...clamp, easing: EASE.back })})`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="#fff"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={24}
              strokeDashoffset={24 * (1 - p)}
            />
          </svg>
        </div>
      )}
    </>
  );
};

/* ── LE TÉLÉPHONE, posé par la caméra. ───────────────────────────────── */
const Phone: React.FC<{ scene: VScene; t: number }> = ({ scene, t }) => {
  const p = interpolate(t, [0, scene.len * FPB], [0, 1], { ...clamp, easing: ease(scene.ease) });
  const cam = lerp(scene.cam[0], scene.cam[1], p);
  const px = BEZEL + cam.fx * SCREEN_W;
  const py = BEZEL + cam.fy * SCREEN_H;
  const tx = cam.ax * VW - px * cam.z;
  const ty = cam.ay * VH - py * cam.z;
  const dim = scene.look === "dim";
  return (
    <AbsoluteFill
      style={{ perspective: 2400, perspectiveOrigin: `${cam.ax * 100}% ${cam.ay * 100}%` }}
    >
      <AbsoluteFill
        style={{
          transform: `rotateX(${cam.rx}deg) rotateY(${cam.ry}deg)`,
          transformOrigin: `${cam.ax * 100}% ${cam.ay * 100}%`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: SCREEN_W + BEZEL * 2,
            height: SCREEN_H + BEZEL * 2,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${cam.z})`,
            borderRadius: 78,
            background: "#0c0d0f",
            boxShadow:
              "inset 0 0 0 1.5px rgb(255 255 255 / 0.14), 0 40px 120px rgb(0 0 0 / 0.75), 0 8px 24px rgb(0 0 0 / 0.6)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: BEZEL,
              top: BEZEL,
              width: SCREEN_W,
              height: SCREEN_H,
              borderRadius: 64,
              overflow: "hidden",
              background: "#050607",
            }}
          >
            <Img
              src={SHOTS_M[scene.shot]}
              style={{
                width: SCREEN_W,
                height: SCREEN_H,
                display: "block",
                filter: dim ? "brightness(0.32) saturate(0.4) blur(5px)" : undefined,
              }}
            />
            {!dim && (scene.marks ?? []).map((m, i) => <MarkView key={i} m={m} t={t} />)}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── LE TEXTE — en haut, aligné à gauche, dans la zone sûre. ─────────── */
const Punch: React.FC<{ text: string; t: number }> = ({ text, t }) => {
  // Lisible dès la frame 0 (la vignette du fil), puis un léger recul.
  const p = interpolate(t, [0, 18], [0, 1], { ...clamp, easing: EASE.expo });
  return (
    <span
      style={{
        display: "inline-block",
        transform: `scale(${1.06 - 0.06 * p})`,
        transformOrigin: "0 50%",
      }}
    >
      <Rise words={parse(text)} t={9999} />
    </span>
  );
};

const Headline: React.FC<{ scene: VScene; lang: Lang; t: number }> = ({ scene, lang, t }) => {
  const lines = scene.copy[lang];
  const hook = scene.id === "hook";
  // L'accroche empile ses deux lignes ; les autres plans n'en ont qu'une.
  const shown = lines.filter((l) => t >= l.at * FPB || l.fx === "punch");
  if (!shown.length) return null;
  const first = lines[0].at * FPB;
  const lab = interpolate(t - first, [0, 16], [0, 1], { ...clamp, easing: EASE.expo });
  const render = (l: VLine) => {
    const lt = t - l.at * FPB;
    const words = parse(l.text);
    if (l.fx === "punch") return <Punch text={l.text} t={lt} />;
    if (l.fx === "type") return <Type words={words} t={lt} />;
    if (l.fx === "glitch") return <Glitch words={words} t={lt} />;
    return <Rise words={words} t={lt} />;
  };
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 150,
        top: hook ? 300 : 230,
        fontFamily: FONT,
      }}
    >
      {scene.label && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 30,
            padding: "12px 22px 12px 18px",
            borderRadius: 999,
            background: "rgb(19 20 22 / 0.92)",
            boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.1)",
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#c9d1d9",
            opacity: lab,
            transform: `translateY(${(1 - lab) * 12}px)`,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 99, background: C.accent }} />
          {scene.label[lang]}
        </div>
      )}
      {shown.map((l, i) => (
        <div
          key={i}
          style={{
            fontWeight: 800,
            fontSize: hook ? 124 : 104,
            letterSpacing: "-0.045em",
            lineHeight: 1.0,
            color: C.text,
            textWrap: "balance",
            marginTop: i ? 26 : 0,
            textShadow: "0 2px 18px rgb(0 0 0 / 0.55)",
          }}
        >
          {render(l)}
        </div>
      ))}
    </div>
  );
};

/** La mention « vraie app · données d'exemple », sous le titre. */
const Demo: React.FC<{ lang: Lang; t: number }> = ({ lang, t }) => {
  const o = interpolate(t, [10, 26], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        top: 1440,
        fontFamily: MONO,
        fontSize: 22,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgb(201 209 217 / 0.85)",
        padding: "12px 18px",
        borderRadius: 12,
        background: "#0b0c0e",
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 6px 18px rgb(0 0 0 / 0.6)",
        opacity: o,
      }}
    >
      {DEMO[lang]}
    </div>
  );
};

/* ── LES ENTRÉES — le plan entrant arrive, le sortant ne fait que couper. ── */
const enterStyle = (scene: VScene, t: number): React.CSSProperties => {
  const p = interpolate(t, [0, 16], [0, 1], { ...clamp, easing: EASE.expo });
  switch (scene.enter) {
    case "whip-left":
      return { transform: `translateX(${(1 - p) * 760}px)` };
    case "whip-up":
      return { transform: `translateY(${(1 - p) * 1100}px)` };
    case "zoom":
      return { transform: `scale(${1.32 - 0.32 * p})`, opacity: Math.min(1, p * 2.2) };
    case "wipe":
      return { clipPath: `inset(0 0 0 ${(1 - p) * 100}%)` };
    case "fade":
      return {};
    default:
      return {};
  }
};

const SceneLayer: React.FC<{ scene: VScene; lang: Lang; frame: number }> = ({
  scene,
  lang,
  frame,
}) => {
  const start = f(scene.beat);
  const end = f(scene.beat + scene.len);
  // La coupe se décide sur la frame ENTIÈRE ; le mouvement, lui, lit la frame
  // fractionnaire du flou de bougé — les coupes restent franches.
  const whole = Math.round(frame);
  if (whole < start || whole >= end) return null;
  const t = frame - start;
  // « fade » : l'écran s'ALLUME (de l'accroche éteinte au produit), pas un fondu au noir.
  const lit =
    scene.enter === "fade" ? interpolate(t, [0, 22], [0, 1], { ...clamp, easing: EASE.expo }) : 1;
  return (
    <AbsoluteFill style={enterStyle(scene, t)}>
      <AbsoluteFill style={{ filter: lit < 1 ? `brightness(${0.32 + 0.68 * lit})` : undefined }}>
        <Phone scene={scene} t={t} />
      </AbsoluteFill>
      {/* Le voile du haut : le titre reste lisible quel que soit l'écran dessous. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgb(5 6 7 / 0.94) 0%, rgb(5 6 7 / 0.86) 26%, rgb(5 6 7 / 0.4) 40%, transparent 50%)",
        }}
      />
      <Headline scene={scene} lang={lang} t={t} />
      {scene.look !== "dim" && <Demo lang={lang} t={t} />}
    </AbsoluteFill>
  );
};

/* ── LE MONTAGE ÉCLAIR — un écran par double-croche, plein cadre. ─────── */
const Montage: React.FC<{ frame: number }> = ({ frame }) => {
  const s = f(V_MONTAGE.beat);
  const end = f(V_SILENCE.beat);
  const whole = Math.round(frame);
  if (whole < s || whole >= end) return null;
  const i = Math.min(
    V_MONTAGE.flashes.length - 1,
    Math.floor((whole - s) / (V_MONTAGE.step * FPB)),
  );
  const fl = V_MONTAGE.flashes[i];
  const lt = frame - s - i * V_MONTAGE.step * FPB;
  // La capture téléphone, plein cadre en largeur : 7 frames, l'œil ne lit que le geste.
  const z = 1.04 + lt * 0.006;
  const w = VW * z;
  const h = (w * 1800) / 780;
  return (
    <AbsoluteFill style={{ background: "#050607", overflow: "hidden" }}>
      <Img
        src={SHOTS_M[fl.shot]}
        style={{
          position: "absolute",
          width: w,
          height: h,
          left: VW / 2 - fl.fx * w,
          top: VH * 0.46 - fl.fy * h,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgb(0 0 0 / 0.6))",
        }}
      />
    </AbsoluteFill>
  );
};

/* ── L'ÉCRAN DE FIN ─────────────────────────────────────────────────── */
const Cta: React.FC<{ lang: Lang; frame: number }> = ({ lang, frame }) => {
  const s = f(V_CTA.beat);
  if (Math.round(frame) < s) return null;
  const t = frame - s;
  const [logoAt, wordAt, tagAt, buttonAt, urlAt] = V_CTA.steps;
  const at = (b: number, dur = 20, easing = EASE.expo) =>
    interpolate(t - b * FPB, [0, dur], [0, 1], { ...clamp, easing });
  const lg = at(logoAt, 26);
  const wd = at(wordAt, 22);
  const tg = at(tagAt, 20);
  const bt = at(buttonAt, 16, EASE.back);
  const ur = at(urlAt, 18);
  const rise = (p: number): React.CSSProperties => ({
    opacity: Math.min(1, p),
    transform: `translateY(${(1 - p) * 22}px)`,
  });
  const txt = V_CTA.text[lang];
  return (
    <AbsoluteFill>
      <VBackdrop glow={interpolate(t, [0, 60], [1.05, 1], clamp)} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 330,
          fontFamily: FONT,
          textAlign: "center",
        }}
      >
        <Img
          src={logo}
          style={{
            width: 168,
            height: 168,
            opacity: Math.min(1, lg * 1.4),
            transform: `scale(${0.7 + 0.3 * lg})`,
            filter: `blur(${(1 - lg) * 16}px)`,
          }}
        />
        <div style={{ marginTop: 34, overflow: "hidden", padding: "0 0.05em 0.14em" }}>
          <div
            style={{
              fontSize: 128,
              letterSpacing: "-0.045em",
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
            ...rise(tg),
            marginTop: 40,
            maxWidth: 860,
            fontWeight: 700,
            fontSize: 62,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: C.text,
            textWrap: "balance",
          }}
        >
          <Rise words={parse(txt.tagline)} t={9999} />
        </div>
        <div
          style={{
            marginTop: 72,
            padding: "34px 64px",
            borderRadius: 30,
            background: C.accent,
            color: "#fff",
            fontWeight: 700,
            fontSize: 46,
            letterSpacing: "-0.01em",
            textShadow: "0 1px 2px rgb(0 0 0 / 0.35)",
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.22), 0 2px 6px rgb(0 0 0 / 0.5)",
            opacity: Math.min(1, bt * 1.5),
            transform: `scale(${0.85 + 0.15 * bt})`,
          }}
        >
          {txt.button}
        </div>
        <div
          style={{
            ...rise(ur),
            marginTop: 34,
            fontFamily: MONO,
            fontSize: 40,
            color: C.text,
            letterSpacing: "0.02em",
          }}
        >
          {V_CTA.url}
        </div>
        <div
          style={{
            ...rise(ur),
            marginTop: 18,
            fontSize: 30,
            fontWeight: 500,
            color: "rgb(201 209 217 / 0.8)",
          }}
        >
          {txt.risk}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Les coupes, pour ne flouter que là où l'image bouge vite. */
const CUTS = (scenes: VScene[]) => [
  ...scenes.map((s) => f(s.beat)),
  f(V_MONTAGE.beat),
  f(V_CTA.beat),
];

export const Vertical: React.FC<{ lang: Lang; hook: Hook }> = ({ lang, hook }) => {
  const raw = useCurrentFrame();
  const frame = Math.round(raw);
  const scenes = vScenes(hook);
  const near = CUTS(scenes).some((c) => frame >= c - 2 && frame < c + V_BLUR.around);
  const inMontage = frame >= f(V_MONTAGE.beat) && frame < f(V_CTA.beat);
  const silent = frame >= f(V_SILENCE.beat) && frame < f(V_SILENCE.beat + V_SILENCE.len);
  // `fr` peut être fractionnaire (sous-images du flou de bougé).
  const content = (fr: number) => (
    <AbsoluteFill>
      {scenes.map((s) => (
        <SceneLayer key={s.id} scene={s} lang={lang} frame={fr} />
      ))}
      <Montage frame={fr} />
      <Cta lang={lang} frame={fr} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ background: "#050607" }}>
      <VBackdrop />
      {near && !inMontage ? (
        <MotionBlur samples={V_BLUR.samples} shutter={V_BLUR.shutter}>
          <BlurFrame render={content} />
        </MotionBlur>
      ) : (
        content(raw)
      )}
      <Grain />
      {silent && <AbsoluteFill style={{ background: "#000" }} />}
      <Audio src={staticFile(AUDIO)} />
    </AbsoluteFill>
  );
};

/** `MotionBlur` gèle des sous-images : chacune relit SA frame. */
const BlurFrame: React.FC<{ render: (fr: number) => React.ReactNode }> = ({ render }) => (
  <>{render(useCurrentFrame())}</>
);
