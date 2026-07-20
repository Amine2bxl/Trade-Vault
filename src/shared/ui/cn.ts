import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class-name merge helper for the design system. Self-contained so `shared/ui`
 * never imports from `app/` (preserves the dependency direction). Behaviour is
 * identical to `app/utils/cn` — clsx for conditionals, twMerge to dedupe
 * conflicting Tailwind utilities so caller overrides always win.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
