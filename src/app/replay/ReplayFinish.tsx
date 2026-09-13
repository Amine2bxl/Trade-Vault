/**
 * ReplayFinish — le bilan de la séance terminée.
 *
 * Après « Terminer & exporter », le trader voit trois choses, dans cet ordre :
 *
 *  1. CE QUI EST ARRIVÉ À SES TRADES. Un bandeau qui dit combien de lignes ont
 *     rejoint le journal, ou pourquoi elles ne l'ont pas fait. C'est la
 *     première question qu'on se pose en appuyant sur ce bouton, donc la
 *     première réponse qu'on doit lire — pas une conclusion à déduire d'un
 *     libellé de bouton.
 *  2. CE QUE SA JOURNÉE A PRODUIT — trades, P&L net, win rate, meilleur et
 *     pire trade, R moyen, puis le détail ligne à ligne.
 *  3. OÙ ALLER ENSUITE : le journal, une nouvelle séance, ou la sortie. Trois
 *     boutons qui disent chacun où ils mènent.
 */

import { AlertTriangle, BookOpen, CheckCircle2, LogOut, RotateCcw } from "lucide-react";
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
      <div className="tv-label text-[10px] text-[var(--tv-text-muted)]">{label}</div>
      <div
        className={cn(
          "mt-1 tv-figure text-lg font-bold",
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

  /**
   * LE BANDEAU DE RÉSULTAT — ce que l'export a réellement fait.
   *
   * Trois cas, trois messages, trois couleurs. Le cas « rien à exporter » n'est
   * pas un échec : une séance peut se terminer sans trade clos, et l'écrire en
   * rouge ferait croire à une panne.
   */
  const banner = (() => {
    if (!push) return null;
    if (push.failed > 0 && push.saved === 0)
      return { tone: "danger" as const, text: t("rt.exportFailed") };
    if (push.saved > 0)
      return {
        tone: "ok" as const,
        text: t("rt.journalPushed")
          .replace("{n}", String(push.saved))
          .replace("{account}", accountName),
      };
    return { tone: "info" as const, text: t("rt.exportedNone") };
  })();

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

        {banner && (
          <div
            className={cn(
              "mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium",
              banner.tone === "ok" &&
                "border-[var(--tv-chart-green)]/40 bg-[rgb(var(--tv-chart-green-rgb)/0.1)] text-[var(--tv-chart-green)]",
              banner.tone === "danger" &&
                "border-[var(--tv-danger)]/40 bg-[rgb(var(--tv-danger-rgb)/0.1)] text-[var(--tv-danger)]",
              banner.tone === "info" &&
                "border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-[var(--tv-text-muted)]",
            )}
          >
            {banner.tone === "ok" ? (
              <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
            )}
            <span>{banner.text}</span>
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
                <table className="w-full text-left tv-figure text-[11px]">
                  <thead className="sticky top-0 bg-[var(--tv-plate-2)] text-[10px] uppercase tracking-wide text-[var(--tv-text-muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("rt.colAction")}</th>
                      <th className="px-3 py-2 font-medium">{t("rt.colSize")}</th>
                      <th className="px-3 py-2 font-medium">{t("rt.colPrice")}</th>
                      <th className="px-3 py-2 font-medium">{t("rt.mark")}</th>
                      <th className="px-3 py-2 font-medium">R</th>
                      <th className="px-3 py-2 text-right font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.closedTrades.map((tr) => (
                      <tr key={tr.id} className="border-t border-[var(--tv-border)]/60">
                        <td className="px-3 py-1.5">
                          {tr.side === "long" ? t("rt.long") : t("rt.short")}
                        </td>
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

            {/* OÙ ALLER ENSUITE. Chaque bouton porte sa destination, pas le
              résultat de l'export — celui-ci est déjà dit dans le bandeau. Le
              libellé « 12 trades ajoutés… » servait auparavant de BOUTON, ce
              qui laissait croire qu'il fallait cliquer pour que l'export ait
              lieu. */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="accent" onClick={onGoJournal} className="gap-2">
                <BookOpen className="h-4 w-4" />
                {t("rt.goJournal")}
              </Button>
              <Button variant="ghost" onClick={onNew} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("rt.newSession")}
              </Button>
              <Button variant="ghost" onClick={() => onExit?.()} className="gap-2">
                <LogOut className="h-4 w-4" />
                {t("rt.exit")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
