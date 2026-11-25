import { useEffect, useMemo, useState } from "react";
import { Card } from "@/shared/ui";
import { cn } from "@/shared/ui/cn";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import type { Trade } from "@/domain/trade";
import { formatMoney } from "@/shared/currency";
import { loadSessions } from "@/app/store/sessions";
import {
  loadTradeIntents,
  loadTradeReflections,
  type TradeIntent,
  type TradeReflection,
} from "@/app/store/tradeIntel";
import { sessionFromSnapshot } from "@/app/features/checklist/sessionPlan";
import { assessTrade, type SessionContext } from "@/app/features/checklist/executionReview";
import { executionMatrix, type MatrixCell } from "@/modules/discipline";

/**
 * EXÉCUTION × RÉSULTAT — les deux systèmes de performance, côte à côte.
 *
 * En lignes : la qualité d'exécution (jugée sur le plan, jamais sur le P&L).
 * En colonnes : le résultat. Un gain mal exécuté et une perte bien exécutée
 * deviennent visibles. Des comptes et des sommes seulement — aucun taux, donc
 * aucun seuil d'échantillon à franchir ; les trades sans rien pour comparer
 * sont comptés à part, jamais rangés « bons ».
 */

/** Une requête `.in(...)` par paquet : une URL de PostgREST a une longueur bornée. */
const CHUNK = 150;

async function loadIntel(userId: string, ids: string[]) {
  const intents: Record<string, TradeIntent> = {};
  const reflections: Record<string, TradeReflection> = {};
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const [a, b] = await Promise.all([
      loadTradeIntents(userId, part),
      loadTradeReflections(userId, part),
    ]);
    Object.assign(intents, a);
    Object.assign(reflections, b);
  }
  return { intents, reflections };
}

export function ExecutionMatrixCard({ trades }: { trades: Trade[] }) {
  const { t } = useT();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<{
    sessions: Record<string, SessionContext>;
    intents: Record<string, TradeIntent>;
    reflections: Record<string, TradeReflection>;
  } | null>(null);

  const ids = useMemo(
    () =>
      trades
        .filter((tr) => !tr.isExample)
        .map((tr) => tr.id)
        .join(","),
    [trades],
  );
  useEffect(() => {
    // Sans compte (aperçu, démo) : seules les erreurs cochées témoignent.
    if (!userId) {
      setData({ sessions: {}, intents: {}, reflections: {} });
      return;
    }
    let active = true;
    void Promise.all([loadSessions(userId, 365), loadIntel(userId, ids ? ids.split(",") : [])])
      .then(([rows, intel]) => {
        if (!active) return;
        const sessions: Record<string, SessionContext> = {};
        for (const s of rows) {
          const past = sessionFromSnapshot(s.sessionDate, s.checklistSnapshot);
          if (past) sessions[s.sessionDate] = past;
        }
        setData({ sessions, ...intel });
      })
      .catch(() => {
        if (active) setData({ sessions: {}, intents: {}, reflections: {} });
      });
    return () => {
      active = false;
    };
  }, [userId, ids]);

  const matrix = useMemo(() => {
    if (!data) return null;
    const byDay = new Map<string, Trade[]>();
    for (const tr of trades) {
      if (tr.isExample) continue;
      const list = byDay.get(tr.date) ?? [];
      list.push(tr);
      byDay.set(tr.date, list);
    }
    const rows = trades
      .filter((tr) => !tr.isExample)
      .map((tr) => ({
        pnl: tr.pnl,
        verdict: assessTrade({
          trade: tr,
          dayTrades: byDay.get(tr.date) ?? [tr],
          session: data.sessions[tr.date] ?? null,
          intent: data.intents[tr.id],
          reflection: data.reflections[tr.id],
        }).verdict,
      }));
    return executionMatrix(rows);
  }, [data, trades]);

  return (
    <Card className="p-3 md:p-4 animate-fade-in-up">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="tv-title">{t("execMatrix.title")}</h3>
      </div>
      {!matrix ? (
        <div className="h-[118px] rounded-xl bg-[var(--tv-plate-2)]" aria-hidden />
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-sm">
            <span />
            <span className="tv-label text-center text-slate-500">{t("execMatrix.win")}</span>
            <span className="tv-label text-center text-slate-500">{t("execMatrix.loss")}</span>
            <span className="tv-label self-center pr-2 text-slate-500">{t("exec.good")}</span>
            <Cell cell={matrix.goodWin} tone="good" />
            <Cell cell={matrix.goodLoss} tone="good" hint={t("execMatrix.goodLossHint")} />
            <span className="tv-label self-center pr-2 text-slate-500">{t("exec.bad")}</span>
            <Cell cell={matrix.badWin} tone="bad" hint={t("execMatrix.badWinHint")} />
            <Cell cell={matrix.badLoss} tone="bad" />
          </div>
          <p className="mt-2.5 text-xs text-slate-500">
            {t("execMatrix.unassessed").replace("{n}", String(matrix.unassessed))}
          </p>
        </>
      )}
    </Card>
  );
}

function Cell({ cell, tone, hint }: { cell: MatrixCell; tone: "good" | "bad"; hint?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        tone === "good"
          ? "border-[var(--tv-border-accent)] bg-[var(--tv-plate-2)]"
          : "border-red-500/25 bg-red-500/[0.06]",
      )}
    >
      <div className="tv-figure text-lg text-white">{cell.n}</div>
      <div
        className={cn(
          "tv-figure text-xs",
          cell.pnl > 0 ? "text-emerald-400" : cell.pnl < 0 ? "text-red-400" : "text-slate-500",
        )}
      >
        {formatMoney(cell.pnl, { signed: true })}
      </div>
      {hint && cell.n > 0 && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
