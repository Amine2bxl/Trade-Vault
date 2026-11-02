/**
 * LA FENÊTRE NAÎT DU BOUTON — la transition « zoom » d'iOS.
 *
 * Sur iPhone, une feuille ne tombe pas du ciel : elle GRANDIT depuis le
 * bouton qu'on vient de toucher, sur un ressort, et s'y RÉTRACTE en se
 * fermant. L'œil suit l'objet : il sait d'où vient la fenêtre et où elle
 * retourne.
 *
 * ── LA SOURCE ──
 * Le moteur d'appui (`press.ts`) note le dernier élément touché ou validé au
 * clavier (`lastPressSource`). Une fenêtre qui s'ouvre dans la seconde qui
 * suit part de lui. Sans source (raccourci clavier, ouverture par programme),
 * ou si la source est plus grande que la fenêtre, l'entrée habituelle reste.
 *
 * ── LE GESTE ──
 * Le panneau part du rectangle du bouton (translation + échelle) et grandit
 * jusqu'à sa place sur le ressort `--tv-spring` (~380 ms). Son contenu
 * apparaît en fondu un peu après : on ne voit jamais un formulaire écrasé.
 * À la fermeture, le même chemin à l'envers (~260 ms, `exitGhost.ts`), si le
 * bouton est encore là et visible.
 *
 * `transform` et `opacity` uniquement. Mouvement réduit : rien.
 */

/** `--tv-spring`, la courbe du ressort d'iOS (repli : l'easing signature). */
const SPRING =
  "linear(0, 0.06 2.4%, 0.23 5.2%, 0.5 9.4%, 0.75 14%, 0.9 18.8%, 0.98 24%, 1.02 30%, 1.025 36%, 1.012 46%, 1.002 60%, 1)";
const FALLBACK = "cubic-bezier(0.16, 1, 0.3, 1)";
export const ZOOM_MS = { in: 380, out: 260 } as const;
/** Une sortie qui accélère vers le bouton, comme aspirée. */
const OUT_EASE = "cubic-bezier(0.4, 0, 0.6, 1)";

function easing(): string {
  return typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", "linear(0, 1)")
    ? SPRING
    : FALLBACK;
}

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** La transformation qui pose le panneau `to` sur le rectangle `from` (origine
 *  au centre, imposée dans les images-clés : une feuille a souvent la sienne). */
function fromTransform(from: DOMRect, to: DOMRect): string {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const sx = Math.max(0.02, from.width / to.width);
  const sy = Math.max(0.02, from.height / to.height);
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

/** Le rectangle de mise en page de `el` dans la fenêtre, transformations ignorées. */
function layoutRect(el: HTMLElement): DOMRect {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft - n.scrollLeft;
    y += n.offsetTop - n.scrollTop;
  }
  return new DOMRect(x + el.scrollLeft, y + el.scrollTop, el.offsetWidth, el.offsetHeight);
}

/** Le bouton est-il utilisable comme point de départ (visible, plus petit) ? */
function usable(source: HTMLElement | null, to: DOMRect): DOMRect | null {
  if (!source || !source.isConnected) return null;
  const from = source.getBoundingClientRect();
  if (from.width < 4 || from.height < 4) return null;
  if (from.width >= to.width && from.height >= to.height) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (from.right < 0 || from.bottom < 0 || from.left > vw || from.top > vh) return null;
  return from;
}

/**
 * Fait grandir `panel` depuis `source`. Rend `true` si la transition joue
 * (l'appelant coupe alors l'entrée CSS), `false` sinon.
 */
export function zoomInFrom(panel: HTMLElement, source: HTMLElement | null): boolean {
  if (typeof panel.animate !== "function" || reduced()) return false;
  // On mesure la place de MISE EN PAGE de la fenêtre, pas son rectangle
  // affiché : une entrée en cours (CSS, ou la nôtre lancée deux fois par le
  // double montage du mode strict) le fausserait.
  const to = layoutRect(panel);
  const from = usable(source, to);
  if (!from) return false;
  for (const running of panel.getAnimations()) running.cancel();
  for (const child of Array.from(panel.children)) {
    for (const running of child.getAnimations()) running.cancel();
  }
  panel.style.animation = "none";
  panel.animate(
    [
      { transform: fromTransform(from, to), transformOrigin: "50% 50%", opacity: 0.35 },
      { transform: "none", transformOrigin: "50% 50%", opacity: 1 },
    ],
    {
      duration: ZOOM_MS.in,
      easing: easing(),
      fill: "backwards",
    },
  );
  // Le contenu arrive un temps après : la bulle s'ouvre, puis on lit.
  for (const child of Array.from(panel.children)) {
    child.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      delay: 110,
      easing: "ease-out",
      fill: "backwards",
    });
  }
  return true;
}

/**
 * Rétracte `panel` (la copie d'une fenêtre qui se ferme) dans `source`.
 * Rend l'animation du panneau, ou `null` si le bouton n'est plus utilisable.
 */
export function zoomOutTo(panel: HTMLElement, source: HTMLElement | null): Animation | null {
  if (typeof panel.animate !== "function" || reduced()) return null;
  const to = panel.getBoundingClientRect();
  const from = usable(source, to);
  if (!from) return null;
  for (const child of Array.from(panel.children)) {
    child.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 110,
      easing: "ease-in",
      fill: "forwards",
    });
  }
  return panel.animate(
    [
      { transform: "none", transformOrigin: "50% 50%", opacity: 1 },
      { transform: fromTransform(from, to), transformOrigin: "50% 50%", opacity: 0 },
    ],
    { duration: ZOOM_MS.out, easing: OUT_EASE, fill: "forwards" },
  );
}
