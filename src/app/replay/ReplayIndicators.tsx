/**
 * ReplayIndicators — la fenêtre des études.
 *
 * Deux colonnes, comme sur la plateforme de référence : le CATALOGUE à gauche
 * (ce qu'on peut poser), les études POSÉES à droite (ce qui est sur le graphe,
 * avec ses réglages). Séparer les deux évite le piège classique d'une liste
 * unique où l'on ne sait plus si un clic ajoute une étude ou en modifie une.
 *
 * Une étude posée se règle sur place : période, source, couleurs. Les
 * modifications sont appliquées À CHAQUE FRAPPE — le graphe est derrière, on
 * voit le résultat en même temps qu'on le règle, ce qui rend un bouton
 * « appliquer » inutile et un bouton « annuler » trompeur.
 *
 * L'œil (afficher/masquer) est distinct de la corbeille : couper une étude
 * pour regarder le prix nu ne doit pas coûter ses réglages.
 */

import { useEffect, useRef } from "react";
import { Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { cn } from "../utils/cn";
import { CHART_SWATCHES } from "./chartPrefs";
import {
  defaultIndicator,
  INDICATOR_SPECS,
  PRICE_SOURCES,
  type IndicatorConfig,
  type IndicatorKind,
  type PriceSource,
} from "@/modules/replay";

/** L'ordre du catalogue — le prix d'abord, les oscillateurs ensuite. */
const CATALOG: IndicatorKind[] = [
  "ma",
  "ema",
  "vwap",
  "bb",
  "volumeMa",
  "rsi",
  "macd",
  "stoch",
  "atr",
];

let seq = 0;
function nextId(): string {
  seq += 1;
  return `ind-${Date.now().toString(36)}-${seq}`;
}

function ParamField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-[10.5px] text-[var(--tv-text-muted)]">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          // Une saisie vide rend `NaN` : on ne la propage pas, sinon l'étude
          // disparaîtrait le temps d'effacer un chiffre pour en taper un autre.
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max, Math.max(min, n)));
        }}
        className="tv-figure w-16 rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-1.5 py-1 text-right text-[11px] text-[var(--tv-text)]"
      />
    </label>
  );
}

function ColorDots({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="flex items-center gap-1">
      {CHART_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            "h-3 w-3 rounded-full border transition",
            value === c
              ? "scale-125 border-[var(--tv-text)]"
              : "border-transparent opacity-60 hover:opacity-100",
          )}
          style={{ background: c }}
        />
      ))}
    </span>
  );
}

export default function ReplayIndicators({
  indicators,
  onChange,
  onClose,
}: {
  indicators: IndicatorConfig[];
  onChange: (next: IndicatorConfig[]) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  const add = (kind: IndicatorKind) => onChange([...indicators, defaultIndicator(kind, nextId())]);
  const patch = (id: string, next: Partial<IndicatorConfig>) =>
    onChange(indicators.map((i) => (i.id === id ? { ...i, ...next } : i)));
  const remove = (id: string) => onChange(indicators.filter((i) => i.id !== id));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t("rt.indicators")}
      className="absolute left-1/2 top-2 z-20 max-h-[calc(100%-1rem)] w-[min(560px,calc(100%-1rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] shadow-[var(--tv-elev-3)]"
    >
      <header className="flex items-center gap-2 border-b border-[var(--tv-border)] px-3 py-2">
        <span className="flex-1 text-[11px] font-bold text-[var(--tv-text)]">
          {t("rt.indicators")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("rt.drawClose")}
          className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="grid max-h-[60vh] grid-cols-[150px_1fr] overflow-hidden">
        {/* Le CATALOGUE */}
        <div className="overflow-y-auto border-r border-[var(--tv-border)] p-1.5">
          {CATALOG.map((kind) => {
            const spec = INDICATOR_SPECS[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => add(kind)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
              >
                <Plus className="h-3 w-3 shrink-0 opacity-60" />
                <span className="truncate">{t(spec.labelKey as TKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Les études POSÉES */}
        <div className="min-h-[220px] overflow-y-auto p-2">
          {indicators.length === 0 && (
            <p className="px-1 py-6 text-center text-[11px] text-[var(--tv-text-muted)]">
              {t("rt.noIndicators")}
            </p>
          )}
          <div className="space-y-2">
            {indicators.map((cfg) => {
              const spec = INDICATOR_SPECS[cfg.kind];
              return (
                <div
                  key={cfg.id}
                  className="rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[var(--tv-text)]">
                      {t(spec.labelKey as TKey)}
                    </span>
                    <button
                      type="button"
                      title={t("rt.toggleIndicator")}
                      aria-label={t("rt.toggleIndicator")}
                      onClick={() => patch(cfg.id, { visible: !cfg.visible })}
                      className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
                    >
                      {cfg.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title={t("rt.removeIndicator")}
                      aria-label={t("rt.removeIndicator")}
                      onClick={() => remove(cfg.id)}
                      className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] hover:text-[var(--tv-danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-1.5 space-y-1.5">
                    {spec.params.map((p) => (
                      <ParamField
                        key={p.key}
                        label={t(p.labelKey as TKey)}
                        value={cfg.params[p.key] ?? spec.defaults[p.key] ?? 0}
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        onChange={(v) => patch(cfg.id, { params: { ...cfg.params, [p.key]: v } })}
                      />
                    ))}

                    {spec.hasSource && (
                      <label className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[10.5px] text-[var(--tv-text-muted)]">
                          {t("rt.source")}
                        </span>
                        <select
                          value={cfg.source}
                          onChange={(e) => patch(cfg.id, { source: e.target.value as PriceSource })}
                          aria-label={t("rt.source")}
                          className="rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-1.5 py-1 text-[11px] text-[var(--tv-text)]"
                        >
                          {PRICE_SOURCES.map((s) => (
                            <option key={s} value={s}>
                              {t(`rt.src.${s}` as TKey)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {spec.lines.map((name, i) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[10.5px] text-[var(--tv-text-muted)]">
                          {name}
                        </span>
                        <ColorDots
                          value={cfg.colors[i] ?? spec.defaultColors[i] ?? ""}
                          onChange={(c) => {
                            const colors = [...cfg.colors];
                            colors[i] = c;
                            patch(cfg.id, { colors });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
