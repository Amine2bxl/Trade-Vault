import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Square, Activity } from "lucide-react";
import type { Trade } from "../types";
import {
  closeSession,
  loadTodaySession,
  openSession,
  todayLocalDate,
  type TradingSession,
} from "../store";
import { loadTradingRules } from "../utils/tradingRules";
import { computeReadiness, EMOTIONAL_STATES, type EmotionalState } from "../utils/readiness";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { formatPnl } from "../utils/tradeCalcs";
import { Button, Card, FIELD_BASE } from "@/shared/ui";
import type { TKey } from "../i18n/translations";

/**
 * La séance du jour, au-dessus de la checklist qui l'alimente.
 *
 * POURQUOI ICI ET PAS SUR UNE PAGE À PART. Une séance s'ouvre au moment où le
 * trader prépare sa journée, c'est-à-dire pendant la checklist. Lui demander
 * d'aller ailleurs pour déclarer qu'il commence produirait exactement ce que
 * `ECOSYSTEM_WIRING.md` cherche à éviter : une donnée que personne ne saisit,
 * donc des corrélations calculées sur trois séances.
 *
 * AUCUN CURSEUR DE PRÉPARATION. Le score affiché est calculé à partir de la
 * checklist réellement cochée, de l'état déclaré et des règles de risque
 * actives ; il est montré AVEC sa décomposition, jamais demandé. Voir
 * `utils/readiness.ts` pour le raisonnement complet.
 */

interface SessionPanelProps {
  /** Items cochés / actifs de la checklist du jour — les faits du score. */
  checklistDone: number;
  checklistTotal: number;
  /** Photo de ce qui a été coché ce matin, figée à l'ouverture. */
  checklistSnapshot: Record<string, unknown>;
  /** Trades du compte actif, pour montrer ceux rattachés à la journée. */
  trades: Trade[];
}

const STATE_KEYS: Record<EmotionalState, TKey> = {
  calm: "session.stateCalm",
  focused: "session.stateFocused",
  tired: "session.stateTired",
  anxious: "session.stateAnxious",
  frustrated: "session.stateFrustrated",
  overconfident: "session.stateOverconfident",
};

export default function SessionPanel({
  checklistDone,
  checklistTotal,
  checklistSnapshot,
  trades,
}: SessionPanelProps) {
  const { user } = useAuth();
  const { t } = useT();
  const [session, setSession] = useState<TradingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<EmotionalState | null>(null);
  const [objective, setObjective] = useState("");
  const [review, setReview] = useState("");
  const [ruleCount, setRuleCount] = useState(0);

  const today = todayLocalDate();

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const [s, rules] = await Promise.all([
        loadTodaySession(user.id, today),
        loadTradingRules(user.id).catch(() => []),
      ]);
      if (!active) return;
      setSession(s);
      setState(s?.emotionalState ?? null);
      setObjective(s?.dailyObjective ?? "");
      setRuleCount(rules.filter((r) => r.enabled).length);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, today]);

  // Aperçu du score AVANT ouverture : le trader voit ce que sa préparation
  // vaut pendant qu'il la fait, ce qui est le seul moment où l'information
  // peut encore changer sa journée.
  const preview = useMemo(
    () =>
      computeReadiness({
        checklistDone,
        checklistTotal,
        emotionalState: state,
        activeRuleCount: ruleCount,
      }),
    [checklistDone, checklistTotal, state, ruleCount],
  );

  const dayTrades = useMemo(() => trades.filter((tr) => tr.date === today), [trades, today]);
  const dayPnl = useMemo(() => dayTrades.reduce((sum, tr) => sum + tr.pnl, 0), [dayTrades]);

  const open = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    const next = await openSession(
      user.id,
      {
        checklistDone,
        checklistTotal,
        emotionalState: state,
        activeRules: Array.from({ length: ruleCount }, (_, i) => ({ index: i })),
        checklistSnapshot,
        dailyObjective: objective.trim() || null,
      },
      today,
    );
    if (next) setSession(next);
    setBusy(false);
  }, [
    user,
    busy,
    checklistDone,
    checklistTotal,
    state,
    ruleCount,
    checklistSnapshot,
    objective,
    today,
  ]);

  const close = useCallback(async () => {
    if (!user || !session || busy) return;
    setBusy(true);
    const ok = await closeSession(session.id, { reviewNote: review.trim() || null });
    if (ok) {
      const fresh = await loadTodaySession(user.id, today);
      setSession(fresh);
    }
    setBusy(false);
  }, [user, session, busy, review, today]);

  if (!user || loading) return null;

  const closed = Boolean(session?.endedAt);

  return (
    <Card variant="glass-strong" pad="default" className="space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg tv-accent-fill">
            <Activity className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">{t("session.title")}</h3>
            <p className="text-[11px] text-slate-500">
              {session ? (closed ? t("session.closed") : t("session.open")) : t("session.notOpen")}
            </p>
          </div>
        </div>

        {/* Le score et, à côté, ce qui le compose : un chiffre sans ses
            entrées n'est pas interprétable. */}
        <div className="text-right">
          <div className="tv-figure text-xl text-white">
            {session?.readinessScore ?? preview.score ?? "—"}
            <span className="text-xs font-bold text-slate-500">/100</span>
          </div>
          <p className="text-[10px] text-slate-500">
            {t("session.readiness")} · {checklistDone}/{checklistTotal} ·{" "}
            {t("session.rulesShort").replace("{n}", String(ruleCount))}
          </p>
        </div>
      </div>

      {!session && (
        <>
          <div>
            <p className="tv-label text-slate-500 mb-1.5">{t("session.howDoYouFeel")}</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONAL_STATES.map((s) => (
                <button
                  key={s}
                  onClick={() => setState((cur) => (cur === s ? null : s))}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition",
                    state === s
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"
                      : "border border-white/[0.06] text-slate-400 hover:text-slate-200",
                  )}
                >
                  {t(STATE_KEYS[s])}
                </button>
              ))}
            </div>
          </div>
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder={t("session.objectivePlaceholder")}
            className={cn(FIELD_BASE, "h-10")}
          />
          <Button onClick={open} disabled={busy} className="w-full">
            <Play className="w-3.5 h-3.5" /> {t("session.openCta")}
          </Button>
        </>
      )}

      {session && (
        <>
          {session.dailyObjective && (
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">{t("session.objective")} : </span>
              {session.dailyObjective}
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="text-[11px] text-slate-500">
              {t("session.tradesAttached").replace("{n}", String(dayTrades.length))}
            </span>
            <span
              className={cn("tv-figure text-sm", dayPnl >= 0 ? "text-emerald-400" : "text-red-400")}
            >
              {formatPnl(dayPnl)}
            </span>
          </div>

          {!closed && (
            <>
              <input
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder={t("session.reviewPlaceholder")}
                className={cn(FIELD_BASE, "h-10")}
              />
              <Button variant="subtle" onClick={close} disabled={busy} className="w-full">
                <Square className="w-3.5 h-3.5" /> {t("session.closeCta")}
              </Button>
            </>
          )}

          {closed && session.reviewNote && (
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">{t("session.review")} : </span>
              {session.reviewNote}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
