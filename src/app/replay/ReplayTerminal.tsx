/**
 * ReplayTerminal — la coque du terminal de rejeu.
 *
 * En-tête (instrument, compte, horloge, solde, sortie), rail d'outils à gauche,
 * colonne de timeframes, graphe + overlay au centre, ticket + panneaux à droite,
 * transport en bas. La mise en page ne porte aucune logique : tout vient du hook
 * `useReplaySession` et des props.
 */

import { useMemo, useRef, useState } from "react";
import {
  Eraser,
  Flag,
  History,
  LogOut,
  MousePointer2,
  Move,
  Ruler,
  Square,
  StretchHorizontal,
  TrendingUp,
  Type,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { ChartLevel, ChartView } from "./ReplayChart";
import ReplayChart from "./ReplayChart";
import ReplayOverlay, { type ReplayTool } from "./ReplayOverlay";
import ReplayControls from "./ReplayControls";
import ReplayTicket from "./ReplayTicket";
import ReplayPanels from "./ReplayPanels";
import ReplayDashboard from "./ReplayDashboard";
import type { ReplayQuote } from "./useReplaySession";
import type { Drawing, PlaceOrderInput, ReplaySessionState } from "@/modules/replay";
import { nyTimeOf, dailyLossState } from "@/modules/replay";

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
  onNext: () => void;
  onPrev: () => void;
  onPlaceOrder: (input: PlaceOrderInput) => void;
  onBracket: (posId: string, sl: number | null, tp: number | null) => void;
  onMoveOrder: (orderId: string, price: number) => void;
  onCancelOrder: (orderId: string) => void;
  onClosePos: (posId: string) => void;
  drawings: Drawing[];
  onAddDrawing: (d: Drawing) => void;
  onUpdateDrawing: (d: Drawing) => void;
  onRemoveDrawing: (id: string) => void;
  onFinish: () => void;
  onExit: () => void;
}

const TOOLS: {
  id: ReplayTool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { id: "cursor", icon: MousePointer2, label: "rt.tool.cursor" },
  { id: "hline", icon: HLineIcon, label: "rt.tool.hline" },
  { id: "trend", icon: TrendingUp, label: "rt.tool.trend" },
  { id: "ray", icon: Move, label: "rt.tool.ray" },
  { id: "rect", icon: Square, label: "rt.tool.rect" },
  { id: "vline", icon: VLineIcon, label: "rt.tool.vline" },
  { id: "text", icon: Type, label: "rt.tool.text" },
  { id: "measured", icon: Ruler, label: "rt.tool.measured" },
  { id: "zone", icon: StretchHorizontal, label: "rt.tool.measured" },
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
  const [tool, setTool] = useState<ReplayTool>("cursor");
  const [showRthEth, setShowRthEth] = useState(true);
  /** Ce qu'occupe la zone centrale : le marché, ou le bilan de la séance. */
  const [view, setView] = useState<"chart" | "stats">("chart");
  /** Couleur des PROCHAINS dessins. Ceux déjà posés gardent la leur. */
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const viewRef = useRef<ChartView>({ chart: null, candles: null });
  const [hover, setHover] = useState<{
    time: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  } | null>(null);

  const state = props.state;
  const orders = state?.orders ?? [];
  const positions = state?.positions ?? [];
  const executions =
    state?.executions ??
    ([] as { at: number; price: number; side: "long" | "short"; qty: number }[]);
  const drawings = props.drawings ?? [];

  // ── Ce que l'ÉCHELLE DE PRIX doit répéter ────────────────────────────────
  // Les niveaux tracés et les prix engagés remontent sur l'axe de droite, à la
  // manière de TradingView : le chiffre se lit sans survoler le trait, et reste
  // lisible quand celui-ci sort du champ. La clé sert de mémo : l'état de la
  // séance est muté en place, comparer les références ne dirait rien, alors
  // qu'une signature courte dit exactement ce qui a bougé.
  const levelKey = [
    ...drawings
      .filter((d) => d.kind === "hline")
      .map((d) => `d${d.id}:${d.points[0]?.y}:${d.color}`),
    ...orders
      .filter(
        (o) => o.status === "working" && o.price != null && o.label !== "SL" && o.label !== "TP",
      )
      .map((o) => `o${o.id}:${o.price}`),
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
    for (const o of orders) {
      if (o.status !== "working" || o.price == null) continue;
      if (o.label === "SL" || o.label === "TP") continue;
      out.push({ id: `ord:${o.id}`, price: o.price, color: "var(--tv-text-muted)" });
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

  return (
    <div className="flex h-full w-full flex-col bg-[var(--tv-bg)] text-[var(--tv-text)]">
      {/* ── En-tête ── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3">
        <button
          type="button"
          onClick={props.onExit}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2.5 py-1.5 text-xs font-semibold text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t("rt.exit")}
        </button>
        <span className="hidden rounded-lg bg-[var(--tv-surface-hover)] px-2 py-1 text-xs font-bold md:inline">
          {state?.symbol ?? "NQ"}
        </span>
        <span className="hidden text-xs text-[var(--tv-text-muted)] md:inline">
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
            "hidden rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide md:inline",
            props.dataSource
              ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text-muted)]"
              : "bg-[rgb(var(--tv-warning-rgb)/0.16)] text-[var(--tv-warning)]",
          )}
        >
          {props.dataSource ?? t("rt.dataSimulated")}
        </span>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden items-center gap-4 md:flex">
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
          <span className="rounded-xl border border-[var(--tv-accent)]/40 bg-[var(--tv-accent)]/10 px-3 py-1.5 tv-figure text-xs font-bold text-[var(--tv-accent)]">
            {props.clockLabel}
          </span>
          <button
            type="button"
            onClick={props.onFinish}
            className="inline-flex items-center gap-1.5 rounded-xl tv-accent-fill px-3 py-1.5 text-xs font-bold text-white"
          >
            <Flag className="h-3.5 w-3.5" />
            {t("rt.finish")}
          </button>
        </div>
      </header>

      {/* ── Corps ── */}
      <div className="flex min-h-0 flex-1">
        {/* Rail d'outils */}
        <aside className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-[var(--tv-border)] bg-[var(--tv-plate-2)] py-2 md:flex">
          {TOOLS.map((tp) => {
            const Icon = tp.icon;
            return (
              <button
                key={tp.id}
                type="button"
                title={t(tp.label as never)}
                onClick={() => setTool(tp.id)}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl transition",
                  tool === tp.id
                    ? "tv-accent-fill text-white"
                    : "text-[var(--tv-text-muted)] hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
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
          <button
            type="button"
            title={t("rt.eth")}
            onClick={() => setShowRthEth((v) => !v)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl text-[10px] font-bold transition",
              showRthEth
                ? "tv-accent-fill text-white"
                : "text-[var(--tv-text-muted)] hover:bg-[var(--tv-surface-hover)]",
            )}
          >
            R/E
          </button>
          <button
            type="button"
            title="Fit"
            onClick={fitChart}
            className="grid h-9 w-9 place-items-center rounded-xl text-[var(--tv-text-muted)] hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Reset"
            onClick={resetChart}
            className="grid h-9 w-9 place-items-center rounded-xl text-[var(--tv-text-muted)] hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
          >
            <Move className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("rt.erase")}
            onClick={() => drawings.forEach((d) => props.onRemoveDrawing(d.id))}
            className="grid h-9 w-9 place-items-center rounded-xl text-[var(--tv-text-muted)] hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-danger)]"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </aside>

        {/* Timeframes + graphe */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2">
            {props.timeframes
              .filter((tf) => tf.id !== "1s")
              .map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => props.setViewTf(tf.id)}
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold transition",
                    props.viewTf === tf.id
                      ? "tv-accent-fill text-white"
                      : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
                  )}
                >
                  {tf.label}
                </button>
              ))}
            {/* GRAPHE / ANALYTICS. La bascule est au bout de la barre qui
              commande la zone centrale, et non dans l'en-tête du compte : on
              range un contrôle avec ce qu'il change. Le ticket et les panneaux
              restent en place, donc consulter son bilan n'oblige pas à quitter
              le carnet. */}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {(["chart", "stats"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold transition",
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
              onCrosshair={setHover}
            />
            <ReplayOverlay
              view={viewRef}
              drawings={drawings}
              orders={orders}
              positions={positions}
              executions={executions}
              bounds={props.bounds}
              showRthEth={showRthEth}
              tool={tool}
              mark={props.quote?.mark ?? 0}
              onAddDrawing={props.onAddDrawing}
              onUpdateDrawing={props.onUpdateDrawing}
              onRemoveDrawing={props.onRemoveDrawing}
              onMoveOrder={props.onMoveOrder}
              onCancelOrder={props.onCancelOrder}
              drawColor={drawColor}
              palette={DRAW_COLORS}
              onToolDone={() => setTool("cursor")}
            />
            {hover && (
              <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)]/95 px-2 py-1 tv-figure text-[10px] text-[var(--tv-text-muted)]">
                <span className="text-[var(--tv-text)]">{nyTimeOf(hover.time)}</span> · O{" "}
                {hover.o.toFixed(2)} H {hover.h.toFixed(2)} L {hover.l.toFixed(2)} C{" "}
                <span
                  className={
                    hover.c >= hover.o
                      ? "text-[var(--tv-chart-green)]"
                      : "text-[var(--tv-chart-red)]"
                  }
                >
                  {hover.c.toFixed(2)}
                </span>
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
            symbol={state?.symbol ?? "NQ"}
            commissionPerContract={state?.commissionPerContract ?? 0}
            onPlace={props.onPlaceOrder}
          />
          <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--tv-border)]">
            <ReplayPanels
              state={state}
              mark={q?.mark ?? 0}
              onClosePos={props.onClosePos}
              onCancelOrder={props.onCancelOrder}
              onChangeBracket={props.onBracket}
            />
          </div>
        </aside>
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
        viewTf={props.viewTf}
      />
    </div>
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
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1",
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
