/**
 * TradingCalendarCard — le mois d'un coup d'œil.
 *
 * Une grille mensuelle où chaque jour porte ce qu'il a produit. C'est la carte
 * que tout journal de trading finit par avoir, parce qu'elle répond à la seule
 * question qu'on se pose en ouvrant l'application : « comment va le mois ? ».
 * Un tableau de trades ne répond pas à ça — il faut le lire ; une grille
 * teintée se lit sans être lue.
 *
 * DEUX LECTURES DU MÊME MOIS, et c'est le sens de la bascule :
 *
 *  • PNL — ce que chaque journée a rapporté ou coûté. Le passé.
 *  • ÉVÉNEMENTS — les publications à fort impact de chaque journée. Le
 *    contexte, et souvent l'explication : une journée rouge un jour de CPI ne
 *    se lit pas comme une journée rouge un mardi ordinaire.
 *
 * ELLE NE CONNAÎT NI LE COMPTE NI L'ENVIRONNEMENT. Elle reçoit des trades et
 * les agrège — c'est ce qui lui permet de servir le journal réel et la section
 * rejeu sans une ligne de différence : chacun lui passe les siens.
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Trade } from "../types";
import { useT } from "../i18n/LanguageContext";
import { useEconomicMonth } from "../hooks/useEconomicCalendar";
import { cn } from "../utils/cn";

type Mode = "pnl" | "events";

export interface TradingCalendarCardProps {
  trades: Trade[];
  /** Ouvre le détail d'une journée. Sans lui, les cases ne sont pas cliquables. */
  onSelectDay?: (isoDate: string) => void;
  /** Le mois affiché au premier rendu. Par défaut, le mois courant. */
  initialYear?: number;
  initialMonth?: number;
  className?: string;
}

/** Un montant de journée, court — « $1,212 », « −$333 ». */
function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const body =
    abs >= 10_000
      ? `${Math.round(abs / 1000)}k`
      : abs.toLocaleString("en-US", { maximumFractionDigits: abs >= 1000 ? 0 : 2 });
  return `${sign}$${body}`;
}

/** `YYYY-MM-DD` d'un jour du mois affiché, sans passer par un fuseau. */
function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function TradingCalendarCard({
  trades,
  onSelectDay,
  initialYear,
  initialMonth,
  className,
}: TradingCalendarCardProps) {
  const { t, lang } = useT();
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());
  const [mode, setMode] = useState<Mode>("pnl");

  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
        new Date(year, month, 1),
      ),
    [locale, year, month],
  );
  /** Les initiales de jours, DIMANCHE EN TÊTE — la semaine du marché US. */
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" })
          .format(new Date(2023, 0, 1 + i))
          .toUpperCase(),
      ),
    [locale],
  );

  /** Le P&L et le nombre de trades par journée du mois affiché. */
  const byDay = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    for (const tr of trades) {
      if (!tr.date.startsWith(prefix)) continue;
      const cur = map.get(tr.date) ?? { pnl: 0, count: 0 };
      cur.pnl += tr.pnl;
      cur.count += 1;
      map.set(tr.date, cur);
    }
    return map;
  }, [trades, year, month]);

  // Les événements ne sont demandés QUE si on les regarde : le mode « PNL » ne
  // doit pas déclencher une requête réseau que personne n'a demandée.
  const { events, loading: eventsLoading } = useEconomicMonth(
    mode === "events" ? year : now.getFullYear(),
    mode === "events" ? month : now.getMonth(),
  );

  /** Les publications à fort impact, par journée. */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    if (mode !== "events") return map;
    for (const e of events) {
      if (e.impact !== "high") continue;
      // L'horodatage est absolu ; la journée se lit à New York, comme la séance.
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(e.startsAt));
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [events, mode]);

  /** Les cases du mois, dimanche en tête, complétées de vides. */
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay(); // 0 = dimanche
    const days = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= days; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const step = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-4",
        className,
      )}
      aria-label={t("dash.tradingCalendar")}
    >
      <h3 className="text-center text-sm font-bold text-[var(--tv-text)]">
        {t("dash.tradingCalendar")}
      </h3>

      {/* LA BASCULE — deux lectures du même mois. */}
      <div
        className="mx-auto mt-3 flex w-full max-w-[280px] rounded-xl bg-[var(--tv-plate-2)] p-1"
        role="tablist"
      >
        {(["pnl", "events"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-bold transition",
              mode === m
                ? "bg-[var(--tv-chart-green)] text-[#04121c]"
                : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
            )}
          >
            {t(m === "pnl" ? "dash.calPnl" : "dash.calEvents")}
          </button>
        ))}
      </div>

      {/* Navigation du mois */}
      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={t("dash.calPrevMonth")}
          className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tv-plate-2)] text-[var(--tv-text-secondary)] transition hover:text-[var(--tv-text)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[140px] text-center text-sm font-bold capitalize text-[var(--tv-text)]">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={t("dash.calNextMonth")}
          className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tv-plate-2)] text-[var(--tv-text-secondary)] transition hover:text-[var(--tv-text)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* En-tête des jours */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {weekdays.map((d) => (
          <div
            key={d}
            className="tv-label rounded-md bg-[var(--tv-plate-2)] py-1.5 text-center text-[9.5px] text-[var(--tv-text-muted)]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* La grille */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={`e${i}`} className="min-h-[58px]" />;
          const iso = isoOf(year, month, day);
          const data = byDay.get(iso);
          const high = eventsByDay.get(iso) ?? 0;
          const traded = mode === "pnl" && data != null;
          const marked = mode === "events" && high > 0;
          const up = (data?.pnl ?? 0) >= 0;
          const clickable = Boolean(onSelectDay) && (traded || marked);

          return (
            <button
              key={iso}
              type="button"
              disabled={!clickable}
              onClick={() => onSelectDay?.(iso)}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition",
                // Une journée SANS activité reste neutre et muette : la teinter
                // ferait de l'absence de trade un résultat.
                !traded && !marked && "border-transparent bg-[var(--tv-plate-2)]/40",
                traded &&
                  up &&
                  "border-[var(--tv-chart-green)]/45 bg-[rgb(var(--tv-chart-green-rgb)/0.10)]",
                traded &&
                  !up &&
                  "border-[var(--tv-chart-red)]/45 bg-[rgb(var(--tv-chart-red-rgb)/0.10)]",
                marked && "border-[var(--tv-warning)]/45 bg-[rgb(var(--tv-warning-rgb)/0.10)]",
                iso === todayIso && "ring-1 ring-[var(--tv-accent)]/50",
                clickable && "hover:brightness-125",
              )}
              title={
                mode === "pnl" && data
                  ? `${data.count} · ${money(data.pnl)}`
                  : marked
                    ? `${high}`
                    : undefined
              }
            >
              <span
                className={cn(
                  "tv-figure text-[13px] font-semibold",
                  traded || marked ? "text-[var(--tv-text)]" : "text-[var(--tv-text-muted)]",
                )}
              >
                {day}
              </span>
              {traded && (
                <span
                  className={cn(
                    "tv-figure mt-0.5 text-[10.5px] font-bold leading-none",
                    up ? "text-[var(--tv-chart-green)]" : "text-[var(--tv-chart-red)]",
                  )}
                >
                  {money(data!.pnl)}
                </span>
              )}
              {marked && (
                <span className="mt-1 flex items-center gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(high, 3) }, (_, k) => (
                    <span key={k} className="h-1 w-1 rounded-full bg-[var(--tv-warning)]" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ce que le mode « événements » a trouvé — ou n'a pas pu trouver. */}
      {mode === "events" && (
        <p className="mt-2 text-center text-[10.5px] text-[var(--tv-text-muted)]">
          {eventsLoading
            ? t("dash.calEventsLoading")
            : events.length === 0
              ? t("dash.calEventsOff")
              : eventsByDay.size === 0
                ? t("dash.calNoEvents")
                : null}
        </p>
      )}
    </section>
  );
}
