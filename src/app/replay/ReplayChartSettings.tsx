/**
 * ReplayChartSettings — le panneau d'apparence du graphe.
 *
 * Ce que TradingView met derrière son engrenage : les couleurs des bougies, le
 * fond, la grille, le viseur, le volume, le fuseau de l'axe des temps. Rien
 * d'autre — un panneau de réglages qui déborde sur le comportement du marché
 * mélangerait deux natures de décision.
 *
 * Chaque couleur se choisit de deux façons, et c'est délibéré : des pastilles
 * de thème pour aller vite et rester cohérent avec le reste du produit, et un
 * sélecteur libre pour ceux qui ont une palette à eux. La première voie donne
 * un jeton (`var(--tv-…)`) qui suivra les changements de thème ; la seconde un
 * hex, qui ne bougera plus — c'est le prix de la liberté, et il est assumé.
 */

import { useEffect, useRef } from "react";
import { RotateCcw, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import {
  CHART_PREFS_DEFAULT,
  CHART_SWATCHES,
  CHART_TIMEZONES,
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
        {/* Le sélecteur libre — le natif, parce qu'il connaît la machine du
          trader mieux qu'une roue chromatique réécrite à la main. */}
        <input
          type="color"
          value={hexOf(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} — ${t("rt.chartCustomColor")}`}
          title={t("rt.chartCustomColor")}
          className="h-5 w-5 cursor-pointer rounded border border-[var(--tv-border)] bg-transparent p-0"
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--tv-text-muted)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--tv-accent)]"
      />
    </label>
  );
}

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
  const set = <K extends keyof ChartPrefs>(k: K, v: ChartPrefs[K]) =>
    onChange({ ...prefs, [k]: v });

  // Échap ferme, et un clic hors du panneau aussi : un panneau de réglages ne
  // doit pas rester planté au-dessus du graphe qu'il sert à régler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // En phase de capture : sinon un clic sur le graphe, qui arrête la
    // propagation pour gérer son propre glissement, ne nous parviendrait pas.
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-2 top-2 z-10 flex w-64 flex-col gap-3 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)]/97 p-3 shadow-[var(--tv-elev-3)] backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--tv-text)]">
          {t("rt.chartSettings")}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(CHART_PREFS_DEFAULT)}
            title={t("rt.chartReset")}
            aria-label={t("rt.chartReset")}
            className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title={t("rt.drawClose")}
            aria-label={t("rt.drawClose")}
            className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <ColorRow label={t("rt.chartUp")} value={prefs.up} onChange={(v) => set("up", v)} />
        <ColorRow label={t("rt.chartDown")} value={prefs.down} onChange={(v) => set("down", v)} />
        <ColorRow
          label={t("rt.chartCrosshair")}
          value={prefs.crosshair}
          onChange={(v) => set("crosshair", v)}
        />
        <ColorRow
          label={t("rt.chartGridColor")}
          value={prefs.gridColor}
          onChange={(v) => set("gridColor", v)}
        />
      </div>

      <div className="h-px bg-[var(--tv-border)]" />

      <div className="flex flex-col gap-2">
        <Toggle label={t("rt.chartGrid")} checked={prefs.grid} onChange={(v) => set("grid", v)} />
        <Toggle
          label={t("rt.chartDashedCrosshair")}
          checked={prefs.crosshairDashed}
          onChange={(v) => set("crosshairDashed", v)}
        />
        <Toggle
          label={t("rt.chartVolume")}
          checked={prefs.volume}
          onChange={(v) => set("volume", v)}
        />
      </div>

      <div className="h-px bg-[var(--tv-border)]" />

      {/* LE FUSEAU N'EST QU'UN AFFICHAGE. Les séances restent calées sur New
        York : c'est le marché qui fixe 09:30, pas celui qui le regarde. */}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-[var(--tv-text-muted)]">{t("rt.chartTimezone")}</span>
        <select
          value={prefs.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          className="rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1.5 text-[11px] font-semibold text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
        >
          {CHART_TIMEZONES.map((tz) => (
            <option key={tz.id} value={tz.id}>
              {tz.label}
            </option>
          ))}
        </select>
        <span className="text-[9px] leading-tight text-[var(--tv-text-muted)]">
          {t("rt.chartTimezoneHint")}
        </span>
      </label>
    </div>
  );
}
