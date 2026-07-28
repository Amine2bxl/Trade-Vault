import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Chip — the app's one "bubble": a small, tappable pill used for selectable
 * tags (mistakes, confluences), quick values and inline toggles.
 *
 * The geometry is lifted verbatim from the Mistakes / Confluences blocks in
 * `TradeModal`, which were already the reference: natural width, `rounded-xl`,
 * `px-3 py-1.5`, `text-xs font-medium`, 1px border, tinted when selected. Every
 * other hand-rolled pill in the product now routes through here so size, shape,
 * spacing and states stop drifting apart between screens.
 *
 * `CHIP_ROW` is the matching container spacing — chips are always laid out in a
 * `flex-wrap` row with a 8px gutter.
 */

export type ChipTone = "accent" | "danger" | "warning" | "success";

const SELECTED: Record<ChipTone, string> = {
  accent: "bg-cyan-500/15 border-cyan-500/25 text-cyan-400",
  danger: "bg-red-500/15 border-red-500/25 text-red-400",
  warning: "bg-amber-500/15 border-amber-500/25 text-amber-400",
  success: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
};

const IDLE =
  "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-slate-600";

/** The one chip geometry. Shared by `Chip` and by chips that wrap extra controls. */
export const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-xl border text-xs font-medium transition-all";

/** Standard container for a group of chips. */
export const CHIP_ROW = "flex flex-wrap gap-2";

export function Chip({
  selected = false,
  tone = "accent",
  onClick,
  className,
  children,
  ...rest
}: {
  selected?: boolean;
  tone?: ChipTone;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className" | "children">) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(CHIP_BASE, "px-3 py-1.5", selected ? SELECTED[tone] : IDLE, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Same chip, split into a label button and a remove button, for user-created
 * tags. Keeping it here (rather than re-deriving the classes at the call site)
 * is what guarantees a removable chip is pixel-identical to a plain one.
 */
export function RemovableChip({
  selected = false,
  tone = "accent",
  onClick,
  onRemove,
  removeLabel,
  children,
}: {
  selected?: boolean;
  tone?: ChipTone;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("group", CHIP_BASE, selected ? SELECTED[tone] : IDLE)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className="pl-3 pr-1.5 py-1.5"
      >
        {children}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="pr-2 py-1.5 text-slate-600 hover:text-red-400 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeWidth="2.5" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
