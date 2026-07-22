import type { ReactNode } from "react";
import { cn } from "./cn";

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
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional small accent line above the title (greeting, breadcrumb). */
  eyebrow?: ReactNode;
  /** Optional icon rendered inline, just before the title text. */
  icon?: ReactNode;
  /** Right-aligned actions (primary CTA, filters). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 md:mb-6 animate-fade-in-up flex items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow}
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {title}
          </h1>
        </div>
        {subtitle && <p className="text-xs md:text-sm text-slate-500 mt-1">{subtitle}</p>}
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
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="flex items-center gap-2 text-sm md:text-base font-bold text-white">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
