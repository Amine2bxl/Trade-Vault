import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Perceived-performance primitives.
 *
 * Two problems this file solves, both of which made TradeVault *feel* slow
 * without actually being slow:
 *
 *  1. THE SKELETON FLASH. Every page navigation rendered a full-page skeleton
 *     through `<Suspense>`. Since `pageModules` preloads the likely-next pages
 *     and the sidebar preloads on hover, the lazy chunk is usually already in
 *     memory and resolves in 20–80ms. The skeleton therefore appeared and
 *     disappeared inside a couple of frames — a grey strobe. A user reads that
 *     as "the app had to go and fetch something", which is the exact opposite
 *     of what happened. `DeferredFallback` shows nothing at all for the first
 *     `delay` ms; only a genuinely slow load ever gets a skeleton.
 *
 *  2. THE COLLAPSE. Rendering nothing while waiting would drop `<main>` to zero
 *     height, killing the scrollbar and shifting the whole shell. So "nothing"
 *     is a reserved box of the same height the content will occupy.
 */

/**
 * Renders `children` only if the wait outlasts `delay`.
 *
 * Mount it with `key={page}` so each navigation gets its own timer.
 *
 * @param delay ms of silence before the fallback is allowed to appear. 320ms is
 *   just past the threshold where a delay stops reading as "instant" and starts
 *   reading as "waiting" — below it a loader costs more than it explains.
 */
export function DeferredFallback({
  children,
  delay = 320,
  reserve = "min-h-[70vh]",
}: {
  children: ReactNode;
  delay?: number;
  /** Height to hold during the silent window. Match the content it stands in
   *  for: a full page reserves a viewport, an inline section reserves its own
   *  box. Getting this wrong is how a "no skeleton" fix reintroduces the very
   *  layout shift it was meant to remove. */
  reserve?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  if (!show) {
    // Reserved space, not emptiness: the scroll container keeps its height, so
    // the sidebar, the scrollbar and the mobile dock never move while we wait.
    return <div className={reserve} aria-hidden="true" />;
  }
  return <>{children}</>;
}

/**
 * PageTransition — the shell's one page-change animation.
 *
 * The wrapper element is deliberately **never remounted** (no `key={page}`):
 * remounting would throw away every page's scroll offset, filter state and
 * expanded rows, and would cost a full re-render on each navigation. Instead
 * the animation is restarted imperatively on the same DOM node — remove the
 * class, force a reflow, add it back — which is the only reliable way to replay
 * a CSS animation without touching React's tree.
 *
 * The animation itself is defined in `styles.css` (`.page-in`): 180ms, opacity
 * 0.55→1 and a 4px rise, compositor-only, disabled under `prefers-reduced-motion`.
 */
export function PageTransition({ page, children }: { page: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    // No entrance on the very first paint: on a cold load (F5) the content must
    // be there instantly. The transition exists to connect two views, and on the
    // first view there is nothing to connect from.
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-in");
    // Reading a layout property flushes the style change, so re-adding the class
    // is seen by the browser as a new animation rather than a no-op.
    void el.offsetWidth;
    el.classList.add("page-in");
  }, [page]);

  return <div ref={ref}>{children}</div>;
}
