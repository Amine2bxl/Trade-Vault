/** Les modales et leurs sélecteurs se partagent le verrou : fermer un enfant
 * ne réactive pas la page, quel que soit l'ordre de démontage React. */
let locks = 0;
let previous = "";
export function acquireBodyScrollLock(): () => void {
  if (locks++ === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Signale « une fenêtre est ouverte » au CSS : l'orbe du curseur s'efface
    // sous le voile flouté, qu'elle obligeait à recalculer à chaque mouvement.
    document.body.classList?.add("tv-scroll-locked");
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      document.body.style.overflow = previous;
      document.body.classList?.remove("tv-scroll-locked");
    }
  };
}
