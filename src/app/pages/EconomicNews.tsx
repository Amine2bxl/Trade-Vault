import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Info,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import {
  getEventsForWeek,
  startOfWeek,
  addDays,
  isoDate,
  formatLocalTime,
  CURRENCIES,
  type Currency,
  type ImpactLevel,
  type EconomicEvent,
} from "../utils/economicEvents";

// Emoji flags keep the currency chips readable with zero image weight.
const CURRENCY_FLAG: Record<Currency, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CHF: "🇨🇭",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CNY: "🇨🇳",
};

const IMPACTS: ImpactLevel[] = ["high", "medium", "low"];

const IMPACT_STYLE: Record<ImpactLevel, { dot: string; text: string; ring: string; bg: string }> = {
  high: { dot: "bg-red-400", text: "text-red-300", ring: "border-red-500/30", bg: "bg-red-500/10" },
  medium: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    ring: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
  low: {
    dot: "bg-slate-400",
    text: "text-slate-300",
    ring: "border-slate-500/25",
    bg: "bg-white/[0.04]",
  },
};

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

export default function EconomicNews() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || "en-US";

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<Set<Currency>>(new Set());
  const [impactFilter, setImpactFilter] = useState<Set<ImpactLevel>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const todayIso = isoDate(new Date());

  useEffect(() => {
    let active = true;
    setLoading(true);
    getEventsForWeek(weekStart)
      .then((ev) => {
        if (active) setEvents(ev);
      })
      .catch(() => {
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [weekStart]);

  const toggleCurrency = (c: Currency) =>
    setCurrencyFilter((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  const toggleImpact = (i: ImpactLevel) =>
    setImpactFilter((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  const clearFilters = () => {
    setCurrencyFilter(new Set());
    setImpactFilter(new Set());
    setSearch("");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (currencyFilter.size > 0 && !currencyFilter.has(e.currency)) return false;
      if (impactFilter.size > 0 && !impactFilter.has(e.impact)) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.currency.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [events, currencyFilter, impactFilter, search]);

  // Group into the 7 days of the week so empty days still render a marker.
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const iso = isoDate(d);
      return { date: d, iso, events: filtered.filter((e) => e.date === iso) };
    });
  }, [weekStart, filtered]);

  const activeFilterCount = currencyFilter.size + impactFilter.size + (search.trim() ? 1 : 0);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return `${fmt.format(weekStart)} – ${fmt.format(end)}`;
  }, [weekStart, locale]);

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" }),
    [locale],
  );

  const isThisWeek = isoDate(weekStart) === isoDate(startOfWeek(new Date()));

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-4 animate-fade-in-up stagger-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("news.title")}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{t("news.subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
          </span>
          {t("news.live")}
        </span>
      </div>

      {/* Week navigator */}
      <div className="glass rounded-2xl p-2.5 mb-3 flex items-center justify-between gap-2 animate-fade-in-up stagger-1">
        <button
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          aria-label={t("news.prevWeek")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold text-white">
            <CalendarDays className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{weekLabel}</span>
          </div>
          {!isThisWeek && (
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
            >
              {t("news.backToWeek")}
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          aria-label={t("news.nextWeek")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2 mb-3 animate-fade-in-up stagger-1">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("news.searchPlaceholder")}
            className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-9 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label={t("news.clear")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "relative h-11 px-3.5 rounded-xl flex items-center gap-2 text-sm font-semibold border transition shrink-0",
            filtersOpen || activeFilterCount > 0
              ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
              : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]",
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">{t("news.filters")}</span>
          {activeFilterCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-[10px] font-bold text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="glass rounded-2xl p-4 mb-3 space-y-4 animate-fade-in-up">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              {t("news.currency")}
            </div>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => {
                const on = currencyFilter.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCurrency(c)}
                    className={cn(
                      "h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition",
                      on
                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                        : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]",
                    )}
                  >
                    <span>{CURRENCY_FLAG[c]}</span>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              {t("news.impact")}
            </div>
            <div className="flex flex-wrap gap-2">
              {IMPACTS.map((i) => {
                const on = impactFilter.has(i);
                const s = IMPACT_STYLE[i];
                const label = {
                  high: t("news.impactHigh"),
                  medium: t("news.impactMedium"),
                  low: t("news.impactLow"),
                }[i];
                return (
                  <button
                    key={i}
                    onClick={() => toggleImpact(i)}
                    className={cn(
                      "h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition",
                      on
                        ? cn(s.bg, s.ring, s.text)
                        : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", s.dot)} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              {t("news.clearFilters")}
            </button>
          )}
        </div>
      )}

      {/* Indicative-times notice */}
      <div className="glass rounded-2xl px-4 py-3 mb-4 flex items-start gap-2.5 animate-fade-in-up stagger-2 border border-cyan-500/10">
        <Info className="w-4 h-4 text-cyan-400/80 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-400">{t("news.notice")}</p>
      </div>

      {/* Days */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-slate-500 text-sm">
          {t("news.noEvents")}
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(({ iso, date, events: dayEvents }) => {
            if (dayEvents.length === 0) return null;
            const isToday = iso === todayIso;
            return (
              <div key={iso} className="animate-fade-in-up">
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span
                    className={cn(
                      "text-xs font-bold capitalize",
                      isToday ? "text-cyan-300" : "text-slate-300",
                    )}
                  >
                    {dayFmt.format(date)}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      {t("news.today")}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[10px] text-slate-600 font-semibold">
                    {dayEvents.length}
                  </span>
                </div>

                {/* Events */}
                <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                  {dayEvents.map((e) => {
                    const s = IMPACT_STYLE[e.impact];
                    const open = expanded === e.id;
                    const time = formatLocalTime(e.date, e.etHour, e.etMinute);
                    return (
                      <div key={e.id}>
                        <button
                          onClick={() => setExpanded(open ? null : e.id)}
                          className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-white/[0.02] transition"
                        >
                          {/* Impact bar */}
                          <span className={cn("w-1 h-9 rounded-full shrink-0", s.dot)} />
                          {/* Time */}
                          <div className="w-12 shrink-0">
                            <div className="text-sm font-bold text-white tabular-nums">{time}</div>
                            {e.approximate && (
                              <div className="text-[8px] text-slate-600 uppercase font-semibold">
                                {t("news.approx")}
                              </div>
                            )}
                          </div>
                          {/* Currency */}
                          <span
                            className={cn(
                              "h-6 px-2 rounded-md flex items-center gap-1 text-[11px] font-bold shrink-0 border",
                              s.bg,
                              s.ring,
                              s.text,
                            )}
                          >
                            <span>{CURRENCY_FLAG[e.currency]}</span>
                            {e.currency}
                          </span>
                          {/* Name */}
                          <span className="flex-1 min-w-0 text-sm font-medium text-slate-200 truncate">
                            {e.name}
                          </span>
                          <ChevronRight
                            className={cn(
                              "w-4 h-4 text-slate-600 shrink-0 transition-transform",
                              open && "rotate-90",
                            )}
                          />
                        </button>
                        {open && (
                          <div className="px-3.5 pb-3.5 pl-[68px] animate-fade-in">
                            <p className="text-xs leading-relaxed text-slate-400">{e.note}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
