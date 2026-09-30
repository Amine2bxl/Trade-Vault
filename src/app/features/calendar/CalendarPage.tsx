import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { Trade, MissedOpportunity } from "@/app/types";
import { loadMissedOpportunities } from "@/app/store";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";

import { cn } from "@/app/utils/cn";
import { dayTone, dayToneBorder, dayToneFill, dayToneSegments } from "./calendarTone";
import { monthGrid, weekTotals as weekTotalsOf, type GridDay } from "./calendarGrid";
import WeekDetailModal from "./WeekDetailModal";
import { useIsNarrow } from "@/app/hooks/useIsNarrow";
import { todayLocalDate } from "@/shared/calendar-date";
import TradeDetailModal from "@/app/components/TradeDetailModal";
import MissedSetupDetailModal from "@/app/features/missed/MissedSetupDetailModal";
import { useT } from "@/app/i18n/LanguageContext";
import { Kpi, KpiGrid } from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { formatMoney } from "@/shared/currency";

interface CalendarPageProps {
  trades: Trade[];
  /** Deletes a trade from the day-detail modal (confirm handled by caller). */
  onDelete?: (id: string) => void;
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

export default function CalendarPage({ trades, onDelete }: CalendarPageProps) {
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const { t, lang } = useT();
  const { boxRef, height } = useAvailableHeight();
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
  /** La semaine ouverte (index de ligne), et la semaine d'où l'on est parti
   *  vers une journée : fermer la journée y ramène. */
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [returnWeek, setReturnWeek] = useState<number | null>(null);
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
        };
      map[t.date].pnl += t.pnl;
      map[t.date].count++;
      map[t.date].trades.push(t);
      map[t.date].avgRR += Math.abs(t.rMultiple);
      map[t.date].totalRR += t.rMultiple;
      if (t.direction === "be") map[t.date].breakEven++;
      else if (t.pnl > 0) map[t.date].wins++;
    }
    // Un taux de réussite PAR JOUR était calculé ici — et n'était affiché nulle
    // part. Supprimé plutôt que conservé « au cas où » : c'était une quatrième
    // définition du win rate, sans plancher d'échantillon, prête à être branchée
    // un jour sur un rendu par un contributeur qui n'aurait pas su qu'elle
    // n'était pas fiable sur une journée.
    for (const k of Object.keys(map)) {
      if (map[k].count > 0) map[k].avgRR = map[k].avgRR / map[k].count;
    }
    return map;
  }, [trades]);

  // La grille complète : jours du mois voisins inclus (voir `monthGrid`).
  const calendarRows = useMemo(() => monthGrid(year, month), [year, month]);

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
      // `null` et non 0 : un mois sans trade tranché n'a pas « 0 % de
      // réussite », il n'a pas de taux du tout.
      winRate: decidedTrades > 0 ? totalWins / decidedTrades : null,
    };
  }, [year, month, dailyData]);

  const selectedTrades = selectedDate ? dailyData[selectedDate]?.trades || [] : [];

  // Heatmap scale — the deepest tint maps to the month's single biggest |P&L|
  // day, so cell intensity reads as relative magnitude (Topstep/Lucid style),
  // not just win/loss binary.
  // Sur téléphone, un montant à quatre chiffres ne tient pas dans une case de
  // 50px : il passe en forme courte (« €1.2k »), jamais tronqué.
  const narrow = useIsNarrow();
  const maxAbsDay = useMemo(() => {
    let m = 0;
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      const data = dailyData[getDateStr(d)];
      if (data && data.count > 0) m = Math.max(m, Math.abs(data.pnl));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, dailyData]);

  // Totaux de semaine : le mois affiché seulement — les jours voisins sont
  // visibles dans la grille, jamais additionnés (voir `weekTotals`).
  const weekTotals = useMemo(
    () => calendarRows.map((row) => weekTotalsOf(row, dailyData)),
    [calendarRows, dailyData],
  );

  /* UNE CASE DU MOIS — partagée par la grille de bureau et celle du
     téléphone : le même jour se dessine de la même façon partout. */
  const renderDay = (cell: GridDay, colIdx: number) => {
    const dateStr = cell.date;
    const data = dailyData[dateStr];
    const out = !cell.inMonth;
    const tone = data ? dayTone(data.trades) : null;
    const isToday = dateStr === todayLocalDate();
    const isWeekend = colIdx >= 5;
    const dayMissed = missedByDate[dateStr] || [];
    const missedCount = dayMissed.length;

    const isAllBE = data && data.count > 0 && data.count === data.breakEven;
    const isWin = data && !isAllBE && data.pnl > 0;
    const isLoss = data && !isAllBE && data.pnl < 0;

    /* LA CASE. Une teinte SOLIDE du résultat net, à peine posée,
                       plus soutenue pour une grosse journée du mois ; un liseré
                       de la même couleur ; un filet en aplats pour une journée
                       mixte. Aucun dégradé. Un jour d'un mois voisin garde sa
                       date et ses trades, mais en retrait : contexte, pas
                       résultat du mois. */
    const mag = data && !out && maxAbsDay > 0 ? Math.min(1, Math.abs(data.pnl) / maxAbsDay) : 0;
    const cellStyle: CSSProperties | undefined =
      tone && !out
        ? { background: dayToneFill(tone, mag), borderColor: dayToneBorder(tone) }
        : undefined;
    const segments = tone && !out ? dayToneSegments(tone) : null;
    const summary = `${new Date(`${dateStr}T12:00:00`).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
    })}${
      data
        ? ` · ${formatMoney(data.pnl, { signed: true })} · ${data.count} ${
            data.count === 1 ? t("calendar.trade") : t("calendar.trades")
          }`
        : ""
    }${out ? ` · ${t("calendar.outsideMonth")}` : ""}`;

    return (
      <button
        key={dateStr}
        onClick={() => {
          if (data) setSelectedDate(dateStr);
          else if (dayMissed.length > 0) setSelectedMissed(dayMissed[0]);
        }}
        disabled={!data && missedCount === 0}
        style={cellStyle}
        aria-label={summary}
        className={cn(
          "cal-cell relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-0.5 text-center transition-[filter,transform] duration-200 md:min-h-[84px] md:gap-1 md:rounded-xl",
          out ? "cal-cell-out" : !cellStyle && "cal-cell-empty",
          !cellStyle && !out && missedCount > 0 && "border-amber-500/25",
          isToday && "ring-1 ring-inset ring-[var(--tv-border-accent)]",
          (data || missedCount > 0) && "cursor-pointer hover:brightness-125 active:scale-[0.97]",
        )}
      >
        {missedCount > 0 && (
          <span
            className={cn(
              "absolute right-1 top-1 flex items-center gap-0.5 text-[10px] font-bold text-amber-300 md:right-1.5 md:top-1.5",
              out && "opacity-60",
            )}
            title={`${missedCount} ${t("missed.title")}`}
          >
            <Target className="h-2.5 w-2.5" />
            <span className="hidden md:inline">{missedCount}</span>
          </span>
        )}
        <span
          className={cn(
            "tv-figure text-[13px] font-bold leading-none md:text-base",
            out
              ? "text-slate-600"
              : isToday
                ? "text-[var(--tv-highlight)]"
                : data
                  ? "text-white"
                  : isWeekend
                    ? "text-slate-500"
                    : "text-slate-300",
          )}
        >
          {cell.day}
        </span>
        {data && (
          <span
            className={cn(
              "tv-figure max-w-full truncate text-[10px] font-bold leading-none sm:text-[11px] md:text-[14px]",
              out && "opacity-70",
              isAllBE
                ? "text-slate-400"
                : isWin
                  ? "text-[var(--tv-chart-green)]"
                  : isLoss
                    ? "text-[var(--tv-chart-red)]"
                    : "text-slate-200",
            )}
          >
            {isAllBE
              ? t("common.be")
              : narrow
                ? formatMoney(data.pnl, {
                    compact: Math.abs(data.pnl) >= 1000,
                    whole: true,
                  })
                : formatMoney(data.pnl)}
          </span>
        )}
        {segments && (
          <span
            aria-hidden
            className="absolute inset-x-2 bottom-1 flex h-[2px] gap-px overflow-hidden rounded-full md:inset-x-3 md:bottom-1.5"
          >
            {segments.map((sg, i) => (
              <span key={i} style={{ flexGrow: sg.share, background: sg.color }} />
            ))}
          </span>
        )}
      </button>
    );
  };

  /* Des trades le week-end ce mois-ci ? Sur téléphone, la colonne W-E
     n'existe que dans ce cas : sans trade le samedi ni le dimanche, deux
     colonnes vides prenaient la place qui revient au total de la semaine. */
  const hasWeekendTrades = calendarRows.some((row) =>
    row.slice(5).some((c) => dailyData[c.date]?.count),
  );

  return (
    // `minHeight`, pas `height` — et `overflow-y-auto`, pas `overflow-hidden`.
    //
    // La hauteur mesurée est une CIBLE (« remplis l'écran »), pas un plafond
    // (« tiens dans l'écran, quoi qu'il en coûte »). Avec `height` +
    // `overflow-hidden`, les six lignes de semaine se partageaient ce qui
    // restait après les KPI, l'en-tête, la ligne des jours et la légende : sur
    // un écran un peu court, chaque cellule tombait sous le seuil lisible et
    // son contenu — P&L, nombre de trades, pastilles — s'écrasait, sans qu'il
    // soit possible de défiler pour compenser.
    //
    // En minimum, la page se comporte exactement pareil tant qu'il y a la
    // place : `flex-1` étire les lignes jusqu'à remplir la hauteur. Quand il
    // n'y a plus la place, les cellules s'arrêtent à leur plancher et le cadre
    // défile, au lieu de comprimer la grille.
    <div
      ref={boxRef}
      style={height ? { minHeight: height } : undefined}
      className="mx-auto flex h-full max-w-[1400px] flex-col overflow-y-auto px-3 py-2 md:px-5 md:py-3"
    >
      {/* Summary Cards */}
      <KpiGrid className="tv-flat shrink-0">
        {(
          [
            {
              label: t("calendar.monthlyPnl"),
              value: formatMoney(monthlySummary.tradingDays === 0 ? 0 : monthlySummary.total),
              tone:
                monthlySummary.tradingDays === 0
                  ? "neutral"
                  : monthlySummary.total > 0
                    ? "pos"
                    : monthlySummary.total < 0
                      ? "neg"
                      : "neutral",
              delay: 0,
            },
            {
              label: t("calendar.tradingDays"),
              value: String(monthlySummary.tradingDays),
              tone: "neutral",
              delay: 1,
            },
            {
              label: t("calendar.winningDays"),
              value: `${monthlySummary.winDays}/${monthlySummary.tradingDays}`,
              tone: monthlySummary.tradingDays === 0 ? "neutral" : "pos",
              delay: 2,
            },
            {
              label: t("dashboard.avgRR"),
              value: monthlySummary.avgRR.toFixed(2),
              tone: monthlySummary.tradingDays === 0 ? "neutral" : "accent",
              delay: 3,
            },
            {
              label: t("calendar.totalRR"),
              value: `${monthlySummary.totalRR.toFixed(2)}R`,
              tone:
                monthlySummary.tradingDays === 0
                  ? "neutral"
                  : monthlySummary.totalRR > 0
                    ? "pos"
                    : monthlySummary.totalRR < 0
                      ? "neg"
                      : "neutral",
              delay: 4,
            },
            {
              label: t("stats.winRate"),
              value:
                monthlySummary.winRate === null
                  ? "\u2014"
                  : `${(monthlySummary.winRate * 100).toFixed(1)}%`,
              tone:
                monthlySummary.winRate === null
                  ? "neutral"
                  : monthlySummary.winRate > 0.5
                    ? "pos"
                    : monthlySummary.winRate < 0.5
                      ? "neg"
                      : "neutral",
              delay: 5,
            },
          ] as const
        ).map((card) => (
          /* SIX CASES QUI NE RÉPONDENT À RIEN.
             Elles portaient `card-premium` : la carte s'éclaircissait au
             survol, ce qui dans ce produit annonce « je réponds au clic ».
             Aucune ne répond, et le rembourrage de carte pleine coûtait deux
             rangées de hauteur sur un téléphone, juste au-dessus du calendrier
             — la seule chose que cette page existe pour montrer. C'est `Kpi`,
             la case statique du produit, et la couleur reste ce qu'elle a
             toujours été : le SIGNE de la valeur. */
          <Kpi
            key={card.label}
            label={card.label}
            value={card.value}
            tone={card.tone}
            className={cn("animate-fade-in-up", `stagger-${card.delay}`)}
          />
        ))}
      </KpiGrid>

      {/* Calendar — remplit la hauteur restante, jamais plus : la page ne
          défile pas, la grille des jours s'étire ou se contracte. */}
      {/* `min-h-0` retiré ici aussi : la permission de rétrécir sous le contenu
          se propage le long de la chaîne flex. La laisser sur la carte aurait
          suffi à réécraser la grille, quel que soit le plancher des cellules.
          `overflow-hidden` reste — il sert les coins arrondis, plus à rogner
          un débordement. */}
      <div className="stat-card-elevated tv-flat mt-2 flex flex-1 flex-col overflow-hidden animate-fade-in-up stagger-5 md:mt-3">
        {/* L'EN-TÊTE DE LA RÉFÉRENCE : le titre à gauche, le mois entre deux
            boutons encadrés, « aujourd'hui » à côté. */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 md:px-5 md:py-3">
          <h3 className="tv-title hidden tracking-tight sm:block">{t("calendar.title")}</h3>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:flex-none">
            <button onClick={prevMonth} aria-label={t("common.previous")} className="cal-nav-btn">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tv-title min-w-[8.5rem] text-center tracking-tight">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} aria-label={t("common.next")} className="cal-nav-btn">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={goToday}
            className="flex h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[var(--tv-highlight)] transition hover:bg-[rgb(var(--tv-accent-rgb)/0.1)] active:scale-95"
          >
            {t("calendar.today")}
          </button>
        </div>
        {/* Tout tient sur une page : 7 colonnes de jours sur mobile (la
            colonne semaine est masquée), 8 sur desktop. Pas de scroll. */}
        <div className="hidden shrink-0 grid-cols-8 gap-1.5 px-2 md:grid">
          {DAYS.map((d, i) => (
            <div key={d + i} className={cn("cal-dow", i >= 5 && "cal-dow-weekend")}>
              {d}
            </div>
          ))}
          <div className="cal-dow">{t("calendar.week")}</div>
        </div>
        <div className="hidden flex-1 flex-col space-y-1.5 p-2 md:flex">
          {calendarRows.map((row, rowIdx) => {
            const week = weekTotals[rowIdx];
            const weekHasTrades = week.trades + week.outsideTrades > 0;
            const weekLabel = `${t("calendar.week")} ${rowIdx + 1}`;
            const weekValue =
              week.trades === 0 ? "—" : formatMoney(week.pnl, { signed: true, whole: true });
            const weekTone =
              week.trades === 0
                ? "text-slate-600"
                : week.pnl > 0
                  ? "text-[var(--tv-chart-green)]"
                  : week.pnl < 0
                    ? "text-[var(--tv-chart-red)]"
                    : "text-slate-300";
            const weekCount = `${week.trades} ${week.trades === 1 ? t("calendar.trade") : t("calendar.trades")}`;
            return (
              // PAS de `min-h-0` : la ligne ne descend jamais sous le plancher
              // de ses cellules, et `flex-1` l'étire dès qu'il y a la place.
              <div key={row[0].date} className="flex flex-1 flex-col gap-0.5">
                <div className="grid flex-1 grid-cols-8 gap-1.5">
                  {row.map((cell, colIdx) => renderDay(cell, colIdx))}

                  {/* LA SEMAINE (bureau) — une case qui s'ouvre sur ses trades. */}
                  <button
                    type="button"
                    onClick={() => weekHasTrades && setOpenWeek(rowIdx)}
                    disabled={!weekHasTrades}
                    aria-label={`${weekLabel} · ${weekValue} · ${weekCount}`}
                    className={cn(
                      "cal-week flex flex-col items-center justify-center rounded-xl p-2 text-center",
                      weekHasTrades ? "cursor-pointer" : "opacity-45",
                    )}
                  >
                    <span className="tv-label mb-0.5 text-slate-500">{weekLabel}</span>
                    <span className={cn("tv-figure text-sm leading-none", weekTone)}>
                      {weekValue}
                    </span>
                    {week.trades > 0 && (
                      <span className="tv-figure mt-1 text-[10px] text-slate-500">{weekCount}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {/* ── LA GRILLE DU TÉLÉPHONE ─────────────────────────────────────
            Lun → ven, puis la SEMAINE en colonne. L'ancienne version posait
            une bande « Week N » sous chaque rangée : six lignes de plus, la
            page s'allongeait d'environ 150px pour un total. Ici le total vit
            dans la rangée, à côté des jours qu'il additionne, et s'ouvre sur
            la semaine. Samedi et dimanche ne prennent une colonne (fusionnée,
            W-E) que si le mois compte des trades le week-end. */}
        <div
          className={cn(
            "grid shrink-0 gap-0.5 px-1 md:hidden",
            hasWeekendTrades ? "cal-m-grid-7" : "cal-m-grid-6",
          )}
        >
          {DAYS.slice(0, 5).map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {hasWeekendTrades && (
            <div className="cal-dow cal-dow-weekend">{t("calendar.weekendShort")}</div>
          )}
          <div className="cal-dow cal-dow-week">{t("calendar.weekShort")}</div>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-1 md:hidden">
          {calendarRows.map((row, rowIdx) => {
            const week = weekTotals[rowIdx];
            const weekHasTrades = week.trades + week.outsideTrades > 0;
            const sat = row[5];
            const sun = row[6];
            const weDays = [sat, sun].filter((c) => dailyData[c.date]?.count);
            const wePnl = weDays.reduce((sum, c) => sum + dailyData[c.date].pnl, 0);
            return (
              <div
                key={row[0].date}
                className={cn(
                  "grid flex-1 gap-0.5",
                  hasWeekendTrades ? "cal-m-grid-7" : "cal-m-grid-6",
                )}
              >
                {row.slice(0, 5).map((cell, colIdx) => renderDay(cell, colIdx))}
                {hasWeekendTrades && (
                  <button
                    type="button"
                    disabled={weDays.length === 0}
                    onClick={() =>
                      weDays.length === 1 ? setSelectedDate(weDays[0].date) : setOpenWeek(rowIdx)
                    }
                    aria-label={`${t("calendar.weekendShort")} ${sat.day}–${sun.day}`}
                    className={cn(
                      "cal-cell cal-cell-empty flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border text-center",
                      weDays.length === 0 && "opacity-60",
                    )}
                  >
                    <span className="tv-figure text-[10px] leading-none text-slate-500">
                      {sat.day}·{sun.day}
                    </span>
                    {weDays.length > 0 && (
                      <span
                        className={cn(
                          "tv-figure text-[10px] font-bold leading-none",
                          wePnl > 0
                            ? "text-[var(--tv-chart-green)]"
                            : wePnl < 0
                              ? "text-[var(--tv-chart-red)]"
                              : "text-slate-400",
                        )}
                      >
                        {formatMoney(wePnl, { compact: Math.abs(wePnl) >= 1000, whole: true })}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => weekHasTrades && setOpenWeek(rowIdx)}
                  disabled={!weekHasTrades}
                  aria-label={`${t("calendar.week")} ${rowIdx + 1} · ${
                    week.trades === 0 ? "—" : formatMoney(week.pnl, { signed: true })
                  }`}
                  className={cn(
                    "cal-week cal-week-m flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-center",
                    !weekHasTrades && "opacity-45",
                  )}
                >
                  <span className="tv-label text-[9px] leading-none text-slate-500">
                    {t("calendar.weekNum").replace("{n}", String(rowIdx + 1))}
                  </span>
                  <span
                    className={cn(
                      "tv-figure max-w-full truncate text-[10.5px] font-bold leading-none",
                      week.trades === 0
                        ? "text-slate-600"
                        : week.pnl > 0
                          ? "text-[var(--tv-chart-green)]"
                          : week.pnl < 0
                            ? "text-[var(--tv-chart-red)]"
                            : "text-slate-300",
                    )}
                  >
                    {week.trades === 0
                      ? "—"
                      : formatMoney(week.pnl, {
                          signed: true,
                          compact: Math.abs(week.pnl) >= 1000,
                          whole: true,
                        })}
                  </span>
                  {week.trades > 0 && (
                    <span className="tv-figure text-[9px] leading-none text-slate-500">
                      {week.trades} {t("calendar.tradesShort")}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden shrink-0 md:flex items-center justify-center gap-6 mt-2 px-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-md border"
            style={{
              background: "rgb(var(--tv-chart-green-rgb) / 0.12)",
              borderColor: "rgb(var(--tv-chart-green-rgb) / 0.38)",
            }}
          />
          <span className="text-[10px] text-slate-500">{t("calendar.legendWinningDay")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-md border"
            style={{
              background: "rgb(var(--tv-chart-red-rgb) / 0.12)",
              borderColor: "rgb(var(--tv-chart-red-rgb) / 0.38)",
            }}
          />
          <span className="text-[10px] text-slate-500">{t("calendar.legendLosingDay")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-md border"
            style={{
              background: "rgb(148 163 184 / 0.12)",
              borderColor: "rgb(148 163 184 / 0.32)",
            }}
          />
          <span className="text-[10px] text-slate-500">{t("calendar.legendBreakEvenDay")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md ring-1 ring-[var(--tv-border-accent)]" />
          <span className="text-[10px] text-slate-500">{t("calendar.legendToday")}</span>
        </div>
        {/* L'intensité : trois aplats, du plus petit au plus gros jour. */}
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[0, 0.5, 1].map((k) => (
              <div
                key={k}
                className="h-3 w-3 rounded-[3px]"
                style={{ background: `rgb(var(--tv-chart-green-rgb) / ${0.06 + 0.1 * k})` }}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-500">{t("calendar.legendHeat")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="cal-cell-out h-4 w-4 rounded-md border" />
          <span className="text-[10px] text-slate-500">{t("calendar.legendOutside")}</span>
        </div>
      </div>

      {selectedDate && selectedTrades.length > 0 && (
        <TradeDetailModal
          trades={selectedTrades}
          date={selectedDate}
          onClose={() => {
            setSelectedDate(null);
            if (returnWeek !== null) {
              setOpenWeek(returnWeek);
              setReturnWeek(null);
            }
          }}
          onDelete={onDelete}
          missed={missedByDate[selectedDate] || []}
          onOpenMissed={(m) => {
            setSelectedDate(null);
            setSelectedMissed(m);
          }}
        />
      )}

      {openWeek !== null && calendarRows[openWeek] && (
        <WeekDetailModal
          days={calendarRows[openWeek]}
          weekIndex={openWeek}
          monthLabel={`${MONTHS[month]} ${year}`}
          byDate={dailyData}
          locale={locale}
          onClose={() => setOpenWeek(null)}
          onOpenDay={(date) => {
            setReturnWeek(openWeek);
            setOpenWeek(null);
            setSelectedDate(date);
          }}
        />
      )}

      {selectedMissed && (
        <MissedSetupDetailModal missed={selectedMissed} onClose={() => setSelectedMissed(null)} />
      )}
    </div>
  );
}
