import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { Trade, MissedOpportunity } from "../types";
import { loadMissedOpportunities } from "../store";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";

import { cn } from "../utils/cn";
import TradeDetailModal from "../components/TradeDetailModal";
import MissedSetupDetailModal from "../components/MissedSetupDetailModal";
import MissedOpportunities from "./MissedOpportunities";
import { useT } from "../i18n/LanguageContext";
import { PageHeader } from "@/shared/ui";

interface CalendarPageProps {
  trades: Trade[];
}

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-PT",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  ru: "ru-RU",
  zh: "zh-CN",
  ja: "ja-JP",
  ar: "ar-SA",
  hi: "hi-IN",
};

export default function CalendarPage({ trades }: CalendarPageProps) {
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || "en-US";
  const MONTHS = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, i, 1)),
      ),
    [locale],
  );
  const DAYS = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2023, 0, 2 + i)),
      ),
    [locale],
  );
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMissed, setSelectedMissed] = useState<MissedOpportunity | null>(null);
  const [missed, setMissed] = useState<MissedOpportunity[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadMissedOpportunities(user.id)
      .then((d) => {
        if (active) setMissed(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, activeId]);

  const missedByDate = useMemo(() => {
    const map: Record<string, MissedOpportunity[]> = {};
    for (const m of missed) (map[m.date] ??= []).push(m);
    return map;
  }, [missed]);

  const dailyData = useMemo(() => {
    const map: Record<
      string,
      {
        pnl: number;
        count: number;
        trades: Trade[];
        avgRR: number;
        totalRR: number;
        wins: number;
        breakEven: number;
        winRate: number;
      }
    > = {};
    for (const t of trades) {
      if (!map[t.date])
        map[t.date] = {
          pnl: 0,
          count: 0,
          trades: [],
          avgRR: 0,
          totalRR: 0,
          wins: 0,
          breakEven: 0,
          winRate: 0,
        };
      map[t.date].pnl += t.pnl;
      map[t.date].count++;
      map[t.date].trades.push(t);
      map[t.date].avgRR += Math.abs(t.rMultiple);
      map[t.date].totalRR += t.rMultiple;
      if (t.direction === "be") map[t.date].breakEven++;
      else if (t.pnl > 0) map[t.date].wins++;
    }
    for (const k of Object.keys(map)) {
      if (map[k].count > 0) map[k].avgRR = map[k].avgRR / map[k].count;
      const decided = map[k].count - map[k].breakEven;
      map[k].winRate = decided > 0 ? map[k].wins / decided : 0;
    }
    return map;
  }, [trades]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const days: (number | null)[] = [];
    for (let i = 0; i < mondayOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(new Date().getFullYear());
    setMonth(new Date().getMonth());
  };
  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const monthlySummary = useMemo(() => {
    let total = 0,
      tradingDays = 0,
      winDays = 0,
      beDays = 0,
      absRRsum = 0,
      tradeCount = 0,
      decidedTrades = 0,
      totalWins = 0,
      totalRR = 0;
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      const dateStr = getDateStr(d);
      const data = dailyData[dateStr];
      if (data) {
        total += data.pnl;
        tradingDays++;
        if (data.pnl > 0) winDays++;
        if (data.count > 0 && data.count === data.breakEven) beDays++;
        // data.avgRR is already the per-day average; multiply back by count so the
        // monthly figure is a true trade-weighted average, matching Dashboard's avgRR.
        absRRsum += data.avgRR * data.count;
        tradeCount += data.count;
        totalRR += data.totalRR;
        const dec = data.count - data.breakEven;
        decidedTrades += dec;
        totalWins += data.wins;
      }
    }
    return {
      total,
      tradingDays,
      winDays,
      beDays,
      avgRR: tradeCount > 0 ? absRRsum / tradeCount : 0,
      totalRR,
      winRate: decidedTrades > 0 ? totalWins / decidedTrades : 0,
    };
  }, [year, month, dailyData]);

  const selectedTrades = selectedDate ? dailyData[selectedDate]?.trades || [] : [];
  const calendarRows = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) rows.push(calendarDays.slice(i, i + 7));
    return rows;
  }, [calendarDays]);

  // Heatmap scale — the deepest tint maps to the month's single biggest |P&L|
  // day, so cell intensity reads as relative magnitude (Topstep/Lucid style),
  // not just win/loss binary.
  const maxAbsDay = useMemo(() => {
    let m = 0;
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      const data = dailyData[getDateStr(d)];
      if (data && data.count > 0) m = Math.max(m, Math.abs(data.pnl));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, dailyData]);

  // Per-week aggregates for the right-hand summary column.
  const weekTotals = useMemo(
    () =>
      calendarRows.map((row) => {
        let pnl = 0;
        let days = 0;
        for (const day of row) {
          if (day === null) continue;
          const data = dailyData[getDateStr(day)];
          if (data && data.count > 0) {
            pnl += data.pnl;
            days += 1;
          }
        }
        return { pnl, days };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendarRows, dailyData, year, month],
  );

  return (
    <div className="p-3 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        className="mb-3 md:mb-6 stagger-0"
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 mb-3 md:mb-6">
        {[
          {
            label: t("calendar.monthlyPnl"),
            value:
              monthlySummary.tradingDays === 0
                ? "$0.00"
                : `${monthlySummary.total >= 0 ? "" : "-"}$${Math.abs(monthlySummary.total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            color:
              monthlySummary.tradingDays === 0
                ? "text-white"
                : monthlySummary.total > 0
                  ? "text-emerald-400"
                  : monthlySummary.total < 0
                    ? "text-red-400"
                    : "text-white",
            delay: 0,
          },
          {
            label: t("calendar.tradingDays"),
            value: String(monthlySummary.tradingDays),
            color: "text-white",
            delay: 1,
          },
          {
            label: t("calendar.winningDays"),
            value: `${monthlySummary.winDays}/${monthlySummary.tradingDays}`,
            color: monthlySummary.tradingDays === 0 ? "text-white" : "text-emerald-400",
            delay: 2,
          },
          {
            label: t("dashboard.avgRR"),
            value: monthlySummary.avgRR.toFixed(2),
            color: monthlySummary.tradingDays === 0 ? "text-white" : "text-cyan-400",
            delay: 3,
          },
          {
            label: t("calendar.totalRR"),
            value: `${monthlySummary.totalRR.toFixed(2)}R`,
            color:
              monthlySummary.tradingDays === 0
                ? "text-white"
                : monthlySummary.totalRR > 0
                  ? "text-emerald-400"
                  : monthlySummary.totalRR < 0
                    ? "text-red-400"
                    : "text-white",
            delay: 4,
          },
          {
            label: t("stats.winRate"),
            value: `${(monthlySummary.winRate * 100).toFixed(1)}%`,
            color:
              monthlySummary.tradingDays === 0
                ? "text-white"
                : monthlySummary.winRate > 0.5
                  ? "text-emerald-400"
                  : monthlySummary.winRate < 0.5
                    ? "text-red-400"
                    : "text-white",
            delay: 5,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={cn(
              "glass rounded-xl md:rounded-2xl p-2.5 md:p-4 card-premium animate-fade-in-up",
              `stagger-${card.delay}`,
            )}
          >
            <div className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5 md:mb-1">
              {card.label}
            </div>
            <div
              className={cn(
                "font-display text-sm md:text-xl font-extrabold tabular-nums",
                card.color,
              )}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="glass rounded-2xl md:rounded-3xl overflow-hidden animate-fade-in-up stagger-5">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-5 border-b border-white/[0.06]">
          <button
            onClick={prevMonth}
            aria-label={t("common.previous")}
            className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="text-base md:text-lg font-bold text-white">
              {MONTHS[month]} '{String(year).slice(-2)}
            </h3>
            <button
              onClick={goToday}
              className="text-[10px] md:text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-2 md:px-3 py-1 rounded-lg hover:bg-cyan-500/10 transition-all active:scale-95"
            >
              {t("calendar.today")}
            </button>
          </div>
          <button
            onClick={nextMonth}
            aria-label={t("common.next")}
            className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-8 border-b border-white/[0.06]">
          {DAYS.map((d, i) => (
            <div
              key={d + i}
              className={cn(
                "py-2 md:py-3 text-center text-[8px] md:text-[10px] font-bold uppercase tracking-widest",
                i >= 5 ? "text-slate-700" : "text-slate-500",
              )}
            >
              {d}
            </div>
          ))}
          <div className="py-2 md:py-3 text-center text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-slate-600 border-l border-white/[0.06]">
            {t("calendar.week")}
          </div>
        </div>
        <div className="p-1.5 md:p-3 space-y-1 md:space-y-2">
          {calendarRows.map((row, rowIdx) => {
            const week = weekTotals[rowIdx];
            return (
              <div key={rowIdx} className="grid grid-cols-8 gap-1 md:gap-2">
                {row.map((day, colIdx) => {
                  if (day === null)
                    return <div key={`e-${rowIdx}-${colIdx}`} className="h-14 md:min-h-[104px]" />;
                  const dateStr = getDateStr(day);
                  const data = dailyData[dateStr];
                  const isAllBE = data && data.count > 0 && data.count === data.breakEven;
                  const isWin = data && !isAllBE && data.pnl > 0;
                  const isLoss = data && !isAllBE && data.pnl < 0;
                  const isToday = dateStr === new Date().toISOString().split("T")[0];
                  const isWeekend = colIdx >= 5;
                  const dayMissed = missedByDate[dateStr] || [];
                  const missedCount = dayMissed.length;

                  // Heatmap intensity: 0 → the day with the largest |P&L| this month.
                  const mag =
                    data && maxAbsDay > 0 ? Math.min(1, Math.abs(data.pnl) / maxAbsDay) : 0;
                  const a = 0.08 + 0.34 * mag; // fill alpha
                  const b = 0.18 + 0.24 * mag; // border alpha
                  let cellStyle: CSSProperties | undefined;
                  if (isWin)
                    cellStyle = {
                      background: `linear-gradient(155deg, rgba(16,185,129,${a}), rgba(16,185,129,${a * 0.35}))`,
                      borderColor: `rgba(16,185,129,${b})`,
                    };
                  else if (isLoss)
                    cellStyle = {
                      background: `linear-gradient(155deg, rgba(244,63,63,${a}), rgba(244,63,63,${a * 0.35}))`,
                      borderColor: `rgba(244,63,63,${b})`,
                    };
                  else if (isAllBE)
                    cellStyle = {
                      background: "rgba(148,163,184,0.10)",
                      borderColor: "rgba(148,163,184,0.22)",
                    };

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (data) setSelectedDate(dateStr);
                        else if (dayMissed.length > 0) setSelectedMissed(dayMissed[0]);
                      }}
                      disabled={!data && missedCount === 0}
                      style={cellStyle}
                      className={cn(
                        "h-14 md:min-h-[104px] md:p-2.5 p-1.5 rounded-lg md:rounded-xl text-left transition-all duration-200 relative overflow-hidden border flex flex-col",
                        !cellStyle && !missedCount && "border-white/[0.05]",
                        !cellStyle && isWeekend && "bg-white/[0.01]",
                        !cellStyle && missedCount > 0 && "bg-amber-500/[0.06] border-amber-500/20",
                        isToday && "ring-1 ring-inset ring-cyan-400/60",
                        (data || missedCount > 0) &&
                          "cursor-pointer hover:brightness-125 active:scale-[0.97]",
                      )}
                    >
                      {/* Day number */}
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-[10px] md:text-xs font-semibold tabular-nums",
                            isToday
                              ? "text-cyan-300"
                              : data
                                ? "text-slate-300"
                                : isWeekend
                                  ? "text-slate-700"
                                  : "text-slate-600",
                          )}
                        >
                          {day}
                        </span>
                        {missedCount > 0 && (
                          <span
                            className="flex items-center gap-0.5 text-amber-300 text-[8px] md:text-[10px] font-bold"
                            title={`${missedCount} ${t("missed.title")}`}
                          >
                            <Target className="w-2 h-2 md:w-2.5 md:h-2.5" />
                            {missedCount}
                          </span>
                        )}
                      </div>

                      {/* P&L — the hero number, centered in the cell */}
                      {data && (
                        <div className="flex-1 flex flex-col justify-center">
                          <div
                            className={cn(
                              "font-display text-[11px] md:text-base font-extrabold tabular-nums leading-none",
                              isAllBE
                                ? "text-slate-300"
                                : isWin
                                  ? "text-emerald-300"
                                  : isLoss
                                    ? "text-red-300"
                                    : "text-slate-400",
                            )}
                          >
                            {isAllBE
                              ? t("common.be")
                              : `${data.pnl >= 0 ? "+" : "−"}$${Math.abs(data.pnl).toFixed(0)}`}
                          </div>
                        </div>
                      )}

                      {/* Footer: trade count + RR */}
                      {data && (
                        <div className="flex items-center gap-1.5 text-[7px] md:text-[10px] font-semibold tabular-nums">
                          <span className="text-slate-400">
                            {data.count}{" "}
                            {data.count === 1 ? t("calendar.trade") : t("calendar.trades")}
                          </span>
                          {data.avgRR > 0 && (
                            <span className="text-cyan-400/80 hidden md:inline">
                              {data.avgRR.toFixed(1)}R
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Weekly summary column */}
                <div
                  className={cn(
                    "h-14 md:min-h-[104px] rounded-lg md:rounded-xl p-1.5 md:p-2.5 flex flex-col justify-center border border-white/[0.04] bg-white/[0.015]",
                    week.days === 0 && "opacity-40",
                  )}
                >
                  <div className="text-[7px] md:text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                    {t("calendar.week")} {rowIdx + 1}
                  </div>
                  <div
                    className={cn(
                      "font-display text-[11px] md:text-sm font-extrabold tabular-nums leading-none",
                      week.days === 0
                        ? "text-slate-600"
                        : week.pnl > 0
                          ? "text-emerald-400"
                          : week.pnl < 0
                            ? "text-red-400"
                            : "text-slate-300",
                    )}
                  >
                    {week.days === 0
                      ? "—"
                      : `${week.pnl >= 0 ? "+" : "−"}$${Math.abs(week.pnl).toFixed(0)}`}
                  </div>
                  {week.days > 0 && (
                    <div className="text-[7px] md:text-[10px] text-slate-500 tabular-nums mt-0.5">
                      {week.days} {week.days === 1 ? t("calendar.day") : t("calendar.days")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-6 mt-4 px-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20" />
          <span className="text-[10px] text-slate-500">{t("calendar.legendWinningDay")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-red-500/15 to-red-600/5 border border-red-500/15" />
          <span className="text-[10px] text-slate-500">{t("calendar.legendLosingDay")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-600/5 border border-slate-500/25" />
          <span className="text-[10px] text-slate-500">{t("calendar.legendBreakEvenDay")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg ring-1 ring-cyan-500/40" />
          <span className="text-[10px] text-slate-500">{t("calendar.legendToday")}</span>
        </div>
        {/* Heatmap intensity scale — deeper tint = bigger day. */}
        <div className="flex items-center gap-2">
          <div
            className="w-16 h-3 rounded"
            style={{
              background:
                "linear-gradient(90deg, rgba(244,63,63,0.42), rgba(244,63,63,0.08), rgba(16,185,129,0.08), rgba(16,185,129,0.42))",
            }}
          />
          <span className="text-[10px] text-slate-500">{t("calendar.legendHeat")}</span>
        </div>
      </div>

      {selectedDate && selectedTrades.length > 0 && (
        <TradeDetailModal
          trades={selectedTrades}
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          missed={missedByDate[selectedDate] || []}
          onOpenMissed={(m) => {
            setSelectedDate(null);
            setSelectedMissed(m);
          }}
        />
      )}

      {selectedMissed && (
        <MissedSetupDetailModal missed={selectedMissed} onClose={() => setSelectedMissed(null)} />
      )}

      {/* Mobile: Missed Opportunities embedded below calendar */}
      <div className="md:hidden mt-6">
        <MissedOpportunities />
      </div>
    </div>
  );
}
