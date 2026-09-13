/**
 * ReplayDashboard — les analytics DE LA SÉANCE.
 *
 * Le mode rejeu ne doit pas seulement ressembler à un autre produit, il doit
 * RENDRE COMPTE comme lui. Cet écran est au backtest ce que la page Analytics
 * est au journal réel : les mêmes grandeurs, la même lecture, mais calculées
 * sur la séance qu'on vient de jouer et sur rien d'autre.
 *
 * Tout vient du produit, rien n'est réinventé :
 *   • `computeStats` — le calcul de statistiques du journal, à l'identique.
 *     Un second calcul aurait fini par diverger, et deux chiffres censés dire
 *     la même chose qui ne s'accordent pas coûtent plus cher que l'absence
 *     du chiffre ;
 *   • `Kpi` / `KpiGrid` — les cases statiques du design system ;
 *   • `tradeOf` — la traduction d'un trade rejoué en trade de journal, déjà
 *     utilisée pour l'encodage et pour la poussée en fin de séance.
 *
 * Deux grandeurs manquent au calcul du journal parce qu'elles n'ont de sens
 * qu'ici : le nombre de lots et la durée moyenne d'un trade. Le rejeu les
 * connaît (quantité, horodatages d'entrée et de sortie), il les calcule.
 */

import { useMemo } from "react";
import { Kpi, KpiGrid } from "@/shared/ui";
import { useT } from "../i18n/LanguageContext";
import { computeStats } from "../utils/tradeCalcs";
import { tradeOf } from "../store/replay";
import type { ReplaySessionState, ReplayTrade } from "@/modules/replay";

const money = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`;

/** Une durée en clair : « 8 min 44 s ». */
function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

export default function ReplayDashboard({ state }: { state: ReplaySessionState | null }) {
  const { t } = useT();
  const closed: ReplayTrade[] = useMemo(() => state?.closedTrades ?? [], [state]);

  const stats = useMemo(() => computeStats(closed.map(tradeOf)), [closed]);

  /** Ce que seul le rejeu sait : les lots engagés et le temps passé en position. */
  const own = useMemo(() => {
    if (closed.length === 0) return { lots: 0, avgMs: 0 };
    const lots = closed.reduce((a, x) => a + x.qty, 0);
    const span = closed.reduce((a, x) => a + Math.max(0, x.exitTime - x.entryTime), 0);
    return { lots, avgMs: span / closed.length };
  }, [closed]);

  /** Le jour le plus rentable et le moins rentable, depuis le P&L par jour. */
  const days = useMemo(() => {
    const entries = Object.entries(stats.pnlByDayOfWeek ?? {});
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => Number(b[1]) - Number(a[1]));
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [stats.pnlByDayOfWeek]);

  // RIEN JOUÉ, RIEN À MONTRER. Un tableau de bord rempli de zéros se lit comme
  // une performance nulle, alors qu'il n'y a simplement pas eu de trade — et
  // c'est précisément la confusion entre le vrai site et le backtest qu'il faut
  // éviter. On le dit en toutes lettres.
  if (closed.length === 0) {
    return (
      <div className="grid min-h-[40vh] place-items-center px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-[var(--tv-text)]">{t("rt.dashEmptyTitle")}</p>
          <p className="mt-1 text-xs text-[var(--tv-text-muted)]">{t("rt.dashEmptyBody")}</p>
        </div>
      </div>
    );
  }

  const pnlTone = (n: number) => (n > 0 ? "pos" : n < 0 ? "neg" : "neutral");

  return (
    <div className="flex flex-col gap-4 p-4">
      <KpiGrid cols={4}>
        <Kpi
          label={t("rt.dashTrades")}
          value={String(stats.totalTrades)}
          hint={`${stats.wins} ${t("rt.dashWins")} · ${stats.losses} ${t("rt.dashLosses")}`}
        />
        <Kpi label={t("rt.dashLots")} value={String(own.lots)} />
        <Kpi label={t("rt.dashAvgDuration")} value={duration(own.avgMs)} />
      </KpiGrid>

      <KpiGrid cols={4}>
        <Kpi
          label={t("rt.dashNetPnl")}
          value={signed(stats.totalPnl)}
          tone={pnlTone(stats.totalPnl)}
        />
        <Kpi label={t("rt.dashWinRate")} value={`${stats.winRate.toFixed(1)} %`} />
        <Kpi
          label={t("rt.dashProfitFactor")}
          value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "—"}
        />
      </KpiGrid>

      <KpiGrid cols={2}>
        <Kpi label={t("rt.dashAvgWin")} value={money(stats.avgWin)} tone="pos" />
        <Kpi label={t("rt.dashAvgLoss")} value={money(stats.avgLoss)} tone="neg" />
      </KpiGrid>

      <KpiGrid cols={2}>
        <Kpi
          label={t("rt.dashBest")}
          value={stats.bestTrade ? signed(stats.bestTrade.pnl) : "—"}
          hint={stats.bestTrade ? `${stats.bestTrade.symbol} · ${stats.bestTrade.date}` : undefined}
          tone="pos"
        />
        <Kpi
          label={t("rt.dashWorst")}
          value={stats.worstTrade ? signed(stats.worstTrade.pnl) : "—"}
          hint={
            stats.worstTrade ? `${stats.worstTrade.symbol} · ${stats.worstTrade.date}` : undefined
          }
          tone="neg"
        />
      </KpiGrid>

      {days && (
        <KpiGrid cols={2}>
          <Kpi
            label={t("rt.dashBestDay")}
            value={days.best[0]}
            hint={signed(Number(days.best[1]))}
            tone="pos"
          />
          <Kpi
            label={t("rt.dashWorstDay")}
            value={days.worst[0]}
            hint={signed(Number(days.worst[1]))}
            tone="neg"
          />
        </KpiGrid>
      )}

      <KpiGrid cols={2}>
        <Kpi label={t("rt.dashMaxDd")} value={money(stats.maxDrawdown)} tone="warn" />
        <Kpi
          label={t("rt.dashAvgRr")}
          value={Number.isFinite(stats.avgRR) ? `${stats.avgRR.toFixed(2)} R` : "—"}
        />
      </KpiGrid>
    </div>
  );
}
