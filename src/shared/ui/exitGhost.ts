/**
 * LA SORTIE D'UNE FEUILLE — le « fantôme ».
 *
 * Une modale qui disparaît d'un coup se lit comme un plantage ; sur iOS et
 * dans Revolut, elle repart par le chemin qu'elle a pris pour arriver.
 *
 * ── POURQUOI UN FANTÔME ──
 * Presque tous les appelants démontent la modale entière (`{x && <Modal open>}`)
 * et vident souvent la donnée qu'elle affichait au même instant. Garder
 * l'arbre React monté le temps de la sortie aurait rendu ce contenu sur une
 * donnée disparue. On fait l'inverse : au démontage, React retire la vraie
 * modale tout de suite, et une COPIE inerte de son DOM — figée, sans React,
 * sans écouteur — joue la sortie puis s'efface.
 *
 * ── LE BON MOMENT ──
 * `snapshotExit` est appelée dans le nettoyage d'un `useLayoutEffect` de la
 * surface : à la suppression d'un composant, React exécute ces nettoyages
 * AVANT de retirer ses nœuds du document. La copie est donc prise sur la
 * modale encore affichée. Elle n'est posée qu'au microtâche suivant, et
 * seulement si l'original a bien quitté le document — le double montage du
 * mode strict, qui nettoie sans rien retirer, ne laisse aucun fantôme.
 *
 * ── LA SORTIE ──
 * Le chemin inverse de l'entrée, à ~70 % de sa durée : 140 ms pour la carte
 * (`tv-dialog-in` dure 200 ms), 240 ms pour la feuille du téléphone
 * (`tv-sheet-up`, 340 ms), le voile en fondu. Elle RÉPOND tout de suite
 * (courbe de sortie `--tv-ease-out`) : une courbe qui démarre lentement
 * laissait la modale immobile un instant après le geste, et on croyait
 * qu'elle n'avait pas entendu. `transform` et `opacity` uniquement.
 *
 * Mouvement réduit, ou navigateur sans animations Web : rien, la modale
 * disparaît comme avant.
 */

/** La sortie de la carte : l'entrée `tv-dialog-in` jouée à l'envers. */
const DIALOG_OUT: Keyframe[] = [
  { opacity: 1, transform: "none" },
  { opacity: 0, transform: "translateY(8px) scale(0.98)" },
];
/** La sortie de la feuille du téléphone : l'entrée `tv-sheet-up` à l'envers. */
const SHEET_OUT: Keyframe[] = [
  { opacity: 1, transform: "none" },
  { opacity: 0, transform: "translateY(40px)" },
];
export const EXIT_MS = { dialog: 140, sheet: 240 } as const;
/** `--tv-ease-out`. */
const EXIT_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
/** Garde-fou : un fantôme ne survit jamais à ce délai. */
const GHOST_MAX_MS = 500;

/** Vrai quand la modale part en feuille (téléphone, carte basse). */
function isSheet(wrap: HTMLElement): boolean {
  return (
    window.matchMedia("(max-width: 639px)").matches &&
    !wrap.classList.contains("items-start") &&
    !wrap.classList.contains("tv-trade-sheet-wrap")
  );
}

/**
 * Prend la copie de `wrap` (le cadre `.tv-dialog-wrap` d'une modale qui se
 * démonte) et lui fait jouer la sortie une fois l'original retiré.
 */
export function snapshotExit(wrap: HTMLElement | null): void {
  if (!wrap || typeof window === "undefined" || !wrap.isConnected) return;
  if (typeof wrap.animate !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ghost = wrap.cloneNode(true) as HTMLElement;
  // Ce qui avait défilé dans la modale (une liste, un formulaire long) : la
  // copie repart à zéro, il faut lui rendre sa position, sinon le contenu
  // saute pendant la sortie.
  const scrolled: [number, number, number][] = [];
  wrap.querySelectorAll("*").forEach((el, i) => {
    if (el.scrollTop || el.scrollLeft) scrolled.push([i, el.scrollTop, el.scrollLeft]);
  });
  const sheet = isSheet(wrap);

  queueMicrotask(() => {
    // Mode strict : l'original est toujours là, il n'y a pas de sortie.
    if (wrap.isConnected) return;
    ghost.setAttribute("inert", "");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("id");
    ghost.style.pointerEvents = "none";
    document.body.appendChild(ghost);
    const nodes = ghost.querySelectorAll("*");
    for (const [i, top, left] of scrolled) {
      const el = nodes[i];
      if (el) {
        el.scrollTop = top;
        el.scrollLeft = left;
      }
    }
    const panel = ghost.querySelector<HTMLElement>(".tv-dialog");
    const veil = ghost.querySelector<HTMLElement>(".tv-dialog-backdrop");
    // La copie est un élément NEUF : sans ça, elle rejouerait son entrée CSS.
    if (panel) panel.style.animation = "none";
    if (veil) veil.style.animation = "none";

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      ghost.remove();
    };
    const duration = sheet ? EXIT_MS.sheet : EXIT_MS.dialog;
    const out = (panel ?? ghost).animate(sheet ? SHEET_OUT : DIALOG_OUT, {
      duration,
      easing: EXIT_EASE,
      fill: "forwards",
    });
    veil?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: Math.round(duration * 0.85),
      easing: "linear",
      fill: "forwards",
    });
    out.finished.then(remove, remove);
    window.setTimeout(remove, GHOST_MAX_MS);
  });
}
