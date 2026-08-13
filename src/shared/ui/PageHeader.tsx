import type { ReactNode } from "react";
import { cn } from "./cn";
import { density, type } from "./tokens";

/**
 * PageHeader — the single page-title pattern of the app. Encodes the exact
 * headline + muted subtitle markup that was previously duplicated at the top of
 * ~15 pages, so every screen shares one hierarchy and future evolutions
 * (density, type scale) happen in one place.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  className,
}: {
  /** Page title. Omit when the active tab / bubble already names the screen. */
  title?: ReactNode;
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
        density.sectionGap,
        "animate-fade-in-up flex items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow}
        {title && (
          <div className="flex items-center gap-2.5">
            {icon}
            <h1 className={cn(type.h1, "text-primary")}>{title}</h1>
          </div>
        )}
        {subtitle && <p className={cn(type.caption, "text-tertiary mt-1")}>{subtitle}</p>}
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
      <h2 className={cn("flex items-center gap-2 text-primary", type.h2)}>
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
