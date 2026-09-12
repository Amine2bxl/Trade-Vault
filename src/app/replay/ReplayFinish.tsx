/**
 * ReplayFinish — le bilan de la séance terminée.
 *
 * Après « Terminer & exporter », le trader voit exactement ce que sa journée a
 * produit — nombre de trades, P&L net, win rate, meilleur/pire trade, R moyen —
 * et rejoint le journal d'un clic. Les trades sont déjà dans la table `trades`
 * reliés au compte de rejeu et à la session.
 */

import { BookOpen, CheckCircle2, Flag, RotateCcw } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { Button } from "@/shared/ui";
import { summarize, type ReplaySessionState } from "@/modules/replay";
import type { JournalPushResult } from "../store/replay";
import { cn } from "../utils/cn";

interface Props {
  state: ReplaySessionState | null;
  accountName: string;
  push: JournalPushResult | null;
  onNew: () => void;
  onGoJournal: () => void;
  onExit: (() => void) | undefined;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--tv-text-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-bold",
          tone === "up"
            ? "text-[var(--tv-chart-green)]"
            : tone === "down"
              ? "text-[var(--tv-chart-red)]"
              : "text-[var(--tv-text)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function ReplayFinish({
  state,
  accountName,
  push,
  onNew,
  onGoJournal,
  onExit,
}: Props) {
  const { t } = useT();
  const summary = state ? summarize(state) : null;
  const pushMsg = summary
    ? t("rt.journalPushed")
        .replace("{n}", String(summary.tradesCount))
        .replace("{account}", accountName)
    : "";

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[var(--tv-bg)] px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--tv-chart-green)] text-[#04121c]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--tv-text)]">{t("rt.summary")}</h1>
            <p className="text-xs text-[var(--tv-text-muted)]">{accountName}</p>
          </div>
        </div>

        {push && !push.saved && push.failed > 0 && (
          <div className="mb-4 rounded-xl border border-[var(--tv-danger)]/40 bg-[var(--tv-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--tv-danger)]">
            {push.failed} {t("rt.trades")} {t("rt.journalNoTrades")}
          </div>
        )}

        {summary && state && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label={t("rt.trades")} value={String(summary.tradesCount)} tone="neutral" />
              <Stat
                label={t("rt.realizedPnl")}
                value={`${summary.netPnl >= 0 ? "+" : ""}${summary.netPnl.toFixed(0)} $`}
                tone={summary.netPnl >= 0 ? "up" : "down"}
              />
              <Stat
                label={t("rt.winRate")}
                value={`${Math.round(summary.winRate * 100)} %`}
                tone="neutral"
              />
              <Stat
                label={t("rt.bestTrade")}
                value={`${summary.bestTrade.toFixed(0)} $`}
                tone="up"
              />
              <Stat
                label={t("rt.worstTrade")}
                value={`${summary.worstTrade.toFixed(0)} $`}
                tone="down"
              />
              <Stat
                label={t("rt.avgR")}
                value={`${summary.avgR.toFixed(2)} R`}
                tone={summary.avgR >= 0 ? "up" : "down"}
              />
            </div>

            {state.closedTrades.length > 0 && (
              <div className="mt-4 max-h-56 overflow-y-auto rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)]">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="sticky top-0 bg-[var(--tv-plate-2)] text-[10px] uppercase tracking-wide text-[var(--tv-text-muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Side</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Entrée</th>
                      <th className="px-3 py-2 font-medium">Sortie</th>
                      <th className="px-3 py-2 font-medium">R</th>
                      <th className="px-3 py-2 text-right font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.closedTrades.map((tr) => (
                      <tr key={tr.id} className="border-t border-[var(--tv-border)]/60">
                        <td className="px-3 py-1.5">{tr.side === "long" ? "LONG" : "SHORT"}</td>
                        <td className="px-3 py-1.5">{tr.qty}</td>
                        <td className="px-3 py-1.5">{tr.entryPrice.toFixed(2)}</td>
                        <td className="px-3 py-1.5">{tr.exitPrice.toFixed(2)}</td>
                        <td
                          className={cn(
                            "px-3 py-1.5",
                            tr.rMultiple >= 0
                              ? "text-[var(--tv-chart-green)]"
                              : "text-[var(--tv-chart-red)]",
                          )}
                        >
                          {tr.rMultiple.toFixed(2)}R
                        </td>
                        <td
                          className={cn(
                            "px-3 py-1.5 text-right font-semibold",
                            tr.realizedPnl >= 0
                              ? "text-[var(--tv-chart-green)]"
                              : "text-[var(--tv-chart-red)]",
                          )}
                        >
                          {tr.realizedPnl >= 0 ? "+" : ""}
                          {tr.realizedPnl.toFixed(2)} $
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="accent" onClick={onGoJournal} className="gap-2">
                <BookOpen className="h-4 w-4" />
                {pushMsg}
              </Button>
              <Button variant="ghost" onClick={onNew} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("rt.newSession")}
              </Button>
              <Button variant="ghost" onClick={() => onExit?.()} className="gap-2">
                <Flag className="h-4 w-4" />
                {t("rt.exit")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
