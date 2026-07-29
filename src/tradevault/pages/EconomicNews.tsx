import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Info,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { useEconomicWeek } from "../hooks/useEconomicWeek";
import {
  startOfWeek,
  addDays,
  isoDate,
  formatEventTime,
  eventTimestamp,
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

/** The four currencies most retail traders actually watch — the "Majors" preset. */
const MAJORS: Currency[] = ["USD", "EUR", "GBP", "JPY"];

const IMPACTS: ImpactLevel[] = ["high", "medium", "low"];

const IMPACT_STYLE: Record<ImpactLevel, { dot: string; text: string; ring: string; bg: string }> = {
  high: { dot: "bg-red-400", text: "text-red-300", ring: "border-red-500/30", bg: "bg-red-500/10" },
  medium: { dot: "bg-amber-400", text: "text-amber-300", ring: "border-amber-500/30", bg: "bg-amber-500/10" },
  low: { dot: "bg-slate-400", text: "text-slate-300", ring: "border-slate-500/25", bg: "bg-white/[0.04]" },
};

const LOCALE_MAP: Record<string, string> = {
  en: "en-US", es: "es-ES", pt: "pt-PT", fr: "fr-FR", de: "de-DE", it: "it-IT",
  nl: "nl-NL", ru: "ru-RU", zh: "zh-CN", ja: "ja-JP", ar: "ar-SA", hi: "hi-IN",
};

type Preset = "all" | "high" | "majors" | "today";

/**
 * Compare a released value against its forecast so the row can be coloured.
 * Values arrive as display strings ("3.4%", "-12.5K", "1.2M") — strip the units
 * and read the number. Returns null when either side isn't comparable.
 */
function surprise(actual?: string, forecast?: string): "beat" | "miss" | "inline" | null {
  if (!actual || !forecast) return null;
  const parse = (s: string): number | null => {
    const m = /^-?[\d.,]+/.exec(s.trim().replace(/,/g, ""));
    if (!m) return null;
    const n = Number(m[0]);
    if (Number.isNaN(n)) return null;
    const mult = /K$/i.test(s) ? 1e3 : /M$/i.test(s) ? 1e6 : /B$/i.test(s) ? 1e9 : 1;
    return n * mult;
  };
  const a = parse(actual);
  const f = parse(forecast);
  if (a === null || f === null) return null;
  if (a === f) return "inline";
  return a > f ? "beat" : "miss";
}

/** One value cell (actual / forecast / previous) in the expanded row. */
function ValueCell({ label, value, tone }: { label: string; value?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-slate-600 font-bold">{label}</div>
      <div className={cn("text-xs font-bold tabular-nums truncate", tone ?? "text-slate-300")}>
        {value ?? "—"}
      </div>
    </div>
  );
}

interface RowProps {
  event: EconomicEvent;
  open: boolean;
  isNext: boolean;
  onToggle: (id: string) => void;
  t: (k: Parameters<ReturnType<typeof useT>["t"]>[0]) => string;
}

/**
 * Memoised so that expanding one row (or the every-minute "next up" tick) does
 * not re-render every other row in the week.
 */
const EventRow = memo(function EventRow({ event: e, open, isNext, onToggle, t }: RowProps) {
  const s = IMPACT_STYLE[e.impact];
  const time = formatEventTime(e);
  const sur = surprise(e.actual, e.forecast);
  const actualTone =
    sur === "beat" ? "text-emerald-300" : sur === "miss" ? "text-red-300" : "text-white";

  return (
    <div className={cn("transition-colors", isNext && "bg-cyan-500/[0.06]")}>
      <button
        onClick={() => onToggle(e.id)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        {/* Impact bar — the primary visual sort cue */}
        <span className={cn("w-1 h-9 rounded-full shrink-0", s.dot)} />

        {/* Time */}
        <div className="w-12 shrink-0">
          <div className="text-sm font-bold text-white tabular-nums">{time}</div>
          {e.allDay ? (
            <div className="text-[8px] text-slate-600 uppercase font-semibold">
              {t("news.allDay")}
            </div>
          ) : e.approximate ? (
            <div className="text-[8px] text-slate-600 uppercase font-semibold">
              {t("news.approx")}
            </div>
          ) : null}
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
          <span aria-hidden>{CURRENCY_FLAG[e.currency]}</span>
          {e.currency}
        </span>

        {/* Name */}
        <span className="flex-1 min-w-0 text-sm font-medium text-slate-200 truncate">{e.name}</span>

        {/* Released value — the single number a trader scans for, so it sits on
            the collapsed row rather than hiding behind an expand. */}
        {e.actual && (
          <span
            title={
              sur === "beat" ? t("news.beat") : sur === "miss" ? t("news.miss") : t("news.inline")
            }
            className={cn("hidden sm:block text-xs font-bold tabular-nums shrink-0", actualTone)}
          >
            {e.actual}
          </span>
        )}
        {isNext && (
          <span className="hidden md:inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-cyan-500/15 border border-cyan-500/25 text-[9px] font-bold uppercase tracking-wider text-cyan-300 shrink-0">
            <Zap className="w-2.5 h-2.5" />
            {t("news.nextUp")}
          </span>
        )}

        <ChevronRight
          className={cn(
            "w-4 h-4 text-slate-600 shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>

      {/* Expanded detail — grid of values first (scannable), then the plain-language note. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pb-3.5 pl-[68px] space-y-2.5">
            {/* The Forex Factory feed publishes forecast + previous but no
                actual, so the Actual cell only appears when a source really
                provides one — an always-empty column reads as broken. */}
            {(e.actual || e.forecast || e.previous) && (
              <div
                className={cn(
                  "grid gap-3 max-w-xs",
                  e.actual ? "grid-cols-3" : "grid-cols-2",
                )}
              >
                {e.actual && (
                  <ValueCell label={t("news.actual")} value={e.actual} tone={actualTone} />
                )}
                <ValueCell label={t("news.forecast")} value={e.forecast} />
                <ValueCell label={t("news.previous")} value={e.previous} />
              </div>
            )}
            <p className="text-xs leading-relaxed text-slate-400">{e.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function EconomicNews() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || "en-US";

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<Set<Currency>>(new Set());
  const [impactFilter, setImpactFilter] = useState<Set<ImpactLevel>>(new Set());
  const [preset, setPreset] = useState<Preset>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, isPending, isFetching, refetch } = useEconomicWeek(weekStart);
  const events = useMemo(() => data?.events ?? [], [data]);

  const todayIso = isoDate(new Date());

  // Ticks once a minute so the "next up" highlight and countdown stay honest
  // without re-rendering on every frame.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const toggleCurrency = useCallback((c: Currency) => {
    setPreset("all");
    setCurrencyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const toggleImpact = useCallback((i: ImpactLevel) => {
    setPreset("all");
    setImpactFilter((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setCurrencyFilter(new Set());
    setImpactFilter(new Set());
    setSearch("");
    setPreset("all");
  }, []);

  // Presets are one tap for the three views people actually want, and they
  // write through to the same filter state so the detailed panel stays in sync.
  const applyPreset = useCallback((p: Preset) => {
    setPreset(p);
    setSearch("");
    if (p === "high") {
      setImpactFilter(new Set<ImpactLevel>(["high"]));
      setCurrencyFilter(new Set());
    } else if (p === "majors") {
      setCurrencyFilter(new Set(MAJORS));
      setImpactFilter(new Set());
    } else {
      setImpactFilter(new Set());
      setCurrencyFilter(new Set());
    }
  }, []);

  const toggleRow = useCallback((id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (preset === "today" && e.date !== todayIso) return false;
      if (currencyFilter.size > 0 && !currencyFilter.has(e.currency)) return false;
      if (impactFilter.size > 0 && !impactFilter.has(e.impact)) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.currency.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [events, currencyFilter, impactFilter, search, preset, todayIso]);

  // Group into days in one pass. The old version ran a full `filter()` per day
  // (7 × N); this is O(N) and matters once the live feed pushes 200+ events.
  const days = useMemo(() => {
    const byDate = new Map<string, EconomicEvent[]>();
    for (const e of filtered) {
      const bucket = byDate.get(e.date);
      if (bucket) bucket.push(e);
      else byDate.set(e.date, [e]);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const iso = isoDate(d);
      const dayEvents = byDate.get(iso) ?? [];
      return {
        date: d,
        iso,
        events: dayEvents,
        highCount: dayEvents.reduce((n, e) => n + (e.impact === "high" ? 1 : 0), 0),
      };
    });
  }, [weekStart, filtered]);

  // The next high-or-medium release still ahead of us — the one thing a trader
  // opening this page at 09:00 actually wants to know.
  const nextEvent = useMemo(() => {
    let best: { event: EconomicEvent; at: number } | null = null;
    for (const e of filtered) {
      if (e.allDay || e.impact === "low") continue;
      const at = eventTimestamp(e);
      if (at < now) continue;
      if (!best || at < best.at) best = { event: e, at };
    }
    return best;
  }, [filtered, now]);

  const countdown = useMemo(() => {
    if (!nextEvent) return null;
    const mins = Math.max(0, Math.round((nextEvent.at - now) / 60_000));
    if (mins === 0) return t("news.now");
    if (mins < 60) return t("news.inMinutes").replace("{m}", String(mins));
    return t("news.inHours")
      .replace("{h}", String(Math.floor(mins / 60)))
      .replace("{m}", String(mins % 60));
  }, [nextEvent, now, t]);

  const activeFilterCount = currencyFilter.size + impactFilter.size + (search.trim() ? 1 : 0);
  const highCount = useMemo(
    () => filtered.reduce((n, e) => n + (e.impact === "high" ? 1 : 0), 0),
    [filtered],
  );

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return `${fmt.format(weekStart)} – ${fmt.format(end)}`;
  }, [weekStart, locale]);

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" }),
    [locale],
  );

  const updatedLabel = useMemo(() => {
    if (!data?.fetchedAt) return null;
    const d = new Date(data.fetchedAt);
    if (Number.isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
    return t("news.updated").replace("{t}", fmt.format(d));
  }, [data?.fetchedAt, locale, t]);

  const isThisWeek = isoDate(weekStart) === isoDate(startOfWeek(new Date()));
  const isLive = data?.source === "forexfactory";

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      {/* ── Header: title, freshness, live state ─────────────────────────── */}
      <div className="mb-4 animate-fade-in-up stagger-0 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("news.title")}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{t("news.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("news.refresh")}
            title={isFetching ? t("news.refreshing") : t("news.refresh")}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white active:scale-95 transition disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          </button>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-semibold",
              isLive
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                : "bg-white/[0.04] border-white/[0.08] text-slate-400",
            )}
          >
            {isLive && (
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
              </span>
            )}
            {t("news.live")}
          </span>
        </div>
      </div>

      {/* ── Week navigator ───────────────────────────────────────────────── */}
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
          {isThisWeek ? (
            <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
              {t("news.eventCount").replace("{n}", String(filtered.length))}
              {highCount > 0 && (
                <>
                  {" · "}
                  <span className="text-red-300/80">
                    {t("news.highImpactCount").replace("{n}", String(highCount))}
                  </span>
                </>
              )}
            </span>
          ) : (
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

      {/* ── Next-up banner: the highest-value line on the page ───────────── */}
      {nextEvent && isThisWeek && (
        <div className="glass rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 border border-cyan-500/20 animate-fade-in-up stagger-1">
          <span className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-cyan-300" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-cyan-400/80 font-bold">
              {t("news.nextUp")}
            </div>
            <div className="text-sm font-semibold text-white truncate">
              <span aria-hidden>{CURRENCY_FLAG[nextEvent.event.currency]}</span>{" "}
              {nextEvent.event.name}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-white tabular-nums">
              {formatEventTime(nextEvent.event)}
            </div>
            <div className="text-[10px] text-cyan-300 font-semibold">{countdown}</div>
          </div>
        </div>
      )}

      {/* ── Quick presets ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto no-scrollbar animate-fade-in-up stagger-1">
        {(
          [
            ["all", t("news.presetAll")],
            ["high", t("news.presetHighOnly")],
            ["majors", t("news.presetMajors")],
            ["today", t("news.presetToday")],
          ] as [Preset, string][]
        ).map(([p, label]) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={cn(
              "h-8 px-3.5 rounded-lg text-xs font-bold border transition shrink-0",
              preset === p
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Search + filter toggle ───────────────────────────────────────── */}
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
          aria-expanded={filtersOpen}
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

      {/* ── Filter panel ─────────────────────────────────────────────────── */}
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
                    aria-pressed={on}
                    className={cn(
                      "h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition",
                      on
                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                        : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]",
                    )}
                  >
                    <span aria-hidden>{CURRENCY_FLAG[c]}</span>
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
                    aria-pressed={on}
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

      {/* ── Days ─────────────────────────────────────────────────────────── */}
      {isPending ? (
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
        // Dim (not blank) while a new week loads — keepPreviousData keeps the
        // previous week on screen, so navigation never flashes a skeleton.
        <div className={cn("space-y-4 transition-opacity", isFetching && "opacity-60")}>
          {days.map(({ iso, date, events: dayEvents, highCount: dayHigh }) => {
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
                  {dayHigh > 0 && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/25">
                      {t("news.highImpactCount").replace("{n}", String(dayHigh))}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[10px] text-slate-600 font-semibold tabular-nums">
                    {dayEvents.length}
                  </span>
                </div>

                {/* Events */}
                <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                  {dayEvents.map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      open={expanded === e.id}
                      isNext={nextEvent?.event.id === e.id}
                      onToggle={toggleRow}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Attribution + indicative-times notice ────────────────────────── */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-1">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 flex-1">
          <Info className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-px" />
          {t("news.notice")}
        </p>
        {/* Discreet provenance line — reads "built-in schedule" whenever we are
            serving the offline fallback, so the credit is never misleading. */}
        <span className="text-[10px] text-slate-600 shrink-0 tabular-nums">
          {isLive ? t("news.source") : t("news.sourceOffline")}
          {updatedLabel && ` · ${updatedLabel}`}
        </span>
      </div>
    </div>
  );
}
