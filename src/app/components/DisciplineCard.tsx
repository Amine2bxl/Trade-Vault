import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, ClipboardCheck, BookOpen } from "lucide-react";
import type { Trade } from "../types";
import { computeDayScore, computeStreak, STREAK_THRESHOLD } from "@/modules/discipline";
import { loadDisciplineDays, saveDisciplineDay, type DisciplineDayRow } from "../store";
import { track } from "../utils/analytics";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";

/**
 * Discipline Score v1 + streak — the Dashboard's daily habit anchor.
 * All numbers come from the pure discipline engine (never from AI). Today's
 * score is persisted best-effort into `discipline_days` so the streak
 * survives devices; a failed write never blocks the UI.
 */

const STREAK_MILESTONES = new Set([3, 7, 14, 30, 60]);

interface DisciplineCardProps {
  userId: string;
  /** ALL trades of the account (the card filters today's itself). */
  trades: Trade[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function readChecklistDoneAt(userId: string): string | null {
  try {
    const raw = localStorage.getItem(`tv-chk-${userId}-${todayIso()}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as { completedAt?: string | null };
    return p.completedAt ?? null;
  } catch {
    return null;
  }
}

export default function DisciplineCard({ userId, trades }: DisciplineCardProps) {
  const { t } = useT();
  const [history, setHistory] = useState<DisciplineDayRow[] | null>(null);
  const lastPersisted = useRef<string>("");

  const today = todayIso();
  const checklistDoneAt = readChecklistDoneAt(userId);
  const todayTrades = useMemo(() => trades.filter((tr) => tr.date === today), [trades, today]);
  const day = useMemo(
    () => computeDayScore({ checklistDoneAt, trades: todayTrades }),
    [checklistDoneAt, todayTrades],
  );

  useEffect(() => {
    let active = true;
    loadDisciplineDays(userId)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {
        if (active) setHistory([]);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const streak = useMemo(() => {
    const past = (history ?? []).filter((d) => d.date !== today);
    const days = day.neutral ? past : [{ date: today, score: day.score }, ...past];
    return computeStreak(days);
  }, [history, day, today]);

  // Persist today's score whenever it changes (best-effort, deduplicated).
  useEffect(() => {
    if (day.neutral || history === null) return;
    const signature = `${today}:${day.score}`;
    if (lastPersisted.current === signature) return;
    lastPersisted.current = signature;
    saveDisciplineDay(userId, today, day, checklistDoneAt).catch(() => {});
    track("discipline_score_computed", { score: day.score });

    const pastStreak = computeStreak((history ?? []).filter((d) => d.date !== today));
    if (day.score >= STREAK_THRESHOLD && STREAK_MILESTONES.has(pastStreak + 1)) {
      track("streak_milestone", { streak: pastStreak + 1 });
    }
    if (day.score < STREAK_THRESHOLD && pastStreak > 0) {
      track("streak_broken", { lost: pastStreak });
    }
  }, [userId, today, day, checklistDoneAt, history]);

  const scoreColor =
    day.neutral || day.score >= STREAK_THRESHOLD
      ? "text-emerald-400"
      : day.score >= 40
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="glass rounded-2xl p-4 mb-4 md:mb-6 flex items-center gap-4 animate-fade-in-up stagger-1">
      <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center shrink-0">
        <Flame className={cn("w-5 h-5", streak > 0 ? "text-orange-400" : "text-slate-500")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          {t("discipline.title")}
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {t("discipline.basis")}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400">
          <span className={cn("flex items-center gap-1", day.checklistDone && "text-emerald-400")}>
            <ClipboardCheck className="w-3 h-3" /> {t("discipline.checklist")}
          </span>
          <span
            className={cn("flex items-center gap-1", day.journalComplete && "text-emerald-400")}
          >
            <BookOpen className="w-3 h-3" /> {t("discipline.journal")}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        {day.neutral ? (
          <div className="text-xs text-slate-500">{t("discipline.neutral")}</div>
        ) : (
          <div className={cn("text-xl font-bold", scoreColor)}>
            {day.score}
            <span className="text-xs text-slate-500 font-semibold">/100</span>
          </div>
        )}
        <div className="text-[11px] text-slate-400">
          {t("discipline.streak")} <span className="font-bold text-orange-400">{streak}</span>{" "}
          {t("discipline.days")}
        </div>
      </div>
    </div>
  );
}
