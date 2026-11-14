import { Fragment, useEffect, useMemo, useReducer, useState } from "react";
import { TrendingUp, TrendingDown, CalendarDays, Sparkles } from "@/shared/ui/icons";
import { Trade, isBreakEven } from "@/app/types";
import { measuredR } from "@/domain/trade";
import { easternClockOf } from "@/domain/easternClock";
import { computeStats, formatPnl, formatPct } from "@/domain/tradeCalcs";
import {
  computeQuantStats,
  getSessionForTrade,
  hasUnverifiedEtTime,
  statsByHour,
  winRateOf,
  MIN_BUCKET_SAMPLE,
  TradingSession,
} from "@/domain/quantStats";
import { loadStartingBalance } from "@/app/store";
import { useAuth } from "@/app/contexts/AuthContext";
import { nsKey, usePersistedValue, writeJSON } from "@/app/utils/persistence";
import { useAccounts } from "@/app/contexts/AccountContext";
import { cn } from "@/shared/ui/cn";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  CartesianGrid,
} from "recharts";
import { useT } from "@/app/i18n/LanguageContext";
import { NewsDaysCard } from "./NewsDaysCard";
import { EdgeLabCard } from "./EdgeLabCard";
import { OverviewBoard } from "./OverviewBoard";
import {
  EmptyState,
  PageContainer,
  SelectPicker,
  FilterControls,
  FilterSection,
  Card,
  Kpi,
  KpiGrid,
  RangePicker,
  MultiPicker,
  rangeBounds,
  type RangeValue,
  ScrollArea,
  SubNav,
} from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { usePageView } from "@/app/hooks/usePageView";
import {
  CHART_GREEN,
  CHART_RED,
  AXIS_TICK,
  BAR_FILL_GREEN,
  BAR_FILL_RED,
  BAR_RADIUS,
  BAR_RADIUS_H,
  useChartAnimation,
  EQUITY_CURVE_TYPE,
  EQUITY_GRID,
  TREND_LINE,
  TREND_STROKE,
  moneyAxisProps,
  tooltipStyle,
  glowActiveDot,
  formatAxisMoney,
} from "@/app/trading/chartTheme";
import { usePageActions } from "@/app/contexts/PageActionsContext";
import { formatMoney } from "@/shared/currency";
import { useLiveTable } from "@/app/hooks/useLiveTable";

interface AnalyticsProps {
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

type AnalyticsPeriod = "all" | "7d" | "30d" | "90d" | "1y";
const PERIOD_DAYS: Record<AnalyticsPeriod, number | null> = {
  all: null,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

/** Le jour d'un trade — midi local : `new Date("YYYY-MM-DD")` est minuit UTC,
 *  donc LA VEILLE à New York. Le lundi d'un trader de Chicago tombait dimanche. */
const weekdayOf = (date: string) => new Date(`${date}T12:00:00`).getDay();

const ANALYTICS_VIEWS = ["overview", "execution", "timing"] as const;

const ALL_PERIOD: RangeValue<AnalyticsPeriod> = { kind: "preset", preset: "all" };
const NO_DAYS: string[] = [];

export default function Analytics({ trades }: AnalyticsProps) {
  const chartAnimation = useChartAnimation();
  const [view, setView] = usePageView("analytics", ANALYTICS_VIEWS, "overview");
  const { boxRef, height } = useAvailableHeight();
  const { t, lang } = useT();
  const { user } = useAuth();
  const { activeId, accounts } = useAccounts();
  const locale = LOCALE_MAP[lang] || "en-US";
  /* Filtres MÉMORISÉS (par utilisateur, sur cet appareil) : la page rouvre
     sur la question que le trader se posait la dernière fois. */
  const periodKey = nsKey(user?.id, "analytics.period");
  const daysKey = nsKey(user?.id, "analytics.days");
  const period = usePersistedValue<RangeValue<AnalyticsPeriod>>(periodKey, ALL_PERIOD);
  const setPeriod = (v: RangeValue<AnalyticsPeriod>) => writeJSON(periodKey, v);
  /* LE JOUR DE LA SEMAINE — la deuxième moitié de la question.
     La page ne savait filtrer qu'une DURÉE : « les trente derniers jours ».
     Or la question qu'un trader se pose sur ses statistiques est presque
     toujours croisée — « mes lundis sur trente jours », « mes vendredis sur
     l'année » —, et c'est exactement ce qu'il faut pour décider d'arrêter de
     trader un jour donné. Le filtre s'applique EN AMONT de tous les calculs de
     la page : chaque chiffre, chaque graphe répond alors à la question posée,
     et pas seulement l'un d'entre eux. */
  /** Jours retenus (1 = lundi … 5 = vendredi) — vide : tous. */
  const days = usePersistedValue<string[]>(daysKey, NO_DAYS);
  const setDays = (v: string[]) => writeJSON(daysKey, v);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [startingBalance, setStartingBalance] = useState(0);

  /** Premier axe : la PÉRIODE — un raccourci, ou des bornes choisies. Les
   *  bornes sont des dates CIVILES comparées en chaînes : aucun décalage de
   *  fuseau ne fait entrer ou sortir un jour. */
  const dureeTrades = useMemo(() => {
    const bounds = rangeBounds(period, PERIOD_DAYS);
    if (!bounds) return trades;
    return trades.filter((t) => t.date >= bounds.from && t.date <= bounds.to);
  }, [trades, period]);

  /* Second axe : les JOURS — un, plusieurs, ou tous. Le croisement porte le
     nom `cutoffTrades` — celui que toute la page consomme déjà —, donc chaque
     chiffre et chaque graphe (profit factor compris) répond à la question
     posée, et pas seulement l'un d'entre eux. */
  const cutoffTrades = useMemo(
    () =>
      days.length === 0
        ? dureeTrades
        : dureeTrades.filter((tr) => days.includes(String(weekdayOf(tr.date)))),
    [dureeTrades, days],
  );

  /** Combien de trades chaque jour porte DANS LA PÉRIODE — le compteur des
   *  options de jour. */
  const periodDayCount = useMemo(() => {
    const acc: Record<number, number> = {};
    for (const tr of dureeTrades) {
      const d = weekdayOf(tr.date);
      acc[d] = (acc[d] ?? 0) + 1;
    }
    return acc;
  }, [dureeTrades]);

  /** Les noms de jours dans la langue de l'app — jamais une liste écrite ici. */
  const jours = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [locale]);
  // Solde de départ modifié sur un autre appareil (profil ou compte) : relu.
  const [liveRev, bumpLive] = useReducer((n: number) => n + 1, 0);
  useLiveTable("profiles", bumpLive);
  useLiveTable("accounts", bumpLive);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    loadStartingBalance(user.id)
      .then((b) => {
        if (active) setStartingBalance(b);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, activeId, liveRev]);
  const DAY_NAMES = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2023, 0, 1 + i)),
      ),
    [locale],
  );
  const MONTH_NAMES_SHORT = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, i, 1)),
      ),
    [locale],
  );
  // Mémoïsé : recalculé à chaque rendu (un survol du camembert en déclenche),
  // `stats` donnait de nouvelles identités aux séries, et Recharts rejouait
  // l'animation de chaque graphique pour des valeurs identiques.
  const stats = useMemo(() => computeStats(cutoffTrades), [cutoffTrades]);
  const dayOfWeekData = useMemo(
    () =>
      Object.entries(stats.pnlByDayOfWeek)
        .filter(([day]) => {
          const d = parseInt(day);
          return d >= 1 && d <= 5;
        })
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([day, data]) => {
          // `winRateOf` : plancher d'échantillon unique ; `null` coupe la ligne
          // au lieu de tracer « 0 % » ou « 100 % » sur un ou deux trades.
          const wr = winRateOf(data);
          return {
            day: DAY_NAMES[parseInt(day)],
            pnl: Math.round(data.pnl * 100) / 100,
            trades: data.count,
            winRate: wr === null ? null : Math.round(wr * 100),
          };
        }),
    [stats.pnlByDayOfWeek, DAY_NAMES],
  );
  const strategyData = useMemo(
    () =>
      Object.entries(stats.pnlByStrategy)
        .map(([strategy, data]) => {
          const wr = winRateOf(data);
          return {
            strategy,
            pnl: Math.round(data.pnl * 100) / 100,
            trades: data.count,
            winRate: wr === null ? null : Math.round(wr * 100),
          };
        })
        .sort((a, b) => b.pnl - a.pnl),
    [stats.pnlByStrategy],
  );
  const pnlDistribution = useMemo(() => {
    const m = (v: number) => formatMoney(v, { whole: true });
    const b = [
      { range: `< ${m(-500)}`, count: 0, fill: CHART_RED },
      { range: `${m(-500)}~${m(-200)}`, count: 0, fill: CHART_RED },
      { range: `${m(-200)}~${m(0)}`, count: 0, fill: "#fca5a5" },
      { range: t("common.be"), count: 0, fill: "#f59e0b" },
      { range: `${m(0)}~${m(200)}`, count: 0, fill: "#86efac" },
      { range: `${m(200)}~${m(500)}`, count: 0, fill: "#5bf0ab" },
      { range: `> ${m(500)}`, count: 0, fill: "#22e08a" },
    ];
    for (const trade of cutoffTrades) {
      if (isBreakEven(trade)) b[3].count++;
      else if (trade.pnl < -500) b[0].count++;
      else if (trade.pnl < -200) b[1].count++;
      else if (trade.pnl < 0) b[2].count++;
      else if (trade.pnl < 200) b[4].count++;
      else if (trade.pnl < 500) b[5].count++;
      else b[6].count++;
    }
    return b;
  }, [cutoffTrades, t]);
  const symbolData = useMemo(() => {
    const map: Record<string, { pnl: number; count: number }> = {};
    for (const t of cutoffTrades) {
      if (!map[t.symbol]) map[t.symbol] = { pnl: 0, count: 0 };
      map[t.symbol].pnl += t.pnl;
      map[t.symbol].count++;
    }
    return Object.entries(map)
      .map(([symbol, data]) => ({
        symbol,
        pnl: Math.round(data.pnl * 100) / 100,
        trades: data.count,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [cutoffTrades]);
  const monthlyData = useMemo(() => {
    const map: Record<
      string,
      { pnl: number; count: number; wins: number; be: number; totalRR: number; rCount: number }
    > = {};
    for (const t of cutoffTrades) {
      const k = t.date.substring(0, 7);
      if (!map[k]) map[k] = { pnl: 0, count: 0, wins: 0, be: 0, totalRR: 0, rCount: 0 };
      map[k].pnl += t.pnl;
      map[k].count++;
      const r = measuredR(t);
      if (r !== null) {
        map[k].totalRR += r;
        map[k].rCount++;
      }
      if (isBreakEven(t)) map[k].be++;
      else if (t.pnl > 0) map[k].wins++;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [y, m] = key.split("-");
        const wr = winRateOf({ count: data.count, wins: data.wins, breakEven: data.be, pnl: 0 });
        // Le R moyen d'un mois suit le même plancher qu'un taux : sur deux
        // trades il ne décrit rien. Il ne porte que sur les trades au R mesuré.
        return {
          month: `${MONTH_NAMES_SHORT[parseInt(m) - 1]} '${y.slice(-2)}`,
          pnl: Math.round(data.pnl * 100) / 100,
          trades: data.count,
          winRate: wr === null ? null : Math.round(wr * 100),
          avgRR: data.rCount >= MIN_BUCKET_SAMPLE ? +(data.totalRR / data.rCount).toFixed(2) : null,
        };
      });
  }, [cutoffTrades]);

  const winLossData = useMemo(() => {
    const arr = [
      { name: t("common.win"), value: stats.wins, color: CHART_GREEN },
      { name: t("common.loss"), value: stats.losses, color: CHART_RED },
    ];
    if (stats.breakEven > 0)
      arr.push({ name: t("common.be"), value: stats.breakEven, color: "#f59e0b" });
    return arr;
  }, [stats.wins, stats.losses, stats.breakEven, t]);
  const quant = useMemo(
    () => computeQuantStats(cutoffTrades, startingBalance),
    [cutoffTrades, startingBalance],
  );

  // Per-setup table: WR / expectancy / PF / avg R for every strategy used
  const setupTable = useMemo(() => {
    const byStrategy: Record<string, Trade[]> = {};
    for (const tr of cutoffTrades) {
      (byStrategy[tr.strategy] ??= []).push(tr);
    }
    return Object.entries(byStrategy)
      .map(([strategy, list]) => {
        const decisive = list.filter((tr) => !isBreakEven(tr));
        const wins = decisive.filter((tr) => tr.pnl > 0);
        const losses = decisive.filter((tr) => tr.pnl < 0);
        const gp = wins.reduce((s, tr) => s + tr.pnl, 0);
        const gl = Math.abs(losses.reduce((s, tr) => s + tr.pnl, 0));
        const rValues = list.map(measuredR).filter((r): r is number => r !== null);
        // Le taux passe par `winRateOf`, l'UNIQUE définition du produit : cette
        // table recalculait le sien, ce qui dupliquait la logique et échappait
        // au plancher d'échantillon. Un setup joué trois fois affichait « 100 %
        // de réussite » sur la page même où le trader décide lequel abandonner.
        const bucket = {
          pnl: list.reduce((s, tr) => s + tr.pnl, 0),
          count: list.length,
          wins: wins.length,
          breakEven: list.length - decisive.length,
        };
        // Les TOTAUX restent affichés quel que soit l'échantillon (une somme est
        // vraie à toute taille) ; seuls les RATIOS attendent d'être fondés.
        const enoughSample = decisive.length >= MIN_BUCKET_SAMPLE;
        return {
          strategy,
          count: list.length,
          pnl: bucket.pnl,
          winRate: winRateOf(bucket),
          expectancy: bucket.pnl / list.length,
          profitFactor: !enoughSample || gl <= 0 ? null : gp / gl,
          avgR:
            rValues.length >= MIN_BUCKET_SAMPLE
              ? rValues.reduce((s, r) => s + r, 0) / rValues.length
              : null,
        };
      })
      .sort((a, b) => b.pnl - a.pnl);
  }, [cutoffTrades]);

  // Session (rows) × weekday (columns) PnL heatmap
  const SESSIONS: TradingSession[] = ["london", "newyork", "asia"];
  const heatmap = useMemo(() => {
    const map: Record<string, { pnl: number; count: number }> = {};
    let maxAbs = 0;
    for (const tr of cutoffTrades) {
      const s = getSessionForTrade(tr);
      if (!s) continue;
      // Même horloge que la session : le jour de New York quand l'instant est
      // prouvé (un trade de 20 h ET est déjà le lendemain à Paris).
      const dow = easternClockOf(tr.entryAt)?.weekday ?? new Date(tr.date + "T12:00:00").getDay();
      if (dow < 1 || dow > 5) continue;
      const k = `${s}-${dow}`;
      if (!map[k]) map[k] = { pnl: 0, count: 0 };
      map[k].pnl += tr.pnl;
      map[k].count++;
    }
    for (const v of Object.values(map)) maxAbs = Math.max(maxAbs, Math.abs(v.pnl));
    return { map, maxAbs };
  }, [cutoffTrades]);

  // Broker and unreviewed CSV clocks cannot be assumed Eastern.
  const unverifiedTimeCount = useMemo(
    () => cutoffTrades.filter(hasUnverifiedEtTime).length,
    [cutoffTrades],
  );

  // Win rate per entry hour
  const hourData = useMemo(() => {
    const byHour = statsByHour(cutoffTrades);
    return Object.entries(byHour)
      .map(([h, b]) => ({
        hour: `${h}h`,
        h: Number(h),
        pnl: Math.round(b.pnl * 100) / 100,
        // `null` et non 0 : Recharts interrompt la ligne, ce qui SE VOIT.
        // Tracer 0 % pour un bucket sans échantillon suffisant affichait « heure
        // catastrophique » là où il n'y a simplement pas de données.
        winRate: winRateOf(b) !== null ? Math.round(winRateOf(b)! * 100) : null,
        trades: b.count,
      }))
      .sort((a, b) => a.h - b.h);
  }, [cutoffTrades]);

  const pageControls = useMemo(
    () => (
      <div className="flex items-center gap-1">
        <FilterControls
          label={t("common.filters")}
          summary={[
            period.kind === "custom"
              ? `${period.from} – ${period.to}`
              : period.preset !== "all"
                ? t(`common.${period.preset}`)
                : "",
            ...days.map((d) => jours[Number(d)]),
          ]
            .filter(Boolean)
            .join(" · ")}
          onReset={() => {
            setDays([]);
            setPeriod({ kind: "preset", preset: "all" });
          }}
          resetLabel={t("common.reset")}
          doneLabel={t("common.done")}
          liveLabel={t("filters.live")}
          count={days.length + (period.kind === "custom" || period.preset !== "all" ? 1 : 0)}
        >
          <FilterSection
            label={t("common.viewMode")}
            summary={t(
              view === "overview"
                ? "analytics.viewOverview"
                : view === "execution"
                  ? "analytics.viewExecution"
                  : "analytics.viewTiming",
            )}
          >
            <SelectPicker
              inline
              label={t("common.viewMode")}
              value={view}
              onChange={setView}
              options={[
                { value: "overview", label: t("analytics.viewOverview") },
                { value: "execution", label: t("analytics.viewExecution") },
                { value: "timing", label: t("analytics.viewTiming") },
              ]}
            />
          </FilterSection>
          <FilterSection
            label={t("common.period")}
            summary={
              period.kind === "custom"
                ? `${period.from} – ${period.to}`
                : t(`common.${period.preset}`)
            }
            defaultOpen
          >
            <RangePicker
              inline
              label={t("common.period")}
              value={period}
              onChange={setPeriod}
              neutralPreset="all"
              presets={[
                { value: "all", label: t("common.all") },
                { value: "7d", label: t("common.7d") },
                { value: "30d", label: t("common.30d") },
                { value: "90d", label: t("common.90d") },
                { value: "1y", label: t("common.1y") },
              ]}
              customLabel={t("picker.custom")}
              fromLabel={t("picker.from")}
              toLabel={t("picker.to")}
              applyLabel={t("picker.apply")}
              todayLabel={t("calendar.today")}
              locale={locale}
            />
          </FilterSection>
          <FilterSection
            label={t("journal.filterDay")}
            summary={days.length ? days.map((d) => jours[Number(d)]).join(", ") : t("common.all")}
          >
            {/* Lundi à vendredi : les marchés que ce produit journalise ne
            s'échangent pas le week-end. Un jour, plusieurs, ou tous. */}
            <MultiPicker
              inline
              label={t("journal.filterDay")}
              values={days}
              onChange={setDays}
              options={[1, 2, 3, 4, 5].map((d) => ({
                value: String(d),
                label: jours[d].charAt(0).toUpperCase() + jours[d].slice(1),
                count: periodDayCount[d] ?? 0,
              }))}
              allLabel={t("common.all")}
              clearLabel={t("common.clear")}
              doneLabel={t("common.done")}
              countLabel={t("picker.nSelected")}
            />
          </FilterSection>
        </FilterControls>
      </div>
    ),
    [view, t, days, period, locale, jours, periodDayCount],
  );
  usePageActions(trades.length > 0 ? pageControls : null);

  if (trades.length === 0)
    return (
      <div className="p-3 md:p-4">
        <EmptyState title={t("analytics.noTrades")} />
      </div>
    );

  return (
    <PageContainer ref={boxRef} fit height={height}>
      {/* LES TROIS VUES, VISIBLES. Le choix de la vue vivait au fond du menu
          « Filtres » : la moitié de la page n'était jamais trouvée. */}
      <SubNav
        ariaLabel={t("common.viewMode")}
        value={view}
        onChange={setView}
        items={[
          { id: "overview", label: t("analytics.viewOverview") },
          { id: "execution", label: t("analytics.viewExecution") },
          { id: "timing", label: t("analytics.viewTiming") },
        ]}
        className="mb-3 w-fit max-w-full shrink-0 self-start"
      />
      <div className="tv-fit-col space-y-3 md:space-y-4">
        {/* La barre « Profit factor » qui coiffait les trois vues a disparu :
            le chiffre est dans la bande de la vue d'ensemble, avec ce qui a
            été gagné et perdu. */}
        <ScrollArea key={view} className="tv-grow animate-fade-in">
          {view === "overview" && (
            <div role="region" aria-label={t("analytics.viewOverview")}>
              <OverviewBoard
                trades={cutoffTrades}
                stats={stats}
                quant={quant}
                balance={Math.max(0, startingBalance + stats.totalPnl) || startingBalance}
                winLoss={
                  /* GAGNÉS / PERDUS — le camembert de l'ancienne vue, dans le
                     cadre commun : l'anneau, le taux au centre, les trois
                     comptes dessous. */
                  <section className="dash-panel">
                    <div className="dash-panel-head">
                      <h2 className="dash-panel-title">{t("analytics.winLoss")}</h2>
                    </div>
                    <div className="ana-donut">
                      <ResponsiveContainer debounce={100} width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={winLossData}
                            cx="50%"
                            cy="50%"
                            innerRadius="68%"
                            outerRadius="92%"
                            paddingAngle={3}
                            cornerRadius={5}
                            dataKey="value"
                            stroke="none"
                            onMouseEnter={(_, i) => setActivePieIndex(i)}
                            onMouseLeave={() => setActivePieIndex(null)}
                            {...chartAnimation}
                          >
                            {winLossData.map((e, i) => (
                              <Cell
                                key={i}
                                // Le secteur est un `role="img"` : sans nom, un lecteur
                                // d'écran n'annonce rien (axe `svg-img-alt`).
                                aria-label={`${e.name} : ${e.value}`}
                                fill={e.color}
                                style={{
                                  opacity:
                                    activePieIndex === null || activePieIndex === i ? 1 : 0.45,
                                  transition: "opacity 200ms ease-out",
                                }}
                              />
                            ))}
                          </Pie>
                          <Tooltip {...tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <span className="ana-donut-center">
                        <b className="tv-figure">
                          {stats.wins + stats.losses > 0 ? formatPct(stats.winRate) : "—"}
                        </b>
                        <small className="tv-label">{t("analytics.winRateLabel")}</small>
                      </span>
                    </div>
                    <div className="dash-month-stats ana-wl-stats">
                      {winLossData.map((e) => (
                        <span key={e.name}>
                          <small className="tv-label">
                            <i className="ana-dot" style={{ background: e.color }} />
                            {e.name}
                          </small>
                          <b className="tv-figure">{e.value}</b>
                        </span>
                      ))}
                    </div>
                  </section>
                }
                monthly={
                  /* PERFORMANCE MENSUELLE — l'ancienne vue : P&L en barres, taux
                     de réussite et R moyen en courbes, trois axes. */
                  <section className="dash-panel ana-span-2">
                    <div className="dash-panel-head">
                      <h2 className="dash-panel-title">{t("analytics.monthlyPerformance")}</h2>
                      <span className="dash-legend ml-auto" aria-hidden>
                        <i style={{ background: CHART_GREEN }} />
                        P&L
                      </span>
                      <span className="dash-legend" aria-hidden>
                        <i style={{ background: TREND_STROKE }} />
                        WR%
                      </span>
                      <span className="dash-legend" aria-hidden>
                        <i style={{ background: "#f59e0b" }} />R
                      </span>
                    </div>
                    {monthlyData.length > 0 ? (
                      <div className="ana-chart">
                        <ResponsiveContainer debounce={100} width="100%" height="100%">
                          <ComposedChart data={monthlyData}>
                            <CartesianGrid {...EQUITY_GRID} />
                            <XAxis
                              dataKey="month"
                              tick={AXIS_TICK}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              yAxisId="left"
                              {...moneyAxisProps(monthlyData.map((d) => d.pnl))}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={AXIS_TICK}
                              tickFormatter={(v) => `${v}%`}
                              axisLine={false}
                              tickLine={false}
                              domain={[0, 100]}
                              width={35}
                            />
                            {/* Le R a SON axe (masqué) : sur l'axe des %, un R
                                négatif était coupé et +1,2R collé au zéro. */}
                            <YAxis yAxisId="r" hide domain={["auto", "auto"]} />
                            <Tooltip
                              {...tooltipStyle}
                              formatter={(value: number | string, name: string) => {
                                if (name === "winRate")
                                  return [`${value}%`, t("analytics.winRateLabel")];
                                if (name === "avgRR") return [`${value}R`, t("dashboard.avgRR")];
                                return [formatMoney(Number(value)), t("journal.colPnl")];
                              }}
                            />
                            <Bar
                              yAxisId="left"
                              dataKey="pnl"
                              radius={BAR_RADIUS}
                              {...chartAnimation}
                            >
                              {monthlyData.map((e, i) => (
                                <Cell key={i} fill={e.pnl >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED} />
                              ))}
                            </Bar>
                            <Line
                              yAxisId="right"
                              type={EQUITY_CURVE_TYPE}
                              dataKey="winRate"
                              stroke={TREND_STROKE}
                              {...TREND_LINE}
                              dot={false}
                              activeDot={glowActiveDot(TREND_STROKE)}
                              name="winRate"
                              {...chartAnimation}
                            />
                            <Line
                              yAxisId="r"
                              type={EQUITY_CURVE_TYPE}
                              dataKey="avgRR"
                              stroke="#f59e0b"
                              {...TREND_LINE}
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={false}
                              activeDot={glowActiveDot("#f59e0b")}
                              name="avgRR"
                              {...chartAnimation}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="ana-empty">{t("analytics.noData")}</div>
                    )}
                  </section>
                }
              />
            </div>
          )}
          {view === "execution" && (
            <div
              className="space-y-3 md:space-y-4"
              role="region"
              aria-label={t("analytics.viewExecution")}
            >
              <Card className="overflow-hidden animate-fade-in-up stagger-2">
                <div className="px-4 md:px-5 py-3 border-b border-white/[0.06]">
                  <h3 className="tv-title">{t("analytics.setupTable")}</h3>
                </div>
                {/* Sur téléphone, le tableau garde ses quatre colonnes essentielles
              (setup, trades, win rate, P&L) au lieu d'imposer 640px de large
              et de faire défiler la carte de côté. */}
                <div>
                  <table className="w-full sm:min-w-[640px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {[
                          t("analytics.setupCol"),
                          t("common.trades"),
                          t("analytics.wrCol"),
                          t("quant.expectancy"),
                          "PF",
                          `${t("dashboard.avgRR")}`,
                          t("journal.colPnl"),
                        ].map((h, i) => (
                          <th
                            key={i}
                            className={cn(
                              "tv-label px-3 sm:px-4 py-2.5 text-slate-500",
                              i === 0 ? "text-left" : "text-right",
                              i >= 3 && i <= 5 && "hidden sm:table-cell",
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {setupTable.map((row) => (
                        <tr key={row.strategy} className="hover:bg-white/[0.02] transition-colors">
                          {/* Un nom de setup long élargissait le tableau au-delà de
                        l'écran : il se tronque, le nom complet reste au survol. */}
                          <td
                            title={row.strategy}
                            className="px-3 py-2.5 text-xs font-bold text-white sm:px-4"
                          >
                            {/* `max-width` n'est pas tenu sur une cellule de tableau :
                          la borne vit sur un bloc intérieur. */}
                            <span className="block max-w-[9.5rem] truncate sm:max-w-none">
                              {row.strategy}
                            </span>
                          </td>
                          <td className="tv-figure tv-figure-secondary px-4 py-2.5 text-xs text-slate-400 text-right">
                            {row.count}
                          </td>
                          <td className="tv-figure tv-figure-secondary px-4 py-2.5 text-xs text-right">
                            <span
                              className={cn(
                                "font-semibold",
                                row.winRate === null
                                  ? "text-slate-500"
                                  : row.winRate >= 0.5
                                    ? "text-emerald-400"
                                    : "text-red-400",
                              )}
                            >
                              {row.winRate === null ? "—" : formatPct(row.winRate)}
                            </span>
                          </td>
                          <td className="tv-figure tv-figure-secondary hidden px-4 py-2.5 text-xs text-right sm:table-cell">
                            <span
                              className={cn(
                                "font-semibold",
                                row.expectancy >= 0 ? "text-emerald-400" : "text-red-400",
                              )}
                            >
                              {formatPnl(row.expectancy)}
                            </span>
                          </td>
                          <td className="tv-figure tv-figure-secondary hidden px-4 py-2.5 text-xs text-right text-slate-300 sm:table-cell">
                            {/* « — » sous l'échantillon minimum : ne rien affirmer vaut
                          mieux qu'affirmer sur trois trades. */}
                            {row.profitFactor === null ? "—" : row.profitFactor.toFixed(2)}
                          </td>
                          <td className="tv-figure tv-figure-secondary hidden px-4 py-2.5 text-xs text-right sm:table-cell">
                            {row.avgR === null ? (
                              <span className="text-slate-600">—</span>
                            ) : (
                              <span
                                className={cn(
                                  "font-semibold",
                                  row.avgR >= 0 ? "text-emerald-400" : "text-red-400",
                                )}
                              >
                                {row.avgR >= 0 ? "+" : ""}
                                {row.avgR.toFixed(2)}R
                              </span>
                            )}
                          </td>
                          <td className="tv-figure tv-figure-secondary px-4 py-2.5 text-xs text-right">
                            <span
                              className={cn(
                                "font-bold",
                                row.pnl >= 0 ? "text-emerald-400" : "text-red-400",
                              )}
                            >
                              {formatPnl(row.pnl)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <EdgeLabCard
                trades={cutoffTrades}
                allTrades={trades}
                accountId={activeId ?? null}
                accountName={(id) => accounts.find((a) => a.id === id)?.name ?? id}
              />
              <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                <Card className="p-3 md:p-4 animate-fade-in-up stagger-6">
                  <h3 className="tv-title mb-3">{t("analytics.pnlByStrategy")}</h3>
                  <div className="h-40 md:h-48">
                    <ResponsiveContainer debounce={100} width="100%" height="100%">
                      <BarChart data={strategyData} layout="vertical">
                        <XAxis
                          type="number"
                          tick={AXIS_TICK}
                          tickFormatter={(v) => formatAxisMoney(Number(v))}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="strategy"
                          type="category"
                          tick={AXIS_TICK}
                          axisLine={false}
                          tickLine={false}
                          width={85}
                        />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(value: any) => [
                            formatMoney(Number(value)),
                            t("journal.colPnl"),
                          ]}
                        />
                        <Bar dataKey="pnl" radius={BAR_RADIUS_H} {...chartAnimation}>
                          {strategyData.map((e, i) => (
                            <Cell key={i} fill={e.pnl >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-3 md:p-4 animate-fade-in-up stagger-8">
                  <h3 className="tv-title mb-3">{t("analytics.symbolPerformance")}</h3>
                  <div className="space-y-1.5 max-h-48 md:max-h-64 overflow-y-auto">
                    {symbolData.map((s) => (
                      <div
                        key={s.symbol}
                        className="flex items-center gap-2 py-1.5 px-1.5 rounded-lg"
                      >
                        <span className="text-xs font-bold text-white w-12">{s.symbol}</span>
                        <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              s.pnl >= 0 ? "bg-emerald-400/70" : "bg-red-400/70",
                            )}
                            style={{
                              width: `${Math.min((Math.abs(s.pnl) / Math.max(...symbolData.map((x) => Math.abs(x.pnl)), 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "tv-num",
                            "text-xs font-bold w-20 text-right",
                            s.pnl >= 0 ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {formatPnl(s.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
              <Card className="p-3 md:p-4 animate-fade-in-up stagger-7">
                <h3 className="tv-title mb-3">{t("analytics.pnlDistribution")}</h3>
                <div className="h-40 md:h-48">
                  <ResponsiveContainer debounce={100} width="100%" height="100%">
                    <BarChart data={pnlDistribution}>
                      <CartesianGrid {...EQUITY_GRID} />
                      <XAxis
                        dataKey="range"
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        angle={-20}
                        textAnchor="end"
                        height={35}
                      />
                      <YAxis
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="count" radius={BAR_RADIUS} {...chartAnimation}>
                        {pnlDistribution.map((e, i) => (
                          <Cell key={i} fill={e.fill} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
          {view === "timing" && (
            <div
              className="space-y-3 md:space-y-4"
              role="region"
              aria-label={t("analytics.viewTiming")}
            >
              {trades.length >= 3 && <SeasonalitySection trades={cutoffTrades} />}
              {unverifiedTimeCount > 0 && (
                <p className="tv-hint" role="status">
                  {t("analytics.timeZoneUnverified")} ({unverifiedTimeCount})
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-3 md:p-4 animate-fade-in-up stagger-2">
                  <h3 className="tv-title mb-1">{t("analytics.heatmap")}</h3>
                  <p className="tv-hint mb-3">{t("analytics.heatmapSub")}</p>
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: "auto repeat(5, 1fr)" }}
                  >
                    <div />
                    {[1, 2, 3, 4, 5].map((d) => (
                      <div
                        key={d}
                        className="text-center text-[11px] text-slate-500 font-semibold pb-1"
                      >
                        {DAY_NAMES[d]}
                      </div>
                    ))}
                    {SESSIONS.map((s) => (
                      <Fragment key={s}>
                        <div className="text-[11px] text-slate-500 font-semibold pr-2 flex items-center">
                          {t(`session.${s}` as never)}
                        </div>
                        {[1, 2, 3, 4, 5].map((d) => {
                          const cell = heatmap.map[`${s}-${d}`];
                          const intensity =
                            cell && heatmap.maxAbs > 0 ? Math.abs(cell.pnl) / heatmap.maxAbs : 0;
                          return (
                            <div
                              key={`${s}-${d}`}
                              title={cell ? `${formatPnl(cell.pnl)} · ${cell.count} trades` : ""}
                              className={cn(
                                "rounded-lg h-11 flex flex-col items-center justify-center text-[11px] font-bold transition-transform hover:scale-105",
                                !cell && "bg-white/[0.02]",
                              )}
                              style={
                                cell
                                  ? {
                                      background:
                                        cell.pnl >= 0
                                          ? `rgb(var(--tv-chart-green-rgb) / ${0.08 + intensity * 0.45})`
                                          : `rgba(239,68,68,${0.08 + intensity * 0.45})`,
                                    }
                                  : undefined
                              }
                            >
                              {cell && (
                                <>
                                  {/* Une case fait ~50px sur téléphone : « +$1,234 » en
                                gras y débordait. Le montant compact (« +$1.2k »)
                                tient, le détail exact reste dans l'infobulle. */}
                                  <span
                                    className={cn(
                                      "max-w-full truncate px-0.5",
                                      cell.pnl >= 0 ? "text-emerald-300" : "text-red-300",
                                    )}
                                  >
                                    <span className="tv-num md:hidden">
                                      {formatMoney(cell.pnl, { signed: true, compact: true })}
                                    </span>
                                    <span className="tv-num hidden md:inline">
                                      {formatMoney(cell.pnl, { signed: true, whole: true })}
                                    </span>
                                  </span>
                                  <span className="tv-num text-slate-400 font-medium">
                                    {cell.count}
                                  </span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </Card>
                <Card className="p-3 md:p-4 animate-fade-in-up stagger-3">
                  <h3 className="tv-title mb-1">{t("analytics.byHour")}</h3>
                  <p className="tv-hint mb-3">{t("analytics.byHourSub")}</p>
                  {hourData.length > 0 ? (
                    <div className="h-40 md:h-48">
                      <ResponsiveContainer debounce={100} width="100%" height="100%">
                        <ComposedChart data={hourData}>
                          <CartesianGrid {...EQUITY_GRID} />
                          <XAxis
                            dataKey="hour"
                            tick={AXIS_TICK}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis yAxisId="left" {...moneyAxisProps(hourData.map((d) => d.pnl))} />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={AXIS_TICK}
                            tickFormatter={(v) => `${v}%`}
                            axisLine={false}
                            tickLine={false}
                            domain={[0, 100]}
                            width={32}
                          />
                          <Tooltip
                            {...tooltipStyle}
                            formatter={(value: any, name: any) => [
                              name === "winRate" ? `${value}%` : formatMoney(Number(value)),
                              name === "winRate"
                                ? t("analytics.winRateLabel")
                                : t("journal.colPnl"),
                            ]}
                          />
                          <Bar yAxisId="left" dataKey="pnl" radius={BAR_RADIUS} {...chartAnimation}>
                            {hourData.map((e, i) => (
                              <Cell key={i} fill={e.pnl >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED} />
                            ))}
                          </Bar>
                          <Line
                            yAxisId="right"
                            type={EQUITY_CURVE_TYPE}
                            dataKey="winRate"
                            stroke={TREND_STROKE}
                            {...TREND_LINE}
                            dot={false}
                            activeDot={glowActiveDot(TREND_STROKE)}
                            {...chartAnimation}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-600 text-sm">
                      {t("analytics.noData")}
                    </div>
                  )}
                </Card>
              </div>
              <Card className="p-3 md:p-4 animate-fade-in-up stagger-5">
                <h3 className="tv-title mb-3">{t("analytics.pnlWinRateByDay")}</h3>
                <div className="h-40 md:h-48">
                  <ResponsiveContainer debounce={100} width="100%" height="100%">
                    <ComposedChart data={dayOfWeekData}>
                      <CartesianGrid {...EQUITY_GRID} />
                      <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" {...moneyAxisProps(dayOfWeekData.map((d) => d.pnl))} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={AXIS_TICK}
                        tickFormatter={(v) => `${v}%`}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                        width={35}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: any, name: any) => [
                          name === "winRate" ? `${value}%` : formatMoney(Number(value)),
                          name === "winRate" ? t("analytics.winRateLabel") : t("journal.colPnl"),
                        ]}
                      />
                      <Bar yAxisId="left" dataKey="pnl" radius={BAR_RADIUS} {...chartAnimation}>
                        {dayOfWeekData.map((e, i) => (
                          <Cell key={i} fill={e.pnl >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED} />
                        ))}
                      </Bar>
                      <Line
                        yAxisId="right"
                        type={EQUITY_CURVE_TYPE}
                        dataKey="winRate"
                        stroke={TREND_STROKE}
                        {...TREND_LINE}
                        dot={false}
                        activeDot={glowActiveDot(TREND_STROKE)}
                        {...chartAnimation}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <NewsDaysCard trades={cutoffTrades} />
            </div>
          )}
        </ScrollArea>
      </div>
    </PageContainer>
  );
}

function SeasonalitySection({ trades }: { trades: Trade[] }) {
  const { t } = useT();
  const { lang } = useT();
  const locale = LOCALE_MAP[lang] || "en-US";
  const monthLabel = (m: number) =>
    new Date(2026, m, 1).toLocaleDateString(locale, { month: "short" });

  const data = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, () => ({ pnl: 0, count: 0 }));
    const byYearMonth = new Map<number, number[]>();
    for (const tr of trades) {
      const d = new Date(tr.date + "T00:00:00");
      if (Number.isNaN(d.getTime())) continue;
      const m = d.getMonth();
      const y = d.getFullYear();
      byMonth[m].pnl += tr.pnl;
      byMonth[m].count += 1;
      if (!byYearMonth.has(y))
        byYearMonth.set(
          y,
          Array.from({ length: 12 }, () => 0),
        );
      byYearMonth.get(y)![m] += tr.pnl;
    }
    const monthly = byMonth.map((m, i) => ({
      month: monthLabel(i),
      pnl: Math.round(m.pnl * 100) / 100,
      count: m.count,
    }));
    // Couronner un mois est un classement : même plancher que la page
    // Saisonnalité, dont cette carte est le résumé (sinon « meilleur mois »
    // désignait un mois d'un seul trade ici, et aucun là-bas).
    const traded = monthly.filter((m) => m.count >= MIN_BUCKET_SAMPLE);
    const best = traded.length ? traded.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
    const worst = traded.length ? traded.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
    const years = [...byYearMonth.entries()].sort((a, b) => b[0] - a[0]);
    const heatMax = Math.max(1, ...years.flatMap(([, arr]) => arr.map(Math.abs)));
    return { best, worst, years, heatMax, monthly };
  }, [trades, lang]);

  const { best, worst, years, heatMax, monthly } = data;
  const tradedMonths = monthly.filter((m) => m.count > 0).length;
  const totalTrades = monthly.reduce((s, m) => s + m.count, 0);
  if (tradedMonths === 0) return null;

  return (
    <Card className="animate-fade-in-up stagger-2">
      <div className="px-4 md:px-5 py-3 border-b border-white/[0.06]">
        <h3 className="tv-title">{t("trends.title")}</h3>
      </div>
      <div className="p-3 md:p-4 space-y-4">
        {/* LES QUATRE FAITS — DES CASES. Quatre blocs centrés de 76px pour
            porter « Août / +2 487,50 $ » : le libellé, le chiffre et sa mention
            n'ont jamais eu besoin de plus que la case standard du produit, et
            les centrer les rendait en plus impossibles à balayer en colonne. */}
        <KpiGrid cols={4}>
          <Kpi
            inset
            label={t("trends.bestMonth")}
            value={best ? best.month : "—"}
            hint={best ? formatPnl(best.pnl) : "—"}
            adornment={<TrendingUp className="h-3 w-3 shrink-0 text-emerald-400" />}
          />
          <Kpi
            inset
            label={t("trends.worstMonth")}
            value={worst ? worst.month : "—"}
            hint={worst ? formatPnl(worst.pnl) : "—"}
            adornment={<TrendingDown className="h-3 w-3 shrink-0 text-red-400" />}
          />
          <Kpi
            inset
            label={t("trends.monthsTraded")}
            value={`${tradedMonths}/12`}
            hint={`${totalTrades} trades`}
            adornment={<CalendarDays className="h-3 w-3 shrink-0 text-[var(--tv-highlight)]" />}
          />
          <Kpi
            inset
            label={t("trends.years")}
            value={String(years.length)}
            hint={t("trends.ofData")}
            adornment={<Sparkles className="h-3 w-3 shrink-0 text-amber-400" />}
          />
        </KpiGrid>

        {/* Yearly heatmap */}
        {years.length > 0 && (
          <div>
            <div className="tv-label text-slate-500 mb-2">{t("trends.yearlyHeatmap")}</div>
            <div className="flex flex-col gap-0.5 w-full">
              <div className="tv-label grid grid-cols-12 gap-0.5 text-slate-600 pl-9">
                {monthly.map((m, i) => (
                  <div key={i} className="text-center">
                    {m.month}
                  </div>
                ))}
              </div>
              {years.map(([year, months]) => (
                <div key={year} className="flex gap-0.5 items-center">
                  <div className="tv-num w-8 text-[10px] font-bold text-slate-400 shrink-0 text-right pr-1">
                    {year}
                  </div>
                  <div className="grid grid-cols-12 gap-0.5 flex-1">
                    {months.map((val, i) => {
                      const mag = heatMax > 0 ? Math.min(1, Math.abs(val) / heatMax) : 0;
                      const a = 0.05 + 0.25 * mag;
                      const isWin = val >= 0;
                      return (
                        <div
                          key={i}
                          className="tv-figure tv-figure-secondary h-7 rounded flex items-center justify-center text-[10px]"
                          style={{
                            background: isWin
                              ? `rgb(var(--tv-chart-green-rgb) / ${a})`
                              : `rgb(var(--tv-chart-red-rgb) / ${a})`,
                            color: mag > 0.1 ? (isWin ? "#6ee7b7" : "#fca5a5") : "#64748b",
                          }}
                        >
                          {val === 0 && months.every((v) => v === 0)
                            ? "—"
                            : `${isWin ? "+" : ""}${Math.round(val)}`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
