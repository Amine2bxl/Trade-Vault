import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "@/shared/ui/icons";
import { cn } from "./cn";
import { selection } from "./selection";
import { acquireBodyScrollLock } from "./scrollLock";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const LayerContext = createContext<string | null>(null);
const layers: string[] = [];
function subscribe(cb: () => void) {
  const mq = window.matchMedia(selection.mobileQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Un seul moteur pour date, heure, choix, périodes et couleurs : portail,
 * limites de fenêtre, focus, Échap imbriqué et fermeture extérieure. */
export function SelectionPanel({
  open,
  onClose,
  anchorRef,
  label,
  width = "17rem",
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  width?: string;
  children: ReactNode;
}) {
  const id = useId();
  const parent = useContext(LayerContext);
  const narrow = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(selection.mobileQuery).matches,
    () => false,
  );
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [position, setPosition] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useIsoLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const viewport = window.visualViewport;
      const vw = viewport?.width ?? window.innerWidth;
      const vh = viewport?.height ?? window.innerHeight;
      const vy = viewport?.offsetTop ?? 0;
      if (narrow) {
        const next = {
          left: 0,
          top: vy,
          width: vw,
          maxHeight: Math.max(100, Math.min(vh - 24, window.innerHeight * 0.78)),
        };
        setPosition((previous) =>
          JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
        );
        return;
      }
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const margin = selection.gutter;
      const wanted = parseFloat(width) * (width.endsWith("rem") ? rem : 1);
      const w = Math.min(Math.max(a.width, wanted || 272), vw - margin * 2);
      const below = vy + vh - a.bottom - margin - selection.gap;
      const above = a.top - vy - margin - selection.gap;
      const maxHeight = Math.max(100, Math.min(416, Math.max(below, above)));
      const left = Math.max(margin, Math.min(a.left, vw - w - margin));
      const next =
        below >= Math.min(320, maxHeight) || below >= above
          ? {
              left,
              top: a.bottom + selection.gap,
              width: w,
              maxHeight: Math.max(100, Math.min(416, below)),
            }
          : { left, bottom: window.innerHeight - a.top + selection.gap, width: w, maxHeight };
      setPosition((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    let frame = 0;
    const schedule = (e?: Event) => {
      if (e && panel.current?.contains(e.target as Node)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    const observer = new ResizeObserver(() => schedule());
    const initialize = () => {
      place();
      if (anchorRef.current) observer.observe(anchorRef.current);
    };
    // La ref de l'ancêtre peut être réattachée APRÈS l'effet de cet enfant.
    // Une trame assure sa présence, sans timer ni mesure répétée en boucle.
    initialize();
    frame = requestAnimationFrame(initialize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open, narrow, anchorRef, width]);

  const ready = open && (narrow || position !== null);
  useEffect(() => {
    if (!ready) return;
    layers.push(id);
    const panelNode = panel.current;
    const releaseScroll = narrow ? acquireBodyScrollLock() : () => {};
    const previous = document.activeElement as HTMLElement | null;
    const isTop = () => layers.at(-1) === id;
    const outside = (e: PointerEvent) => {
      if (!isTop()) return;
      const target = e.target as Node;
      if (panel.current?.contains(target) || anchorRef.current?.contains(target)) return;
      closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
          ) ?? []),
        ].filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    const frame = requestAnimationFrame(() => {
      const node = panel.current;
      if (!node || node.contains(document.activeElement)) return;
      const selected = node.querySelector<HTMLElement>(
        'button[aria-selected="true"], button[aria-current="date"]',
      );
      const target =
        (!narrow ? node.querySelector<HTMLElement>("input") : null) ??
        selected ??
        node.querySelector<HTMLElement>("button:not(:disabled)");
      target?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      layers.splice(layers.indexOf(id), 1);
      releaseScroll();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key, true);
      if (
        previous?.isConnected &&
        (document.activeElement === document.body || panelNode?.contains(document.activeElement))
      )
        previous.focus({ preventScroll: true });
    };
  }, [ready, id, narrow, anchorRef]);

  if (!open || typeof document === "undefined" || (!narrow && !position)) return null;
  const content = (
    <LayerContext.Provider value={id}>
      <div
        ref={panel}
        role="dialog"
        aria-label={label}
        aria-modal={narrow || undefined}
        data-selection-panel={id}
        data-selection-parent={parent ?? undefined}
        style={
          narrow
            ? { maxHeight: position?.maxHeight }
            : {
                position: "fixed",
                ...position,
                maxHeight: position?.maxHeight,
              }
        }
        className={cn(
          "tv-pop tv-pick-in tv-selection-panel flex flex-col",
          narrow ? "relative w-full max-w-sm max-h-[78dvh]" : "z-[var(--tv-z-modal-top)]",
          "overflow-hidden",
        )}
      >
        <div className="tv-selection-heading">
          <span className="tv-label text-slate-400">{label}</span>
          <button type="button" onClick={onClose} className="tv-pop-nav" aria-label="×">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="tv-selection-body flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </LayerContext.Provider>
  );
  return createPortal(
    narrow ? (
      <div
        style={{
          top: position?.top,
          height: window.visualViewport?.height ?? window.innerHeight,
          bottom: "auto",
        }}
        className="tv-pick-wrap fixed inset-0 z-[var(--tv-z-modal-top)] flex items-center justify-center p-3"
      >
        <div className="tv-pick-veil absolute inset-0" aria-hidden />
        {content}
      </div>
    ) : (
      content
    ),
    document.body,
  );
}
