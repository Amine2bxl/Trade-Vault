/**
 * L'APPUI LIQUID — chaque objet qu'on touche s'enfonce, puis revient sur le
 * ressort, comme sur iOS et dans Revolut.
 *
 * ── POURQUOI UN SEUL ÉCOUTEUR ET PAS UNE RÈGLE `:active` PAR COMPOSANT ──
 * 1. `:active` ne dure que le temps du contact : un appui bref (le cas normal
 *    au doigt) se relâchait avant que l'enfoncement ne se voie. Ici l'objet
 *    descend toujours jusqu'au bout, puis remonte.
 * 2. Une transition CSS sur `transform` se battait avec les `transition`
 *    propres à chaque composant (couleur, fond…) : la plus spécifique gagnait
 *    et l'enfoncement sautait sans transition. L'animation Web passe par la
 *    propriété individuelle `scale`, qui se compose avec les `transform`
 *    existants (pouce d'interrupteur, rotation d'un chevron) sans les écraser.
 * 3. Une liste de sélecteurs à tenir à jour finissait toujours par oublier le
 *    dernier composant ajouté. Ici, est « appuyable » tout ce qui l'est pour le
 *    navigateur : bouton, lien en bloc, onglet, option.
 *
 * ── UNE AMPLITUDE PROPORTIONNELLE ──
 * Un même `scale(.97)` déplace le bord d'un bouton de 44 px de 0,7 px, mais
 * celui d'une rangée de 800 px de 12 px : la rangée tremblait. L'amplitude se
 * calcule donc sur la taille de l'objet, pour que son bord recule d'environ
 * 5 px au plus : 0,97 pour un bouton, ≈ 0,985 pour une rangée, ≈ 0,99 pour une
 * grande carte.
 *
 * ── CE QUI NE S'ENFONCE PAS ──
 * Le désactivé, l'interrupteur (son pouce s'étire, en CSS), le lien dans un
 * paragraphe, les objets qui ont leur propre pression CSS — le disque de
 * `.tv-action`, la barre mobile, le rail (sa languette ne s'enfonce pas avec
 * l'entrée), les étoiles, l'onboarding cinématique —, les contrôles Glisse
 * (ils se SOULÈVENT à l'appui, à la manière d'iOS 26, et gardent leur geste)
 * et tout ce qui porte `data-press="off"`.
 *
 * Mouvement réduit : rien ne bouge. Le contenu ne dépend jamais de ce module.
 */

/** Ce que le navigateur considère comme appuyable. */
const PRESSABLE = [
  "button",
  "a[href]",
  "summary",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  "label[for]",
].join(",");

/** Ce qui garde sa propre pression, ou n'en veut pas. */
const EXCLUDED = [
  '[role="switch"]',
  "[disabled]",
  '[aria-disabled="true"]',
  '[data-press="off"]',
  ".tv-action",
  ".bottom-nav",
  ".rail-item",
  ".star-btn",
  ".tv-trade-star",
  ".onb-root",
  // Glisse porte son propre geste (soulèvement, étirement, lentille) : deux
  // moteurs sur la même propriété `scale` se battraient.
  ".lg-glass",
  ".lg-tab-bar",
  ".lg-segmented",
  ".lg-switch",
  ".lg-slider",
  ".lg-menu",
].join(",");

/** Recul maximal du bord de l'objet, en pixels. */
const MAX_TRAVEL_PX = 5;
/** Amplitude d'un petit objet (le jeton `--tv-press`). */
const MIN_SCALE = 0.97;
/** Plus faible enfoncement encore lisible sur une très grande surface. */
const MAX_SCALE = 0.992;

/** L'enfoncement : `--tv-dur-1`, la courbe de sortie. */
const PRESS_MS = 120;
const PRESS_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
/** Le retour : `--tv-dur-spring`, sur le ressort `--tv-spring`. */
const RELEASE_MS = 340;
const SPRING_EASE =
  "linear(0, 0.06 2.4%, 0.23 5.2%, 0.5 9.4%, 0.75 14%, 0.9 18.8%, 0.98 24%, 1.02 30%, 1.025 36%, 1.012 46%, 1.002 60%, 1)";
const FALLBACK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Au doigt, on attend un instant : le contact peut être le début d'un
 *  défilement, et une liste qui s'enfonce sous le pouce à chaque défilement
 *  se lit comme un bug. iOS fait la même chose. */
const TOUCH_DELAY_MS = 70;
/** Au-delà de ce déplacement, ce n'est plus un appui mais un geste. */
const SLOP_PX = 8;

/**
 * LA SOURCE DU DERNIER GESTE — le bouton qu'on vient de toucher (ou d'activer
 * au clavier). Une fenêtre qui s'ouvre juste après s'en sert pour NAÎTRE de
 * ce bouton, et y retourner en se fermant (`zoomTransition.ts`). Notée pour
 * tout ce qui est appuyable, contrôles de Glisse compris.
 */
let lastSource: { el: HTMLElement; at: number } | null = null;

/** Le dernier élément touché, s'il date de moins de `maxAgeMs` et existe encore. */
export function lastPressSource(maxAgeMs = 1000): HTMLElement | null {
  if (!lastSource) return null;
  const { el, at } = lastSource;
  if (performance.now() - at > maxAgeMs || !el.isConnected) return null;
  return el;
}

function noteSource(from: EventTarget | null): void {
  if (!(from instanceof Element)) return;
  const el = from.closest<HTMLElement>(PRESSABLE);
  if (el) lastSource = { el, at: performance.now() };
}

/** L'amplitude d'un objet de `width` × `height` pixels. */
export function pressScale(width: number, height: number): number {
  const side = Math.max(width, height, 1);
  const s = 1 - MAX_TRAVEL_PX / side;
  return Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)) * 1000) / 1000;
}

/** La cible de l'appui à partir de l'élément touché, ou `null`. */
export function pressTarget(from: EventTarget | null): HTMLElement | null {
  if (!(from instanceof Element)) return null;
  const el = from.closest<HTMLElement>(PRESSABLE);
  if (!el || el.closest(EXCLUDED)) return null;
  return el;
}

/** Le dernier appui posé sur chaque objet : une remontée en retard (double
 *  tap rapide) ne doit pas écraser l'appui suivant. */
const generation = new WeakMap<HTMLElement, number>();

let springEase: string | null = null;
function releaseEase(): string {
  if (springEase === null) {
    springEase =
      typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", "linear(0, 1)")
        ? SPRING_EASE
        : FALLBACK_EASE;
  }
  return springEase;
}

/**
 * Pose l'écouteur unique sur le document. Rend la fonction qui le retire.
 * Sans effet côté serveur et dans un navigateur sans animations Web.
 */
export function installPressFeedback(doc: Document = document): () => void {
  const win = doc.defaultView;
  if (!win || typeof win.Element.prototype.animate !== "function") return () => {};
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");

  let current: {
    el: HTMLElement;
    anim: Animation | null;
    timer: number | null;
    x: number;
    y: number;
    pointerId: number;
  } | null = null;

  const pressIn = (el: HTMLElement) => {
    const { width, height } = el.getBoundingClientRect();
    // Un lien en ligne (dans un paragraphe) n'est pas un objet : il ne
    // s'enfonce pas.
    if (win.getComputedStyle(el).display === "inline") return null;
    generation.set(el, (generation.get(el) ?? 0) + 1);
    return el.animate([{ scale: "1" }, { scale: String(pressScale(width, height)) }], {
      duration: PRESS_MS,
      easing: PRESS_EASE,
      fill: "forwards",
    });
  };

  const release = () => {
    const p = current;
    current = null;
    if (!p) return;
    if (p.timer !== null) win.clearTimeout(p.timer);
    const down = p.anim;
    if (!down) return;
    // Un appui bref descend quand même jusqu'au bout avant de remonter : c'est
    // ce qui fait « sentir » un tap. La remontée part donc toujours du fond.
    const gen = generation.get(p.el);
    const up = () => {
      if (generation.get(p.el) !== gen) {
        down.cancel();
        return;
      }
      const from = win.getComputedStyle(p.el).scale;
      const anim = p.el.animate([{ scale: from === "none" ? "1" : from }, { scale: "1" }], {
        duration: RELEASE_MS,
        easing: releaseEase(),
      });
      down.cancel();
      anim.onfinish = () => anim.cancel();
    };
    if (down.playState === "running") down.finished.then(up, () => {});
    else up();
  };

  const onDown = (e: PointerEvent) => {
    if (e.button === 0) noteSource(e.target);
    if (e.button !== 0 || reduce.matches) return;
    const el = pressTarget(e.target);
    if (!el) return;
    release();
    const p = {
      el,
      anim: null as Animation | null,
      timer: null as number | null,
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };
    current = p;
    if (e.pointerType === "touch") {
      p.timer = win.setTimeout(() => {
        p.timer = null;
        if (current === p) p.anim = pressIn(el);
      }, TOUCH_DELAY_MS);
    } else {
      p.anim = pressIn(el);
    }
  };

  const onMove = (e: PointerEvent) => {
    const p = current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (Math.abs(e.clientX - p.x) > SLOP_PX || Math.abs(e.clientY - p.y) > SLOP_PX) release();
  };

  const onUp = (e: PointerEvent) => {
    if (current && e.pointerId === current.pointerId) {
      // Appui très bref au doigt : la descente n'a pas encore commencé. On la
      // joue quand même, puis on remonte — sinon le tap ne se « sent » pas.
      if (current.timer !== null) {
        win.clearTimeout(current.timer);
        current.timer = null;
        current.anim = pressIn(current.el);
      }
      release();
    }
  };

  // Au clavier, la source est l'élément qui a le focus quand on valide.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") noteSource(doc.activeElement);
  };

  const opts = { capture: true, passive: true } as const;
  doc.addEventListener("keydown", onKey, opts);
  doc.addEventListener("pointerdown", onDown, opts);
  doc.addEventListener("pointermove", onMove, opts);
  doc.addEventListener("pointerup", onUp, opts);
  doc.addEventListener("pointercancel", release, opts);
  win.addEventListener("blur", release);
  return () => {
    release();
    doc.removeEventListener("keydown", onKey, opts);
    doc.removeEventListener("pointerdown", onDown, opts);
    doc.removeEventListener("pointermove", onMove, opts);
    doc.removeEventListener("pointerup", onUp, opts);
    doc.removeEventListener("pointercancel", release, opts);
    win.removeEventListener("blur", release);
  };
}
