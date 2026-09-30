import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusion de classes — source unique pour tout le dépôt (app, features, shared).
 * clsx pour les conditions, twMerge pour dédoublonner les utilitaires Tailwind
 * en conflit : la surcharge de l'appelant gagne toujours.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
