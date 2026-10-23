import {
  projectStrategy,
  type StrategyConfig,
  type StrategyModel,
} from "@/modules/probability/strategy";

self.onmessage = (event: MessageEvent<{ model: StrategyModel; config: StrategyConfig }>) => {
  try {
    const result = projectStrategy(event.data.model, event.data.config);
    self.postMessage(
      { result },
      {
        transfer: [
          result.paths.buffer,
          result.drawdownPaths.buffer,
          result.objectiveStops.buffer,
          result.objectiveBalances.buffer,
          result.outcomes.buffer,
        ],
      },
    );
  } catch {
    self.postMessage({ error: "INVALID_PROJECTION" });
  }
};
