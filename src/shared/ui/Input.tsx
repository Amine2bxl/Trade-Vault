import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";
import { Label } from "./Typography";

/**
 * Form controls — one field skin for the whole app. `FIELD_BASE` is the exact
 * class string already duplicated across TradeModal / Journal / LotSizeCalculator
 * / TradingPlan, so adopting these renders identically while removing the copies.
 */

export const FIELD_BASE =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white " +
  "placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 " +
  "focus:ring-cyan-500/20 transition-all";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, "h-11", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(FIELD_BASE, "py-2.5", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} className={cn(FIELD_BASE, "h-11", className)} {...rest} />;
  },
);

/**
 * Field — label + control + optional error, stacked with the standard spacing
 * used in the product's forms. Pass the control as children.
 */
export function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label != null && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error != null && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
