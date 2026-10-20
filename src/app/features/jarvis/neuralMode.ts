import { useEffect, useState } from "react";
import type { JarvisMode } from "@/shared/ui/JarvisNeural";
import type { TKey } from "@/app/i18n/translations";

/**
 * CE QUE FAIT JARVIS, EN UN MODE — la source du cœur neuronal.
 *
 * La conversation connaît déjà les faits : le micro est ouvert, la question
 * est partie, la réponse s'écrit, la voix parle. Ce module les traduit en
 * mode de fonctionnement (voir `shared/ui/neural/modes.ts`).
 *
 * Le serveur répond d'un bloc : il ne dit pas en direct s'il comprend, lit ou
 * vérifie. Les phases de réflexion suivent donc le temps écoulé — le même
 * principe que les étapes affichées sous la question (`ThinkingSteps`) : la
 * dernière phase dure tant que le serveur n'a pas répondu, elle ne prétend
 * jamais avoir fini avant lui.
 */

export type ThinkingPhase = "understanding" | "analyzing" | "thinking" | "revising";

/** La phase de réflexion selon le temps écoulé depuis l'envoi. */
export function thinkingPhase(elapsedMs: number): ThinkingPhase {
  if (elapsedMs < 1_200) return "understanding";
  if (elapsedMs < 4_500) return "analyzing";
  if (elapsedMs < 11_000) return "thinking";
  // Une longue réflexion alterne : penser, puis relire ce qu'on a pensé.
  return (elapsedMs - 11_000) % 8_000 < 3_000 ? "revising" : "thinking";
}

export interface JarvisActivityFacts {
  /** La voix de Jarvis joue. */
  speaking: boolean;
  /** La réponse s'écrit à l'écran. */
  writing: boolean;
  /** La question est partie, la réponse n'est pas arrivée. */
  loading: boolean;
  /** Depuis combien de temps (ms). */
  loadingMs: number;
  /** Le micro est ouvert (dictée ou conversation vocale). */
  listening: boolean;
}

/** Le mode affiché — la voix d'abord, puis l'écriture, la réflexion, l'écoute. */
export function jarvisMode(f: JarvisActivityFacts): JarvisMode {
  if (f.speaking) return "speaking";
  if (f.writing) return "writing";
  if (f.loading) return thinkingPhase(f.loadingMs);
  if (f.listening) return "listening";
  return "breathing";
}

/** Le libellé de chaque mode (dictionnaire de l'app). */
export const MODE_LABEL: Record<JarvisMode, TKey> = {
  breathing: "jarvis.mode.breathing",
  listening: "jarvis.mode.listening",
  understanding: "jarvis.mode.understanding",
  analyzing: "jarvis.mode.analyzing",
  thinking: "jarvis.mode.thinking",
  revising: "jarvis.mode.revising",
  writing: "jarvis.mode.writing",
  speaking: "jarvis.mode.speaking",
};

/**
 * Le temps écoulé depuis que `active` est vrai, rafraîchi deux fois par
 * seconde — et seulement pendant ce temps-là : aucun minuteur au repos.
 */
export function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed(performance.now() - started), 500);
    return () => window.clearInterval(id);
  }, [active]);
  return elapsed;
}
