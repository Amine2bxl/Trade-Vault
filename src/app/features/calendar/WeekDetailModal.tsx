import { ChevronRight, X } from "lucide-react";
import { Modal } from "@/shared/ui";
import { formatMoney } from "@/shared/currency";
import { isBreakEven, type Trade } from "@/app/types";
import type { GridDay } from "./calendarGrid";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/app/utils/cn";

/**
 * LA SEMAINE, OUVERTE.
 *
 * Le total de semaine était une case muette — et masquée sur téléphone. Il
 * s'ouvre maintenant sur ce qui l'a produit : les sept jours, leurs trades, le
 * résultat. Les jours d'un mois voisin restent affichés (c'est la vraie
 * semaine) mais à part, marqués, et JAMAIS dans les totaux : consulter
 * septembre ne doit pas faire compter un trade du 1er octobre.
 */

interface DayData {
  pnl: number;
  count: number;
  trades: Trade[];
}

export default function WeekDetailModal({
  days,
  weekIndex,
  monthLabel,
  byDate,
  locale,
  onClose,
  onOpenDay,
}: {
  days: GridDay[];
  weekIndex: number;
  monthLabel: string;
  byDate: Record<string, DayData | undefined>;
  locale: string;
  onClose: () => void;
  /** Ouvre le détail d'une journée (la modale de la journée). */
  onOpenDay: (date: string) => void;
}) {
  const { t } = useT();
  const inMonth = days.filter((d) => d.inMonth);
  const monthTrades = inMonth.flatMap((d) => byDate[d.date]?.trades ?? []);
  const pnl = monthTrades.reduce((s, x) => s + x.pnl, 0);
  const decided = monthTrades.filter((x) => !isBreakEven(x));
  const wins = decided.filter((x) => x.pnl > 0).length;
  const winRate = decided.length > 0 ? wins / decided.length : null;
  const tradedDays = inMonth.filter((d) => (byDate[d.date]?.count ?? 0) > 0).length;
  const dayFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const rangeFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const at = (iso: string) => new Date(`${iso}T12:00:00`);
  const range = `${rangeFmt.format(at(days[0].date))} – ${rangeFmt.format(at(days[6].date))}`;
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(byDate[d.date]?.pnl ?? 0)));
  const tone = (v: number) =>
    v > 0
      ? "text-[var(--tv-chart-green)]"
      : v < 0
        ? "text-[var(--tv-chart-red)]"
        : "text-slate-300";

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-xl max-h-[92vh] overflow-hidden"
      labelledBy="week-title"
    >
      <div className="flex max-h-[92vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--tv-border)] px-5 pb-4 pt-5">
          <div className="min-w-0">
            <p className="tv-label text-slate-500">
              {t("calendar.week")} {weekIndex + 1} · {monthLabel}
            </p>
            <h2 id="week-title" className="tv-title mt-1 tracking-tight">
              {range}
            </h2>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="cal-nav-btn">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-px border-b border-[var(--tv-border)] bg-[var(--tv-border)] sm:grid-cols-4">
          {[
            {
              label: t("calendar.weekPnl"),
              value: tradedDays ? formatMoney(pnl, { signed: true }) : "—",
              cls: tradedDays ? tone(pnl) : "text-slate-500",
            },
            {
              label: t("calendar.weekTrades"),
              value: String(monthTrades.length),
              cls: "text-white",
            },
            {
              label: t("stats.winRate"),
              value: winRate === null ? "—" : `${Math.round(winRate * 100)}%`,
              cls: "text-white",
            },
            { label: t("calendar.tradingDays"), value: String(tradedDays), cls: "text-white" },
          ].map((k) => (
            <div key={k.label} className="bg-[var(--tv-plate-1)] px-4 py-3">
              <div className="tv-label text-slate-500">{k.label}</div>
              <div className={cn("tv-figure mt-1 text-lg font-semibold", k.cls)}>{k.value}</div>
            </div>
          ))}
        </div>

        <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {days.map((d) => {
            const data = byDate[d.date];
            const count = data?.count ?? 0;
            return (
              <li key={d.date} className={cn("rounded-xl", !d.inMonth && "opacity-55")}>
                <div className="flex items-center gap-3 px-2 py-2">
                  <span
                    className={cn(
                      "tv-figure w-[5.5rem] shrink-0 text-xs capitalize",
                      d.inMonth ? "text-slate-300" : "text-slate-500",
                    )}
                  >
                    {dayFmt.format(at(d.date))}
                  </span>
                  {/* La barre dit l'ampleur relative de la journée dans la semaine. */}
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                    {count > 0 && (
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.max(6, (Math.abs(data!.pnl) / maxAbs) * 100)}%`,
                          background:
                            data!.pnl >= 0
                              ? "rgb(var(--tv-chart-green-rgb) / 0.55)"
                              : "rgb(var(--tv-chart-red-rgb) / 0.55)",
                        }}
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      "tv-figure w-24 shrink-0 text-right text-sm font-semibold",
                      count ? tone(data!.pnl) : "text-slate-600",
                    )}
                  >
                    {count ? formatMoney(data!.pnl, { signed: true }) : "—"}
                  </span>
                </div>
                {!d.inMonth && count > 0 && (
                  <p className="px-2 pb-1 text-[11px] text-slate-500">
                    {t("calendar.outsideMonthNote")}
                  </p>
                )}
                {count > 0 && (
                  <ul className="mb-2 ml-2 space-y-1 border-l border-[var(--tv-border)] pl-3">
                    {data!.trades.map((tr) => (
                      <li key={tr.id}>
                        <button
                          onClick={() => onOpenDay(d.date)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-white">
                            <span className="font-semibold">{tr.symbol}</span>
                            <span className="ml-2 text-xs text-slate-500">
                              {[tr.entryTime, tr.strategy].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          {Number.isFinite(tr.rMultiple) && tr.rMultiple !== 0 && (
                            <span className="tv-figure text-xs text-slate-400">
                              {tr.rMultiple > 0 ? "+" : ""}
                              {tr.rMultiple.toFixed(1)}R
                            </span>
                          )}
                          <span
                            className={cn(
                              "tv-figure w-20 text-right text-sm",
                              isBreakEven(tr) ? "text-slate-300" : tone(tr.pnl),
                            )}
                          >
                            {isBreakEven(tr)
                              ? t("common.be")
                              : formatMoney(tr.pnl, { signed: true })}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </Modal>
  );
}
