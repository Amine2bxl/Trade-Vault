import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Info,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { PageHeader, Card } from "@/shared/ui";
import { useEconomicCalendar } from "../hooks/useEconomicCalendar";
import type { CalendarEvent, EventImpact } from "@/modules/economic-calendar";
import type { TKey } from "../i18n/translations";
import { startOfWeek, addDays, isoDate } from "../utils/economicEvents";

// La page ne connaît qu'une chose : `useEconomicCalendar`. Ni la source, ni le
// cache, ni le repli. Tout ce qui suit est de la mise en scène.

const CURRENCY_FLAG: Record<string, string> = {
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
const flagOf = (currency: string) => CURRENCY_FLAG[currency] ?? "🌐";

const IMPACTS: EventImpact[] = ["high", "medium", "low"];

// Rouge / orange / jaune / gris — le code couleur de la source, que tout trader
// lit déjà d'un coup d'œil. En inventer un autre obligerait à réapprendre une
// convention qui n'a aucune raison de différer.
const IMPACT_STYLE: Record<EventImpact, { dot: string; text: string; ring: string; bg: string }> = {
  high: { dot: "bg-red-500", text: "text-red-300", ring: "border-red-500/30", bg: "bg-red-500/10" },
  medium: {
    dot: "bg-orange-500",
    text: "text-orange-300",
    ring: "border-orange-500/30",
    bg: "bg-orange-500/10",
  },
  low: {
    dot: "bg-yellow-400",
    text: "text-yellow-300",
    ring: "border-yellow-500/25",
    bg: "bg-yellow-500/10",
  },
  holiday: {
    dot: "bg-slate-500",
    text: "text-slate-400",
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

/** Fenêtre pendant laquelle un événement est considéré « en cours ». */
const LIVE_WINDOW_MS = 15 * 60_000;

type EventStatus = "past" | "live" | "upcoming";

function statusOf(event: CalendarEvent, now: number): EventStatus {
  const start = new Date(event.startsAt).getTime();
  if (now >= start + LIVE_WINDOW_MS) return "past";
  if (now >= start) return "live";
  return "upcoming";
}

/**
 * Horloge partagée. Une seule minuterie pour toute la page, et sa fréquence
 * suit l'enjeu : la seconde n'a d'intérêt que dans l'heure qui précède une
 * publication. Le reste du temps, un tick par minute suffit largement.
 */
function useNow(fast: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), fast ? 1_000 : 60_000);
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

/**
 * Précédent et prévision — les deux seuls chiffres que la source publie.
 *
 * Pas de colonne « Réel » : l'export ne la fournit jamais, et une colonne
 * remplie de tirets serait une promesse non tenue à chaque ligne. Elle
 * réapparaîtra le jour où une source la donne, la donnée étant déjà prévue de
 * bout en bout.
 */
function ValueGrid({
  event,
  labels,
}: {
  event: CalendarEvent;
  labels: { previous: string; forecast: string };
}) {
  if (!event.previous && !event.forecast) return null;

  const cell = (label: string, value: string | null) =>
    value === null ? null : (
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">{label}</div>
        <div className="text-sm font-semibold text-slate-300 tabular-nums truncate">{value}</div>
      </div>
    );

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      {cell(labels.previous, event.previous)}
      {cell(labels.forecast, event.forecast)}
    </div>
  );
}

export default function EconomicNews() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || "en-US";
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<Set<string>>(new Set());
  const [impactFilter, setImpactFilter] = useState<Set<EventImpact>>(new Set());
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { events, loading, isFallback, lastSuccessAt, stale } = useEconomicCalendar(weekStart);

  // Le compte à rebours ne bat à la seconde que si quelque chose arrive dans
  // l'heure — sinon la page ferait travailler le processeur pour rien.
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

  // Les devises proposées sortent des données réelles : ajouter un pays à la
  // source suffit à le voir apparaître dans les filtres, sans toucher au code.
  const availableCurrencies = useMemo(
    () => [...new Set(events.map((e) => e.currency))].sort(),
    [events],
  );

  const localDayIso = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
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
    });
  }, [events, currencyFilter, impactFilter, dayFilter, search, localDayIso]);

  // Regroupement par jour LOCAL : un événement à 22 h à New York peut tomber le
  // lendemain à Paris, et c'est la journée du lecteur qui fait foi.
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const iso = isoDate(date);
      return {
        date,
        iso,
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
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" }),
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

  const impactLabel = (i: EventImpact) =>
    i === "holiday"
      ? t("news.holiday")
      : { high: t("news.impactHigh"), medium: t("news.impactMedium"), low: t("news.impactLow") }[i];

  const freshness = relativeFreshness(lastSuccessAt, t);
  const liveActive = isThisWeek && !isFallback && !stale;

  return (
    <div className="p-4 md:p-5 max-w-[1100px] mx-auto">
      <PageHeader
        className="mb-4 stagger-0"
        title={t("news.title")}
        subtitle={t("news.subtitle")}
        actions={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-semibold shrink-0",
              liveActive
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                : "bg-white/[0.04] border-white/[0.08] text-slate-400",
            )}
          >
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

      {/* Avertissements de qualité de donnée. Discrets mais jamais masqués :
          afficher un calendrier dégradé sans le dire serait pire que rien. */}
      {(isFallback || stale) && !loading && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-200/90 animate-fade-in">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{isFallback ? t("news.fallbackWarning") : t("news.staleWarning")}</span>
        </div>
      )}

      {/* Prochaine publication — la seule information que l'on veut voir sans
          scroller quand on ouvre la page en séance. */}
      {isThisWeek && nextEvent && (
        <Card className="p-3 mb-3 flex items-center gap-3 animate-fade-in-up stagger-1">
          <span
            className={cn("w-1 h-9 rounded-full shrink-0", IMPACT_STYLE[nextEvent.impact].dot)}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              {t("news.nextRelease")}
            </div>
            <div className="text-sm font-semibold text-slate-200 truncate">
              {flagOf(nextEvent.currency)} {nextEvent.title}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-lg font-extrabold text-cyan-300 tabular-nums leading-none">
              {formatCountdown(new Date(nextEvent.startsAt).getTime() - now)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold tabular-nums">
              {timeFmt.format(new Date(nextEvent.startsAt))}
            </div>
          </div>
        </Card>
      )}

      {/* Navigation de semaine */}
      <Card className="p-2.5 mb-3 flex items-center justify-between gap-2 animate-fade-in-up stagger-1">
        <button
          onClick={() => {
            setWeekStart((w) => addDays(w, -7));
            setDayFilter(null);
          }}
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
              onClick={() => {
                setWeekStart(startOfWeek(new Date()));
                setDayFilter(null);
              }}
              className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
            >
              {t("news.backToWeek")}
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setWeekStart((w) => addDays(w, 7));
            setDayFilter(null);
          }}
          aria-label={t("news.nextWeek")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </Card>

      {/* Filtre par jour — barre défilante sur mobile, 8 colonnes au-delà. */}
      {!loading && events.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 animate-fade-in-up stagger-1">
          <button
            onClick={() => setDayFilter(null)}
            className={cn(
              "shrink-0 h-12 px-3 rounded-xl border text-xs font-bold transition",
              dayFilter === null
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]",
            )}
          >
            {t("news.allDays")}
          </button>
          {days.map(({ iso, date, all }) => {
            const on = dayFilter === iso;
            const isToday = iso === todayIso;
            return (
              <button
                key={iso}
                onClick={() => setDayFilter(on ? null : iso)}
                disabled={all.length === 0}
                className={cn(
                  "shrink-0 w-14 h-12 rounded-xl border flex flex-col items-center justify-center transition",
                  on
                    ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                    : all.length === 0
                      ? "bg-white/[0.01] border-white/[0.04] text-slate-700 cursor-not-allowed"
                      : "bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]",
                  isToday && !on && all.length > 0 && "border-cyan-500/20",
                )}
              >
                <span className="text-[10px] font-bold uppercase leading-none">
                  {shortDayFmt.format(date)}
                </span>
                <span className="font-display text-sm font-extrabold tabular-nums leading-none mt-1">
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Forme de la semaine — sert de légende ET de filtre d'importance. */}
      {!loading && events.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 animate-fade-in-up stagger-1">
          {IMPACTS.map((i) => {
            const st = IMPACT_STYLE[i];
            const on = impactFilter.has(i);
            return (
              <button
                key={i}
                onClick={() => toggle(setImpactFilter, i)}
                aria-pressed={on}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-left transition-all",
                  on
                    ? cn(st.bg, st.ring)
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider truncate",
                      on ? st.text : "text-slate-500",
                    )}
                  >
                    {impactLabel(i)}
                  </span>
                </span>
                <span
                  className={cn(
                    "block mt-0.5 font-display text-lg font-extrabold tabular-nums leading-none",
                    on ? st.text : "text-slate-200",
                  )}
                >
                  {weekCounts[i]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Recherche + filtres */}
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

      {filtersOpen && (
        <Card className="p-4 mb-3 space-y-4 animate-fade-in-up">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              {t("news.currency")}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableCurrencies.map((c) => {
                const on = currencyFilter.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggle(setCurrencyFilter, c)}
                    className={cn(
                      "h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition",
                      on
                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-200"
                        : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]",
                    )}
                  >
                    <span>{flagOf(c)}</span>
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
                return (
                  <button
                    key={i}
                    onClick={() => toggle(setImpactFilter, i)}
                    className={cn(
                      "h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition",
                      on
                        ? cn(s.bg, s.ring, s.text)
                        : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", s.dot)} />
                    {impactLabel(i)}
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
        </Card>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-slate-500 text-sm">{t("news.noEvents")}</Card>
      ) : (
        <div className="space-y-4">
          {days.map(({ iso, date, events: dayEvents }) => {
            if (dayEvents.length === 0) return null;
            const isToday = iso === todayIso;
            return (
              <div key={iso} className="animate-fade-in-up">
                <div className="sticky top-0 z-10 flex items-center gap-2 mb-2 px-1 py-1.5 -mx-1 bg-[#070d18]/85 backdrop-blur-md rounded-lg">
                  <span
                    className={cn(
                      "text-xs font-bold capitalize",
                      isToday ? "text-cyan-300" : "text-slate-300",
                    )}
                  >
                    {dayFmt.format(date)}
                  </span>
                  {isToday && (
                    <span className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      {t("news.today")}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[10px] text-slate-600 font-semibold">
                    {dayEvents.length}
                  </span>
                </div>

                <Card className="overflow-hidden">
                  {dayEvents.map((e, index) => {
                    const s = IMPACT_STYLE[e.impact];
                    const open = expanded === e.id;
                    const start = new Date(e.startsAt);
                    const status = statusOf(e, now);
                    const untilMs = start.getTime() - now;

                    return (
                      <div
                        key={e.id}
                        className={cn(
                          "relative",
                          index > 0 && "border-t border-white/[0.04]",
                          status === "past" && "opacity-55",
                          status === "live" && "bg-emerald-500/[0.05]",
                        )}
                      >
                        {/* Rail de timeline : le fil vertical qui relie les
                            événements de la journée, coupé aux extrémités. */}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute left-[26px] w-px bg-white/[0.07]",
                            index === 0 ? "top-6 bottom-0" : "top-0 bottom-0",
                            index === dayEvents.length - 1 && "bottom-auto h-6",
                          )}
                        />
                        <button
                          onClick={() => setExpanded(open ? null : e.id)}
                          aria-expanded={open}
                          className={cn(
                            "relative w-full flex items-start gap-3 px-3.5 py-3.5 text-left transition-colors",
                            open ? "bg-white/[0.03]" : "hover:bg-white/[0.02]",
                          )}
                        >
                          {/* Pastille de timeline */}
                          <span className="relative shrink-0 w-5 flex justify-center pt-1.5">
                            <span
                              className={cn(
                                "w-2.5 h-2.5 rounded-full ring-4 ring-[#0a1120]",
                                s.dot,
                              )}
                            />
                            {status === "live" && (
                              <span
                                className={cn(
                                  "absolute top-1.5 w-2.5 h-2.5 rounded-full animate-ping opacity-70",
                                  s.dot,
                                )}
                              />
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white tabular-nums">
                                {e.allDay ? t("news.allDay") : timeFmt.format(start)}
                              </span>
                              <span
                                className={cn(
                                  "h-5 px-1.5 rounded-md inline-flex items-center gap-1 text-[11px] font-bold border",
                                  s.bg,
                                  s.ring,
                                  s.text,
                                )}
                              >
                                <span>{flagOf(e.currency)}</span>
                                {e.currency}
                              </span>
                              {status === "live" && (
                                <span className="h-5 px-1.5 rounded-md inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                  {t("news.releasing")}
                                </span>
                              )}
                              {status === "upcoming" && untilMs < 3_600_000 && (
                                <span className="h-5 px-1.5 rounded-md inline-flex items-center text-[10px] font-bold tabular-nums bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                  {t("news.inMinutes").replace("{value}", formatCountdown(untilMs))}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-sm font-medium text-slate-200 break-words">
                              {e.title}
                            </div>
                          </div>

                          <ChevronRight
                            className={cn(
                              "w-4 h-4 text-slate-600 shrink-0 mt-1 transition-transform",
                              open && "rotate-90",
                            )}
                          />
                        </button>

                        {open && (
                          <div className="relative px-3.5 pb-3.5 pl-[42px] animate-fade-in">
                            <ValueGrid
                              event={e}
                              labels={{
                                previous: t("news.previous"),
                                forecast: t("news.forecast"),
                              }}
                            />
                            <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                              {e.country}
                            </div>
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

      <p className="mt-5 flex items-start gap-2 px-1 text-[11px] leading-relaxed text-slate-600">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          {t("news.timezone").replace("{zone}", timeZone)}
          {" · "}
          {freshness ? t("news.updated").replace("{value}", freshness) : t("news.updatedNever")}
          {isFallback && ` · ${t("news.notice")}`}
        </span>
      </p>
    </div>
  );
}
