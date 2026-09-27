import React from "react";
import { Composition } from "remotion";
import { DURATION, FPS, H, W } from "./beats";
import { TradeVault } from "./TradeVault";

export const Root: React.FC = () => (
  <Composition
    id="TradeVault"
    component={TradeVault}
    durationInFrames={DURATION}
    fps={FPS}
    width={W}
    height={H}
  />
);
