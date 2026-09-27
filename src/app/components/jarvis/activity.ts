import { useSyncExternalStore } from "react";
import type { JarvisOrbState } from "@/shared/ui";

/* CE QUE JARVIS EST EN TRAIN DE FAIRE — un seul état, lu partout.
 *
 * La conversation sait si Jarvis écoute, réfléchit ou parle ; l'en-tête de la
 * fenêtre et la barre de la page Jarvis, non. Sans état partagé, l'orbe de
 * l'en-tête restait immobile pendant que la réponse se préparait deux
 * centimètres plus bas — l'agent semblait dormir au moment où il travaillait.
 * Un store minuscule (pas de contexte React : il traverserait le portail de
 * la modale et la page sans qu'on le câble à chaque niveau). */

let current: JarvisOrbState = "idle";
const listeners = new Set<() => void>();

export function setJarvisActivity(next: JarvisOrbState): void {
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useJarvisActivity(): JarvisOrbState {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "idle",
  );
}
