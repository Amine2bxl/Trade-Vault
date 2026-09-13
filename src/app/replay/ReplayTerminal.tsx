/**
 * ReplayTerminal — la coque du terminal de rejeu.
 *
 * Quatre bandes et trois colonnes, la disposition d'une plateforme de
 * trading :
 *
 *   ┌──────────────────── en-tête : compte, chiffres, horloge, sortie ──────┐
 *   │ outils │  barre du graphe (unités de temps, type, études, réglages)   │
 *   │        │  ─────────────────────────────────────────────  │  ticket   │
 *   │        │  graphe + légende + couche d'ordres             │  carnet   │
 *   └──────────────── transport : lecture, vitesse, progression ────────────┘
 *
 * La mise en page ne porte AUCUNE logique de marché : tout vient du hook
 * `useReplaySession` et des props. Ce qui vit ici, ce sont les décisions
 * d'écran — quel outil est actif, quelles études sont posées, quel panneau est
 * ouvert — et une seule décision de produit : À LA CLÔTURE D'UN TRADE, LE
 * JOURNAL S'OUVRE (voir `useAutoJournal`).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  BoxSelect,
  ChartLine,
  Eraser,
  Flag,
  Maximize2,
  MousePointer2,
  Move,
  MoveUpRight,
  Ruler,
  Settings2,
  Square,
  StretchHorizontal,
  TrendingUp,
  Type,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useToast } from "../contexts/ToastContext";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { cn } from "../utils/cn";
import type { ChartLevel, ChartView, LegendInfo } from "./ReplayChart";
import ReplayChart from "./ReplayChart";
import ReplayLegend from "./ReplayLegend";
import ReplayOverlay, { type ReplayTool } from "./ReplayOverlay";
import ReplayControls from "./ReplayControls";
import ReplayTicket from "./ReplayTicket";
import ReplayPanels from "./ReplayPanels";
import ReplayOrderBar from "./ReplayOrderBar";
import ReplayDashboard from "./ReplayDashboard";
import ReplayChartSettings from "./ReplayChartSettings";
import ReplayIndicators from "./ReplayIndicators";
import { useAutoJournal } from "./useAutoJournal";
import { CHART_TYPES, loadChartPrefs, saveChartPrefs, type ChartPrefs } from "./chartPrefs";
import type { ReplayQuote } from "./useReplaySession";
import type { Drawing, OrderType, PlaceOrderInput, ReplaySessionState } from "@/modules/replay";
import { dailyLossState } from "@/modules/replay";

export interface TerminalProps {
  accountName: string;
  /** Fournisseur ayant servi les bougies. `null` = générateur déterministe. */
  dataSource?: string | null;
  state: ReplaySessionState | null;
  candles: import("@/modules/replay").SimulatedCandle[];
  bounds: {
    ethStart: number;
    ethEnd: number;
    rthStart: number;
    rthEnd: number;
    /** Une fenêtre RTH par séance rejouée — l'ombrage du graphe en vit. */
    rthWindows?: { start: number; end: number }[];
  };
  quote: ReplayQuote | null;
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  clockLabel: string;
  viewTf: string;
  setViewTf: (tf: string) => void;
  timeframes: readonly { id: string; label: string }[];
  speed: number;
  setSpeed: (s: number) => void;
  onTogglePlay: () => void;
  /** Suspendre la lecture SANS la relancer — ce que fait l'encodage d'un trade. */
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onPlaceOrder: (input: PlaceOrderInput) => void;
  onBracket: (posId: string, sl: number | null, tp: number | null) => void;
  onMoveOrder: (orderId: string, price: number) => void;
  onMoveOrderBracket: (
    orderId: string,
    sl: number | null | undefined,
    tp: number | null | undefined,
  ) => void;
  onCancelOrder: (orderId: string) => void;
  onClosePos: (posId: string) => void;
  /** Les trois gestes d'urgence de la barre d'exécution. */
  onFlattenAll: () => void;
  onReverse: () => void;
  onCancelAll: () => void;
  drawings: Drawing[];
  onAddDrawing: (d: Drawing) => void;
  onUpdateDrawing: (d: Drawing) => void;
  onRemoveDrawing: (id: string) => void;
  onFinish: () => void;
  onExit: () => void;
}

interface ToolDef {
  id: ReplayTool;
  icon: React.ComponentType<{ className?: string }>;
  label: TKey;
}

/**
 * LE RAIL D'OUTILS, GROUPÉ — l'ordre de la plateforme de référence.
 *
 * Dix icônes à la file forment une colonne indifférenciée où l'on cherche à
 * chaque fois. Groupées par NATURE de tracé — curseur, droites, formes,
 * mesures, annotation — et séparées d'un filet, elles se retrouvent d'un coup
 * d'œil : on sait dans quel tiers regarder avant même d'avoir lu les icônes.
 */
const TOOL_GROUPS: ToolDef[][] = [
  [{ id: "cursor", icon: MousePointer2, label: "rt.tool.cursor" }],
  [
    { id: "trend", icon: TrendingUp, label: "rt.tool.trend" },
    { id: "ray", icon: MoveUpRight, label: "rt.tool.ray" },
    { id: "hline", icon: HLineIcon, label: "rt.tool.hline" },
    { id: "vline", icon: VLineIcon, label: "rt.tool.vline" },
  ],
  [
    { id: "rect", icon: Square, label: "rt.tool.rect" },
    { id: "zone", icon: BoxSelect, label: "rt.tool.zone" },
  ],
  [
    { id: "fib", icon: ChartLine, label: "rt.tool.fib" },
    { id: "measured", icon: Ruler, label: "rt.tool.measured" },
  ],
  [{ id: "text", icon: Type, label: "rt.tool.text" }],
];

/**
 * La palette de dessin — des JETONS du thème, pas des couleurs inventées.
 *
 * Le test de couverture des thèmes interdit les hex de marque en dur, et il a
 * raison : une couleur écrite à la main ignore le thème choisi et jure dès
 * qu'on en change. Ces cinq-là suivent le thème, y compris celui du rejeu.
 */
const DRAW_COLORS = [
  "var(--tv-accent)",
  "var(--tv-chart-green)",
  "var(--tv-chart-red)",
  "var(--tv-warning)",
  "var(--tv-text)",
] as const;

function HLineIcon({ className }: { className?: string }) {
  return <StretchHorizontal className={className} />;
}
function VLineIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block", className)}
      style={{ borderLeft: "2px solid currentColor", height: 16 }}
    />
  );
}

export default function ReplayTerminal(props: TerminalProps) {
  const { t } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [tool, setTool] = useState<ReplayTool>("cursor");
  /** La taille de la barre d'exécution — celle que portent ses boutons. */
  const [orderQty, setOrderQty] = useState(1);
  /** Ce qu'occupe la zone centrale : le marché, ou le bilan de la séance. */
  const [view, setView] = useState<"chart" | "stats">("chart");
  /** Couleur des PROCHAINS dessins. Ceux déjà posés gardent la leur. */
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  /**
   * L'apparence du graphe, lue au premier rendu et écrite à chaque réglage.
   *
   * L'initialiseur paresseux de `useState` évite de relire le stockage à
   * chaque rendu du terminal — c'est-à-dire à chaque battement de l'horloge.
   */
  const [prefs, setPrefs] = useState<ChartPrefs>(loadChartPrefs);
  const [panel, setPanel] = useState<"none" | "settings" | "indicators">("none");
  /** L'encodage automatique à la clôture — armé par défaut, coupable d'un clic. */
  const [autoLog, setAutoLog] = useState(true);
  const applyPrefs = (next: ChartPrefs) => {
    setPrefs(next);
    saveChartPrefs(next);
  };
  const viewRef = useRef<ChartView>({ chart: null, candles: null });
  const overlayRef = useRef<SVGSVGElement | null>(null);
  /** La boîte du graphe : elle porte le clic droit ET l'échelle de la capture. */
  const chartBoxRef = useRef<HTMLDivElement | null>(null);
  const [legend, setLegend] = useState<LegendInfo | null>(null);

  const state = props.state;
  const orders = useMemo(() => state?.orders ?? [], [state]);
  const positions = useMemo(() => state?.positions ?? [], [state]);
  const executions = useMemo(
    () =>
      state?.executions ??
      ([] as { at: number; price: number; side: "long" | "short"; qty: number }[]),
    [state],
  );
  const drawings = props.drawings ?? [];
  const closedTrades = state?.closedTrades ?? [];

  // ── LE JOURNAL S'OUVRE À LA CLÔTURE ─────────────────────────────────────
  // C'est la promesse du terminal : on ne sort pas du rejeu pour encoder, et
  // on n'attend pas la fin de séance pour se souvenir de ce qu'on pensait.
  const journal = useAutoJournal({
    userId: user?.id ?? null,
    enabled: autoLog,
    // La séance n'existe pas au premier rendu d'une reprise : s'amorcer avant
    // elle rouvrirait tous ses trades déjà clos.
    ready: state != null,
    closedTrades,
    chart: () => viewRef.current.chart,
    overlay: overlayRef,
    container: chartBoxRef,
    onPause: props.onPause,
    notify: toast,
    labels: { shot: t("rt.logShot"), shotFailed: t("rt.logShotFailed") },
  });

  // ── Clic droit sur le graphe → passer un ordre au prix visé ─────────────
  const [ctxMenu, setCtxMenu] = useState<{
    left: number;
    top: number;
    price: number;
  } | null>(null);
  const openCtxMenu = (ev: React.MouseEvent) => {
    if (view !== "chart") return;
    ev.preventDefault();
    const box = chartBoxRef.current?.getBoundingClientRect();
    const s = viewRef.current.candles;
    if (!box || !s) return;
    const x = ev.clientX - box.left;
    const y = ev.clientY - box.top;
    const price = s.coordinateToPrice(y);
    if (price == null) return;
    setCtxMenu({
      left: Math.max(0, Math.min(x, box.width - 176)),
      top: Math.max(0, Math.min(y, box.height - 156)),
      price,
    });
  };
  const placeFromCtx = (side: "long" | "short", type: OrderType) => {
    if (!ctxMenu) return;
    props.onPlaceOrder({
      side,
      type,
      qty: 1,
      price: type === "market" ? undefined : ctxMenu.price,
    });
    setCtxMenu(null);
  };
  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctxMenu]);

  // ── Ce que l'ÉCHELLE DE PRIX doit répéter ────────────────────────────────
  // Les niveaux tracés et les prix engagés remontent sur l'axe de droite, à la
  // manière de TradingView : le chiffre se lit sans survoler le trait, et reste
  // lisible quand celui-ci sort du champ. La clé sert de mémo : l'état de la
  // séance est muté en place, comparer les références ne dirait rien, alors
  // qu'une signature courte dit exactement ce qui a bougé.
  const levelKey = [
    prefs.showOrders ? "1" : "0",
    ...drawings
      .filter((d) => d.kind === "hline")
      .map((d) => `d${d.id}:${d.points[0]?.y}:${d.color}`),
    ...orders
      .filter(
        (o) => o.status === "working" && o.price != null && o.label !== "SL" && o.label !== "TP",
      )
      .map((o) => `o${o.id}:${o.price}:${o.bracketSl}:${o.bracketTp}`),
    ...positions.flatMap((p) => [
      `p${p.id}:${p.avgEntry}:${p.side}`,
      `s${p.stop?.id ?? ""}:${p.stop?.price ?? ""}`,
      `t${p.target?.id ?? ""}:${p.target?.price ?? ""}`,
    ]),
  ].join("|");
  const levels = useMemo<ChartLevel[]>(() => {
    const out: ChartLevel[] = [];
    for (const d of drawings) {
      if (d.kind !== "hline" || d.points[0] == null) continue;
      out.push({ id: `drw:${d.id}`, price: d.points[0].y, color: d.color });
    }
    // Les prix engagés ne remontent sur l'axe que si le graphe montre les
    // ordres : couper l'affichage à moitié laisserait des étiquettes
    // orphelines sur l'échelle, sans trait auquel les rattacher.
    if (!prefs.showOrders) return out;
    for (const o of orders) {
      if (o.status !== "working" || o.price == null) continue;
      if (o.label === "SL" || o.label === "TP") continue;
      out.push({ id: `ord:${o.id}`, price: o.price, color: "var(--tv-text-muted)" });
      // Le bracket d'un ordre en carnet compte lui aussi : ce sont les prix
      // qu'on s'apprête à engager, donc ceux qu'on veut lire sur l'axe.
      if (o.bracketSl != null)
        out.push({ id: `obsl:${o.id}`, price: o.bracketSl, color: "var(--tv-chart-red)" });
      if (o.bracketTp != null)
        out.push({ id: `obtp:${o.id}`, price: o.bracketTp, color: "var(--tv-chart-green)" });
    }
    for (const p of positions) {
      const side = p.side === "long" ? "var(--tv-chart-green)" : "var(--tv-chart-red)";
      out.push({ id: `pos:${p.id}`, price: p.avgEntry, color: side });
      if (p.stop?.price != null)
        out.push({ id: `sl:${p.stop.id}`, price: p.stop.price, color: "var(--tv-chart-red)" });
      if (p.target?.price != null)
        out.push({
          id: `tp:${p.target.id}`,
          price: p.target.price,
          color: "var(--tv-chart-green)",
        });
    }
    return out;
    // La signature SUFFIT, et les tableaux ne suffiraient pas : mutés en place
    // par le moteur, ils gardent la même référence après un changement de prix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  const fitChart = () => viewRef.current.chart?.timeScale().fitContent();
  const resetChart = () => viewRef.current.chart?.timeScale().resetTimeScale();

  const q = props.quote;
  const balanceTone = q && q.equity - q.balance ? pnlTone(q.equity - q.balance) : "neutral";
  // La limite de perte que le trader s'est fixée au lancement, s'il en a fixé
  // une. `dailyLossState` compte le P&L OUVERT : une position en cours qui
  // dépasse le mur le dépasse maintenant, pas à sa clôture.
  const dailyLoss =
    state && state.maxDailyLossPct ? dailyLossState(state, state.maxDailyLossPct) : null;

  // ── LA BARRE D'EXÉCUTION ────────────────────────────────────────────────
  const openPositions = positions.filter((p) => p.qty > 0).length;
  const workingOrders = orders.filter((o) => o.status === "working").length;
  const marketReady = (props.quote?.mark ?? 0) > 0;

  const placeMarket = (side: "long" | "short") => {
    if (!marketReady) return;
    props.onPlaceOrder({ side, type: "market", qty: Math.max(1, Math.round(orderQty || 1)) });
  };

  /**
   * Les gestes d'urgence DEMANDENT. Ils ferment des positions et annulent des
   * ordres : ce sont les seules actions du terminal qu'on ne peut pas défaire.
   */
  const flattenAll = async () => {
    if (openPositions === 0) return;
    if (await confirm(t("rt.flattenConfirm"), { danger: true })) props.onFlattenAll();
  };
  const reverseAll = async () => {
    if (openPositions === 0) return;
    if (await confirm(t("rt.reverseConfirm"), { danger: true })) props.onReverse();
  };
  const cancelAll = async () => {
    if (workingOrders === 0) return;
    if (await confirm(t("rt.cancelAllConfirm"), { danger: true })) props.onCancelAll();
  };

  /** Les props de la barre — une seule définition, deux points de montage. */
  const orderBar = {
    qty: orderQty,
    setQty: setOrderQty,
    openPositions,
    workingOrders,
    onBuy: () => placeMarket("long" as const),
    onSell: () => placeMarket("short" as const),
    onFlatten: () => void flattenAll(),
    onReverse: () => void reverseAll(),
    onCancelAll: () => void cancelAll(),
    ready: marketReady,
  };

  // ── LES RACCOURCIS ──────────────────────────────────────────────────────
  //
  // Ce sont ceux de toute plateforme de trading, et c'est justement pourquoi
  // ils comptent dans un simulateur : on y vient pour acquérir des réflexes
  // qui serviront ailleurs. Les mêmes touches, donc.
  //
  // Rien ne se déclenche pendant une SAISIE : le champ « période » d'un
  // indicateur contient des lettres, et taper « s » dedans ne doit pas vendre
  // deux contrats. Un modificateur (Ctrl/Cmd/Alt) rend la touche au système.
  const shortcutsRef = useRef({ placeMarket, flattenAll, reverseAll, cancelAll, props });
  shortcutsRef.current = { placeMarket, flattenAll, reverseAll, cancelAll, props };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
        return;
      }
      const k = shortcutsRef.current;
      switch (e.key.toLowerCase()) {
        case "b":
          k.placeMarket("long");
          break;
        case "s":
          k.placeMarket("short");
          break;
        case "f":
          void k.flattenAll();
          break;
        case "r":
          void k.reverseAll();
          break;
        case "c":
          void k.cancelAll();
          break;
        case " ":
          // La barre d'espace fait défiler la page par défaut : dans un
          // terminal plein écran, elle commande la lecture.
          e.preventDefault();
          k.props.onTogglePlay();
          break;
        case "arrowright":
          e.preventDefault();
          k.props.onNext();
          break;
        case "arrowleft":
          e.preventDefault();
          k.props.onPrev();
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const symbol = state?.symbol ?? "NQ";
  const tfLabel =
    props.timeframes.find((tf) => tf.id === props.viewTf)?.label ?? props.viewTf.toUpperCase();
  const indicatorCount = prefs.indicators.filter((i) => i.visible).length;

  return (
    <div className="flex h-full w-full flex-col bg-[var(--tv-bg)] text-[var(--tv-text)]">
      {/* ── En-tête ── */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2.5">
        {/* Le SYMBOLE n'est plus ici : sa place est dans la barre du graphe,
          en tête, comme sur toute plateforme — c'est un réglage de ce qu'on
          REGARDE, pas une propriété du compte. Cette barre-ci ne parle que du
          compte : son nom, ses chiffres, son horloge, ses sorties. */}
        <span className="truncate text-xs font-semibold text-[var(--tv-text-secondary)]">
          {props.accountName}
        </span>
        {/* D'OÙ VIENNENT LES BOUGIES. Le repli sur le générateur est silencieux
          par conception — le terminal doit tourner sans abonnement — mais il ne
          doit pas être CACHÉ : croire qu'on rejoue le vrai NQ alors qu'on
          regarde une simulation fait tirer de fausses conclusions d'une séance.
          Une pastille ambre quand c'est simulé, neutre quand c'est réel. */}
        <span
          title={props.dataSource ? t("rt.dataReal") : t("rt.dataSimulatedHint")}
          className={cn(
            "hidden rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide md:inline",
            props.dataSource
              ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text-muted)]"
              : "bg-[rgb(var(--tv-warning-rgb)/0.16)] text-[var(--tv-warning)]",
          )}
        >
          {props.dataSource ?? t("rt.dataSimulated")}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1.5 md:flex">
            <HeaderStat label={t("rt.balance")} value={fmt$(q?.balance)} />
            <HeaderStat label={t("rt.equity")} value={fmt$(q?.equity)} tone={balanceTone} />
            <HeaderStat
              label={t("rt.openPnl")}
              value={signed$(q?.openPnl)}
              tone={pnlTone(q?.openPnl ?? 0)}
            />
            <HeaderStat
              label={t("rt.realizedPnl")}
              value={signed$(q?.realizedPnl)}
              tone={pnlTone(q?.realizedPnl ?? 0)}
            />
            {/* MLL — ce qu'il reste avant le mur que le trader s'est fixé.
              Affiché SEULEMENT s'il en a fixé un : inventer une limite qu'on
              n'a pas demandée en ferait une règle de la maison. */}
            {dailyLoss && (
              <HeaderStat
                label={t("rt.mll")}
                value={fmt$(dailyLoss.remaining)}
                tone={dailyLoss.breached ? "down" : dailyLoss.ratio > 0.7 ? "warn" : "neutral"}
              />
            )}
          </div>
          <span className="rounded-md border border-[var(--tv-accent)]/40 bg-[var(--tv-accent)]/10 px-3 py-1.5 tv-figure text-xs font-bold text-[var(--tv-accent)]">
            {props.clockLabel}
          </span>

          {/* LES DEUX SORTIES, CÔTE À CÔTE ET DISTINCTES.
            « Terminer » clôt la séance et pousse ce qui reste au journal ;
            « Quitter » range la séance et revient au produit. Deux gestes
            différents, deux boutons différents, et le plein rappelle lequel
            est l'aboutissement de la séance. */}
          <button
            type="button"
            onClick={props.onFinish}
            title={t("rt.finish")}
            className="inline-flex items-center gap-1.5 rounded-md tv-accent-fill px-3 py-1.5 text-xs font-bold text-white"
          >
            <Flag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("rt.finishShort")}</span>
          </button>
          <button
            type="button"
            onClick={props.onExit}
            title={t("rt.exit")}
            aria-label={t("rt.exit")}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)] transition hover:border-[var(--tv-danger)]/50 hover:text-[var(--tv-danger)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Corps ── */}
      <div className="flex min-h-0 flex-1">
        {/* Rail d'outils */}
        <aside className="hidden w-11 shrink-0 flex-col items-center gap-0.5 border-r border-[var(--tv-border)] bg-[var(--tv-plate-2)] py-1.5 md:flex">
          {TOOL_GROUPS.map((group, gi) => (
            <div key={gi} className="flex w-full flex-col items-center gap-0.5">
              {gi > 0 && <div className="my-0.5 h-px w-5 bg-[var(--tv-border)]" />}
              {group.map((tp) => {
                const Icon = tp.icon;
                return (
                  <button
                    key={tp.id}
                    type="button"
                    title={t(tp.label)}
                    aria-label={t(tp.label)}
                    aria-pressed={tool === tp.id}
                    onClick={() => setTool(tp.id)}
                    className={cn(
                      "relative grid h-8 w-8 place-items-center rounded-[3px] transition",
                      tool === tp.id
                        ? "bg-[var(--tv-surface-hover)] text-[var(--tv-accent)] before:absolute before:left-[-6px] before:h-4 before:w-[2px] before:rounded-full before:bg-[var(--tv-accent)]"
                        : "text-[var(--tv-text-muted)] hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          ))}
          {/* La couleur se choisit là où l'outil se choisit : au même endroit,
            dans le même geste. La poser dans un réglage aurait séparé deux
            décisions qui se prennent ensemble. */}
          <div className="my-1 h-px w-6 bg-[var(--tv-border)]" />
          <div className="grid grid-cols-2 gap-1 px-1 pb-1">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={t("rt.drawColor")}
                aria-label={t("rt.drawColor")}
                onClick={() => setDrawColor(c)}
                className={cn(
                  "h-4 w-4 rounded-full border transition",
                  drawColor === c
                    ? "border-[var(--tv-text)] scale-110"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="my-1 h-px w-6 bg-[var(--tv-border)]" />
          <RailButton label={t("rt.fit")} icon={Maximize2} onClick={fitChart} />
          <RailButton label={t("rt.resetView")} icon={Move} onClick={resetChart} />
          <RailButton
            label={t("rt.erase")}
            icon={Eraser}
            danger
            onClick={() => drawings.forEach((d) => props.onRemoveDrawing(d.id))}
          />
        </aside>

        {/* Timeframes + graphe */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-1.5">
            {/* SYMBOLE — la première chose de la barre, comme sur la plateforme
              de référence. Il n'est pas cliquable : le rejeu ne sert qu'un
              contrat à la fois, et un bouton qui n'ouvre rien ment. */}
            <span
              title={symbol}
              className="mr-1 shrink-0 rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1 text-[11.5px] font-bold text-[var(--tv-text)]"
            >
              {symbol}
            </span>
            <div className="mx-0.5 h-4 w-px shrink-0 bg-[var(--tv-border)]" />
            {props.timeframes
              .filter((tf) => tf.id !== "1s")
              .map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => props.setViewTf(tf.id)}
                  aria-pressed={props.viewTf === tf.id}
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition",
                    props.viewTf === tf.id
                      ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                      : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
                  )}
                >
                  {tf.label}
                </button>
              ))}

            <div className="mx-1 h-4 w-px shrink-0 bg-[var(--tv-border)]" />

            {/* LE TYPE DE GRAPHE, à côté des unités de temps — ce sont les deux
              réglages qu'on change le plus souvent, et une plateforme les pose
              toujours ensemble, à portée immédiate. */}
            <select
              value={prefs.chartType}
              onChange={(e) =>
                applyPrefs({ ...prefs, chartType: e.target.value as ChartPrefs["chartType"] })
              }
              aria-label={t("rt.chartType")}
              title={t("rt.chartType")}
              className="shrink-0 rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-1.5 py-[3px] text-[11px] font-semibold text-[var(--tv-text)]"
            >
              {CHART_TYPES.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.labelKey as TKey)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setPanel(panel === "indicators" ? "none" : "indicators")}
              title={t("rt.indicators")}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition",
                panel === "indicators"
                  ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                  : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
              )}
            >
              <ChartLine className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{t("rt.indicators")}</span>
              {indicatorCount > 0 && (
                <span className="tv-figure rounded-full bg-[var(--tv-accent)]/20 px-1.5 text-[9.5px] text-[var(--tv-accent)]">
                  {indicatorCount}
                </span>
              )}
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {/* L'ENCODAGE AUTOMATIQUE — l'interrupteur est ici, visible, parce
                que c'est un comportement qui INTERROMPT la lecture. Un
                comportement qui s'impose doit pouvoir se couper sans chercher. */}
              <button
                type="button"
                onClick={() => {
                  setAutoLog((v) => !v);
                  toast(autoLog ? t("rt.autoLogOff") : t("rt.autoLogOn"), "info");
                }}
                title={t("rt.autoLog")}
                aria-pressed={autoLog}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition",
                  autoLog
                    ? "bg-[rgb(var(--tv-chart-green-rgb)/0.16)] text-[var(--tv-chart-green)]"
                    : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
                )}
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{t("rt.autoLog")}</span>
              </button>

              {/* L'apparence se règle DEPUIS le graphe, comme sur TradingView :
                l'engrenage est au bout de la barre qui commande la zone
                centrale, et le panneau s'ouvre par-dessus ce qu'il modifie —
                on voit le résultat en même temps qu'on le règle. */}
              <button
                type="button"
                onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
                title={t("rt.chartSettings")}
                aria-label={t("rt.chartSettings")}
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-md transition",
                  panel === "settings"
                    ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                    : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              {(["chart", "stats"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition",
                    view === v
                      ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                      : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
                  )}
                >
                  {v === "chart" ? t("rt.viewChart") : t("rt.viewStats")}
                </button>
              ))}
            </div>
          </div>
          <div
            ref={chartBoxRef}
            onContextMenu={openCtxMenu}
            className={cn(
              "relative min-h-0 flex-1 bg-[var(--tv-plate-0)]",
              view === "stats" && "hidden",
            )}
          >
            <ReplayChart
              candles={props.candles}
              refsView={viewRef}
              viewTf={props.viewTf}
              levels={levels}
              prefs={prefs}
              onCrosshair={setLegend}
            />
            <ReplayOverlay
              view={viewRef}
              drawings={drawings}
              orders={orders}
              positions={positions}
              executions={executions}
              bounds={props.bounds}
              showRthEth={prefs.sessionShading}
              showOrders={prefs.showOrders}
              exportRef={overlayRef}
              tool={tool}
              mark={props.quote?.mark ?? 0}
              onAddDrawing={props.onAddDrawing}
              onUpdateDrawing={props.onUpdateDrawing}
              onRemoveDrawing={props.onRemoveDrawing}
              onMoveOrder={props.onMoveOrder}
              onMoveOrderBracket={props.onMoveOrderBracket}
              onCancelOrder={props.onCancelOrder}
              onBracket={props.onBracket}
              symbol={symbol}
              drawColor={drawColor}
              palette={DRAW_COLORS}
              onToolDone={() => setTool("cursor")}
            />
            {prefs.legend && (
              <ReplayLegend
                symbol={symbol}
                timeframe={tfLabel}
                info={legend}
                indicators={prefs.indicators}
              />
            )}
            {panel === "settings" && (
              <ReplayChartSettings
                prefs={prefs}
                onChange={applyPrefs}
                onClose={() => setPanel("none")}
              />
            )}
            {panel === "indicators" && (
              <ReplayIndicators
                indicators={prefs.indicators}
                onChange={(indicators) => applyPrefs({ ...prefs, indicators })}
                onClose={() => setPanel("none")}
              />
            )}

            {/* Ce qui attend encore son formulaire — quand deux trades se
              referment d'un coup, il faut dire qu'il en reste un. */}
            {journal.queued > 0 && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-[var(--tv-border)] bg-[var(--tv-plate-2)]/95 px-3 py-1 text-[10.5px] font-semibold text-[var(--tv-text-muted)] shadow-[var(--tv-elev-2)]">
                {journal.queued} · {t("rt.logTradeTitle")}
              </div>
            )}

            {/* MENU DU CLIC DROIT — passer un ordre au prix visé, comme sur
              une plateforme de trading : on vise le niveau, on clic droit, on
              choisit le sens et le type. L'ordre part à CE prix, pas au mark. */}
            {ctxMenu && (
              <div
                className="absolute z-10 w-44 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-1 shadow-[var(--tv-elev-3)]"
                style={{ left: ctxMenu.left, top: ctxMenu.top }}
                role="menu"
                aria-label={t("rt.ctxOrder")}
              >
                <p className="px-2 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--tv-text-muted)]">
                  {t("rt.ctxOrder")} · <span className="tv-figure">{ctxMenu.price.toFixed(2)}</span>
                </p>
                {(["long", "short"] as const).map((side) => (
                  <div key={side}>
                    <p
                      className={`px-2 pb-0.5 pt-1 text-[8.5px] font-bold uppercase tracking-wider ${
                        side === "long"
                          ? "text-[var(--tv-chart-green)]"
                          : "text-[var(--tv-chart-red)]"
                      }`}
                    >
                      {side === "long" ? t("rt.buy") : t("rt.sell")}
                    </p>
                    {(["market", "limit", "stop"] as const).map((ty) => (
                      <button
                        key={ty}
                        type="button"
                        role="menuitem"
                        onClick={() => placeFromCtx(side, ty)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold text-[var(--tv-text)] transition hover:bg-[var(--tv-surface-hover)]"
                      >
                        {t(ty === "market" ? "rt.market" : ty === "limit" ? "rt.limit" : "rt.stop")}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="my-1 h-px bg-[var(--tv-border)]" />
                <button
                  type="button"
                  onClick={() => setCtxMenu(null)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>

          {/* Le bilan de la SÉANCE — mêmes grandeurs que la page Analytics,
            calculées sur les seuls trades de ce rejeu. */}
          {view === "stats" && (
            <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--tv-plate-0)]">
              <ReplayDashboard state={state} />
            </div>
          )}
        </main>

        {/* Panneau droit */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--tv-border)] bg-[var(--tv-plate-2)] lg:flex xl:w-[320px]">
          <ReplayTicket
            price={q?.mark ?? null}
            balance={state?.account.equity ?? 0}
            symbol={symbol}
            commissionPerContract={state?.commissionPerContract ?? 0}
            onPlace={props.onPlaceOrder}
          />
          {/* LA BARRE D'EXÉCUTION, sous le ticket : le geste le plus fréquent
            est le plus accessible, et il porte sa taille. */}
          <ReplayOrderBar {...orderBar} />
          <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--tv-border)]">
            <ReplayPanels
              state={state}
              mark={q?.mark ?? 0}
              onClosePos={props.onClosePos}
              onCancelOrder={props.onCancelOrder}
              onChangeBracket={props.onBracket}
              onLogTrade={journal.logNow}
            />
          </div>
        </aside>
      </div>

      {/* SOUS 1024 px, LE PANNEAU DROIT DISPARAÎT — et avec lui le seul moyen
        de passer un ordre. La barre remonte donc ici, pleine largeur : un
        terminal où l'on ne peut pas acheter n'est pas un terminal. */}
      <div className="lg:hidden">
        <ReplayOrderBar {...orderBar} />
      </div>

      {/* ── Transport ── */}
      <ReplayControls
        playing={props.playing}
        atStart={props.atStart}
        atEnd={props.atEnd}
        onToggle={props.onTogglePlay}
        onNext={props.onNext}
        onPrev={props.onPrev}
        speed={props.speed}
        setSpeed={props.setSpeed}
        progress={q?.progress ?? 0}
        clockLabel={props.clockLabel}
        viewTf={tfLabel}
      />
    </div>
  );
}

/** Un bouton du rail — icône seule, libellé au survol. */
function RailButton({
  label,
  icon: Icon,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)]",
        danger ? "hover:text-[var(--tv-danger)]" : "hover:text-[var(--tv-text)]",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Une statistique d'en-tête, en PASTILLE `LIBELLÉ : valeur`.
 *
 * L'empilement libellé-au-dessus-valeur prenait deux lignes et laissait
 * flotter les chiffres sans limite : sur une barre qui en aligne cinq, le
 * regard ne savait pas où commençait l'un et finissait l'autre. La pastille
 * borne chaque grandeur — c'est la lecture des plateformes de prop firm
 * (« BAL: », « MLL: », « RP&L: »), et le design system nomme déjà cette
 * convention à propos de `.tv-label`.
 *
 * Une pastille prend un FOND quand sa valeur porte un signe : un P&L positif
 * ou négatif se remarque alors sans être lu. Les grandeurs neutres — le solde,
 * l'equity — restent sobres, sinon tout serait mis en avant, donc rien.
 */
function HeaderStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  /** `warn` : on approche d'un seuil sans l'avoir franchi — ni vert, ni rouge. */
  tone?: "up" | "down" | "warn" | "neutral";
}) {
  const filled = tone === "up" || tone === "down" || tone === "warn";
  const hue =
    tone === "up"
      ? "var(--tv-chart-green-rgb)"
      : tone === "down"
        ? "var(--tv-chart-red-rgb)"
        : "var(--tv-warning-rgb)";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1",
        !filled && "border border-[var(--tv-border)] bg-[var(--tv-plate-1)]",
      )}
      style={filled ? { background: `rgb(${hue} / 0.16)` } : undefined}
    >
      <span className="tv-label text-[9.5px] text-[var(--tv-text-muted)]">{label}</span>
      <span
        className={cn(
          "tv-figure text-xs",
          tone === "up"
            ? "text-[var(--tv-chart-green)]"
            : tone === "down"
              ? "text-[var(--tv-chart-red)]"
              : tone === "warn"
                ? "text-[var(--tv-warning)]"
                : "text-[var(--tv-text)]",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function fmt$(n: number | undefined): string {
  return `${(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} $`;
}

function signed$(n: number | undefined): string {
  const v = n ?? 0;
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)} $`;
}

function pnlTone(n: number): "up" | "down" | "neutral" {
  return n > 0 ? "up" : n < 0 ? "down" : "neutral";
}
