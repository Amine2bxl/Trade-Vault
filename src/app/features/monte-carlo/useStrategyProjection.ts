import { useEffect, useRef, useState } from "react";
import type {
  StrategyConfig,
  StrategyModel,
  StrategyProjection,
} from "@/modules/probability/strategy";

/** Un seul calcul courant. Changer un réglage annule le Worker précédent,
 * donc aucun résultat périmé ne peut reprendre la place du nouveau scénario. */
export function useStrategyProjection(model: StrategyModel | null, config: StrategyConfig) {
  const [result, setResult] = useState<StrategyProjection | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    setError(false);
    if (!model || (model.kind === "historical" && model.sampleSize < 5)) {
      setResult(null);
      setRunning(false);
      return;
    }
    setRunning(true);
    const timer = window.setTimeout(() => {
      try {
        const worker = new Worker(new URL("./strategy.worker.ts", import.meta.url), {
          type: "module",
        });
        workerRef.current = worker;
        worker.onmessage = (
          event: MessageEvent<{ result?: StrategyProjection; error?: string }>,
        ) => {
          setResult(event.data.result ?? null);
          setError(!event.data.result);
          setRunning(false);
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
        };
        worker.onerror = () => {
          setError(true);
          setRunning(false);
          worker.terminate();
        };
        worker.postMessage({ model, config });
      } catch {
        setError(true);
        setRunning(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [model, config, retryKey]);
  return { result, running, error, retry: () => setRetryKey((k) => k + 1) };
}
