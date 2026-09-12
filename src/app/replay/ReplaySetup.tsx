/**
 * ReplaySetup — le point d'entrée du terminal.
 *
 * De l'offre Premium à la première bougie : on choisit le compte de rejeu (ou
 * on le crée), la date historique, l'heure de départ et le timeframe. Aucun
 * écran de configuration inutile — tout tient ici, et la reprise d'une séance
 * en cours est proposée en clair avant de tout recommencer.
 */

import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, Flag, Play, Plus, RotateCcw } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { Button } from "@/shared/ui";
import { TIMEFRAMES, sessionDateKey, nyDow, nyDateOf } from "@/modules/replay";
import type { ReplaySessionDto } from "../store/replay";
import type { Account } from "../store";

interface Props {
  replayAccounts: Account[];
  account: Account | null;
  sessions: ReplaySessionDto[];
  busy: boolean;
  onCreateAccount: (form: { name: string; startingBalance: number }) => void;
  onHoldAccount: (accountId: string) => void;
  onResume: (dto: ReplaySessionDto) => void;
  onStart: (cfg: {
    accountId: string;
    date: string;
    startTime: string;
    timeframe: string;
    startingBalance: number;
  }) => void;
}

function todayNy(): string {
  return nyDateOf(Date.now());
}

export default function ReplaySetup({
  replayAccounts,
  account,
  sessions,
  busy,
  onCreateAccount,
  onHoldAccount,
  onResume,
  onStart,
}: Props) {
  const { t } = useT();

  const [creating, setCreating] = useState(replayAccounts.length === 0);
  const [name, setName] = useState("NQ Backtest");
  const [startingBalance, setStartingBalance] = useState(100_000);
  const [date, setDate] = useState(() => todayNy());
  const [startTime, setStartTime] = useState("09:30");
  const [timeframe, setTimeframe] = useState("5m");
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => replayAccounts.find((a) => a.id === account?.id) ?? replayAccounts[0] ?? null,
    [replayAccounts, account],
  );

  const usableTimeframes = useMemo(() => TIMEFRAMES.filter((tf) => tf.seconds >= 60), []);
  const dow = nyDow(date);

  const start = () => {
    if (!active) return setError("rt.noReplayAccount");
    if (dow === 0 || dow === 6) {
      // On rejoue discrètement le vendredi au lieu de refuser le clic.
    }
    const clampedDate = sessionDateKey(date);
    onStart({
      accountId: active.id,
      date: clampedDate,
      startTime,
      timeframe,
      startingBalance: Number(startingBalance) || 100_000,
    });
  };

  const resumables = sessions.filter((s) => s.status === "active" && s.state);
  const finitos = sessions.filter((s) => s.status === "finished");

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[var(--tv-bg)] px-4 py-8">
      <div className="w-full max-w-3xl">
        {/* Bandeau d'entrée */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl tv-accent-fill">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--tv-text)]">{t("rt.setupTitle")}</h1>
            <p className="text-xs text-[var(--tv-text-muted)]">
              NQ · Electronique et séance officielle · fuseau New York
            </p>
          </div>
        </div>

        {resumables.length > 0 && (
          <section className="mb-4 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--tv-text)]">
              <RotateCcw className="h-4 w-4 text-[var(--tv-accent)]" />
              {t("rt.resumeSession")}
            </div>
            {resumables.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2"
              >
                <div className="min-w-0 text-xs text-[var(--tv-text-muted)]">
                  <span className="font-semibold text-[var(--tv-text)]">{s.symbol}</span> ·{" "}
                  {s.startDate} · {s.startTime} · {s.timeframe}
                  <span className="ml-2 text-[var(--tv-text-muted)]">
                    ({t("rt.resumeNote")}{" "}
                    {s.state
                      ? new Date(s.state.now).toLocaleTimeString("en-US", {
                          timeZone: "America/New_York",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : ""}
                    )
                  </span>
                </div>
                <Button size="sm" variant="accent" onClick={() => onResume(s)}>
                  {t("rt.resume")}
                </Button>
              </div>
            ))}
          </section>
        )}

        {/* Compte de rejeu */}
        <section className="rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--tv-text)]">{t("rt.account")}</span>
            {replayAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--tv-accent)]"
              >
                {creating ? (
                  <ChevronLeft className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {creating ? t("rt.cancelCreate") : t("rt.createAccount")}
              </button>
            )}
          </div>

          {creating ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">Nom</span>
                <input
                  className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("rt.accountNamePlaceholder")}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
                  {t("rt.startingBalance")} ($)
                </span>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(Number(e.target.value))}
                />
              </label>
              <div className="sm:col-span-2">
                <Button
                  variant="accent"
                  disabled={busy}
                  onClick={() =>
                    onCreateAccount({
                      name: name.trim() || "NQ Backtest",
                      startingBalance: Number(startingBalance) || 100_000,
                    })
                  }
                >
                  <Flag className="h-4 w-4" />
                  {t("rt.createAccount")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {replayAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onHoldAccount(a.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    active?.id === a.id
                      ? "tv-accent-fill text-white"
                      : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text)]"
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Configuration du départ */}
        <section className="mt-4 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-4">
          <div className="grid gap-4 sm:grid-cols-3">
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
                className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
                {t("rt.time")}
              </span>
              <input
                type="time"
                step={300}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
                {t("rt.timeframe")}
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {usableTimeframes.map((tfm) => (
                  <button
                    key={tfm.id}
                    type="button"
                    onClick={() => setTimeframe(tfm.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      timeframe === tfm.id
                        ? "tv-accent-fill text-white"
                        : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)]"
                    }`}
                  >
                    {tfm.label}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="accent" disabled={busy || !active} onClick={start} className="gap-2">
              <Play className="h-4 w-4" />
              {t("rt.start")}
            </Button>
            {error && (
              <span className="text-xs font-medium text-[var(--tv-danger)]">
                {t(error as never)}
              </span>
            )}
            <span className="ml-auto text-[11px] text-[var(--tv-text-muted)]">
              {dow === 0 || dow === 6
                ? "Week-end — la séance du vendredi est rejouée."
                : `${date} · ${startTime} ET`}
            </span>
          </div>
        </section>

        {finitos.length > 0 && (
          <section className="mt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tv-text-muted)]">
              {t("rt.finishedSessions")}
            </span>
            <div className="mt-2 grid gap-2">
              {finitos.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-xs text-[var(--tv-text-muted)]"
                >
                  <span>
                    {s.symbol} · {s.startDate} · {s.timeframe}
                  </span>
                  <span className="text-[var(--tv-text)]">{s.timeframe}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
