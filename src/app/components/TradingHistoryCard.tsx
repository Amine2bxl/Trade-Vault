/**
 * TradingHistoryCard — l'historique, UNE JOURNÉE PAR CARTE.
 *
 * Un tableau de trades est un outil de vérification : on y cherche une ligne.
 * L'historique d'un tableau de bord répond à une autre question — « comment se
 * sont passées mes dernières journées ? » — et pour celle-là, une ligne de
 * tableau de sept colonnes est illisible : les chiffres qui comptent (le net,
 * le meilleur moment, ce que les commissions ont mangé) s'y perdent parmi les
 * autres.
 *
 * D'où la carte : une journée, son instrument principal, et quatre grandeurs
 * nommées. On lit la journée, pas la ligne.
 *
 * LE « PNL MAX » EST UNE VRAIE MESURE, pas le plus gros trade : c'est le point
 * le plus haut atteint par le CUMUL de la journée, trade après trade. C'est ce
 * qui dit si une journée verte a été tenue ou si elle a rendu l'essentiel —
 * deux journées à +200 $ dont l'une est montée à +900 $ ne racontent pas la
 * même chose, et seule cette grandeur les distingue.
 */

import { useMemo, useState } from "react";
import type { Trade } from "../types";
import { isBreakEven } from "../types";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

/** Combien de journées on montre avant de demander « voir plus ». */
const PAGE = 5;

export interface TradingHistoryCardProps {
  trades: Trade[];
  /** Ouvre le détail d'une journée. Sans lui, les cartes ne sont pas cliquables. */
  onSelectDay?: (isoDate: string) => void;
  className?: string;
}

interface DayRecord {
  date: string;
  /** Les symboles de la journée, le plus fréquent en tête. */
  symbols: string[];
  netPnl: number;
  /** Plus haut point du cumul intra-journalier. */
  pnlHigh: number;
  commission: number;
  avgWin: number;
  count: number;
}

function money(n: number, digits = 2): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** `YYYY-MM-DD` → « 05/25/2026 ». */
function formatDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(y, m - 1, d));
}

function buildRecords(trades: Trade[]): DayRecord[] {
  const byDay = new Map<string, Trade[]>();
  for (const t of trades) {
    const list = byDay.get(t.date);
    if (list) list.push(t);
    else byDay.set(t.date, [t]);
  }

  const out: DayRecord[] = [];
  for (const [date, list] of byDay) {
    // L'ordre INTRA-JOURNALIER décide du « PNL max » : sans lui, le cumul
    // serait celui d'un ordre arbitraire, et le plus haut point n'aurait aucun
    // sens. L'heure d'entrée est ce qu'on a de plus proche d'une chronologie.
    const ordered = [...list].sort((a, b) => (a.entryTime ?? "").localeCompare(b.entryTime ?? ""));
    let running = 0;
    let high = 0;
    let wins = 0;
    let winSum = 0;
    let commission = 0;
    const symbolCount = new Map<string, number>();

    for (const t of ordered) {
      running += t.pnl;
      high = Math.max(high, running);
      if (!isBreakEven(t) && t.pnl > 0) {
        wins += 1;
        winSum += t.pnl;
      }
      // Les commissions ne sont pas un champ du trade : le glissement saisi y
      // tient lieu de coût d'exécution quand il est renseigné.
      commission += Number(t.slippage ?? 0) || 0;
      if (t.symbol) symbolCount.set(t.symbol, (symbolCount.get(t.symbol) ?? 0) + 1);
    }

    out.push({
      date,
      symbols: [...symbolCount.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s),
      netPnl: running,
      pnlHigh: high,
      commission,
      avgWin: wins > 0 ? winSum / wins : 0,
      count: ordered.length,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="tv-label truncate text-[9px] text-[var(--tv-text-muted)]">{label}</div>
      <div
        className={cn("tv-figure truncate text-[13px] font-bold", tone ?? "text-[var(--tv-text)]")}
      >
        {value}
      </div>
    </div>
  );
}

export default function TradingHistoryCard({
  trades,
  onSelectDay,
  className,
}: TradingHistoryCardProps) {
  const { t, lang } = useT();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const records = useMemo(() => buildRecords(trades), [trades]);
  const [shown, setShown] = useState(PAGE);

  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-4",
        className,
      )}
      aria-label={t("dash.tradingHistory")}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--tv-text)]">{t("dash.tradingHistory")}</h3>
        <span className="shrink-0 rounded-full bg-[var(--tv-plate-2)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--tv-text-muted)]">
          {t("dash.records").replace("{n}", String(records.length))}
        </span>
      </div>

      {records.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-[var(--tv-text-muted)]">
          {t("dash.noHistory")}
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {records.slice(0, shown).map((r) => {
              const up = r.netPnl >= 0;
              const clickable = Boolean(onSelectDay);
              return (
                <button
                  key={r.date}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onSelectDay?.(r.date)}
                  className={cn(
                    "w-full rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-3 text-left transition",
                    clickable && "hover:border-[var(--tv-border-strong)]",
                  )}
                >
                  <div className="tv-label text-[9px] text-[var(--tv-text-muted)]">
                    {t("rt.date")}
                  </div>
                  <div className="tv-figure text-sm font-bold text-[var(--tv-text)]">
                    {formatDate(r.date, locale)}
                  </div>

                  {r.symbols.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.symbols.slice(0, 3).map((sym) => (
                        <span
                          key={sym}
                          className="rounded-md border border-[var(--tv-chart-green)]/40 bg-[rgb(var(--tv-chart-green-rgb)/0.10)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--tv-chart-green)]"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
                    <Cell
                      label={t("dash.netPnl")}
                      value={money(r.netPnl)}
                      tone={up ? "text-[var(--tv-chart-green)]" : "text-[var(--tv-chart-red)]"}
                    />
                    <Cell label={t("dash.pnlHigh")} value={money(r.pnlHigh)} />
                    <Cell label={t("dash.commission")} value={money(r.commission)} />
                    <Cell label={t("dash.avgWin")} value={money(r.avgWin)} />
                  </div>
                </button>
              );
            })}
          </div>

          {shown < records.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mt-2 w-full rounded-xl border border-[var(--tv-border)] py-2 text-[11px] font-semibold text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)]"
            >
              {t("dash.historyMore")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
