import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SegmentedControl } from "glisse";
import { ChevronDown } from "@/shared/ui/icons";
import { cn } from "./cn";
import { WhenShown } from "./WhenShown";

/**
 * Choix courts — LE CONTRÔLE SEGMENTÉ D'iOS 26 (Glisse), pleine largeur.
 *
 * Une pastille posée sur une piste de verre ; tenue ou glissée, elle se
 * soulève en lentille au-dessus des libellés. Les segments se partagent la
 * largeur du groupe à parts égales. Aucune option peut être choisie au départ
 * (`value` à `null`) : la pastille n'apparaît qu'au premier choix. Une option
 * qui porte un ton (`positive` / `negative`, ex. Long / Short) teinte la
 * pastille quand elle est choisie. Le clavier (flèches, Début, Fin) et les
 * rôles ARIA viennent de Glisse.
 */
export function ChoiceGroup<V extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: V | null;
  options: readonly { value: V; label: string; icon?: ReactNode; tone?: "positive" | "negative" }[];
  onChange: (value: V) => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const next = Math.floor(wrap.clientWidth / Math.max(1, options.length));
      setWidth((prev) => (prev === next ? prev : next));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [options.length]);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={wrapRef} className={cn("tv-choice-group", className)} data-tone={selected?.tone}>
      <WhenShown>
        <SegmentedControl
          aria-label={label}
          items={options.map((o) => ({
            value: String(o.value),
            label: (
              <span className="tv-seg-label" data-tone={o.tone}>
                {o.icon}
                <span className="tv-seg-text">{o.label}</span>
              </span>
            ),
          }))}
          value={value === null ? null : String(value)}
          onValueChange={(next) => {
            const o = options.find((x) => String(x.value) === next);
            if (o) onChange(o.value);
          }}
          style={width ? ({ "--lg-tab-width": `${width}px` } as CSSProperties) : undefined}
        />
      </WhenShown>
    </div>
  );
}

/** Les options avancées se replient sans animation de hauteur ni montage
 * d'un deuxième formulaire. Un seul patron pour tous les sous-groupes. */
export function Disclosure({
  title,
  open,
  onChange,
  children,
  className,
}: {
  title: string;
  open: boolean;
  onChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={cn("tv-disclosure", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onChange(!open)}
        className="tv-disclosure-toggle"
      >
        <span>{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-slate-500", open && "rotate-180")} />
      </button>
      {open && (
        <div id={id} className="tv-disclosure-body">
          {children}
        </div>
      )}
    </section>
  );
}
