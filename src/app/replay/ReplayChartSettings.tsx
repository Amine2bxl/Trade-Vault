/**
 * ReplayChartSettings — le panneau de réglages du graphe.
 *
 * Ce qu'une plateforme de graphes met derrière son engrenage, rangé en trois
 * onglets parce que ce sont trois natures de décision :
 *
 *  • GRAPHE — le type de tracé, les couleurs, la grille, le viseur ;
 *  • ÉCHELLES — le mode de l'axe des prix, le dernier cours, le fuseau ;
 *  • TRADING — ce que le graphe montre de la séance : ordres, ombrage.
 *
 * Chaque couleur se choisit de deux façons, et c'est délibéré : des pastilles
 * de thème pour aller vite et rester cohérent avec le reste du produit, et un
 * sélecteur libre pour ceux qui ont une palette à eux. La première voie donne
 * un jeton (`var(--tv-…)`) qui suivra les changements de thème ; la seconde un
 * hex, qui ne bougera plus — c'est le prix de la liberté, et il est assumé.
 *
 * Le panneau NE TOUCHE PAS aux indicateurs : ceux-ci ont leur propre fenêtre
 * (`ReplayIndicators`), parce qu'ajouter une étude est un geste d'analyse, pas
 * un réglage d'apparence.
 */

import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { cn } from "../utils/cn";
import {
  CHART_PREFS_DEFAULT,
  CHART_SWATCHES,
  CHART_TIMEZONES,
  CHART_TYPES,
  type ChartPrefs,
} from "./chartPrefs";

/** Une valeur utilisable par `<input type="color">` — donc un vrai hex. */
function hexOf(value: string): string {
  if (value.startsWith("#")) return value;
  if (typeof window === "undefined") return "#000000";
  const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(value.trim());
  const raw = m
    ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
    : value.trim();
  return raw.startsWith("#") ? raw.slice(0, 7) : "#000000";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="tv-label text-[9.5px] text-[var(--tv-text-muted)]">{title}</p>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--tv-text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {CHART_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={label}
            aria-label={`${label} — ${c}`}
            onClick={() => onChange(c)}
            className={cn(
              "h-4 w-4 rounded-full border transition",
              value === c
                ? "scale-110 border-[var(--tv-text)]"
                : "border-transparent opacity-70 hover:opacity-100",
            )}
            style={{ background: c }}
          />
        ))}
        <label
          className="ml-0.5 grid h-4 w-4 cursor-pointer place-items-center rounded-full border border-[var(--tv-border-strong)]"
          title={t("rt.chartCustomColor")}
          style={{ background: hexOf(value) }}
        >
          <input
            type="color"
            className="sr-only"
            value={hexOf(value)}
            onChange={(e) => onChange(e.target.value)}
            aria-label={t("rt.chartCustomColor")}
          />
        </label>
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-[var(--tv-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-[11px] text-[var(--tv-text)]">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[10px] leading-snug text-[var(--tv-text-muted)]">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

/** Un choix parmi trois ou sept — des pastilles, pas un menu déroulant. */
function ChipRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md px-2 py-1 text-[10.5px] font-semibold transition",
            value === o.id
              ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
              : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Tab = "chart" | "scales" | "trading";

export default function ReplayChartSettings({
  prefs,
  onChange,
  onClose,
}: {
  prefs: ChartPrefs;
  onChange: (next: ChartPrefs) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<Tab>("chart");
  const set = <K extends keyof ChartPrefs>(key: K, value: ChartPrefs[K]) =>
    onChange({ ...prefs, [key]: value });

  // Échap referme, et un clic au-dehors aussi : un panneau posé PAR-DESSUS le
  // graphe qu'il règle doit pouvoir disparaître sans viser sa croix.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // `mousedown` en capture : le graphe avale les clics de sa zone de tracé.
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  const TABS: { id: Tab; key: TKey }[] = [
    { id: "chart", key: "rt.tabChart" },
    { id: "scales", key: "rt.tabScales" },
    { id: "trading", key: "rt.tabTrading" },
  ];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t("rt.chartSettings")}
      className="absolute right-2 top-2 z-20 max-h-[calc(100%-1rem)] w-[280px] overflow-y-auto rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] shadow-[var(--tv-elev-3)]"
    >
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2">
        <span className="flex-1 text-[11px] font-bold text-[var(--tv-text)]">
          {t("rt.chartSettings")}
        </span>
        <button
          type="button"
          onClick={() => onChange({ ...CHART_PREFS_DEFAULT, indicators: prefs.indicators })}
          title={t("rt.chartReset")}
          aria-label={t("rt.chartReset")}
          className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("rt.drawClose")}
          className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex gap-0.5 border-b border-[var(--tv-border)] px-2 py-1.5">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[10.5px] font-semibold transition",
              tab === tb.id
                ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
            )}
          >
            {t(tb.key)}
          </button>
        ))}
      </div>

      <div className="space-y-3.5 p-3">
        {tab === "chart" && (
          <>
            <Section title={t("rt.chartType")}>
              <ChipRow
                value={prefs.chartType}
                onChange={(v) => set("chartType", v)}
                options={CHART_TYPES.map((c) => ({ id: c.id, label: t(c.labelKey as TKey) }))}
              />
            </Section>

            <Section title={t("rt.chartUp")}>
              <ColorRow label={t("rt.chartUp")} value={prefs.up} onChange={(v) => set("up", v)} />
              <ColorRow
                label={t("rt.chartDown")}
                value={prefs.down}
                onChange={(v) => set("down", v)}
              />
              <ColorRow
                label={t("rt.chartWickUp")}
                value={prefs.wickUp}
                onChange={(v) => set("wickUp", v)}
              />
              <ColorRow
                label={t("rt.chartWickDown")}
                value={prefs.wickDown}
                onChange={(v) => set("wickDown", v)}
              />
              <SwitchRow
                label={t("rt.chartBorders")}
                checked={prefs.borders}
                onChange={(v) => set("borders", v)}
              />
            </Section>

            <Section title={t("rt.chartGrid")}>
              <SwitchRow
                label={t("rt.chartGrid")}
                checked={prefs.grid}
                onChange={(v) => set("grid", v)}
              />
              <SwitchRow
                label={t("rt.chartGridVertical")}
                checked={prefs.gridVertical}
                onChange={(v) => set("gridVertical", v)}
              />
              <ColorRow
                label={t("rt.chartGridColor")}
                value={prefs.gridColor}
                onChange={(v) => set("gridColor", v)}
              />
            </Section>

            <Section title={t("rt.crosshairMode")}>
              <ChipRow
                value={prefs.crosshairMode}
                onChange={(v) => set("crosshairMode", v)}
                options={[
                  { id: "off" as const, label: t("rt.crosshairOff") },
                  { id: "normal" as const, label: t("rt.crosshairNormal") },
                  { id: "magnet" as const, label: t("rt.crosshairMagnet") },
                ]}
              />
              {prefs.crosshairMode === "off" ? (
                <p className="text-[10px] leading-snug text-[var(--tv-text-muted)]">
                  {t("rt.crosshairOffHint")}
                </p>
              ) : (
                <>
                  <ColorRow
                    label={t("rt.chartCrosshair")}
                    value={prefs.crosshair}
                    onChange={(v) => set("crosshair", v)}
                  />
                  <SwitchRow
                    label={t("rt.chartDashedCrosshair")}
                    checked={prefs.crosshairDashed}
                    onChange={(v) => set("crosshairDashed", v)}
                  />
                </>
              )}
            </Section>

            <Section title={t("rt.legend")}>
              <SwitchRow
                label={t("rt.legend")}
                checked={prefs.legend}
                onChange={(v) => set("legend", v)}
              />
              <SwitchRow
                label={t("rt.chartVolume")}
                checked={prefs.volume}
                onChange={(v) => set("volume", v)}
              />
            </Section>
          </>
        )}

        {tab === "scales" && (
          <>
            <Section title={t("rt.scaleMode")}>
              <ChipRow
                value={prefs.priceScaleMode}
                onChange={(v) => set("priceScaleMode", v)}
                options={[
                  { id: "normal" as const, label: t("rt.scaleNormal") },
                  { id: "log" as const, label: t("rt.scaleLog") },
                  { id: "percent" as const, label: t("rt.scalePercent") },
                ]}
              />
              <SwitchRow
                label={t("rt.lastPriceLine")}
                checked={prefs.lastPriceLine}
                onChange={(v) => set("lastPriceLine", v)}
              />
              <SwitchRow
                label={t("rt.countdown")}
                checked={prefs.countdown}
                onChange={(v) => set("countdown", v)}
              />
            </Section>

            <Section title={t("rt.chartTimezone")}>
              <select
                value={prefs.timezone}
                onChange={(e) => set("timezone", e.target.value)}
                aria-label={t("rt.chartTimezone")}
                className="w-full rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1.5 text-[11px] text-[var(--tv-text)]"
              >
                {CHART_TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] leading-snug text-[var(--tv-text-muted)]">
                {t("rt.chartTimezoneHint")}
              </p>
            </Section>
          </>
        )}

        {tab === "trading" && (
          <Section title={t("rt.tabTrading")}>
            <SwitchRow
              label={t("rt.showOrders")}
              checked={prefs.showOrders}
              onChange={(v) => set("showOrders", v)}
            />
            <SwitchRow
              label={t("rt.sessionShading")}
              checked={prefs.sessionShading}
              onChange={(v) => set("sessionShading", v)}
            />
          </Section>
        )}
      </div>
    </div>
  );
}
