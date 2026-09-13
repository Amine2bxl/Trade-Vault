/**
 * ReplayChart — le cœur visuel du terminal.
 *
 * Wrapper `lightweight-charts` penturé aux couleurs TradeVault (variables CSS
 * de thème, pas une palette figée) : chandeliers, volume en overlay bas,
 * crosshair, axes NY, légende OHLC au survol. Le graphe est « ivre » de la vue
 * : il reçoit les bougies déjà révélées par le moteur à l'instant simulé.
 *
 * L'état du graphe (chart + séries) est exposé à l'extérieur via `refsView` :
 * l'overlay de dessins l'utilise pour convertir prix/temps → pixels.
 *
 * Le graphe possède aussi l'ÉCHELLE DE PRIX, donc c'est lui qui y répercute
 * les niveaux (`levels`) : ce que l'overlay trace dans la zone, l'axe le
 * chiffre sur son bord droit.
 */

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useTheme } from "../contexts/ThemeContext";
import type { SimulatedCandle } from "@/modules/replay";

export interface ChartView {
  chart: IChartApi | null;
  candles: ISeriesApi<"Candlestick"> | null;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Une couleur UTILISABLE PAR UN CANVAS.
 *
 * Le reste du produit écrit ses couleurs en jetons de thème — `var(--tv-…)` —
 * et c'est ce que portent les dessins et les ordres. Un canvas, lui, ne résout
 * rien : il lui faut la valeur. On la lui donne au moment du tracé, sans figer
 * la palette, donc sans casser le changement de thème.
 */
function resolveColor(c: string, fallback = "#94a3b8"): string {
  const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(c.trim());
  return m ? cssVar(m[1], fallback) : c;
}

/**
 * Un niveau répercuté sur l'ÉCHELLE DE PRIX.
 *
 * Un trait tracé dans le graphe dit « ici » ; il ne dit pas « à combien ».
 * TradingView répond en posant le prix du niveau sur l'échelle de droite, à
 * sa hauteur : le chiffre est lisible sans survoler, et reste lisible quand le
 * trait sort du champ par la gauche. C'est cette pastille-là qu'on reproduit,
 * et on la fait porter par la librairie plutôt que par l'overlay SVG : c'est
 * elle qui possède l'échelle, sa largeur et son empilement d'étiquettes.
 */
export interface ChartLevel {
  id: string;
  price: number;
  /** Jeton de thème ou hex — résolu au tracé. */
  color: string;
}

/** « 14:32 » en fuseau NY, format axis. */
function nyTick(time: Time): string {
  if (typeof time === "object" && time !== null && "year" in time) {
    const b = time as { year: number; month: number; day: number };
    return `${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;
  }
  const t = new Date((time as number) * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(t);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export interface ReplayChartProps {
  candles: SimulatedCandle[];
  refsView: MutableRefObject<ChartView>;
  /** Timeframe de vue — sert à réinitialiser l'échelle à chaque changement. */
  viewTf: string;
  /** Niveaux à répercuter sur l'échelle de prix (dessins, ordres, brackets). */
  levels?: ChartLevel[];
  /** Saisie du curseur : {time, ohlc} ou null. */
  onCrosshair?: (
    info: { time: number; o: number; h: number; l: number; c: number; v: number } | null,
  ) => void;
}

export default function ReplayChart({
  candles,
  refsView,
  viewTf,
  levels,
  onCrosshair,
}: ReplayChartProps) {
  const { active } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [ready, setReady] = useState(false);

  const themeKey = `${active.id}:${active.primary}:${active.secondary}:${active.highlight}`;

  // ── Création (une fois par thème) ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const viewTarget = refsView;

    const grid = cssVar("--tv-border", "#17212b");
    const text = cssVar("--tv-text-secondary", "#94a3b8");
    const up = cssVar("--tv-chart-green", "#22c55e");
    const down = cssVar("--tv-chart-red", "#ef4444");
    const accent = cssVar("--tv-accent", "#5e6ad2");
    const font = `'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: font,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: accent, width: 1, style: 3, labelBackgroundColor: accent },
        horzLine: { color: accent, width: 1, style: 3, labelBackgroundColor: accent },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 },
        minimumWidth: 56,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 8,
        minBarSpacing: 1.5,
        tickMarkFormatter: nyTick,
      },
      localization: {
        timeFormatter: (t: Time) => nyTick(t),
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      wickUpColor: up,
      wickDownColor: down,
      borderVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candlesRef.current = candles;
    volRef.current = vol;
    viewTarget.current.candles = candles;
    viewTarget.current.chart = chart;

    let last: { time: number; o: number; h: number; l: number; c: number; v: number } | null = null;
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || typeof param.time !== "number") {
        if (last) {
          last = null;
          onCrosshair?.(null);
        }
        return;
      }
      const bar = param.seriesData.get(candles) as
        | { open?: number; high?: number; low?: number; close?: number }
        | undefined;
      const volBar = param.seriesData.get(vol) as { value?: number } | undefined;
      last = {
        time: (param.time as number) * 1000,
        o: bar?.open ?? 0,
        h: bar?.high ?? 0,
        l: bar?.low ?? 0,
        c: bar?.close ?? 0,
        v: volBar?.value ?? 0,
      };
      onCrosshair?.(last);
    });

    setReady(true);
    return () => {
      chart.remove();
      chartRef.current = null;
      candlesRef.current = null;
      volRef.current = null;
      viewTarget.current.chart = null;
      viewTarget.current.candles = null;
    };
    // Une seule création ; un thème ne recrée pas le graphe (réapply seulement).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pousser les bougies révélées ─────────────────────────────────────────
  useEffect(() => {
    const c = candlesRef.current;
    const v = volRef.current;
    if (!c || !v) return;
    const data = candles.map((b) => ({
      time: (b.time / 1000) as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    const vols = candles.map((b) => ({
      time: (b.time / 1000) as UTCTimestamp,
      value: b.volume,
    }));
    const prevKey = keyOfRef.current;
    const nextKey = `${data.length}:${data.length ? data[data.length - 1].time : 0}`;
    if (
      prevKey &&
      prevKey.split(":")[0] === String(data.length) &&
      prevKey.endsWith(`:${data[data.length - 1]?.time}`)
    ) {
      // Seul le dernier point a bougé → `update` plutôt que `setData`.
      c.update(data[data.length - 1]);
      v.update(vols[vols.length - 1]);
    } else {
      c.setData(data);
      v.setData(vols);
    }
    keyOfRef.current = nextKey;
  }, [candles]);

  const keyOfRef = useRef<string>("");

  // ── Le thème repaint les couleurs (sans recréer le graphe) ──────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candlesRef.current;
    const vol = volRef.current;
    if (!chart || !candles || !vol) return;
    candles.applyOptions({
      upColor: cssVar("--tv-chart-green", "#22c55e"),
      downColor: cssVar("--tv-chart-red", "#ef4444"),
      wickUpColor: cssVar("--tv-chart-green", "#22c55e"),
      wickDownColor: cssVar("--tv-chart-red", "#ef4444"),
    });
    chart.applyOptions({
      layout: { textColor: cssVar("--tv-text-secondary", "#94a3b8") },
      grid: {
        vertLines: { color: cssVar("--tv-border", "#17212b") },
        horzLines: { color: cssVar("--tv-border", "#17212b") },
      },
      crosshair: {
        vertLine: {
          color: cssVar("--tv-accent", "#5e6ad2"),
          labelBackgroundColor: cssVar("--tv-accent", "#5e6ad2"),
        },
        horzLine: {
          color: cssVar("--tv-accent", "#5e6ad2"),
          labelBackgroundColor: cssVar("--tv-accent", "#5e6ad2"),
        },
      },
    });
  }, [themeKey]);

  // ── Les niveaux sur l'échelle de prix ───────────────────────────────────
  // On RÉCONCILIE plutôt qu'on ne reconstruit : les lignes de prix déjà posées
  // sont mises à jour, celles qui ont disparu sont retirées. Tout effacer pour
  // tout recréer à chaque image aurait fait clignoter l'échelle à chaque
  // déplacement d'un trait.
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  useEffect(() => {
    const series = candlesRef.current;
    if (!series) return;
    const plate = cssVar("--tv-plate-2", "#1d2125");
    const keep = new Set<string>();
    for (const lv of levels ?? []) {
      if (!Number.isFinite(lv.price)) continue;
      keep.add(lv.id);
      const color = resolveColor(lv.color);
      const opts = {
        price: lv.price,
        color,
        lineWidth: 1 as const,
        lineStyle: LineStyle.Dotted,
        // Le TRAIT est déjà dessiné par l'overlay, avec sa couleur, son style
        // et ses poignées. Le doubler d'une ligne de la librairie l'aurait
        // épaissi sans rien ajouter : on ne garde que l'étiquette d'axe.
        lineVisible: false,
        axisLabelVisible: true,
        title: "",
        // Pastille sombre, texte teinté : lisible sur tous les thèmes, là où
        // un aplat de couleur aurait rendu certains chiffres illisibles.
        axisLabelColor: plate,
        axisLabelTextColor: color,
      };
      const prev = priceLinesRef.current.get(lv.id);
      if (prev) prev.applyOptions(opts);
      else priceLinesRef.current.set(lv.id, series.createPriceLine(opts));
    }
    for (const [id, line] of priceLinesRef.current) {
      if (keep.has(id)) continue;
      series.removePriceLine(line);
      priceLinesRef.current.delete(id);
    }
  }, [levels, themeKey]);

  // ── Réinitialiser la vue quand le timeframe change ──────────────────────
  const prevTf = useRef(viewTf);
  useEffect(() => {
    if (prevTf.current === viewTf) return;
    prevTf.current = viewTf;
    chartRef.current?.timeScale().resetTimeScale();
  }, [viewTf]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!ready && <div className="absolute inset-0" />}
    </div>
  );
}
