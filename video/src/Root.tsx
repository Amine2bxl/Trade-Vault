import React from "react";
import { Composition } from "remotion";
import { DURATION, FPS, H, W } from "./beats";
import { TradeVault } from "./TradeVault";
import { VH, VW, Vertical } from "./vertical/Vertical";

/* La pub 16:9 (landing, YouTube) et ses déclinaisons 9:16 (TikTok, Reels,
   Shorts, épingles vidéo Pinterest) : même grille, même bande-son. Deux
   langues × deux accroches à tester l'une contre l'autre. */
export const Root: React.FC = () => (
  <>
    <Composition
      id="TradeVault"
      component={TradeVault}
      durationInFrames={DURATION}
      fps={FPS}
      width={W}
      height={H}
    />
    {(["fr", "en"] as const).flatMap((lang) =>
      (["a", "b"] as const).map((hook) => (
        <Composition
          key={`${lang}-${hook}`}
          id={`Vertical-${lang.toUpperCase()}-${hook.toUpperCase()}`}
          component={Vertical}
          durationInFrames={DURATION}
          fps={FPS}
          width={VW}
          height={VH}
          defaultProps={{ lang, hook }}
        />
      )),
    )}
  </>
);
