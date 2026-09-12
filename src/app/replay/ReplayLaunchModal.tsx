/**
 * ReplayLaunchModal — le « pop-up de pré-confirmation ».
 *
 * Pas d'onboarding : quelques champs minimums (compte de rejeu, date, heure,
 * timeframe, capital) dans une petite fenêtre, à l'instant où le trader entre
 * dans Backtest. Une option propose la semaine d'exemple NQ pour voir l'app en
 * action. Confirmer → la séquence d'entrée jouée, le terminal s'ouvre.
 */

import { useMemo, useState } from "react";
import { CalendarClock, Flag, Play, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { Button } from "@/shared/ui";
import { TIMEFRAMES, sessionDateKey, nyDow, nyDateOf } from "@/modules/replay";
import { useReplayMode } from "./ReplayModeContext";
import { cn } from "../utils/cn";

function todayNy(): string {
  return nyDateOf(Date.now());
}

export default function ReplayLaunchModal() {
  const { t } = useT();
  const { session, launchOpen, closeLaunch, enter, resumeInto, ensureSampleWeek } = useReplayMode();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("NQ Backtest");
  const [balance, setBalance] = useState(100_000);
  const [date, setDate] = useState(() => todayNy());
  const [time, setTime] = useState("09:30");
  const [tf, setTf] = useState("5m");
  const [seedWeek, setSeedWeek] = useState(true);
  const [busy, setBusy] = useState(false);

  const account = session.account ?? session.replayAccounts[0] ?? null;
  const usableTfs = useMemo(() => TIMEFRAMES.filter((x) => x.seconds >= 60), []);
  const resumables = session.sessions.filter((s) => s.status === "active" && s.state).slice(0, 1);
  const dow = nyDow(date);

  if (!launchOpen) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      let target = account;
      if (creating || !target) {
        target = await session.createReplayAccount({
          name: name.trim() || "NQ Backtest",
          startingBalance: Number(balance) || 100_000,
        });
      }
      if (seedWeek) await ensureSampleWeek(target.id).catch(() => {});
      const ok = await enter({
        accountId: target.id,
        date: sessionDateKey(date),
        startTime: time,
        timeframe: tf,
        startingBalance: Number(balance) || target.startingBalance || 100_000,
      });
      if (ok) setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[var(--tv-z-modal)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Fond : voile léger, la page reste lisible derrière. */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={closeLaunch} />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--tv-border-strong)] bg-[var(--tv-plate-2)] p-5 pt-4 shadow-[var(--tv-elev-3)]">
        {/* En-tête discret. */}
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl tv-accent-fill">
            <CalendarClock className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold leading-tight text-[var(--tv-text)]">NQ Backtest</h2>
            <p className="truncate text-[11px] text-[var(--tv-text-muted)]">{t("rt.setupTitle")}</p>
          </div>
        </div>

        {resumables.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void resumeInto(resumables[0]).catch(() => {})}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-[var(--tv-accent)]/40 bg-[var(--tv-accent)]/10 px-3 py-2 text-left text-xs font-semibold text-[var(--tv-accent)] hover:bg-[var(--tv-accent)]/15"
          >
            <Play className="h-3.5 w-3.5" />
            {t("rt.resumeSession")} · {resumables[0].startDate} {resumables[0].startTime}
          </button>
        )}

        {/* Compte de rejeu */}
        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--tv-text-muted)]">
            {t("rt.account")}
          </span>
          {session.replayAccounts.length > 0 && !creating ? (
            <select
              value={account?.id ?? ""}
              onChange={(e) => session.selectAccount(e.target.value)}
              className="w-full rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            >
              {session.replayAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("rt.accountNamePlaceholder")}
              className="w-full rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
          )}
          {session.replayAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="mt-1.5 text-[11px] font-semibold text-[var(--tv-accent)] hover:underline"
            >
              {creating ? t("rt.selectAccount") : `+ ${t("rt.createAccount")}`}
            </button>
          )}
        </label>

        {/* Date / heure / capital */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
              {t("rt.date")}
            </span>
            <input
              type="date"
              min="2020-01-01"
              max={todayNy()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2.5 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
              {t("rt.time")}
            </span>
            <input
              type="time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2.5 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">Capital</span>
            <input
              type="number"
              min={1000}
              step={1000}
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2.5 py-2 text-right font-mono text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
          </label>
        </div>

        {dow === 0 || dow === 6 ? (
          <p className="mb-3 text-[10.5px] font-medium text-[var(--tv-warning)]">
            {t("rt.weekendResumes")}
          </p>
        ) : null}

        {/* Timeframe */}
        <div className="mb-3">
          <span className="mb-1 block text-[11px] font-medium text-[var(--tv-text-muted)]">
            {t("rt.timeframe")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {usableTfs.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTf(f.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                  tf === f.id
                    ? "tv-accent-fill text-white"
                    : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Semaine d'exemple — voir l'app en action. */}
        <label className="mb-4 flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2">
          <input
            type="checkbox"
            checked={seedWeek}
            onChange={(e) => setSeedWeek(e.target.checked)}
            className="accent-[var(--tv-accent)]"
          />
          <Sparkles className="h-3.5 w-3.5 text-[var(--tv-accent)]" />
          <span className="text-[11px] font-medium text-[var(--tv-text)]">
            {t("rt.seedWeek")} <span className="text-[var(--tv-text-muted)]">NQ</span>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <Button
            variant="accent"
            disabled={busy}
            onClick={() => void confirm()}
            className="w-full justify-center gap-2"
          >
            {busy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
            {busy ? "…" : `${t("rt.start")} · ${date} ${time}`}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={closeLaunch} className="shrink-0">
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
