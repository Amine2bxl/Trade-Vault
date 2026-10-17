/** Les modales et leurs sélecteurs se partagent le verrou : fermer un enfant
 * ne réactive pas la page, quel que soit l'ordre de démontage React. */
let locks = 0;
let previous = "";
export function acquireBodyScrollLock(): () => void {
  if (locks++ === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.body.style.overflow = previous;
  };
}
