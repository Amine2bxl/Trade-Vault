import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, Trash2, ChevronLeft, ChevronRight, Target } from "@/shared/ui/icons";
import { Trade, MissedOpportunity, isBreakEven } from "@/app/types";
import { formatPnl, getDuration, directionLabel, directionBadgeClass } from "@/domain/tradeCalcs";
import { getSession } from "@/domain/quantStats";
import { cn } from "@/shared/ui/cn";
import { Button, Disclosure, Modal } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import type { TradeIntent, TradeReflection } from "@/app/store/tradeIntel";
import { ScreenshotImage } from "@/app/components/ScreenshotImage";
import {
  TradeConfidence,
  TradeConfluences,
  TradeIntentFlow,
  TradeMetrics,
  TradeMistakes,
  TradeNotes,
  TradeRisk,
} from "./TradeDetailParts";

/**
 * L'APERÇU D'UN TRADE SUR TÉLÉPHONE — une feuille plein écran, simple.
 *
 * La modale du bureau, posée telle quelle sur un téléphone, montrait tout à la
 * fois : cinq tuiles de mesures, le risque, la confiance, les étiquettes, les
 * captures en petit et un ✕ de 36 px coincé à côté du P&L. Trop grand, on ne
 * comprenait rien, et c'était dur à quitter.
 *
 * Ici, dans l'ordre où on lit un trade :
 *   1. une barre du haut FIXE : la date, ‹ › pour passer au trade voisin, et
 *      un ✕ de 44 px ; on ferme aussi en glissant la feuille vers le bas ;
 *   2. un résumé : symbole, sens, P&L, R, heures ;
 *   3. les captures en carrousel pleine largeur (toucher = plein écran) ;
 *   4. les notes ;
 *   5. le reste — avant/après, erreurs, détails — dans des sections repliées.
 *
 * Les blocs d'information sont ceux de la modale (`TradeDetailParts`) : les
 * deux formes ne peuvent pas diverger. Le bureau ne change pas.
 */

/** Distance (px) ou vitesse (px/ms) d'un glissé vers le bas qui ferme. */
const CLOSE_DISTANCE = 120;
const CLOSE_FLICK = { distance: 50, speed: 0.5 };
/** Distance (px) d'un balayage horizontal qui passe au trade voisin. */
const NAV_DISTANCE = 64;
const EXIT_MS = 180;

export interface TradeDetailSheetProps {
  trades: Trade[];
  dateStr: string;
  dayPnl: number;
  macro: string[];
  missed: MissedOpportunity[];
  onOpenMissed?: (m: MissedOpportunity) => void;
  onClose: () => void;
  onNavigate?: (dir: 1 | -1) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string;
  onDelete?: (id: string) => void;
  intents: Record<string, TradeIntent>;
  reflections: Record<string, TradeReflection>;
  screenshotUrls: Record<string, string>;
  onOpenShot: (paths: string[], index: number) => void;
  /** La visionneuse plein écran, montée dans la même couche. */
  children?: ReactNode;
}

export default function TradeDetailSheet({
  trades,
  dateStr,
  dayPnl,
  macro,
  missed,
  onOpenMissed,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  positionLabel,
  onDelete,
  intents,
  reflections,
  screenshotUrls,
  onOpenShot,
  children,
}: TradeDetailSheetProps) {
  const { t } = useT();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Un autre trade s'affiche : on repart du haut, comme une nouvelle page.
  const firstId = trades[0]?.id;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [firstId]);

  /** Fermeture au glissé : la feuille finit sa course vers le bas, puis part. */
  const slideAway = useCallback(
    (panel: HTMLElement) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onClose();
        return;
      }
      panel.style.transition = `transform ${EXIT_MS}ms var(--tv-ease-out)`;
      panel.style.transform = "translateY(100%)";
      window.setTimeout(onClose, EXIT_MS);
    },
    [onClose],
  );

  // Les gestes : glisser vers le bas pour fermer (depuis la barre, ou depuis
  // le contenu quand il est en haut), balayer de côté pour changer de trade
  // (sauf dans le carrousel, qui défile ses captures). Écouteurs natifs : le
  // glissé doit pouvoir empêcher le rebond du défilement (`passive: false`).
  useEffect(() => {
    const root = rootRef.current;
    const scroller = scrollRef.current;
    const panel = root?.closest<HTMLElement>('[role="dialog"]');
    if (!root || !scroller || !panel) return;
    let start: { x: number; y: number; t: number; atTop: boolean; inCarousel: boolean } | null =
      null;
    let mode: "down" | "side" | "none" | null = null;
    let dy = 0;

    const reset = () => {
      panel.style.transition = "";
      panel.style.transform = "";
      start = null;
      mode = null;
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      const target = e.target as Element;
      start = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: Date.now(),
        atTop: !scroller.contains(target) || scroller.scrollTop <= 0,
        inCarousel: !!target.closest("[data-carousel]"),
      };
      mode = null;
      dy = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - start.x;
      const d = e.touches[0].clientY - start.y;
      if (mode === null) {
        if (Math.abs(dx) < 8 && Math.abs(d) < 8) return;
        if (d > 0 && Math.abs(d) > Math.abs(dx) && start.atTop) mode = "down";
        else if (!start.inCarousel && Math.abs(dx) > Math.abs(d)) mode = "side";
        else mode = "none";
        if (mode === "down") {
          // L'entrée animée tient `transform` : on la coupe pour suivre le doigt.
          panel.style.animation = "none";
          panel.style.transition = "none";
        }
      }
      if (mode === "down") {
        e.preventDefault();
        dy = Math.max(0, d);
        panel.style.transform = `translateY(${dy}px)`;
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const s = start;
      if (mode === "down") {
        const speed = dy / Math.max(1, Date.now() - s.t);
        if (dy > CLOSE_DISTANCE || (dy > CLOSE_FLICK.distance && speed > CLOSE_FLICK.speed)) {
          start = null;
          mode = null;
          slideAway(panel);
          return;
        }
      } else if (mode === "side" && onNavigate) {
        const dx = e.changedTouches[0].clientX - s.x;
        const d = e.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) >= NAV_DISTANCE && Math.abs(dx) >= Math.abs(d) * 1.5) {
          if (dx > 0 && hasPrev) onNavigate(-1);
          else if (dx < 0 && hasNext) onNavigate(1);
        }
      }
      reset();
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", reset);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", reset);
    };
  }, [onNavigate, hasPrev, hasNext, slideAway]);

  const navButton = (dir: 1 | -1, enabled: boolean | undefined) => (
    <button
      type="button"
      onClick={() => onNavigate?.(dir)}
      disabled={!enabled}
      aria-label={dir < 0 ? t("common.previous") : t("common.next")}
      className={cn(
        "grid h-11 w-10 place-items-center rounded-xl transition-colors",
        enabled ? "text-slate-300 active:bg-white/[0.06]" : "text-slate-700",
      )}
    >
      {dir < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy={titleId}
      wrapperClassName="tv-trade-sheet-wrap"
      className="tv-trade-sheet"
    >
      <div ref={rootRef} className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-[var(--tv-border)] pb-1.5 pl-4 pr-1.5">
          {/* La poignée dit « ça se glisse ». */}
          <div aria-hidden className="mx-auto mb-1 mt-2 h-1 w-10 rounded-full bg-white/15" />
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="tv-num tv-title truncate">
                {dateStr}
              </h2>
              <p className="truncate text-xs text-slate-500">
                <span className="tv-num">
                  {trades.length}{" "}
                  {trades.length !== 1
                    ? t("tradeDetail.tradesCountSuffix")
                    : t("tradeDetail.tradeCountSuffix")}
                </span>
                {trades.length > 1 && (
                  <>
                    {" · "}
                    <span
                      className={cn("tv-num", dayPnl >= 0 ? "text-emerald-400" : "text-red-400")}
                    >
                      {formatPnl(dayPnl)}
                    </span>
                  </>
                )}
              </p>
            </div>
            {onNavigate && (
              <div className="flex shrink-0 items-center">
                {navButton(-1, hasPrev)}
                {positionLabel && (
                  <span className="tv-figure tv-figure-secondary min-w-[32px] text-center text-[10px] text-slate-500">
                    {positionLabel}
                  </span>
                )}
                {navButton(1, hasNext)}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-200 active:bg-white/[0.06]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
        >
          {(macro.length > 0 || missed.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {macro.map((ev) => (
                <span
                  key={ev}
                  className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300"
                  title={t("tradeDetail.macroHint")}
                >
                  {ev}
                </span>
              ))}
              {missed.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpenMissed?.(m)}
                  className="flex min-h-[36px] items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 text-xs font-bold text-amber-300"
                >
                  <Target className="h-3.5 w-3.5" />
                  {t("tradeDetail.missedSetup")}
                  {m.symbol ? `: ${m.symbol}` : ""}
                </button>
              ))}
            </div>
          )}

          {trades.map((trade) => (
            <SheetTrade
              key={trade.id}
              trade={trade}
              intent={intents[trade.id] ?? null}
              reflection={reflections[trade.id] ?? null}
              screenshotUrls={screenshotUrls}
              onOpenShot={onOpenShot}
            />
          ))}

          {onDelete && trades.length === 1 && (
            <Button variant="danger" className="h-11 w-full" onClick={() => onDelete(trades[0].id)}>
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
          )}
        </div>
      </div>
      {children}
    </Modal>
  );
}

function SheetTrade({
  trade,
  intent,
  reflection,
  screenshotUrls,
  onOpenShot,
}: {
  trade: Trade;
  intent: TradeIntent | null;
  reflection: TradeReflection | null;
  screenshotUrls: Record<string, string>;
  onOpenShot: (paths: string[], index: number) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<Record<"flow" | "mistakes" | "details", boolean>>({
    flow: false,
    mistakes: false,
    details: false,
  });
  const toggle = (k: keyof typeof open) => (v: boolean) => setOpen((o) => ({ ...o, [k]: v }));
  const be = isBreakEven(trade);
  const tone = be ? "text-slate-300" : trade.pnl >= 0 ? "text-emerald-400" : "text-red-400";
  const session = getSession(trade.entryTime);
  const times =
    trade.entryTime || trade.exitTime
      ? `${trade.entryTime || "—"} → ${trade.exitTime || "—"} · ${getDuration(trade.entryTime, trade.exitTime)}`
      : "";

  return (
    <article className="space-y-3 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-3.5">
      {/* Résumé : ce qu'on cherche en ouvrant un trade. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-bold text-white">{trade.symbol}</span>
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold",
                directionBadgeClass(trade.direction),
              )}
            >
              {directionLabel(trade.direction)}
            </span>
            {session && (
              <span className="tv-label shrink-0 rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-400">
                {t(`session.${session}` as never)}
              </span>
            )}
          </div>
          {(trade.strategy || times) && (
            <p className="mt-1 truncate text-xs text-slate-500">
              {trade.strategy}
              {trade.strategy && times ? " · " : ""}
              {times && <span className="tv-num">{times}</span>}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={cn("tv-figure text-xl", tone)}>{formatPnl(trade.pnl)}</div>
          <div
            className={cn(
              "tv-figure tv-figure-secondary text-xs",
              trade.rMultiple >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {trade.rMultiple.toFixed(2)}R
          </div>
        </div>
      </div>

      {trade.screenshots.length > 0 && (
        <ShotCarousel
          paths={trade.screenshots}
          urls={screenshotUrls}
          onOpen={(i) => onOpenShot(trade.screenshots, i)}
        />
      )}

      <TradeNotes trade={trade} />

      {(intent || reflection) && (
        <Disclosure title={t("tradeDetail.intentFlow")} open={open.flow} onChange={toggle("flow")}>
          <TradeIntentFlow trade={trade} intent={intent} reflection={reflection} label={false} />
        </Disclosure>
      )}
      {trade.mistakes.length > 0 && (
        <Disclosure
          title={`${t("tradeDetail.mistakes")} · ${trade.mistakes.length}`}
          open={open.mistakes}
          onChange={toggle("mistakes")}
        >
          <TradeMistakes trade={trade} label={false} />
        </Disclosure>
      )}
      <Disclosure title={t("tradeDetail.details")} open={open.details} onChange={toggle("details")}>
        <TradeMetrics trade={trade} />
        <TradeRisk trade={trade} />
        <TradeConfidence trade={trade} />
        <TradeConfluences trade={trade} />
      </Disclosure>
    </article>
  );
}

/** Les captures d'un trade, une par écran : on balaie, on touche pour agrandir. */
function ShotCarousel({
  paths,
  urls,
  onOpen,
}: {
  paths: string[];
  urls: Record<string, string>;
  onOpen: (index: number) => void;
}) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = trackRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const step = first.offsetWidth + 8; // largeur + `gap-2`
    setIndex(Math.min(paths.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
  };

  return (
    <div className="-mx-3.5" data-carousel>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="tv-shot-track flex snap-x snap-mandatory gap-2 overflow-x-auto px-3.5"
      >
        {paths.map((path, i) => (
          <button
            key={path || i}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`${t("tradeDetail.chartScreenshots")} ${i + 1}/${paths.length}`}
            className="w-full shrink-0 snap-center overflow-hidden rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-0)]"
          >
            <ScreenshotImage
              path={path}
              url={urls[path] ?? ""}
              alt={`Chart ${i + 1}`}
              boxClassName="h-56 w-full"
              className="h-56 w-full object-contain"
            />
          </button>
        ))}
      </div>
      {paths.length > 1 && (
        <div aria-hidden className="mt-2 flex justify-center gap-1.5">
          {paths.map((path, i) => (
            <span
              key={path || i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === index ? "bg-slate-200" : "bg-white/15",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
