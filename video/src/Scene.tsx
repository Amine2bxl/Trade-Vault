import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { SHOTS, type ShotId } from "./assets";
import { FPB, H, W, f } from "./beats";
import { Copy } from "./Copy";
import { Backdrop } from "./fx";
import { SCENES } from "./scenes";
import { C, EASE, RGB } from "./theme";
import { lerpCam } from "./math";
import type { Enter, Mark } from "./types";

/** Largeur d'une capture à z = 1 (les captures font 2400 px : net jusqu'à z ≈ 1.5). */
const PLATE = 1600;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Durées des transitions en frames : `pre` = sortie du plan précédent AVANT la
    coupe, `post` = entrée APRÈS. `overlap` : le plan précédent reste dessous. */
const TRANS: Record<Enter, { pre: number; post: number; overlap?: boolean }> = {
  cut: { pre: 0, post: 0 },
  fade: { pre: 0, post: 12, overlap: true },
  wipe: { pre: 0, post: 30, overlap: true },
  "whip-left": { pre: 8, post: 18 },
  "whip-right": { pre: 8, post: 18 },
  "whip-up": { pre: 8, post: 18 },
  zoom: { pre: 8, post: 18 },
};

const enterFx = (type: Enter, t: number): React.CSSProperties => {
  const { post } = TRANS[type];
  if (t >= post) return {};
  const p = interpolate(t, [0, post], [0, 1], { ...clamp, easing: EASE.expo });
  switch (type) {
    case "whip-left":
      return { transform: `translateX(${(1 - p) * W * 1.1}px)` };
    case "whip-right":
      return { transform: `translateX(${-(1 - p) * W * 1.1}px)` };
    case "whip-up":
      return { transform: `translateY(${(1 - p) * H * 1.2}px)` };
    case "zoom":
      return {
        transform: `scale(${0.55 + 0.45 * p})`,
        opacity: interpolate(t, [0, 5], [0, 1], clamp),
      };
    case "fade":
      return { opacity: p, filter: `blur(${(1 - p) * 12}px)` };
    case "wipe":
      return {
        clipPath: `inset(0 ${100 - interpolate(t, [0, post], [0, 100], { ...clamp, easing: EASE.inOut })}% 0 0)`,
      };
    default:
      return {};
  }
};

/** `r` = frames restantes avant la coupe. */
const exitFx = (type: Enter, r: number): React.CSSProperties => {
  const { pre } = TRANS[type];
  if (!pre || r > pre) return {};
  const p = interpolate(pre - r, [0, pre], [0, 1], { ...clamp, easing: EASE.expoIn });
  switch (type) {
    case "whip-left":
      return { transform: `translateX(${-p * W * 1.1}px)` };
    case "whip-right":
      return { transform: `translateX(${p * W * 1.1}px)` };
    case "whip-up":
      return { transform: `translateY(${-p * H * 1.2}px)` };
    case "zoom":
      return { transform: `scale(${1 + p * 1.4})`, opacity: 1 - p };
    default:
      return {};
  }
};

const MarkView: React.FC<{ m: Mark; t: number }> = ({ m, t }) => {
  const d = t - m.at * FPB;
  if (d < 0) return null;
  const p = interpolate(d, [0, 14], [0, 1], { ...clamp, easing: EASE.back });
  const ring = interpolate(d, [0, 26], [0, 1], { ...clamp, easing: EASE.expo });
  const col = m.tone === "red" ? RGB.red : RGB.accent;
  const [x, y, w, h] = m.box;
  const box: React.CSSProperties = {
    position: "absolute",
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    borderRadius: m.pill ? 999 : 14,
  };
  return (
    <>
      <div
        style={{
          ...box,
          border: `2px solid rgb(${col} / ${0.6 * (1 - ring)})`,
          transform: `scale(${1 + ring * 0.1})`,
        }}
      />
      <div
        style={{
          ...box,
          border: `2px solid rgb(${col})`,
          background: `rgb(${col} / 0.1)`,
          opacity: Math.min(1, p),
          transform: `scale(${1.12 - 0.12 * p})`,
        }}
      />
      {m.check && (
        <div
          style={{
            position: "absolute",
            left: `${m.check[0] * 100}%`,
            top: `${m.check[1] * 100}%`,
            width: "1.25%",
            aspectRatio: "1",
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: C.plate,
            border: `2px solid ${C.accent}`,
            transform: `translate(-50%, -50%) scale(${Math.max(0, p)})`,
          }}
        >
          <svg viewBox="0 0 12 12" width="66%" height="66%">
            <path
              d="M2.4 6.3 4.9 8.7 9.7 3.5"
              fill="none"
              stroke={C.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={11}
              strokeDashoffset={11 * (1 - interpolate(d, [3, 12], [0, 1], clamp))}
            />
          </svg>
        </div>
      )}
    </>
  );
};

/** Le cadre de capture de la LP (`.shot-frame`) : biseau éclairé en haut,
    ombre posée, lueur d'accent, reflet en diagonale. */
export const Plate: React.FC<{
  shot: ShotId;
  cam: ReturnType<typeof lerpCam>;
  t?: number;
  dim?: boolean;
  bands?: number[];
  stagger?: number;
  marks?: Mark[];
  halo?: boolean;
}> = ({ shot, cam, t = 999, dim, bands, stagger = 3, marks, halo }) => {
  const src = SHOTS[shot];
  const revealing = bands && t < 4 + (bands.length - 1) * stagger + 18;
  return (
    <AbsoluteFill style={{ perspective: 2400 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: PLATE,
          transformOrigin: "0 0",
          transform: `translate(${cam.ax * W}px, ${cam.ay * H}px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) scale(${cam.z}) translate(${-cam.fx * 100}%, ${-cam.fy * 100}%)`,
        }}
      >
        {halo && (
          <div
            style={{
              position: "absolute",
              inset: "-14% -8% -10%",
              background: `radial-gradient(60% 46% at 50% 18%, rgb(${RGB.accent} / 0.09), transparent 70%), radial-gradient(52% 40% at 50% 88%, rgb(${RGB.green} / 0.05), transparent 72%)`,
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            borderRadius: 22,
            padding: 6,
            border: "1px solid transparent",
            background: `linear-gradient(180deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.02) 34%, transparent 70%) border-box, ${C.plate} padding-box`,
            boxShadow: `0 32px 80px -24px rgb(0 0 0 / 0.85), 0 0 120px -30px rgb(${RGB.accent} / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.07)`,
          }}
        >
          <div
            style={{
              position: "relative",
              borderRadius: 16,
              overflow: "hidden",
              filter: dim ? "brightness(0.34) saturate(0.55) blur(5px)" : undefined,
            }}
          >
            <Img
              src={src}
              style={{
                display: "block",
                width: "100%",
                visibility: revealing ? "hidden" : "visible",
              }}
            />
            {revealing &&
              bands.slice(0, -1).map((y0, i) => {
                const p = interpolate(t - 4 - i * stagger, [0, 18], [0, 1], {
                  ...clamp,
                  easing: EASE.expo,
                });
                return (
                  <Img
                    key={i}
                    src={src}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      clipPath: `inset(${y0 * 100}% 0 ${(1 - bands[i + 1]) * 100}% 0)`,
                      opacity: p,
                      transform: `translateY(${(1 - p) * 26}px)`,
                    }}
                  />
                );
              })}
            {marks?.map((m, i) => (
              <MarkView key={i} m={m} t={t} />
            ))}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(104deg, rgb(255 255 255 / 0.045) 0%, transparent 38%, transparent 100%)",
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SCRIM = [
  "linear-gradient(to top, rgb(7 8 10 / 0.97) 0%, rgb(7 8 10 / 0.86) 26%, rgb(7 8 10 / 0.5) 42%, transparent 62%)",
  "radial-gradient(75% 65% at 0% 100%, rgb(7 8 10 / 0.8), transparent 72%)",
].join(",");

/** Un plan : capture + caméra + texte, entrée et sortie comprises. */
export const SceneView: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const rf = Math.round(frame);
  const s = SCENES[i];
  const next = SCENES[i + 1];
  const enter = s.enter ?? "cut";
  const nextEnter = next?.enter ?? "cut";
  const start = f(s.beat);
  const end = f(s.beat + s.len);
  const until = end + (TRANS[nextEnter].overlap ? TRANS[nextEnter].post : 0);
  if (rf < start || rf >= until) return null;

  const t = frame - start;
  const p = interpolate(frame, [start, end], [0, 1], { ...clamp, easing: EASE[s.ease ?? "inOut"] });
  const cam = lerpCam(s.cam[0], s.cam[1], p);
  const pos = s.pos ?? "bottom";
  const wipe = enter === "wipe" && t < TRANS.wipe.post;
  const wipeX = interpolate(t, [0, TRANS.wipe.post], [0, 100], { ...clamp, easing: EASE.inOut });

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ ...enterFx(enter, t), ...(next ? exitFx(nextEnter, end - frame) : {}) }}
      >
        {TRANS[enter].overlap && t < TRANS[enter].post && <Backdrop />}
        <Plate
          shot={s.shot}
          cam={cam}
          t={t}
          dim={s.look === "dim"}
          bands={s.bands}
          stagger={s.stagger}
          marks={s.marks}
          halo={s.halo}
        />
        {pos === "bottom" && <AbsoluteFill style={{ background: SCRIM }} />}
        {pos === "center" && (
          <AbsoluteFill
            style={{
              background: "radial-gradient(50% 45% at 50% 50%, rgb(7 8 10 / 0.6), transparent 75%)",
            }}
          />
        )}
        {rf < end && <Copy scene={s} t={t} />}
      </AbsoluteFill>
      {wipe && (
        // Le front du balayage : un liseré émeraude qui « trace » l'écran.
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${wipeX}%`,
            width: 2,
            background: C.highlight,
            boxShadow: `0 0 24px 4px rgb(${RGB.accent} / 0.6), 0 0 80px 10px rgb(${RGB.accent} / 0.25)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
