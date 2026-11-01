import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";
import {
  FilterControls,
  FilterSection,
  PageContainer,
  MultiPicker,
  SelectPicker,
} from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { usePageActions } from "@/app/contexts/PageActionsContext";
import { useEconomicCalendar } from "./useEconomicCalendar";
import type { CalendarEvent, EventImpact } from "@/modules/economic-calendar";
import type { TKey } from "@/app/i18n/translations";
import { startOfWeek, addDays, isoDate } from "./economicEvents";
import { useAuth } from "@/app/contexts/AuthContext";
import { loadUserPref, saveUserPref, USER_PREFS_EVENT } from "@/app/utils/userPrefs";

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

/* Les libellés d'impact passent par `t`, comme tout le reste. La table
   figée qui vivait ici écrivait « Fort / Moyen / Faible / Férié » en dur,
   donc en FRANÇAIS, dans une interface dont la langue par défaut est
   l'anglais. Les clés `news.impact*` existaient déjà et n'étaient appelées
   nulle part. */
const IMPACT_KEYS = {
  high: "news.impactHigh",
  medium: "news.impactMedium",
  low: "news.impactLow",
  holiday: "news.impactHoliday",
} as const;

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

/**
 * Le compte a rebours jusqu'au prochain evenement.
 *
 * `j` est l'abreviation FRANCAISE de « jour ». Elle etait ecrite en dur dans
 * une interface dont la langue par defaut est l'anglais : un anglophone
 * lisait « 1j 17h ». Les trois autres unites (h, m, s) sont identiques dans
 * les deux langues, ce qui explique que le defaut soit passe inapercu — seul
 * le premier palier, celui qui ne s'affiche qu'au-dela de 24 heures, trahit
 * la langue.
 *
 * Le suffixe vient donc du dictionnaire. Trouve en relisant une capture
 * destinee a la vitrine, exactement comme les libelles de filtres avant lui.
 */
function formatCountdown(ms: number, jour: string): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}${jour} ${hours}h`;
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

/** Navigation presets for the day bar */
type DayNavPreset = "today" | "tomorrow" | "week" | "all";

/* LES FILTRES SONT DURABLES : ils vivent dans les préférences du COMPTE
   (`user_preferences`, synchronisées en direct), pas dans l'état de la page.
   Fermer le site, changer d'appareil ou se reconnecter les retrouve tels
   quels. */
const FILTERS_PREF_KEY = "news.filters.v1";
interface SavedFilters {
  impacts: EventImpact[];
  currencies: string[];
  dayPreset: DayNavPreset;
}
const DAY_PRESETS: DayNavPreset[] = ["today", "tomorrow", "week", "all"];
function readSaved(raw: unknown): SavedFilters | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SavedFilters>;
  return {
    impacts: Array.isArray(r.impacts)
      ? r.impacts.filter((i): i is EventImpact => i in IMPACT_ORDER)
      : [],
    currencies: Array.isArray(r.currencies)
      ? r.currencies.filter((c): c is string => typeof c === "string")
      : [],
    dayPreset: DAY_PRESETS.includes(r.dayPreset as DayNavPreset)
      ? (r.dayPreset as DayNavPreset)
      : "week",
  };
}

/** L'impact en barres, comme les dossiers de Forex Factory : 3 rouge, 2 orange,
 *  1 jaune, un point gris pour un jour férié. Le libellé reste lisible par les
 *  lecteurs d'écran. */
function ImpactBars({ impact, label }: { impact: EventImpact; label: string }) {
  const lit = impact === "high" ? 3 : impact === "medium" ? 2 : impact === "low" ? 1 : 0;
  return (
    <span className="ff-impact" title={label}>
      <span className="sr-only">{label}</span>
      {impact === "holiday" ? (
        <i className="ff-impact-dot" aria-hidden />
      ) : (
        [0, 1, 2].map((k) => (
          <i
            key={k}
            aria-hidden
            className="ff-impact-bar"
            data-on={k < lit ? impact : undefined}
            style={{ height: 6 + k * 3 }}
          />
        ))
      )}
    </span>
  );
}

export default function EconomicNews() {
  const { t, lang } = useT();
  const { boxRef, height } = useAvailableHeight();
  const { user } = useAuth();
  const locale = LOCALE_MAP[lang] || "en-US";
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const nowDate = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(nowDate));
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<Set<string>>(new Set());
  const [impactFilter, setImpactFilter] = useState<Set<EventImpact>>(new Set());
  // Par défaut la SEMAINE : « aujourd'hui » seul paraît vide les jours calmes
  // (et le week-end), ce qui se lisait comme une panne.
  const [dayPreset, setDayPreset] = useState<DayNavPreset>("week");
  const [customDayFilter, setCustomDayFilter] = useState<string | null>(null);
  // Tant que les filtres enregistrés ne sont pas relus, la liste n'est pas
  // montrée : elle apparaîtrait d'abord non filtrée, puis sauterait.
  const [prefsReady, setPrefsReady] = useState(!user?.id);

  /* Relecture des filtres enregistrés — au montage, puis quand ils changent
     sur un autre appareil. */
  useEffect(() => {
    if (!user?.id) {
      setPrefsReady(true);
      return;
    }
    let alive = true;
    const apply = () =>
      loadUserPref<unknown>(user.id, FILTERS_PREF_KEY)
        .then((raw) => {
          if (!alive) return;
          const saved = readSaved(raw);
          if (saved) {
            setImpactFilter(new Set(saved.impacts));
            setCurrencyFilter(new Set(saved.currencies));
            setDayPreset(saved.dayPreset);
          }
        })
        .catch(() => {})
        .finally(() => alive && setPrefsReady(true));
    void apply();
    const onRemote = (e: Event) => {
      if ((e as CustomEvent<{ userId?: string }>).detail?.userId === user.id) void apply();
    };
    window.addEventListener(USER_PREFS_EVENT, onRemote);
    return () => {
      alive = false;
      window.removeEventListener(USER_PREFS_EVENT, onRemote);
    };
  }, [user?.id]);

  /* Chaque choix est enregistré (le module regroupe les écritures). */
  const persist = (next: Partial<SavedFilters>) => {
    if (!user?.id) return;
    saveUserPref(user.id, FILTERS_PREF_KEY, {
      impacts: Array.from(next.impacts ?? impactFilter),
      currencies: Array.from(next.currencies ?? currencyFilter),
      dayPreset: next.dayPreset ?? dayPreset,
    } satisfies SavedFilters);
  };
  const changeImpacts = (v: EventImpact[]) => {
    setImpactFilter(new Set(v));
    persist({ impacts: v });
  };
  const changeCurrencies = (v: string[]) => {
    setCurrencyFilter(new Set(v));
    persist({ currencies: v });
  };
  const changeDayPreset = (v: DayNavPreset) => {
    setDayPreset(v);
    setCustomDayFilter(null);
    persist({ dayPreset: v });
  };

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
  const tomorrowIso = isoDate(addDays(new Date(), 1));
  const isThisWeek = isoDate(weekStart) === isoDate(startOfWeek(new Date()));

  const availableCurrencies = useMemo(
    () => [...new Set([...events.map((e) => e.currency), ...currencyFilter])].sort(),
    [events, currencyFilter],
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

  const dayFilter = useMemo(() => {
    if (dayPreset === "today") return todayIso;
    if (dayPreset === "tomorrow") return tomorrowIso;
    if (dayPreset === "week") return null;
    return customDayFilter;
  }, [dayPreset, todayIso, tomorrowIso, customDayFilter]);

  /* L'ordre d'un calendrier : l'HEURE d'abord (comme Forex Factory), puis
     l'impact pour départager deux publications simultanées. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => {
        if (currencyFilter.size > 0 && !currencyFilter.has(e.currency)) return false;
        if (impactFilter.size > 0 && !impactFilter.has(e.impact)) return false;
        if (dayFilter && localDayIso(e) !== dayFilter) return false;
        if (q) {
          const haystack = `${e.title} ${e.currency} ${e.country}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const tDiff = a.startsAt.localeCompare(b.startsAt);
        if (tDiff !== 0) return tDiff;
        return (IMPACT_ORDER[a.impact] ?? 3) - (IMPACT_ORDER[b.impact] ?? 3);
      });
  }, [events, currencyFilter, impactFilter, dayFilter, search, localDayIso]);

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
    return filtered
      .filter((e) => new Date(e.startsAt).getTime() > now && e.impact !== "holiday")
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  }, [filtered, now]);

  const weekCounts = useMemo(() => {
    const counts: Record<EventImpact, number> = { high: 0, medium: 0, low: 0, holiday: 0 };
    for (const e of events) counts[e.impact]++;
    return counts;
  }, [events]);

  const activeFilterCount =
    currencyFilter.size +
    impactFilter.size +
    (search.trim() ? 1 : 0) +
    (dayPreset !== "week" ? 1 : 0);

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

  const freshness = relativeFreshness(lastSuccessAt, t);
  const verified = !isFallback && !stale;

  const jumpToToday = () => {
    setWeekStart(startOfWeek(new Date()));
    changeDayPreset("today");
  };

  /* L'en-tête porte la PROVENANCE : vérifié (Forex Factory, synchronisé) ou
     indicatif (repli local). Une donnée de marché sans source ne se lit pas. */
  const headerActions = useMemo(
    () => (
      <span className={cn("ff-source", verified ? "ff-source-ok" : "ff-source-warn")}>
        {verified ? (
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        )}
        {verified ? t("news.sourceVerified") : t("news.sourceIndicative")}
        {verified && freshness && <span className="ff-source-time">· {freshness}</span>}
      </span>
    ),
    [verified, freshness, t],
  );
  usePageActions(headerActions);

  const value = (v: string | null) =>
    v ? <span className="tv-figure">{v}</span> : <span className="text-slate-600">—</span>;

  return (
    <PageContainer ref={boxRef} fit height={height}>
      {(isFallback || stale) && !loading && (
        <div className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {isFallback
              ? t("news.fallbackWarning")
              : t("news.staleWarning").replace("{value}", freshness ?? "—")}
          </span>
        </div>
      )}

      {/* ── UNE SEULE BARRE : la semaine, le prochain événement, les filtres ── */}
      <div className="ff-toolbar shrink-0">
        <div className="ff-week">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="ff-week-btn"
            aria-label={t("news.prevWeek")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="ff-week-label tv-num">
            <CalendarDays className="hidden h-3.5 w-3.5 text-[var(--tv-accent)] sm:block" />
            {weekLabel}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="ff-week-btn"
            aria-label={t("news.nextWeek")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!isThisWeek && (
          <button type="button" onClick={jumpToToday} className="ff-today">
            <Clock className="h-3.5 w-3.5" /> {t("news.today")}
          </button>
        )}

        {/* Le prochain événement, au fil de la barre : heure, devise, titre,
            compte à rebours. Il tient compte des filtres. */}
        {isThisWeek && nextEvent && (
          <div className="ff-next">
            <ImpactBars
              impact={nextEvent.impact}
              label={t(IMPACT_KEYS[nextEvent.impact as keyof typeof IMPACT_KEYS])}
            />
            <span className="tv-label text-slate-500">{t("news.nextShort")}</span>
            <span className="min-w-0 truncate text-[13px] font-semibold text-white">
              {flagOf(nextEvent.currency)} {nextEvent.currency} · {nextEvent.title}
            </span>
            <span className="tv-figure shrink-0 text-[13px] text-[var(--tv-highlight)]">
              {formatCountdown(new Date(nextEvent.startsAt).getTime() - now, t("news.dayShort"))}
            </span>
          </div>
        )}

        <div className="ml-auto">
          <FilterControls
            label={t("common.filters")}
            count={activeFilterCount}
            summary={[
              ...Array.from(currencyFilter),
              ...Array.from(impactFilter).map((i) => t(IMPACT_KEYS[i as keyof typeof IMPACT_KEYS])),
              dayPreset !== "week"
                ? t(
                    dayPreset === "today"
                      ? "news.today"
                      : dayPreset === "tomorrow"
                        ? "news.tomorrow"
                        : "news.all",
                  )
                : "",
              customDayFilter,
              search,
            ]
              .filter(Boolean)
              .join(" · ")}
            onReset={() => {
              setSearch("");
              setImpactFilter(new Set());
              setCurrencyFilter(new Set());
              setDayPreset("week");
              setCustomDayFilter(null);
              persist({ impacts: [], currencies: [], dayPreset: "week" });
            }}
            resetLabel={t("common.reset")}
            doneLabel={t("common.done")}
            liveLabel={t("filters.live")}
          >
            <label className="tv-pick-search">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("news.searchPlaceholder")}
                aria-label={t("news.searchPlaceholder")}
                className="min-w-0 w-full bg-transparent text-sm outline-none"
              />
            </label>
            <FilterSection
              label={t("news.impact")}
              summary={
                impactFilter.size
                  ? Array.from(impactFilter)
                      .map((i) => t(IMPACT_KEYS[i as keyof typeof IMPACT_KEYS]))
                      .join(", ")
                  : t("common.all")
              }
              defaultOpen
            >
              <MultiPicker
                inline
                label={t("news.impact")}
                values={Array.from(impactFilter)}
                onChange={(v) => changeImpacts(v as EventImpact[])}
                options={IMPACTS.map((i) => ({
                  value: i,
                  label: t(IMPACT_KEYS[i as keyof typeof IMPACT_KEYS]),
                  count: weekCounts[i],
                }))}
                allLabel={t("common.all")}
              />
            </FilterSection>
            <FilterSection
              label={t("news.currencies")}
              summary={
                currencyFilter.size ? Array.from(currencyFilter).join(", ") : t("common.all")
              }
            >
              <MultiPicker
                inline
                label={t("news.currencies")}
                values={Array.from(currencyFilter)}
                onChange={(v) => changeCurrencies(v)}
                options={availableCurrencies.map((c) => ({ value: c, label: `${flagOf(c)} ${c}` }))}
                allLabel={t("common.all")}
                searchLabel={t("picker.search")}
                moreLabel={t("filters.more")}
                lessLabel={t("filters.less")}
              />
            </FilterSection>
            <FilterSection
              label={t("common.period")}
              summary={t(
                dayPreset === "today"
                  ? "news.today"
                  : dayPreset === "tomorrow"
                    ? "news.tomorrow"
                    : dayPreset === "week"
                      ? "news.thisWeek"
                      : "news.all",
              )}
            >
              <SelectPicker
                inline
                label={t("common.period")}
                value={dayPreset}
                onChange={(v) => changeDayPreset(v)}
                options={[
                  { value: "today", label: t("news.today") },
                  { value: "tomorrow", label: t("news.tomorrow") },
                  { value: "week", label: t("news.thisWeek") },
                  { value: "all", label: t("news.all") },
                ]}
              />
              {dayPreset === "all" && (
                <div className="mt-3">
                  <span className="tv-prose mb-2 block text-slate-500">
                    {t("journal.filterDay")}
                  </span>
                  <SelectPicker
                    inline
                    label={t("journal.filterDay")}
                    value={customDayFilter ?? "all"}
                    onChange={(v) => setCustomDayFilter(v === "all" ? null : v)}
                    options={[
                      { value: "all", label: t("common.all") },
                      ...days
                        .filter((d) => d.all.length > 0 || d.iso === customDayFilter)
                        .map((d) => ({
                          value: d.iso,
                          label: shortDayFmt.format(d.date),
                          count: d.all.length,
                        })),
                    ]}
                  />
                </div>
              )}
            </FilterSection>
          </FilterControls>
        </div>
      </div>

      {/* ── LE TABLEAU ── une ligne par publication, comme Forex Factory :
          heure · devise · impact · événement · réel · prévu · précédent. */}
      {loading || !prefsReady ? (
        <div className="ff-table" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ff-row">
              <div className="col-span-full h-5 animate-pulse rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ff-table px-4 py-10 text-center text-sm text-slate-500">
          {t("news.noEvents")}
        </div>
      ) : (
        /* Le tableau défile DANS sa carte (en-tête de colonnes collant) : la
           barre de la semaine et des filtres reste sous les yeux. */
        <div className="ff-table tv-grow tv-scroll" role="table" aria-label={t("news.title")}>
          <div className="ff-row ff-head" role="row">
            <span role="columnheader">{t("news.colTime")}</span>
            <span role="columnheader">{t("news.colCurrency")}</span>
            <span role="columnheader" className="sr-only md:not-sr-only">
              {t("news.impact")}
            </span>
            <span role="columnheader">{t("news.colEvent")}</span>
            <span role="columnheader" className="ff-num">
              {t("news.actual")}
            </span>
            <span role="columnheader" className="ff-num">
              {t("news.forecast")}
            </span>
            <span role="columnheader" className="ff-num">
              {t("news.previous")}
            </span>
          </div>
          {days.map(({ iso, date, events: dayEvents }) => {
            if (dayEvents.length === 0) return null;
            const isToday = iso === todayIso;
            const highCount = dayEvents.filter((e) => e.impact === "high").length;
            return (
              <div key={iso} ref={isToday ? todayRef : undefined} role="rowgroup">
                <div className={cn("ff-day", isToday && "ff-day-today")} role="row">
                  <span className="capitalize">{dayFmt.format(date)}</span>
                  {isToday && <span className="ff-day-tag">{t("news.today")}</span>}
                  <span className="ml-auto flex items-center gap-3">
                    {highCount > 0 && (
                      <span className="tv-num flex items-center gap-1 text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {highCount}
                      </span>
                    )}
                    <span className="tv-num text-slate-500">
                      {dayEvents.length === 1
                        ? t("news.eventsOne")
                        : t("news.eventsCount").replace("{n}", String(dayEvents.length))}
                    </span>
                  </span>
                </div>
                {dayEvents.map((e, index) => {
                  const status = statusOf(e, now);
                  const time = e.allDay ? t("news.allDay") : timeFmt.format(new Date(e.startsAt));
                  // Comme Forex Factory : l'heure n'est écrite qu'une fois pour
                  // les publications simultanées.
                  const sameTime =
                    index > 0 &&
                    dayEvents[index - 1].startsAt === e.startsAt &&
                    dayEvents[index - 1].allDay === e.allDay;
                  const isNext = nextEvent?.id === e.id;
                  return (
                    <div
                      key={e.id}
                      role="row"
                      className={cn(
                        "ff-row",
                        status === "past" && "ff-past",
                        status === "live" && "ff-live",
                        isNext && "ff-isnext",
                      )}
                    >
                      <span className="ff-time tv-num" role="cell">
                        {sameTime ? "" : time}
                        {status === "live" && <span className="ff-live-pill">Live</span>}
                      </span>
                      <span className="ff-cur" role="cell">
                        <span aria-hidden>{flagOf(e.currency)}</span> {e.currency}
                      </span>
                      <span role="cell">
                        <ImpactBars
                          impact={e.impact}
                          label={t(IMPACT_KEYS[e.impact as keyof typeof IMPACT_KEYS])}
                        />
                      </span>
                      <span className="ff-title" role="cell" title={e.country}>
                        {e.title}
                      </span>
                      <span className="ff-num ff-actual" role="cell">
                        <span className="ff-num-label">{t("news.actual")}</span>
                        {value(e.actual)}
                      </span>
                      <span className="ff-num" role="cell">
                        <span className="ff-num-label">{t("news.forecast")}</span>
                        {value(e.forecast)}
                      </span>
                      <span className="ff-num" role="cell">
                        <span className="ff-num-label">{t("news.previous")}</span>
                        {value(e.previous)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-slate-500">
        <span>{t("news.timezone").replace("{zone}", timeZone)}</span>
        <span aria-hidden>·</span>
        <span>
          {freshness ? t("news.updated").replace("{value}", freshness) : t("news.updatedNever")}
        </span>
        {isFallback && (
          <>
            <span aria-hidden>·</span>
            <span>{t("news.notice")}</span>
          </>
        )}
      </div>
    </PageContainer>
  );
}
