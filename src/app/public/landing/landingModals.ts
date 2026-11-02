import { useEffect, useSyncExternalStore } from "react";

/**
 * LES FENÊTRES DE LA VITRINE — un état qui survit au remplacement de la page.
 *
 * Sur `/`, la vitrine est montée TROIS fois pendant le chargement : le rendu
 * serveur, l'attente du code de l'application, puis l'application elle-même
 * (`AppHost`, `routes/__root.tsx`), à chaque fois à une autre place de
 * l'arbre. Un `useState` local repartait de zéro à chaque passage : un clic
 * sur « Log in » ou « Get Started » pendant ces premières secondes ouvrait le
 * formulaire dans une instance aussitôt démontée, et le visiteur ne voyait
 * RIEN s'ouvrir (constaté en production, connexion lente : formulaire ouvert
 * au sixième clic seulement).
 *
 * L'état vit donc ici, hors des instances : la dernière vitrine montée affiche
 * ce que la précédente avait ouvert. Quand plus aucune vitrine n'est à l'écran
 * (le trader vient de se connecter et l'application la remplace), l'état se
 * referme après un court délai : à la déconnexion, la vitrine revient sans
 * formulaire déjà ouvert.
 */

export type AuthFormState = {
  mode: "login" | "signup";
  plan?: string;
  error?: string;
};

export type LandingModalsState = {
  auth: AuthFormState | null;
  demo: boolean;
};

const CLOSED: LandingModalsState = { auth: null, demo: false };
/** Le délai au-delà duquel une vitrine démontée et non remplacée est partie. */
export const CLOSE_GRACE_MS = 1500;

let state: LandingModalsState = CLOSED;
const listeners = new Set<() => void>();

function set(next: LandingModalsState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function getLandingModals(): LandingModalsState {
  return state;
}

export function subscribeLandingModals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openAuthForm(mode: "login" | "signup", plan?: string, error?: string): void {
  set({ ...state, auth: { mode, plan, error } });
}

export function closeAuthForm(): void {
  if (state.auth) set({ ...state, auth: null });
}

export function setDemoOpen(open: boolean): void {
  if (state.demo !== open) set({ ...state, demo: open });
}

/* ── Les vitrines à l'écran ── */
let mounted = 0;
let pendingClose: ReturnType<typeof setTimeout> | null = null;

/**
 * Déclare une vitrine à l'écran. Rend la fonction à appeler quand elle part.
 * Le remplacement d'une instance par la suivante annule la fermeture.
 */
export function registerLandingInstance(graceMs: number = CLOSE_GRACE_MS): () => void {
  mounted++;
  if (pendingClose !== null) {
    clearTimeout(pendingClose);
    pendingClose = null;
  }
  return () => {
    mounted--;
    if (mounted > 0) return;
    pendingClose = setTimeout(() => {
      pendingClose = null;
      if (mounted === 0 && state !== CLOSED) set(CLOSED);
    }, graceMs);
  };
}

/** L'état des fenêtres pour une vitrine montée. Côté serveur : tout est fermé. */
export function useLandingModals(): LandingModalsState {
  useEffect(() => registerLandingInstance(), []);
  return useSyncExternalStore(subscribeLandingModals, getLandingModals, () => CLOSED);
}
