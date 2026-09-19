/**
 * ReplayChart — le cœur visuel du terminal.
 *
 * Wrapper `lightweight-charts` penturé aux couleurs TradeVault (variables CSS
 * de thème, pas une palette figée). Il rend ce qu'une plateforme de graphes
 * rend :
 *
 *  • SEPT TYPES DE TRACÉ — bougies pleines, creuses, barres OHLC, ligne, aire,
 *    ligne de base, Heikin-Ashi ;
 *  • LES ÉTUDES — moyennes, VWAP, Bollinger sur le prix ; RSI, MACD, ATR,
 *    stochastique dans leur propre volet, empilés sous le prix comme sur la
 *    plateforme de référence ;
 *  • L'ÉCHELLE — linéaire, logarithmique ou en pourcentage, trait du dernier
 *    cours, compte à rebours de la bougie en cours ;
 *  • LA LÉGENDE — OHLC de la bougie survolée et valeur de chaque étude à cet
 *    instant, remontées à l'appelant plutôt que peintes ici.
 *
 * Le graphe est « ivre » de la vue : il reçoit les bougies déjà révélées par
 * le moteur à l'instant simulé, jamais le futur.
 *
 * L'état du graphe (chart + série principale) est exposé via `refsView` :
 * l'overlay de dessins l'utilise pour convertir prix/temps → pixels, et le
 * terminal s'en sert pour capturer l'image d'un trade.
 */

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  createChart,
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useTheme } from "../contexts/ThemeContext";
import { CHART_PREFS_DEFAULT, type ChartPrefs } from "./chartPrefs";
import {
  computeIndicator,
  heikinAshi,
  INDICATOR_SPECS,
  nyDateOf,
  type OhlcBar,
  type SimulatedCandle,
} from "@/modules/replay";

export interface ChartView {
  chart: IChartApi | null;
  candles: ISeriesApi<SeriesType> | null;
}

/** Ce que la légende affiche pour une étude — son titre et ses valeurs. */
export interface LegendStudy {
  id: string;
  title: string;
  values: { name: string; value: number | null; color: string }[];
}

/** Tout ce que la barre de légende doit dire, à l'instant visé. */
export interface LegendInfo {
  time: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** Variation par rapport à l'ouverture de la bougie, en points et en %. */
  change: number;
  changePct: number;
  studies: LegendStudy[];
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

/** La même couleur, transparente à `alpha` — pour les aplats d'aire. */
function fade(c: string, alpha: number): string {
  const hex = resolveColor(c);
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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

/**
 * « 09-12 14:32 » dans le fuseau choisi, format axe.
 *
 * Le fuseau n'est qu'une LANGUE : les horodatages restent les mêmes instants,
 * et les séances restent calées sur New York. Lire l'axe en heure de Bruxelles
 * ne déplace pas l'ouverture de 09:30, ça la dit autrement.
 *
 * Un fuseau invalide ne doit pas faire tomber le graphe : `Intl` lève sur un
 * identifiant inconnu, et un axe muet vaut mieux qu'un écran blanc.
 */
function tickIn(time: Time, timeZone: string): string {
  if (typeof time === "object" && time !== null && "year" in time) {
    const b = time as { year: number; month: number; day: number };
    return `${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;
  }
  const t = new Date((time as number) * 1000);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(t);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(t);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** Le début d'une séance — l'ancre du VWAP. Un changement de jour NY. */
function isSessionStart(bar: OhlcBar, prev: OhlcBar): boolean {
  return nyDateOf(bar.time) !== nyDateOf(prev.time);
}

const SCALE_MODES: Record<ChartPrefs["priceScaleMode"], PriceScaleMode> = {
  normal: PriceScaleMode.Normal,
  log: PriceScaleMode.Logarithmic,
  percent: PriceScaleMode.Percentage,
};

const CROSSHAIR_MODES: Record<ChartPrefs["crosshairMode"], CrosshairMode> = {
  off: CrosshairMode.Hidden,
  normal: CrosshairMode.Normal,
  magnet: CrosshairMode.Magnet,
};

export interface ReplayChartProps {
  candles: SimulatedCandle[];
  refsView: MutableRefObject<ChartView>;
  /** Timeframe de vue — sert à réinitialiser l'échelle à chaque changement. */
  viewTf: string;
  /** Niveaux à répercuter sur l'échelle de prix (dessins, ordres, brackets). */
  levels?: ChartLevel[];
  /** L'apparence réglée par le trader — couleurs, grille, viseur, études. */
  prefs?: ChartPrefs;
  /** Saisie du curseur — `null` quand il quitte la zone de tracé. */
  onCrosshair?: (info: LegendInfo | null) => void;
}

/** Ce que le graphe doit RECRÉER quand cela change, plutôt que ré-appliquer. */
function shapeKeyOf(prefs: ChartPrefs): string {
  return [
    prefs.chartType,
    ...prefs.indicators.map((i) => `${i.id}:${i.kind}:${i.visible ? 1 : 0}`),
  ].join("|");
}

export default function ReplayChart({
  candles,
  refsView,
  viewTf,
  levels,
  prefs = CHART_PREFS_DEFAULT,
  onCrosshair,
}: ReplayChartProps) {
  const { active } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  /** Une entrée par LIGNE d'étude — clé `configId#lineIndex`. */
  const studyRef = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const [ready, setReady] = useState(false);
  /** Les étiquettes d'axe posées sur la série du prix, par identifiant. */
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  // Les formateurs de l'axe vivent aussi longtemps que le graphe : ils lisent
  // le fuseau dans une ref, sinon ils resteraient collés à celui du montage.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const themeKey = `${active.id}:${active.primary}:${active.secondary}:${active.highlight}`;
  const shapeKey = shapeKeyOf(prefs);

  // ── Les données affichées ───────────────────────────────────────────────
  // Heikin-Ashi n'est pas une étude : c'est une TRANSFORMATION des bougies. On
  // la pose ici, une fois, pour que la légende, les études et le tracé lisent
  // tous la même série — sinon la légende afficherait un OHLC que le graphe ne
  // montre pas.
  const shown = useMemo<OhlcBar[]>(
    () => (prefs.chartType === "heikin" ? heikinAshi(candles) : candles),
    [candles, prefs.chartType],
  );

  /** Les études calculées — une entrée par configuration visible. */
  const studies = useMemo(() => {
    return prefs.indicators
      .filter((cfg) => cfg.visible)
      .map((cfg) => ({ cfg, lines: computeIndicator(cfg, shown, isSessionStart) }));
  }, [prefs.indicators, shown]);
  const studiesRef = useRef(studies);
  studiesRef.current = studies;

  // ── Création (une fois) ─────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const viewTarget = refsView;

    const grid = cssVar("--tv-border", "#17212b");
    const text = cssVar("--tv-text-secondary", "#94a3b8");
    const font = `'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: font,
        fontSize: 11,
        attributionLogo: false,
        // Le séparateur entre volets — c'est lui qui rend l'empilement RSI /
        // MACD lisible plutôt que collé.
        panes: { separatorColor: grid, separatorHoverColor: grid, enableResize: true },
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 },
        minimumWidth: 62,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 8,
        minBarSpacing: 1.5,
        tickMarkFormatter: (t: Time) => tickIn(t, prefsRef.current.timezone),
      },
      localization: {
        timeFormatter: (t: Time) => tickIn(t, prefsRef.current.timezone),
      },
    });

    chartRef.current = chart;
    viewTarget.current.chart = chart;

    setReady(true);
    return () => {
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
      volRef.current = null;
      studyRef.current.clear();
      viewTarget.current.chart = null;
      viewTarget.current.candles = null;
    };
    // Une seule création ; ni le thème ni les réglages ne recréent le graphe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── La SÉRIE PRINCIPALE et les séries d'étude ───────────────────────────
  //
  // Changer de type de graphe ou d'étude change la NATURE des séries : la
  // librairie ne convertit pas une série ligne en bougies. On les reconstruit
  // donc, mais seulement quand la forme change — pas à chaque battement de
  // l'horloge, ni à chaque réglage de couleur.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const viewTarget = refsView;

    const p = prefsRef.current;
    const up = resolveColor(p.up, "#22c55e");
    const down = resolveColor(p.down, "#ef4444");

    const main = ((): ISeriesApi<SeriesType> => {
      const common = { priceLineVisible: false, lastValueVisible: false };
      switch (p.chartType) {
        case "line":
          return chart.addSeries(LineSeries, { ...common, color: up, lineWidth: 2 });
        case "area":
          return chart.addSeries(AreaSeries, {
            ...common,
            lineColor: up,
            topColor: fade(p.up, 0.28),
            bottomColor: fade(p.up, 0.02),
            lineWidth: 2,
          });
        case "baseline":
          return chart.addSeries(BaselineSeries, {
            ...common,
            topLineColor: up,
            bottomLineColor: down,
            topFillColor1: fade(p.up, 0.28),
            topFillColor2: fade(p.up, 0.02),
            bottomFillColor1: fade(p.down, 0.02),
            bottomFillColor2: fade(p.down, 0.28),
          });
        case "bars":
          return chart.addSeries(BarSeries, {
            ...common,
            upColor: up,
            downColor: down,
            thinBars: false,
          });
        case "hollow":
          // Bougies CREUSES : le corps haussier n'est qu'un contour. On le
          // rend en peignant le corps de la couleur du fond de la zone —
          // « transparent » ne convient pas ici, il laisserait passer la
          // grille au travers du corps.
          return chart.addSeries(CandlestickSeries, {
            ...common,
            upColor: "rgba(0,0,0,0)",
            downColor: down,
            borderUpColor: up,
            borderDownColor: down,
            borderVisible: true,
            wickUpColor: up,
            wickDownColor: down,
          });
        case "candles":
        case "heikin":
        default:
          return chart.addSeries(CandlestickSeries, {
            ...common,
            upColor: up,
            downColor: down,
            borderVisible: p.borders,
            borderUpColor: up,
            borderDownColor: down,
            wickUpColor: resolveColor(p.wickUp, "#22c55e"),
            wickDownColor: resolveColor(p.wickDown, "#ef4444"),
          });
      }
    })();

    const vol = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        lastValueVisible: false,
        priceLineVisible: false,
      },
      0,
    );
    chart.priceScale("vol", 0).applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    mainRef.current = main;
    volRef.current = vol;
    viewTarget.current.candles = main;

    // Les études : les « overlay » vivent dans le volet du prix, les autres
    // reçoivent chacune le leur, empilés sous le prix.
    const created = new Map<string, ISeriesApi<SeriesType>>();
    let paneIndex = 0;
    for (const { cfg, lines } of studiesRef.current) {
      const spec = INDICATOR_SPECS[cfg.kind];
      const ownPane = spec.placement === "pane";
      if (ownPane) paneIndex += 1;
      const target = ownPane ? paneIndex : 0;
      lines.forEach((line, i) => {
        const key = `${cfg.id}#${i}`;
        const color = resolveColor(line.color);
        const series =
          line.style === "histogram"
            ? chart.addSeries(
                HistogramSeries,
                { color, priceLineVisible: false, lastValueVisible: false },
                target,
              )
            : chart.addSeries(
                LineSeries,
                {
                  color,
                  lineWidth: 2,
                  priceLineVisible: false,
                  lastValueVisible: false,
                  crosshairMarkerVisible: false,
                },
                target,
              );
        created.set(key, series);
      });
      // Un volet d'étude prend moins de place que le prix : sans facteur
      // d'étirement, trois études écraseraient les bougies en une bande.
      if (ownPane) {
        const pane = chart.panes()[target];
        if (pane) pane.setStretchFactor(0.28);
      }
    }
    studyRef.current = created;
    // Les lignes de prix appartenaient à la série PRÉCÉDENTE, partie avec elle.
    // Les garder en mémoire ferait appliquer des options à des objets morts au
    // premier changement de niveau — et le graphe ne s'en relèverait pas.
    priceLinesRef.current.clear();

    return () => {
      // AU DÉMONTAGE, LE GRAPHE PART EN PREMIER. React appelle les nettoyages
      // dans l'ordre de déclaration des effets, et celui qui crée le graphe est
      // déclaré avant celui-ci : quand il a déjà appelé `chart.remove()`,
      // retirer une série lèverait sur un objet disposé. `chartRef` remis à
      // `null` est le signal qui le dit.
      if (chartRef.current === chart) {
        for (const s of created.values()) chart.removeSeries(s);
        chart.removeSeries(vol);
        chart.removeSeries(main);
      }
      created.clear();
      priceLinesRef.current.clear();
      mainRef.current = null;
      volRef.current = null;
      viewTarget.current.candles = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shapeKey]);

  // ── Pousser les bougies révélées ─────────────────────────────────────────
  const keyOfRef = useRef<string>("");
  useEffect(() => {
    const main = mainRef.current;
    const v = volRef.current;
    if (!main || !v) return;
    const p = prefsRef.current;
    const asLine = p.chartType === "line" || p.chartType === "area" || p.chartType === "baseline";

    const data = shown.map((b) =>
      asLine
        ? { time: (b.time / 1000) as UTCTimestamp, value: b.close }
        : {
            time: (b.time / 1000) as UTCTimestamp,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          },
    );
    const upC = resolveColor(p.up, "#22c55e");
    const downC = resolveColor(p.down, "#ef4444");
    const vols = shown.map((b) => ({
      time: (b.time / 1000) as UTCTimestamp,
      value: b.volume,
      // Le volume prend LA COULEUR DE SA BOUGIE, comme sur la plateforme : une
      // barre de volume grise ne dit pas si le flux a poussé ou vendu.
      color: fade(b.close >= b.open ? upC : downC, 0.45),
    }));

    const lastTime = data.length ? (data[data.length - 1].time as number) : 0;
    const nextKey = `${p.chartType}:${data.length}:${lastTime}`;
    const prevKey = keyOfRef.current;
    // Seul le dernier point a bougé → `update` plutôt que `setData` : c'est ce
    // qui garde le déplacement et le zoom du trader pendant la lecture.
    if (prevKey === nextKey && data.length > 0) {
      main.update(data[data.length - 1]);
      v.update(vols[vols.length - 1]);
    } else {
      main.setData(data);
      v.setData(vols);
    }
    keyOfRef.current = nextKey;
  }, [shown, shapeKey]);

  // ── Pousser les valeurs des études ──────────────────────────────────────
  //
  // `setData` REDONNE TOUTE LA SÉRIE à la librairie, qui la revalide et la
  // recale. Pendant la lecture, cet effet se rejoue à chaque image — la bougie
  // en cours se forme en continu — et repousser mille points par ligne, dix
  // lignes, soixante fois par seconde, suffit à faire saccader le graphe.
  //
  // Or entre deux images, seule la DERNIÈRE valeur a bougé : tant que le
  // nombre de bougies et l'horodatage de la dernière ne changent pas, une
  // simple `update` du dernier point dit exactement la même chose, pour un
  // coût constant. La série entière n'est renvoyée que quand une bougie
  // apparaît, que l'unité de temps change, ou que l'étude est reconstruite.
  const studyKeyRef = useRef<string>("");
  useEffect(() => {
    const map = studyRef.current;
    if (!map.size) return;
    const len = shown.length;
    const lastTime = len ? shown[len - 1].time : 0;
    const key = `${shapeKey}:${len}:${lastTime}`;
    const sameBar = studyKeyRef.current === key;
    studyKeyRef.current = key;

    for (const { cfg, lines } of studies) {
      lines.forEach((line, i) => {
        const series = map.get(`${cfg.id}#${i}`);
        if (!series) return;
        const points = line.points
          .filter((pt) => pt.value != null)
          .map((pt) => ({ time: (pt.time / 1000) as UTCTimestamp, value: pt.value as number }));
        const last = points[points.length - 1];
        // L'étude doit AVOIR une valeur sur la dernière bougie pour qu'une
        // mise à jour ponctuelle suffise : une EMA encore en chauffe n'en a
        // pas, et c'est alors la série entière qu'il faut redonner.
        if (sameBar && last && last.time === ((lastTime / 1000) as UTCTimestamp)) {
          series.update(last);
          return;
        }
        series.setData(points);
      });
    }
  }, [studies, shown, shapeKey]);

  // ── L'APPARENCE — thème du produit ET réglages du trader ────────────────
  // Un seul effet pour les deux : ce sont deux sources pour une même image, et
  // les séparer aurait laissé la dernière écraser l'autre selon l'ordre des
  // rendus. Rien n'est recréé, tout est ré-appliqué.
  useEffect(() => {
    const chart = chartRef.current;
    const main = mainRef.current;
    const vol = volRef.current;
    if (!chart || !main || !vol) return;
    const up = resolveColor(prefs.up, "#22c55e");
    const down = resolveColor(prefs.down, "#ef4444");
    const cross = resolveColor(prefs.crosshair, "#94a3b8");
    const grid = resolveColor(prefs.gridColor, "#17212b");

    switch (prefs.chartType) {
      case "line":
        main.applyOptions({ color: up, lineWidth: 2 });
        break;
      case "area":
        main.applyOptions({
          lineColor: up,
          topColor: fade(prefs.up, 0.28),
          bottomColor: fade(prefs.up, 0.02),
        });
        break;
      case "baseline":
        main.applyOptions({ topLineColor: up, bottomLineColor: down });
        break;
      case "bars":
        main.applyOptions({ upColor: up, downColor: down });
        break;
      case "hollow":
        main.applyOptions({
          upColor: "rgba(0,0,0,0)",
          downColor: down,
          borderUpColor: up,
          borderDownColor: down,
          wickUpColor: up,
          wickDownColor: down,
        });
        break;
      default:
        main.applyOptions({
          upColor: up,
          downColor: down,
          borderVisible: prefs.borders,
          borderUpColor: up,
          borderDownColor: down,
          wickUpColor: resolveColor(prefs.wickUp, "#22c55e"),
          wickDownColor: resolveColor(prefs.wickDown, "#ef4444"),
        });
    }

    // Le trait du dernier cours et son étiquette d'axe — la plateforme les
    // porte sur la série du prix, pas sur un niveau à part.
    main.applyOptions({
      priceLineVisible: prefs.lastPriceLine,
      lastValueVisible: prefs.lastPriceLine,
      priceLineStyle: LineStyle.Dashed,
      priceLineWidth: 1,
    });

    // Le volume se coupe sans se démonter : le rallumer doit être immédiat, et
    // reconstruire la série aurait redemandé toutes les données.
    vol.applyOptions({ visible: prefs.volume });

    chart.applyOptions({
      layout: {
        textColor: cssVar("--tv-text-secondary", "#94a3b8"),
        // « transparent » laisse le fond du terminal traverser : c'est le
        // défaut, et c'est ce qui garde le graphe solidaire du thème.
        background: {
          type: ColorType.Solid,
          color:
            prefs.background === "transparent" ? "transparent" : resolveColor(prefs.background),
        },
        panes: { separatorColor: grid, separatorHoverColor: grid },
      },
      grid: {
        vertLines: { color: grid, visible: prefs.grid && prefs.gridVertical },
        horzLines: { color: grid, visible: prefs.grid },
      },
      crosshair: {
        mode: CROSSHAIR_MODES[prefs.crosshairMode],
        vertLine: {
          color: cross,
          labelBackgroundColor: cross,
          width: 1,
          style: prefs.crosshairDashed ? LineStyle.LargeDashed : LineStyle.Solid,
        },
        horzLine: {
          color: cross,
          labelBackgroundColor: cross,
          width: 1,
          style: prefs.crosshairDashed ? LineStyle.LargeDashed : LineStyle.Solid,
        },
      },
      rightPriceScale: { mode: SCALE_MODES[prefs.priceScaleMode] },
      // Closures neuves à chaque changement : c'est ce qui force la librairie
      // à repeindre l'axe quand seul le fuseau a bougé.
      timeScale: { tickMarkFormatter: (t: Time) => tickIn(t, prefs.timezone) },
      localization: { timeFormatter: (t: Time) => tickIn(t, prefs.timezone) },
    });

    for (const { cfg, lines } of studiesRef.current) {
      lines.forEach((line, i) => {
        studyRef.current.get(`${cfg.id}#${i}`)?.applyOptions({ color: resolveColor(line.color) });
      });
    }
  }, [themeKey, prefs, ready, shapeKey]);

  // ── LA LÉGENDE — ce que le curseur survole, ou la dernière bougie ────────
  //
  // Une plateforme de graphes n'attend pas le survol pour afficher l'OHLC : au
  // repos, la légende décrit la DERNIÈRE bougie. C'est ce qui permet de suivre
  // la lecture sans garder la souris dans la zone de tracé.
  const hoverTimeRef = useRef<number | null>(null);
  const emitRef = useRef<(time: number | null) => void>(() => {});
  emitRef.current = (time: number | null) => {
    if (!onCrosshair) return;
    const bars = shown;
    if (!bars.length) {
      onCrosshair(null);
      return;
    }
    const idx =
      time == null ? bars.length - 1 : bars.findIndex((b) => Math.floor(b.time / 1000) === time);
    const i = idx >= 0 ? idx : bars.length - 1;
    const bar = bars[i];
    onCrosshair({
      time: bar.time,
      o: bar.open,
      h: bar.high,
      l: bar.low,
      c: bar.close,
      v: bar.volume,
      change: bar.close - bar.open,
      changePct: bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0,
      studies: studiesRef.current.map(({ cfg, lines }) => ({
        id: cfg.id,
        title: cfg.kind,
        values: lines.map((line) => ({
          name: line.name,
          value: line.points[i]?.value ?? null,
          color: line.color,
        })),
      })),
    });
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = (param: MouseEventParams) => {
      const time = typeof param.time === "number" ? param.time : null;
      hoverTimeRef.current = time;
      emitRef.current(time);
    };
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [ready]);

  // Au repos (ou dès que la lecture avance), la légende suit la dernière
  // bougie : `emitRef` lit l'état courant, donc rien ne se périme.
  useEffect(() => {
    emitRef.current(hoverTimeRef.current);
  }, [shown, studies]);

  // ── Les niveaux sur l'échelle de prix ───────────────────────────────────
  // On RÉCONCILIE plutôt qu'on ne reconstruit : les lignes de prix déjà posées
  // sont mises à jour, celles qui ont disparu sont retirées. Tout effacer pour
  // tout recréer à chaque image aurait fait clignoter l'échelle à chaque
  // déplacement d'un trait.
  useEffect(() => {
    const series = mainRef.current;
    if (!series) {
      priceLinesRef.current.clear();
      return;
    }
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
    // `shapeKey` compte : la série principale a pu être recréée, et les lignes
    // de prix de l'ancienne sont parties avec elle.
  }, [levels, themeKey, shapeKey, ready]);

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
