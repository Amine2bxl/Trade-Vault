import { useCallback, useEffect, useRef } from "react";
import { computeBrain, type BrainRequest } from "./brainCompute";

/**
 * Envoie une demande au Worker du Neural Brain et rend une promesse. Sans
 * Worker (navigateur ancien, SSR), le calcul passe sur le fil principal après
 * le rendu courant — plus lent, jamais faux.
 */
export function useBrainCompute() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(
    new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>(),
  );
  const seq = useRef(0);

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    let w: Worker;
    try {
      w = new Worker(new URL("./brain.worker.ts", import.meta.url), { type: "module" });
    } catch {
      return;
    }
    w.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const p = pending.current.get(e.data.id);
      if (!p) return;
      pending.current.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.result);
    };
    worker.current = w;
    const waiting = pending.current;
    return () => {
      w.terminate();
      worker.current = null;
      for (const p of waiting.values()) p.reject(new Error("BRAIN_WORKER_CLOSED"));
      waiting.clear();
    };
  }, []);

  return useCallback(<T>(req: BrainRequest): Promise<T> => {
    const w = worker.current;
    if (!w)
      return new Promise<T>((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(computeBrain(req) as T);
          } catch (e) {
            reject(e);
          }
        }, 0),
      );
    const id = ++seq.current;
    return new Promise<T>((resolve, reject) => {
      pending.current.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ id, req });
    });
  }, []);
}
