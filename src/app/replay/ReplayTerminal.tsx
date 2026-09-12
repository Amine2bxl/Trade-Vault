/**
 * ReplayTerminal — la coque du terminal de rejeu.
 *
 * En-tête (instrument, compte, horloge, solde, sortie), rail d'outils à gauche,
 * colonne de timeframes, graphe + overlay au centre, ticket + panneaux à droite,
 * transport en bas. La mise en page ne porte aucune logique : tout vient du hook
 * `useReplaySession` et des props.
 */

import { useRef, useState } from "react";
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
import type { ChartView } from "./ReplayChart";
import ReplayChart from "./ReplayChart";
import ReplayOverlay, { type ReplayTool } from "./ReplayOverlay";
import ReplayControls from "./ReplayControls";
import ReplayTicket from "./ReplayTicket";
import ReplayPanels from "./ReplayPanels";
import type { ReplayQuote } from "./useReplaySession";
import type { Drawing, PlaceOrderInput, ReplaySessionState } from "@/modules/replay";
import { nyTimeOf } from "@/modules/replay";

export interface TerminalProps {
  accountName: string;
  state: ReplaySessionState | null;
  candles: import("@/modules/replay").SimulatedCandle[];
  bounds: { ethStart: number; ethEnd: number; rthStart: number; rthEnd: number };
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

  const fitChart = () => viewRef.current.chart?.timeScale().fitContent();
  const resetChart = () => viewRef.current.chart?.timeScale().resetTimeScale();

  const q = props.quote;
  const balanceTone = q && q.equity - q.balance ? pnlTone(q.equity - q.balance) : "neutral";

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
          NQ
        </span>
        <span className="hidden text-xs text-[var(--tv-text-muted)] md:inline">
          {props.accountName}
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
          </div>
          <span className="rounded-xl border border-[var(--tv-accent)]/40 bg-[var(--tv-accent)]/10 px-3 py-1.5 font-mono text-xs font-bold text-[var(--tv-accent)]">
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
          </div>
          <div className="relative min-h-0 flex-1 bg-[var(--tv-plate-0)]">
            <ReplayChart
              candles={props.candles}
              refsView={viewRef}
              viewTf={props.viewTf}
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
              onMoveOrder={props.onMoveOrder}
            />
            {hover && (
              <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)]/95 px-2 py-1 font-mono text-[10px] text-[var(--tv-text-muted)]">
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
        </main>

        {/* Panneau droit */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--tv-border)] bg-[var(--tv-plate-2)] lg:flex xl:w-[320px]">
          <ReplayTicket price={q?.mark ?? null} onPlace={props.onPlaceOrder} />
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

function HeaderStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="text-right">
      <div className="text-[9.5px] font-medium uppercase tracking-wide text-[var(--tv-text-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-xs font-bold",
          tone === "up"
            ? "text-[var(--tv-chart-green)]"
            : tone === "down"
              ? "text-[var(--tv-chart-red)]"
              : "text-[var(--tv-text)]",
        )}
      >
        {value}
      </div>
    </div>
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
