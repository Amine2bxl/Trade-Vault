/**
 * LE RETOUR TACTILE — un battement très court sous le doigt, réservé aux
 * gestes qui ENGAGENT : ajouter un trade, basculer un interrupteur.
 *
 * Un retour sur chaque bouton n'en serait plus un : il deviendrait du bruit,
 * et l'on ne sentirait plus les moments qui comptent.
 *
 * `navigator.vibrate` n'existe que sur Android (Safari iOS ne l'expose pas) ;
 * ailleurs l'appel ne fait rien. Jamais sous mouvement réduit : quelqu'un qui
 * a demandé moins de mouvement n'a pas demandé plus de vibrations.
 */
export function tap(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    navigator.vibrate(8);
  } catch {
    // Certains navigateurs refusent la vibration hors geste : sans conséquence.
  }
}
