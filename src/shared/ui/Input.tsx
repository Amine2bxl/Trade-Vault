import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
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
  "focus:ring-cyan-500/20 transition";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    // Compact mobile (h-9) / confort desktop (h-10) — champs fins, plus denses.
    return <input ref={ref} className={cn(FIELD_BASE, "h-9 sm:h-10", className)} {...rest} />;
  },
);

// SSR : `useLayoutEffect` avertit côté serveur — on retombe sur `useEffect`.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grandit avec le contenu au lieu de faire défiler (défaut : true). */
  autoGrow?: boolean;
  /** Hauteur maximale avant défilement, en px. 0 = pas de limite. */
  maxGrowPx?: number;
}

/**
 * Textarea — le texte saisi reste TOUJOURS visible en entier.
 *
 * Une zone de texte à hauteur fixe cache ce qu'on vient d'écrire derrière une
 * barre de défilement de 3 lignes : on relit mal, donc on se relit moins. Ici
 * le champ grandit avec le contenu (jusqu'à `maxGrowPx`, puis il défile), avec
 * un interligne aéré pour la lecture.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow = true, maxGrowPx = 420, onChange, value, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = node;
    },
    [ref],
  );

  const grow = useCallback(() => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    el.style.height = "auto";
    const next = maxGrowPx > 0 ? Math.min(el.scrollHeight, maxGrowPx) : el.scrollHeight;
    el.style.height = `${next}px`;
    el.style.overflowY = maxGrowPx > 0 && el.scrollHeight > maxGrowPx ? "auto" : "hidden";
  }, [autoGrow, maxGrowPx]);

  // Layout effect : la hauteur est correcte AVANT la peinture, donc pas de
  // saut visible à l'ouverture d'une popup pré-remplie.
  useIsoLayoutEffect(grow, [grow, value]);
  useEffect(() => {
    if (!autoGrow) return;
    window.addEventListener("resize", grow);
    return () => window.removeEventListener("resize", grow);
  }, [autoGrow, grow]);

  return (
    <textarea
      ref={setRefs}
      value={value}
      onChange={(e) => {
        grow();
        onChange?.(e);
      }}
      className={cn(FIELD_BASE, "py-2.5 leading-relaxed", autoGrow && "resize-none", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} className={cn(FIELD_BASE, "h-9 sm:h-10", className)} {...rest} />;
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
