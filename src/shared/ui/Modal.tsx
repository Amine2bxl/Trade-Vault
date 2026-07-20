import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Modal — the single dialog primitive. Replaces the hand-rolled
 * `fixed inset-0 z-50` overlays scattered across the app (TradeModal,
 * TradeDetailModal, MissedSetupDetailModal…), each of which re-implemented (or
 * skipped) the accessibility plumbing.
 *
 * Matches the existing overlay look exactly: bottom-sheet on mobile
 * (`items-end`), centered on desktop, dimmed blurred backdrop. Adds what the
 * copies lacked: `Esc` to close, background scroll-lock, `role="dialog"` +
 * `aria-modal`, and a focusable panel. Renders inline (no portal) to keep the
 * same SSR behaviour the app already relies on.
 */

export type ModalSize = "sm" | "md" | "lg";

const SIZE: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  size = "md",
  className,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  className?: string;
  /** id of the title element, for `aria-labelledby`. */
  labelledBy?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc-to-close + background scroll-lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "glass-strong relative w-full rounded-t-2xl outline-none md:rounded-2xl",
          SIZE[size],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
