import { computeBrain, type BrainRequest } from "./brainCompute";

/** Worker du Neural Brain : une demande, une réponse, aucun état. */
self.onmessage = (event: MessageEvent<{ id: number; req: BrainRequest }>) => {
  try {
    self.postMessage({ id: event.data.id, result: computeBrain(event.data.req) });
  } catch {
    self.postMessage({ id: event.data.id, error: "BRAIN_COMPUTE_FAILED" });
  }
};
