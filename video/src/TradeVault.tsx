import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { f } from "./beats";
import { Cta, Montage } from "./Finale";
import { Backdrop, Grain, Hud, Impacts, MotionBlur, Vignette } from "./fx";
import { SceneView } from "./Scene";
import { AUDIO, HUD, MOTION_BLUR, SCENES, SILENCE } from "./scenes";
import { C } from "./theme";

export const TradeVault: React.FC = () => {
  const frame = Math.round(useCurrentFrame());
  const silent = frame >= f(SILENCE.beat) && frame < f(SILENCE.beat + SILENCE.len);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop />
      <MotionBlur {...MOTION_BLUR}>
        <AbsoluteFill>
          {SCENES.map((s, i) => (
            <SceneView key={s.id} i={i} />
          ))}
          <Montage />
          <Cta />
        </AbsoluteFill>
      </MotionBlur>
      <Impacts />
      <Vignette />
      <Grain />
      {HUD && <Hud />}
      {silent && <AbsoluteFill style={{ background: "#000" }} />}
      <Audio src={staticFile(AUDIO)} />
    </AbsoluteFill>
  );
};
