import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Info, Newspaper, FilterX } from "lucide-react";
import {
  EconomicEvent,
  ImpactLevel,
  Currency,
  CURRENCIES,
  getEventsForWeek,
  startOfWeek,
  addDays,
  isoDate,
  formatLocalTime,
} from "../utils/economicEvents";
import { useT } from "../i18n/LanguageContext";
import { Skeleton } from "../components/Skeleton";
import { cn } from "../utils/cn";

const IMPACT_STYLES: Record<ImpactLevel, { dot: string; chip: string }> = {
  high: {
    dot: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]",
    chip: "bg-red-500/10 border-red-500/25 text-red-400",
  },
  medium: {
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
    chip: "bg-amber-500/10 border-amber-500/25 text-amber-400",
  },
  low: { dot: "bg-slate-500", chip: "bg-white/[0.04] border-white/[0.08] text-slate-400" },
};

const CURRENCY_FLAGS: Record<Currency, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
};

export default function EconomicNews() {
  const { t, lang } = useT();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<EconomicEvent[] | null>(null);
  const [currency, setCurrency] = useState<Currency | "all">("all");
  const [impact, setImpact] = useState<ImpactLevel | "all">("all");

  // Provider is async by contract (so a live API can slot in later) —
  // the skeleton covers the pending window either way.
  useEffect(() => {
    let active = true;
    setEvents(null);
    getEventsForWeek(weekStart)
      .then((ev) => {
        if (active) setEvents(ev);
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [weekStart]);

  const todayIso = isoDate(new Date());
  const isCurrentWeek = isoDate(startOfWeek(new Date())) === isoDate(weekStart);

  const filtered = useMemo(
    () =>
      (events ?? []).filter(
        (e) =>
          (currency === "all" || e.currency === currency) &&
          (impact === "all" || e.impact === impact),
      ),
    [events, currency, impact],
  );

  // Group by day, keep the 5 weekdays + any weekend event
  const days = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (let i = 0; i < 7; i++) {
      const dIso = isoDate(addDays(weekStart, i));
      const dayEvents = filtered.filter((e) => e.date === dIso);
      if (i < 5 || dayEvents.length > 0) map.set(dIso, dayEvents);
    }
    return [...map.entries()];
  }, [filtered, weekStart]);

  const weekLabel = `${addDays(weekStart, 0).toLocaleDateString(lang, { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString(lang, { day: "numeric", month: "short" })}`;
  const hasActiveFilters = currency !== "all" || impact !== "all";

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("news.title")}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{t("news.subtitle")}</p>
        </div>
        {/* Week navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            aria-label="Previous week"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className={cn(
              "h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5",
              isCurrentWeek
                ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white",
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" /> {t("news.thisWeek")}
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            aria-label="Next week"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Indicative-schedule notice */}
      <div className="glass rounded-2xl px-4 py-3 mb-4 flex items-start gap-2.5 animate-fade-in-up stagger-1 border border-cyan-500/10">
        <Info className="w-4 h-4 text-cyan-400/80 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          {t("news.indicative")} <span className="text-slate-500">· {t("news.localTime")}.</span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5 animate-fade-in-up stagger-1">
        <span className="text-lg font-bold text-white font-display mr-1">{weekLabel}</span>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={currency === "all"} onClick={() => setCurrency("all")}>
            {t("news.allCurrencies")}
          </FilterChip>
          {CURRENCIES.map((c) => (
            <FilterChip
              key={c}
              active={currency === c}
              onClick={() => setCurrency(currency === c ? "all" : c)}
            >
              {CURRENCY_FLAGS[c]} {c}
            </FilterChip>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["high", "medium", "low"] as const).map((lvl) => (
            <FilterChip
              key={lvl}
              active={impact === lvl}
              onClick={() => setImpact(impact === lvl ? "all" : lvl)}
            >
              <span
                className={cn("w-1.5 h-1.5 rounded-full inline-block mr-1", IMPACT_STYLES[lvl].dot)}
              />
              {t(`news.${lvl}` as never)}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Week list */}
      {events === null ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-2xl p-4 space-y-2.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center animate-fade-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
            <Newspaper className="w-6 h-6 text-slate-600" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">{t("news.noEvents")}</h3>
          <p className="text-xs text-slate-500 mb-4">{t("news.noEventsSub")}</p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setCurrency("all");
                setImpact("all");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/15 transition-all"
            >
              <FilterX className="w-3.5 h-3.5" /> {t("news.clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {days.map(([dIso, dayEvents], di) => {
            const d = new Date(dIso + "T00:00:00");
            const isToday = dIso === todayIso;
            return (
              <div
                key={dIso}
                className={cn(
                  "glass rounded-2xl overflow-hidden card-premium animate-fade-in-up border",
                  isToday ? "border-cyan-500/20" : "border-transparent",
                  `stagger-${Math.min(di + 2, 7)}`,
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.05]",
                    isToday && "bg-cyan-500/[0.05]",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider font-display",
                      isToday ? "text-cyan-300" : "text-slate-300",
                    )}
                  >
                    {d.toLocaleDateString(lang, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  {isToday && (
                    <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-[9px] font-bold uppercase tracking-wider">
                      {t("news.today")}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-slate-600 tabular-nums">
                    {dayEvents.length}
                  </span>
                </div>
                {dayEvents.length === 0 ? (
                  <div className="px-4 py-3.5 text-[11px] text-slate-600">—</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {dayEvents.map((e) => (
                      <EventRow key={e.id} event={e} t={t} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventRow({ event, t }: { event: EconomicEvent; t: (k: never) => string }) {
  const [openNote, setOpenNote] = useState(false);
  const s = IMPACT_STYLES[event.impact];
  return (
    <div
      className="px-4 py-2.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
      onClick={() => setOpenNote((v) => !v)}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-300 tabular-nums w-12 shrink-0">
          {formatLocalTime(event.date, event.etHour, event.etMinute)}
        </span>
        <span className={cn("w-2 h-2 rounded-full shrink-0", s.dot)} />
        <span className="px-1.5 py-0.5 rounded-md border text-[9px] font-bold shrink-0 bg-white/[0.03] border-white/[0.08] text-slate-400">
          {CURRENCY_FLAGS[event.currency]} {event.currency}
        </span>
        <span className="text-sm text-slate-200 font-medium min-w-0 truncate">{event.name}</span>
        {event.approximate && (
          <span className="hidden sm:inline px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-slate-500 text-[9px] font-semibold shrink-0">
            {t("news.approx" as never)}
          </span>
        )}
        <span
          className={cn(
            "ml-auto px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wide shrink-0",
            s.chip,
          )}
        >
          {t(`news.${event.impact}` as never)}
        </span>
      </div>
      {openNote && (
        <p className="mt-2 ml-[60px] mr-2 text-[11px] leading-relaxed text-slate-400 animate-fade-in">
          {event.note}
        </p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-2.5 rounded-lg border text-[11px] font-semibold transition-all",
        active
          ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
          : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]",
      )}
    >
      {children}
    </button>
  );
}
