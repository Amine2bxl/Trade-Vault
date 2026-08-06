import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  AlertTriangle,
  Radio,
  Clock,
  ChevronDown,
  TrendingUp,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { PageHeader, Card } from "@/shared/ui";
import { useEconomicCalendar } from "../hooks/useEconomicCalendar";
import type { CalendarEvent, EventImpact } from "@/modules/economic-calendar";
import type { TKey } from "../i18n/translations";
import { startOfWeek, addDays, isoDate } from "../utils/economicEvents";

const CURRENCY_FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  CHF: "🇨🇭", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CNY: "🇨🇳",
};
const flagOf = (currency: string) => CURRENCY_FLAG[currency] ?? "🌐";

const IMPACTS: EventImpact[] = ["high", "medium", "low"];

const IMPACT_STYLE: Record<EventImpact, { dot: string; text: string; ring: string; bg: string; bar: string }> = {
  high: { dot: "bg-red-500", text: "text-red-300", ring: "border-red-500/30", bg: "bg-red-500/10", bar: "bg-red-500" },
  medium: { dot: "bg-orange-500", text: "text-orange-300", ring: "border-orange-500/30", bg: "bg-orange-500/10", bar: "bg-orange-500" },
  low: { dot: "bg-yellow-400", text: "text-yellow-300", ring: "border-yellow-500/25", bg: "bg-yellow-500/10", bar: "bg-yellow-500" },
  holiday: { dot: "bg-slate-500", text: "text-slate-400", ring: "border-slate-500/25", bg: "bg-white/[0.04]", bar: "bg-slate-500" },
};

const IMPACT_LABELS: Record<EventImpact, string> = {
  high: "Fort", medium: "Moyen", low: "Faible", holiday: "Férié",
};

const LOCALE_MAP: Record<string, string> = {
  en: "en-US", es: "es-ES", pt: "pt-PT", fr: "fr-FR",
  de: "de-DE", it: "it-IT", nl: "nl-NL", ru: "ru-RU",
  zh: "zh-CN", ja: "ja-JP", ar: "ar-SA", hi: "hi-IN",
};

const LIVE_WINDOW_MS = 15 * 60_000;

function statusOf(event: CalendarEvent, now: number): "past" | "live" | "upcoming" {
  const start = new Date(event.startsAt).getTime();
  if (now >= start + LIVE_WINDOW_MS) return "past";
  if (now >= start) return "live";
  return "upcoming";
}

function useNow(fast: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), fast ? 5_000 : 60_000);
    return () => clearInterval(id);
  }, [fast]);
  return now;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

function relativeFreshness(iso: string | null, t: (k: TKey) => string): string | null {
  if (!iso) return null;
  const delta = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(delta)) return null;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return t("news.justNow");
  if (minutes < 60) return t("news.minutesAgo").replace("{value}", String(minutes));
  return t("news.hoursAgo").replace("{value}", String(Math.floor(minutes / 60)));
}

const IMPACT_ORDER: Record<EventImpact, number> = { high: 0, medium: 1, low: 2, holiday: 3 };

export default function EconomicNews() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || "en-US";
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const nowDate = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(nowDate));
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<Set<string>>(new Set());
  const [impactFilter, setImpactFilter] = useState<Set<EventImpact>>(new Set());
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { events, loading, isFallback, lastSuccessAt, stale } = useEconomicCalendar(weekStart);
  const todayRef = useRef<HTMLDivElement>(null);

  const hasImminent = useMemo(() => {
    const now = Date.now();
    return events.some((e) => {
      const delta = new Date(e.startsAt).getTime() - now;
      return delta > -LIVE_WINDOW_MS && delta < 3_600_000;
    });
  }, [events]);
  const now = useNow(hasImminent);

  const todayIso = isoDate(new Date());
  const isThisWeek = isoDate(weekStart) === isoDate(startOfWeek(new Date()));

  const toggle = <T,>(set: (fn: (prev: Set<T>) => Set<T>) => void, value: T) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const clearFilters = () => {
    setCurrencyFilter(new Set());
    setImpactFilter(new Set());
    setDayFilter(null);
    setSearch("");
  };

  const availableCurrencies = useMemo(
    () => [...new Set(events.map((e) => e.currency))].sort(),
    [events],
  );

  const localDayIso = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    return (event: CalendarEvent) => fmt.format(new Date(event.startsAt));
  }, [timeZone]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (currencyFilter.size > 0 && !currencyFilter.has(e.currency)) return false;
      if (impactFilter.size > 0 && !impactFilter.has(e.impact)) return false;
      if (dayFilter && localDayIso(e) !== dayFilter) return false;
      if (q) {
        const haystack = `${e.title} ${e.currency} ${e.country}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const iDiff = (IMPACT_ORDER[a.impact] ?? 3) - (IMPACT_ORDER[b.impact] ?? 3);
      if (iDiff !== 0) return iDiff;
      return a.startsAt.localeCompare(b.startsAt);
    });
  }, [events, currencyFilter, impactFilter, dayFilter, search, localDayIso]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const iso = isoDate(date);
      return {
        date, iso,
        all: events.filter((e) => localDayIso(e) === iso),
        events: filtered.filter((e) => localDayIso(e) === iso),
      };
    });
  }, [weekStart, events, filtered, localDayIso]);

  const nextEvent = useMemo(() => {
    return events
      .filter((e) => new Date(e.startsAt).getTime() > now && e.impact !== "holiday")
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  }, [events, now]);

  const weekCounts = useMemo(() => {
    const counts: Record<EventImpact, number> = { high: 0, medium: 0, low: 0, holiday: 0 };
    for (const e of events) counts[e.impact]++;
    return counts;
  }, [events]);

  const activeFilterCount =
    currencyFilter.size + impactFilter.size + (dayFilter ? 1 : 0) + (search.trim() ? 1 : 0);

  const weekLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return `${fmt.format(weekStart)} – ${fmt.format(addDays(weekStart, 6))}`;
  }, [weekStart, locale]);

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric" }),
    [locale],
  );
  const shortDayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale],
  );
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }),
    [locale, timeZone],
  );

  const freshness = relativeFreshness(lastSuccessAt, t);
  const liveActive = isThisWeek && !isFallback && !stale;

  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!loading && !scrolledRef.current && isThisWeek) {
      scrolledRef.current = true;
      requestAnimationFrame(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [loading, isThisWeek]);

  const jumpToToday = () => {
    setWeekStart(startOfWeek(new Date()));
    setDayFilter(null);
    requestAnimationFrame(() => {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    });
  };

  return (
    <div className="p-4 md:p-5 max-w-[1100px] mx-auto">
      {/* Premium header: icon + gradient title + live badge */}
      <PageHeader
        className="mb-5 stagger-0"
        icon={
          <span className="relative shrink-0">
            <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20">
              <TrendingUp className="w-4.5 h-4.5 text-white" />
            </span>
          </span>
        }
        title={t("news.title")}
        subtitle={t("news.subtitle")}
        actions={
          <span className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-semibold shrink-0",
            liveActive
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : "bg-white/[0.04] border-white/[0.08] text-slate-400",
          )}>
            {liveActive ? (
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
              </span>
            ) : (
              <Radio className="w-3 h-3" />
            )}
            {t("news.live")}
          </span>
        }
      />

      {/* Data quality warning */}
      {(isFallback || stale) && !loading && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-200/90">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{isFallback ? t("news.fallbackWarning") : t("news.staleWarning")}</span>
        </div>
      )}

      {/* ── All-in-one top bar: week nav + today + search + filters ── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 shrink-0">
          <button onClick={() => { setWeekStart((w) => addDays(w, -7)); setDayFilter(null); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2 min-w-0">
            <CalendarDays className="w-3.5 h-3.5 text-cyan-400 shrink-0 hidden sm:block" />
            <span className="text-sm font-bold text-white whitespace-nowrap">{weekLabel}</span>
          </div>
          {!isThisWeek && (
            <button onClick={jumpToToday}
              className="h-8 px-2.5 rounded-lg flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition shrink-0">
              <Clock className="w-3 h-3" /> {t("news.today")}
            </button>
          )}
          <button onClick={() => { setWeekStart((w) => addDays(w, 7)); setDayFilter(null); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("news.searchPlaceholder")}
            className="w-full h-10 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-9 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button onClick={() => setFiltersOpen((v) => !v)} className={cn(
          "relative h-10 px-3.5 rounded-xl flex items-center gap-2 text-sm font-semibold border transition shrink-0",
          filtersOpen || activeFilterCount > 0
            ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300" : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]",
        )}>
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-[10px] font-bold text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Day filter + impact pills (single row, horizontal scroll on mobile) ── */}
      {!loading && events.length > 0 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 items-center">
          <button onClick={() => setDayFilter(null)} className={cn(
            "shrink-0 h-10 px-3 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5",
            dayFilter === null ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200" : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]",
          )}>
            Tout
          </button>
          {days.map(({ iso, date, all }) => {
            const on = dayFilter === iso;
            const isToday = iso === todayIso;
            const highCount = all.filter(e => e.impact === "high").length;
            const allCount = all.length;
            return (
              <button key={iso} onClick={() => setDayFilter(on ? null : iso)} disabled={allCount === 0} className={cn(
                "shrink-0 min-w-[52px] h-10 px-2.5 rounded-xl border flex flex-col items-center justify-center transition",
                on ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                  : allCount === 0 ? "bg-white/[0.01] border-white/[0.04] text-slate-700 cursor-not-allowed"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]",
                isToday && !on && allCount > 0 && "border-cyan-500/20",
              )}>
                <span className="text-[10px] font-bold uppercase leading-none">{shortDayFmt.format(date)}</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {highCount > 0 && <span className="w-1 h-1 rounded-full bg-red-500" />}
                  <span className="font-display text-xs font-extrabold leading-none">{allCount}</span>
                </div>
              </button>
            );
          })}
          {/* Quick impact toggles inline */}
          <div className="w-px h-6 bg-white/[0.08] mx-0.5 shrink-0" />
          {IMPACTS.map((i) => {
            const on = impactFilter.has(i);
            const st = IMPACT_STYLE[i];
            return (
              <button key={i} onClick={() => toggle(setImpactFilter, i)}
                className={cn(
                  "shrink-0 h-10 px-2.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5",
                  on ? cn(st.bg, st.ring, st.text) : "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:bg-white/[0.05]",
                )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                {IMPACT_LABELS[i]}
                <span className="text-[10px] opacity-60">{weekCounts[i]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Currency filters dropdown */}
      {filtersOpen && (
        <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">Devises</span>
          {availableCurrencies.map((c) => {
            const on = currencyFilter.has(c);
            return (
              <button key={c} onClick={() => toggle(setCurrencyFilter, c)} className={cn(
                "h-7 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-bold border transition",
                on ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200" : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]",
              )}>
                {flagOf(c)} {c}
              </button>
            );
          })}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-white transition">
              Effacer filtres
            </button>
          )}
        </Card>
      )}

      {/* Next event — hero card, visible only this week */}
      {isThisWeek && nextEvent && (
        <div className={cn(
          "mb-4 rounded-2xl border overflow-hidden relative",
          nextEvent.impact === "high" ? "border-red-500/20 bg-red-500/[0.04]"
          : nextEvent.impact === "medium" ? "border-orange-500/20 bg-orange-500/[0.03]"
          : "border-cyan-500/20 bg-cyan-500/[0.03]",
        )}>
          <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", IMPACT_STYLE[nextEvent.impact].bar)} />
          <div className="flex items-center gap-4 pl-5 pr-4 py-3.5">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">
                Prochaine publication
              </div>
              <div className="text-sm font-bold text-white truncate">
                {flagOf(nextEvent.currency)} {nextEvent.title}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "h-5 px-1.5 rounded-md inline-flex items-center gap-1 text-[10px] font-bold border",
                  IMPACT_STYLE[nextEvent.impact].bg, IMPACT_STYLE[nextEvent.impact].ring, IMPACT_STYLE[nextEvent.impact].text,
                )}>
                  {IMPACT_LABELS[nextEvent.impact as "high" | "medium" | "low"] || nextEvent.impact}
                </span>
                <span className="text-[11px] text-slate-400">{timeFmt.format(new Date(nextEvent.startsAt))}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-2xl font-extrabold text-cyan-300 tabular-nums leading-none">
                {formatCountdown(new Date(nextEvent.startsAt).getTime() - now)}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">avant l'event</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-slate-500 text-sm">{t("news.noEvents")}</Card>
      ) : (
        <div className="space-y-4">
          {days.map(({ iso, date, events: dayEvents }) => {
            if (dayEvents.length === 0) return null;
            const isToday = iso === todayIso;
            const highCount = dayEvents.filter(e => e.impact === "high").length;
            return (
              <div key={iso} ref={isToday ? todayRef : undefined}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={cn(
                    "text-xs font-bold capitalize",
                    isToday ? "text-cyan-300" : "text-slate-400",
                  )}>
                    {dayFmt.format(date)}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      Aujourd'hui
                    </span>
                  )}
                  {highCount > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {highCount}
                    </span>
                  )}
                  <div className="flex-1" />
                  <span className="text-[10px] text-slate-600 font-semibold">{dayEvents.length}</span>
                </div>

                <Card className="overflow-hidden border-white/[0.04]">
                  {dayEvents.map((e, index) => {
                    const s = IMPACT_STYLE[e.impact];
                    const open = expanded === e.id;
                    const start = new Date(e.startsAt);
                    const status = statusOf(e, now);
                    const untilMs = start.getTime() - now;

                    return (
                      <div key={e.id} className={cn(
                        index > 0 && "border-t border-white/[0.03]",
                        status === "past" && "opacity-50",
                        status === "live" && "bg-emerald-500/[0.04]",
                      )}>
                        <div className="relative flex items-stretch">
                          {/* Left impact bar */}
                          <span className={cn("w-1 shrink-0 rounded-r-sm", s.bar, open ? "opacity-100" : "opacity-30")} />

                          <button onClick={() => setExpanded(open ? null : e.id)}
                            className="flex-1 flex items-center gap-3 pl-3 pr-3 py-3 text-left hover:bg-white/[0.02] transition-colors min-w-0">
                            <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-slate-400">
                              {e.allDay ? "—" : timeFmt.format(start)}
                            </span>
                            <span className="flex-1 min-w-0 text-sm font-medium text-white truncate">
                              {e.title}
                            </span>
                            <span className={cn(
                              "shrink-0 h-5.5 px-1.5 rounded text-[10px] font-bold border flex items-center gap-1",
                              s.bg, s.ring, s.text,
                            )}>
                              {flagOf(e.currency)} {e.currency}
                            </span>
                            {status === "live" && (
                              <span className="shrink-0 h-5.5 px-1.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 animate-pulse">
                                Live
                              </span>
                            )}
                            <ChevronDown className={cn(
                              "w-4 h-4 text-slate-600 shrink-0 transition-transform duration-200",
                              open && "rotate-180",
                            )} />
                          </button>
                        </div>

                        {open && (
                          <div className="border-t border-white/[0.04] pl-[72px] pr-4 py-3">
                            <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                              {e.previous && (
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] uppercase text-slate-600 font-bold">Précédent</div>
                                  <div className="text-sm font-semibold text-slate-300 tabular-nums">{e.previous}</div>
                                </div>
                              )}
                              {e.forecast && (
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] uppercase text-slate-600 font-bold">Prévision</div>
                                  <div className="text-sm font-semibold text-slate-300 tabular-nums">{e.forecast}</div>
                                </div>
                              )}
                            </div>
                            <div className="mt-2 text-[11px] text-slate-600">{e.country}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer info bar */}
      <div className={cn(
        "mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-slate-600",
      )}>
        <span>Fuseau : {timeZone}</span>
        <span>·</span>
        <span>{freshness ? `Mis à jour ${freshness}` : t("news.updatedNever")}</span>
        {isFallback && <><span>·</span><span>{t("news.notice")}</span></>}
      </div>
    </div>
  );
}
