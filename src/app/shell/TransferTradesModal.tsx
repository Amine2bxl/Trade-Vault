import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Copy, Lock, MoveRight, Repeat2, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useToast } from "../contexts/ToastContext";
import { useSubscription } from "../hooks/useSubscription";
import { useT } from "../i18n/LanguageContext";
import { intlLocale } from "../i18n/locale";
import { loadUserTrades } from "../store/trades";
import { isPlanLimitError } from "../utils/planLimits";
import type { Trade } from "../types";
import {
  defaultTransferFactor,
  sanitizeFactor,
  summarizeTransfer,
  type TransferMode,
} from "../trading/tradeTransfer";
import { AccountScaleBridge } from "../trading/AccountScaleBridge";
import { Badge, Modal, Button, DateField, SelectPicker, FIELD_BASE, cn } from "@/shared/ui";
import { formatMoney } from "@/shared/currency";

/**
 * TRANSFÉRER DES TRADES D'UN COMPTE À L'AUTRE.
 *
 * Le geste du trader qui a repris sur un nouveau sous-compte (un 25k acheté
 * après un compte sauté) et veut, quand il le décide, reverser ce travail dans
 * son compte principal — ou l'inverse. Tout est réglable, rien n'est caché :
 *
 *   • de quel compte, vers quel compte ;
 *   • sur quelle période (tout, ou de telle date à telle date) ;
 *   • copier (les originaux restent) ou déplacer ;
 *   • à quelle échelle : par défaut le rapport des capitaux (25k → 50k = ×2),
 *     modifiable, ou aucune conversion.
 *
 * L'aperçu montre AVANT de confirmer combien de trades partent et ce que
 * devient leur P&L. Deux colonnes : les réglages à gauche, l'aperçu à droite,
 * qui reste visible pendant qu'on règle.
 *
 * Offre Pro : hors Pro, l'écran reste consultable (c'est lui qui montre ce que
 * l'offre apporte) et le bouton final mène à l'abonnement. Le transfert lui-même est dans `store/tradeTransfer.ts` ;
 * le calcul, pur et testé, dans `trading/tradeTransfer.ts`.
 */
export default function TransferTradesModal({
  onClose,
  initialSourceId,
  initialTargetId,
}: {
  onClose: () => void;
  initialSourceId?: string;
  initialTargetId?: string;
}) {
  const { user } = useAuth();
  const { accounts, activeAccount, mainAccount, transfer } = useAccounts();
  const { t, lang } = useT();
  const { toast } = useToast();
  const { can } = useSubscription();
  const isPro = can("accountTransfer");
  // La modale d'offre s'ouvre À LA PLACE de celle-ci : empilées, l'une
  // cacherait l'autre.
  const openUpgrade = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("tv:upgrade"));
  };
  const locale = intlLocale(lang);

  const [sourceId, setSourceId] = useState(
    initialSourceId ?? activeAccount?.id ?? accounts[0]?.id ?? "",
  );
  const [targetId, setTargetId] = useState(() => {
    if (initialTargetId) return initialTargetId;
    const src = initialSourceId ?? activeAccount?.id;
    // Par défaut on reverse VERS le compte principal ; depuis le principal,
    // vers le premier sous-compte.
    if (mainAccount && mainAccount.id !== src) return mainAccount.id;
    return accounts.find((a) => a.id !== src)?.id ?? "";
  });
  const [mode, setMode] = useState<TransferMode>("copy");
  const [allDates, setAllDates] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rescale, setRescale] = useState(true);
  const [factorText, setFactorText] = useState("");
  const [skipCopied, setSkipCopied] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const source = accounts.find((a) => a.id === sourceId) ?? null;
  const target = accounts.find((a) => a.id === targetId) ?? null;

  // Le compte source peut ne pas être le compte affiché : ses trades sont lus
  // à part, une fois par changement de source.
  const [sourceTrades, setSourceTrades] = useState<Trade[] | null>(null);
  useEffect(() => {
    if (!user || !sourceId) return;
    let alive = true;
    setSourceTrades(null);
    loadUserTrades(user.id, { accountId: sourceId })
      .then((list) => alive && setSourceTrades(list))
      .catch(() => alive && setSourceTrades([]));
    return () => {
      alive = false;
    };
  }, [user, sourceId]);

  // Le facteur par défaut suit les comptes choisis, tant que le trader ne l'a
  // pas saisi lui-même.
  const autoFactor = useMemo(
    () =>
      source && target ? defaultTransferFactor(source.startingBalance, target.startingBalance) : 1,
    [source, target],
  );
  useEffect(() => {
    setFactorText(String(Math.round(autoFactor * 10000) / 10000));
  }, [autoFactor]);

  const factor = rescale ? sanitizeFactor(Number(factorText.replace(",", "."))) : 1;
  const range = { from: allDates ? null : from || null, to: allDates ? null : to || null };
  const summary = useMemo(
    () => (sourceTrades ? summarizeTransfer(sourceTrades, { ...range, factor }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceTrades, range.from, range.to, factor],
  );

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    hint: `${formatMoney(a.startingBalance, { whole: true })}${a.id === mainAccount?.id ? ` · ${t("account.mainBadge")}` : ""}`,
  }));

  const sameAccount = !!sourceId && sourceId === targetId;
  const badRange = !allDates && !!from && !!to && from > to;
  const canSubmit =
    !busy && !!source && !!target && !sameAccount && !badRange && (summary?.count ?? 0) > 0;

  const swap = () => {
    setSourceId(targetId);
    setTargetId(sourceId);
  };

  const submit = async () => {
    if (!isPro) return openUpgrade();
    if (!canSubmit || !source || !target) return;
    setBusy(true);
    setProgress({ done: 0, total: summary?.count ?? 0 });
    try {
      const res = await transfer(
        {
          sourceAccountId: source.id,
          targetAccountId: target.id,
          mode,
          factor,
          from: range.from,
          to: range.to,
          skipAlreadyCopied: skipCopied,
        },
        (done, total) => setProgress({ done, total }),
      );
      if (res.planLimitReached) {
        toast(t("transfer.planLimit"), "info");
        window.dispatchEvent(new CustomEvent("tv:upgrade"));
      }
      toast(
        t(mode === "copy" ? "transfer.doneCopy" : "transfer.doneMove")
          .replace("{n}", String(res.transferred))
          .replace("{account}", target.name),
        res.failed > 0 || res.screenshotsFailed > 0 ? "info" : "success",
      );
      if (res.skipped > 0) {
        toast(t("transfer.skippedNote").replace("{n}", String(res.skipped)), "info");
      }
      if (res.failed > 0 || res.screenshotsFailed > 0) {
        toast(
          t("transfer.partialNote")
            .replace("{failed}", String(res.failed))
            .replace("{shots}", String(res.screenshotsFailed)),
          "error",
        );
      }
      onClose();
    } catch (e) {
      console.error("Transfer failed", e);
      toast(isPlanLimitError(e) ? t("transfer.planLimit") : t("transfer.failed"), "error");
      setBusy(false);
      setProgress(null);
    }
  };

  const label = "tv-label block text-slate-400 mb-1.5";
  const fmtDate = (d: string | null) =>
    d ? new Date(`${d}T12:00:00`).toLocaleDateString(locale, { dateStyle: "medium" }) : "—";

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      closeOnBackdrop={!busy}
      className="md:max-w-3xl max-h-[94vh] overflow-hidden"
      labelledBy="transfer-title"
      wrapperClassName="z-[var(--tv-z-modal-nested)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--tv-border)] px-6 py-4">
        <div className="min-w-0">
          <h2 id="transfer-title" className="tv-title flex flex-wrap items-center gap-2.5">
            <Repeat2 className="h-4 w-4 shrink-0 text-[var(--tv-accent)]" />
            {t("transfer.title")}
            {!isPro && <Badge variant="accent">{t("credits.plan.pro")}</Badge>}
          </h2>
          <p className="tv-row-label mt-0.5">{t("transfer.subtitle")}</p>
        </div>
        <button
          onClick={onClose}
          disabled={busy}
          aria-label={t("common.close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[72vh] overflow-y-auto">
        <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* ── LES RÉGLAGES ── */}
          <div className="space-y-5 px-6 py-5">
            {/* DE → VERS */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
              <div className="min-w-0">
                <span className={label}>{t("transfer.from")}</span>
                <SelectPicker
                  label={t("transfer.from")}
                  value={sourceId}
                  options={accountOptions}
                  onChange={setSourceId}
                  variant="field"
                  width="100%"
                />
              </div>
              <button
                type="button"
                onClick={swap}
                aria-label={t("transfer.swap")}
                title={t("transfer.swap")}
                className="mb-0.5 grid h-10 w-10 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-slate-400 transition-colors hover:border-[var(--tv-border-strong)] hover:text-white"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <span className={label}>{t("transfer.to")}</span>
                <SelectPicker
                  label={t("transfer.to")}
                  value={targetId}
                  options={accountOptions}
                  onChange={setTargetId}
                  variant="field"
                  width="100%"
                />
              </div>
            </div>
            {sameAccount && <p className="text-xs text-amber-400">{t("transfer.sameAccount")}</p>}

            {/* COPIER / DÉPLACER */}
            <div>
              <span className={label}>{t("transfer.mode")}</span>
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label={t("transfer.mode")}
              >
                {(
                  [
                    {
                      id: "copy",
                      icon: Copy,
                      title: t("transfer.copy"),
                      hint: t("transfer.copyHint"),
                    },
                    {
                      id: "move",
                      icon: MoveRight,
                      title: t("transfer.move"),
                      hint: t("transfer.moveHint"),
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      mode === m.id
                        ? "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.08)]"
                        : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] hover:border-[var(--tv-border-strong)]",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
                      <m.icon className="h-3.5 w-3.5 text-[var(--tv-accent)]" />
                      {m.title}
                    </span>
                    <span className="text-xs leading-snug text-slate-500">{m.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* PÉRIODE */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="tv-label text-slate-400">{t("transfer.period")}</span>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={allDates}
                    onChange={(e) => setAllDates(e.target.checked)}
                    className="accent-[var(--tv-accent)]"
                  />
                  {t("transfer.allDates")}
                </label>
              </div>
              {!allDates && (
                <div className="animate-fade-in-up grid grid-cols-2 gap-2">
                  <DateField
                    value={from}
                    onChange={setFrom}
                    locale={locale}
                    aria-label={t("transfer.dateFrom")}
                    max={to || undefined}
                  />
                  <DateField
                    value={to}
                    onChange={setTo}
                    locale={locale}
                    aria-label={t("transfer.dateTo")}
                    min={from || undefined}
                  />
                </div>
              )}
              {badRange && (
                <p className="mt-1.5 text-xs text-amber-400">{t("transfer.badRange")}</p>
              )}
            </div>

            {/* ÉCHELLE */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="tv-label text-slate-400">{t("transfer.scale")}</span>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={rescale}
                    onChange={(e) => setRescale(e.target.checked)}
                    className="accent-[var(--tv-accent)]"
                  />
                  {t("transfer.rescale")}
                </label>
              </div>
              {rescale ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      ×
                    </span>
                    <input
                      value={factorText}
                      onChange={(e) => setFactorText(e.target.value)}
                      inputMode="decimal"
                      aria-label={t("transfer.factor")}
                      className={cn(FIELD_BASE, "h-10 pl-7 tv-figure")}
                    />
                  </div>
                  <p className="text-xs leading-snug text-slate-500">
                    {source && target
                      ? t("transfer.scaleHint")
                          .replace("{from}", formatMoney(source.startingBalance, { whole: true }))
                          .replace("{to}", formatMoney(target.startingBalance, { whole: true }))
                      : null}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">{t("transfer.noScaleHint")}</p>
              )}
            </div>

            {mode === "copy" && (
              <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-slate-400">
                <input
                  type="checkbox"
                  checked={skipCopied}
                  onChange={(e) => setSkipCopied(e.target.checked)}
                  className="mt-0.5 accent-[var(--tv-accent)]"
                />
                {t("transfer.skipCopied")}
              </label>
            )}
          </div>

          {/* ── L'APERÇU — collé en haut sur grand écran : il suit le trader
              pendant qu'il règle, au lieu d'attendre sous le dernier champ. ── */}
          <div className="border-t border-[var(--tv-border)] bg-[var(--tv-plate-0)] px-6 py-5 md:border-l md:border-t-0">
            <div className="space-y-4 md:sticky md:top-0">
              <span className="tv-label text-slate-500">{t("transfer.preview")}</span>
              {source && target && !sameAccount && (
                <AccountScaleBridge
                  from={{
                    label: t("transfer.from"),
                    name: source.name,
                    balance: source.startingBalance,
                  }}
                  to={{
                    label: t("transfer.to"),
                    name: target.name,
                    balance: target.startingBalance,
                  }}
                  factor={factor}
                />
              )}
              {!summary ? (
                <div className="h-24 rounded-xl bg-white/[0.04]" aria-hidden />
              ) : summary.count === 0 ? (
                <p className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-4 py-3 text-sm text-slate-400">
                  {t("transfer.empty")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-4">
                  <div>
                    <div className="tv-figure text-2xl text-white">{summary.count}</div>
                    <div className="text-xs text-slate-500">
                      {t("transfer.tradesSpan")
                        .replace("{from}", fmtDate(summary.firstDate))
                        .replace("{to}", fmtDate(summary.lastDate))}
                    </div>
                  </div>
                  <div>
                    <div
                      className={cn(
                        "tv-figure text-2xl",
                        summary.pnlAfter >= 0 ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {formatMoney(summary.pnlAfter, { signed: true })}
                    </div>
                    <div className="text-xs text-slate-500">
                      {factor !== 1
                        ? t("transfer.pnlWas").replace(
                            "{pnl}",
                            formatMoney(summary.pnlBefore, { signed: true }),
                          )
                        : t("transfer.pnlUnchanged")}
                    </div>
                  </div>
                  <p className="col-span-2 text-xs leading-snug text-slate-500">
                    {t("transfer.keeps").replace("{shots}", String(summary.screenshots))}
                  </p>
                </div>
              )}

              {progress && (
                <div aria-live="polite">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full origin-left rounded-full bg-[var(--tv-accent)] transition-transform"
                      style={{
                        transform: `scaleX(${progress.total ? progress.done / progress.total : 0})`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {t("transfer.progress")
                      .replace("{done}", String(progress.done))
                      .replace("{total}", String(progress.total))}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--tv-border)] px-6 py-4 sm:flex-row sm:items-center">
        {!isPro && (
          <p className="text-xs leading-snug text-slate-500 sm:flex-1">{t("transfer.proNote")}</p>
        )}
        <div className="flex justify-end gap-2 sm:ml-auto">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          {isPro ? (
            <Button onClick={submit} disabled={!canSubmit}>
              {busy
                ? t("transfer.running")
                : t(mode === "copy" ? "transfer.ctaCopy" : "transfer.ctaMove").replace(
                    "{n}",
                    String(summary?.count ?? 0),
                  )}
            </Button>
          ) : (
            <Button onClick={openUpgrade}>
              <Lock className="h-4 w-4" />
              {t("transfer.proCta")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
