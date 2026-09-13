/**
 * ReplaySetup — le seuil du terminal, en plein écran.
 *
 * Ce n'était qu'un pop-up posé sur l'application, qui s'ouvrait tout seul en
 * arrivant sur Backtest : on n'avait rien demandé, et le décor derrière disait
 * qu'on n'avait pas bougé. C'est désormais le PREMIER écran d'un autre monde —
 * il occupe la scène entière, sous le thème du rejeu, et on y vient d'un geste
 * délibéré.
 *
 * Toujours pas d'onboarding : le minimum (compte, date, heure, timeframe,
 * capital, durée), et on entre.
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

/** Cinq ans en arrière — la profondeur d'historique que le rejeu propose. */
function fiveYearsAgo(): string {
  return new Date(Date.now() - 5 * 365.25 * 24 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Un message LISIBLE à partir de n'importe quoi.
 *
 * Ce qui remonte de Supabase n'est pas une `Error` mais un objet nu
 * (`{ code, message, details, hint }`) : `String(e)` en faisait
 * « [object Object] », c'est-à-dire un message d'échec qui n'apprenait rien à
 * personne — ni au trader, ni à celui qui doit corriger. On lit les champs
 * utiles, et on tombe sur du JSON avant de tomber sur « [object Object] ».
 */
function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.error_description, o.details, o.hint].filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    const code = typeof o.code === "string" ? o.code : null;
    if (parts.length > 0) return code ? `${code} · ${parts.join(" · ")}` : parts.join(" · ");
    try {
      return JSON.stringify(o);
    } catch {
      return "unknown error";
    }
  }
  return String(e);
}

/** Les durées proposées, en SÉANCES de cotation. */
const DURATIONS = [
  { days: 1, key: "rt.duration1" },
  { days: 3, key: "rt.duration3" },
  { days: 5, key: "rt.duration5" },
] as const;

export default function ReplaySetup() {
  const { t } = useT();
  const { session, launchOpen, closeLaunch, enter, resumeInto, ensureSampleWeek } = useReplayMode();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("NQ Backtest");
  const [balance, setBalance] = useState(100_000);
  const [date, setDate] = useState(() => todayNy());
  const [time, setTime] = useState("09:30");
  const [tf, setTf] = useState("5m");
  const [days, setDays] = useState(1);
  /** Perte max de séance, en % — vide = aucune limite. */
  const [maxLoss, setMaxLoss] = useState<string>("2");
  const [seedWeek, setSeedWeek] = useState(true);
  const [busy, setBusy] = useState(false);
  /** Échec local du lancement — distinct de `session.error`, qui ne couvre
   *  que le chargement des données une fois la séance créée. */
  const [failure, setFailure] = useState<string | null>(null);

  const account = session.account ?? session.replayAccounts[0] ?? null;
  const usableTfs = useMemo(() => TIMEFRAMES.filter((x) => x.seconds >= 60), []);
  const resumables = session.sessions.filter((s) => s.status === "active" && s.state).slice(0, 1);
  const dow = nyDow(date);

  if (!launchOpen) return null;

  const confirm = async () => {
    setBusy(true);
    setFailure(null);
    try {
      let target = account;
      if (creating || !target) {
        target = await session.createReplayAccount({
          name: name.trim() || "NQ Backtest",
          startingBalance: Number(balance) || 100_000,
        });
      }
      const ok = await enter({
        accountId: target.id,
        date: sessionDateKey(date),
        startTime: time,
        timeframe: tf,
        startingBalance: Number(balance) || target.startingBalance || 100_000,
        days,
        maxDailyLossPct: Number(maxLoss) > 0 ? Number(maxLoss) : undefined,
      });
      if (ok) {
        setCreating(false);
        // La semaine d'exemple garnit le journal, elle ne conditionne pas le
        // rejeu : la lancer AVANT d'entrer faisait attendre le trader devant un
        // bouton muet pendant que sept séances se rejouaient. Elle part
        // maintenant derrière, une fois le terminal ouvert.
        if (seedWeek) void ensureSampleWeek(target.id).catch(() => {});
      }
    } catch (e) {
      // Il n'y avait AUCUN `catch` ici : créer le compte de rejeu peut lever
      // (limite du plan, écriture refusée, réseau), l'exception s'échappait, et
      // le bouton retombait inerte sans un mot. Un échec doit se voir.
      console.error("[replay] lancement impossible", e);
      setFailure(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    // La scène fournit déjà le plein écran : ici on ne fait que centrer, et
    // laisser défiler si l'écran est court — un formulaire tronqué serait pire
    // qu'un formulaire qui défile.
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--tv-border-strong)] bg-[var(--tv-plate-2)] p-5 pt-4 shadow-[var(--tv-elev-3)]">
        {/* En-tête, et la porte de sortie : on est en plein écran, il faut
          pouvoir revenir à l'application sans entrer. */}
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl tv-accent-fill">
            <CalendarClock className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold leading-tight text-[var(--tv-text)]">NQ Backtest</h2>
            <p className="truncate text-[11px] text-[var(--tv-text-muted)]">{t("rt.setupTitle")}</p>
          </div>
          <button
            type="button"
            onClick={closeLaunch}
            className="rounded-lg border border-[var(--tv-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)]"
          >
            {t("rt.backToApp")}
          </button>
        </div>

        {/* L'échec ne doit JAMAIS être muet. Sans cette ligne, une séance qui
          ne démarrait pas laissait le trader devant un bouton inerte, sans un
          mot — le défaut le plus déroutant du terminal. */}
        {failure && (
          <p className="mb-3 rounded-xl border border-[var(--tv-chart-red)]/40 bg-[var(--tv-chart-red)]/10 px-3 py-2 text-[11px] font-medium text-[var(--tv-chart-red)]">
            {t("rt.errorLaunch")} <span className="tv-figure opacity-80">{failure}</span>
          </p>
        )}
        {session.error && (
          <p className="mb-3 rounded-xl border border-[var(--tv-chart-red)]/40 bg-[var(--tv-chart-red)]/10 px-3 py-2 text-[11px] font-medium text-[var(--tv-chart-red)]">
            {t(session.error as Parameters<typeof t>[0])}
          </p>
        )}

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
              min={fiveYearsAgo()}
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
              className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2.5 py-2 text-right tv-figure text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
          </label>
        </div>

        {dow === 0 || dow === 6 ? (
          <p className="mb-3 text-[10.5px] font-medium text-[var(--tv-warning)]">
            {t("rt.weekendResumes")}
          </p>
        ) : (
          <p className="mb-3 text-[10px] text-[var(--tv-text-muted)]">
            {t("rt.historyYears").replace("{min}", fiveYearsAgo())}
          </p>
        )}

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

        {/* Durée — on compte en SÉANCES, jamais en jours civils. */}
        <div className="mb-3">
          <span className="mb-1 block text-[11px] font-medium text-[var(--tv-text-muted)]">
            {t("rt.duration")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d.days}
                type="button"
                onClick={() => setDays(d.days)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                  days === d.days
                    ? "tv-accent-fill text-white"
                    : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
                )}
              >
                {t(d.key)}
              </button>
            ))}
          </div>
          {days > 1 && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--tv-text-muted)]">
              {t("rt.durationHint")}
            </p>
          )}
        </div>

        {/* Perte max de séance — le garde-fou que le trader se fixe AVANT
          d'ouvrir le terminal, quand il est encore lucide. Laisser vide n'en
          pose aucun : on n'impose pas une règle que personne n'a demandée. */}
        <label className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
            {t("rt.maxDailyLoss")}
          </span>
          <span className="flex items-center gap-1">
            <input
              value={maxLoss}
              onChange={(e) => setMaxLoss(e.target.value)}
              placeholder="—"
              inputMode="decimal"
              className="w-16 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1 text-center tv-figure text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
            <span className="text-[11px] text-[var(--tv-text-muted)]">%</span>
          </span>
        </label>

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
