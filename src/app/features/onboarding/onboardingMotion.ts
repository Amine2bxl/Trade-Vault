import type { CSSProperties } from "react";

/** `--i` : le rang dans la cascade d'entrée (`.onb-rise`). */
export const rise = (i: number): CSSProperties => ({ "--i": i }) as CSSProperties;

/** Lu à l'appel, pas mémorisé : le réglage système peut changer en cours de route. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
