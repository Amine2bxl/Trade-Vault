import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "./cn";

/**
 * Table primitives — wrap the exact markup pattern used in Journal/Analytics
 * (px-5 py-3 cells, `text-[10px] uppercase` headers, hairline row borders).
 * `TableScroll` provides the mandatory horizontal-scroll container so wide
 * tables never break the page's horizontal overflow rule.
 */

export function TableScroll({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("w-full overflow-x-auto", className)}>{children}</div>;
}

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("w-full", className)} {...rest}>
      {children}
    </table>
  );
}

export function THead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={className} {...rest}>
      {children}
    </thead>
  );
}

export function TBody({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  );
}

export function TR({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-white/[0.06]", className)} {...rest}>
      {children}
    </tr>
  );
}

export function TH({
  align = "left",
  className,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-5 py-3 text-sm text-slate-300", className)} {...rest}>
      {children}
    </td>
  );
}
