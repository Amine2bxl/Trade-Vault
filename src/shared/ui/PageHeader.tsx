import type { ReactNode } from "react";
import { cn } from "./cn";
import { density, type } from "./tokens";

/**
 * Page accents — each screen keeps the shared header structure but carries its
 * own hue, so the product reads as one system while pages stop looking like
 * copies of each other (Dashboard = overview, Journal = tool, Analytics =
 * analysis, Jarvis = coach, Mistakes = progress, Goals = motivation…).
 */
export type PageAccent = "cyan" | "sky" | "violet" | "amber" | "emerald" | "rose";

const ACCENT_CHIP: Record<PageAccent, string> = {
  cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
  sky: "bg-sky-500/10 border-sky-500/20 text-sky-400",
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
};

/**
 * PageHeader — the single page-title pattern of the app. Encodes the exact
 * gradient headline + muted subtitle markup that was previously duplicated at
 * the top of ~15 pages, so every screen shares one hierarchy and future
 * evolutions (density, type scale) happen in one place.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  accent,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional small accent line above the title (greeting, breadcrumb). */
  eyebrow?: ReactNode;
  /** Optional icon rendered inline, just before the title text. */
  icon?: ReactNode;
  /** Page identity hue — wraps `icon` in a tinted chip. */
  accent?: PageAccent;
  /** Right-aligned actions (primary CTA, filters). */
  actions?: ReactNode;
  className?: string;
}) {
  const iconEl =
    icon && accent ? (
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
          ACCENT_CHIP[accent],
        )}
      >
        {icon}
      </span>
    ) : (
      icon
    );
  return (
    <div
      className={cn(
        density.sectionGap,
        "animate-fade-in-up flex items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow}
        <div className="flex items-center gap-2.5">
          {iconEl}
          <h1
            className={cn(
              type.h1,
              "bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent",
            )}
          >
            {title}
          </h1>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * SectionHeader — intra-page section title (above a card group or table).
 * One consistent size step below PageHeader, with optional right-side action.
 */
export function SectionHeader({
  title,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between gap-2", className)}>
      <h2 className={cn("flex items-center gap-2 text-white", type.h2)}>
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
