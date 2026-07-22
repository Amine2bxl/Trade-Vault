import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * EmptyState — the one way a screen says "nothing here yet". Same glass
 * surface as everywhere else, centered, with room for a guided next step
 * (ROADMAP P2 #19: empty states become pedagogical, not dead ends).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass rounded-2xl p-10 text-center", className)}>
      {icon && <div className="mb-3 flex justify-center text-slate-600">{icon}</div>}
      <p className="text-slate-400 font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
