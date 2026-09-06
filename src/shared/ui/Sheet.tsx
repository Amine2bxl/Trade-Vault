import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { type } from "./tokens";

/**
 * Sheet — LE PANNEAU QUI ENTRE PAR UN BORD.
 *
 * `Modal` coupe la tâche : elle se pose au centre, assombrit tout, et attend
 * une réponse. C'est la bonne forme pour une confirmation ou un formulaire de
 * trade.
 *
 * Ce n'en est PAS une pour des réglages qu'on ajuste en regardant le résultat
 * changer. Une feuille entre par la droite (desktop) ou par le bas (mobile),
 * garde le contenu visible et lisible derrière elle, et se ferme d'un geste.
 * Le voile est volontairement léger — il désigne le panneau, il ne cache pas
 * ce qu'on est en train de régler.
 *
 * Elle emprunte à `Modal` tout ce qui est de l'accessibilité et rien d'autre :
 * `Esc`, verrou de défilement, `role="dialog"`, `aria-modal`, panneau
 * focalisable.
 */

export function Sheet({
  open,
  onClose,
  title,
  /** Ligne d'aide sous le titre. */
  subtitle,
  /** Actions du pied (réinitialiser, appliquer…). */
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--tv-z-sheet)] flex items-end justify-center sm:items-stretch sm:justify-end">
      {/* Le voile est FAIBLE et sans flou : ce qu'on règle doit rester lisible
          derrière la feuille, sinon on règle à l'aveugle. */}
      <div className="absolute inset-0 bg-black/45 sm:bg-black/35" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "glass-strong tv-sheet-in relative flex max-h-[88vh] w-full flex-col rounded-t-3xl outline-none",
          "shadow-2xl shadow-black/50",
          "sm:max-h-none sm:w-[380px] sm:rounded-none sm:rounded-l-3xl sm:border-l sm:border-[var(--tv-border)]",
          className,
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--tv-border)] px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="tv-title truncate">{title}</h2>
            {subtitle && <p className={cn(type.hint, "mt-0.5")}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth="2" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center gap-2 border-t border-[var(--tv-border)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
