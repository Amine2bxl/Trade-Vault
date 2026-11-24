import type { Page } from "@/app/types";

/**
 * LA NAVIGATION CONTEXTUELLE — un seul canal pour passer d'une donnée à sa
 * source, depuis n'importe quel écran (Jarvis, Inbox, Analytics, Erreurs,
 * capture…).
 *
 * Réutilise l'événement `tv:navigate` déjà écouté par le cadre de l'app :
 * `filter` pose `?f=` (filtre unifié des trades), `focus` pose `?trade=` ou
 * `?missed=` pour OUVRIR un élément précis. La page cible lit le paramètre au
 * montage et écoute `tv:focus` quand elle est déjà affichée.
 */

export type FocusKind = "trade" | "missed";

export interface NavigateDetail {
  page: Page;
  /** Filtre unifié encodé (`filterParam` / `encodeFilter`). */
  filter?: string;
  focus?: { kind: FocusKind; id: string };
}

export const FOCUS_EVENT = "tv:focus";

export function navigateTo(detail: NavigateDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("tv:navigate", { detail }));
}

/** Pose le paramètre de focus dans l'URL et prévient la page déjà montée. */
export function applyFocus(focus: NavigateDetail["focus"]): void {
  if (!focus || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(focus.kind, focus.id);
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT));
}

export function readFocus(kind: FocusKind): string | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get(kind);
  return v && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null;
}

export function clearFocus(kind: FocusKind): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(kind)) return;
  url.searchParams.delete(kind);
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}
