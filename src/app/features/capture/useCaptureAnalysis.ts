import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeCapture } from "@/backend/capture.functions";
import { hasAnyValue, type CaptureExtraction } from "@/domain/capture";
import { enrichCapture, type CaptureDerived } from "@/domain/captureEnrich";
import { todayLocalDate } from "@/shared/calendar-date";

/**
 * L'appel au moteur de capture, côté écran. Une analyse à la fois ; une
 * réponse arrivée après la fermeture de l'écran est ignorée. Le calcul
 * (`enrichCapture`) se refait ici, à la lecture : il n'est jamais stocké.
 */

export type CaptureError = "failed" | "rate_limited" | "unavailable" | "unreadable" | "nothing";

export interface CaptureRun {
  itemId: string | null;
  extraction: CaptureExtraction;
  derived: CaptureDerived;
  cached: boolean;
}

export interface CaptureRequest {
  paths: string[];
  note?: string;
  source: "image" | "note" | "voice";
  target: "trade" | "missed";
  accountId?: string | null;
  hints?: { symbol?: string; date?: string; setups?: string[] };
  force?: boolean;
  plannedRiskDollars?: number | null;
}

export function captureErrorOf(err: unknown): CaptureError {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/RATE_LIMITED|DAILY_QUOTA/.test(msg)) return "rate_limited";
  if (/CAPTURE_(UNREADABLE|TOO_LARGE|NOT_IMAGE)/.test(msg)) return "unreadable";
  return "failed";
}

export function useCaptureAnalysis() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CaptureError | null>(null);
  const [run, setRun] = useState<CaptureRun | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const analyze = useCallback(async (req: CaptureRequest): Promise<CaptureRun | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await analyzeCapture({
        data: {
          paths: req.paths,
          note: req.note?.trim() ? req.note.trim().slice(0, 4000) : undefined,
          source: req.source,
          target: req.target,
          accountId: req.accountId ?? null,
          today: todayLocalDate(),
          hints: req.hints,
          force: req.force,
        },
      });
      if (!alive.current) return null;
      if (res.status === "disabled" || res.status === "no_provider") {
        setError("unavailable");
        return null;
      }
      if (res.status !== "completed" || !res.extraction) {
        setError(res.status === "processing" ? null : "failed");
        return null;
      }
      if (!hasAnyValue(res.extraction)) setError("nothing");
      const out: CaptureRun = {
        itemId: res.itemId,
        extraction: res.extraction,
        derived: enrichCapture(res.extraction, { plannedRiskDollars: req.plannedRiskDollars }),
        cached: res.cached,
      };
      setRun(out);
      return out;
    } catch (err) {
      if (alive.current) setError(captureErrorOf(err));
      return null;
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setRun(null);
    setError(null);
  }, []);

  return { busy, error, run, analyze, reset };
}
