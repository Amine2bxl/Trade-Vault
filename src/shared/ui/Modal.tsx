import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Modal — the single dialog primitive. Replaces the hand-rolled
 * `fixed inset-0 z-50` overlays scattered across the app, each of which
 * re-implemented (or skipped) the accessibility plumbing.
 *
 * Defaults reproduce the app's house modal style exactly: a bottom-sheet on
 * mobile (`items-end`) that centers on desktop, a dimmed blurred backdrop, and
 * a `glass-strong` rounded panel with the standard slide-in animation. Callers
 * pass only what's distinctive (max width/height, overflow) via `className`,
 * and can override the backdrop or wrapper when a modal differs.
 *
 * Adds what the hand-rolled copies lacked: `Esc` to close, background
 * scroll-lock, `role="dialog"` + `aria-modal`, and a focusable panel. Renders
 * inline (no portal) to keep the same SSR behaviour the app relies on.
 */

export type ModalSize = "sm" | "md" | "lg";

const SIZE: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional convenience max-width. Omit and pass a max-width in `className`
   *  for exact control (used when migrating existing modals verbatim). */
  size?: ModalSize;
  /** Extra classes on the panel (max width/height, overflow, layout). */
  className?: string;
  /** Override the backdrop (e.g. a stronger dim/blur). Merged over the default. */
  backdropClassName?: string;
  /** Override the positioning wrapper (e.g. a different z-index or alignment). */
  wrapperClassName?: string;
  /** id of the title element, for `aria-labelledby`. */
  labelledBy?: string;
  /** Close when the backdrop is clicked (default true). */
  closeOnBackdrop?: boolean;
  /** Lock background scroll while open (default true). */
  lockScroll?: boolean;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  size,
  className,
  backdropClassName,
  wrapperClassName,
  labelledBy,
  closeOnBackdrop = true,
  lockScroll = true,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc-to-close + optional background scroll-lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (lockScroll) document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, lockScroll]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4",
        wrapperClassName,
      )}
    >
      <div
        className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm", backdropClassName)}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "glass-strong relative w-full rounded-t-3xl outline-none shadow-2xl shadow-black/50",
          "animate-slide-up md:rounded-3xl md:animate-slide-in",
          size && SIZE[size],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
