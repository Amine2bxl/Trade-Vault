import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  CircleAlert,
  Copy,
  Loader2,
  Lock,
  MoveRight,
  Repeat2,
  X,
} from "@/shared/ui/icons";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useToast } from "../contexts/ToastContext";
import { useSubscription } from "../hooks/useSubscription";
import { useT } from "../i18n/LanguageContext";
import { intlLocale } from "../i18n/locale";
import { loadUserTrades } from "../store/trades";
import { TransferSchemaError, type TransferResult } from "../store/tradeTransfer";
import { isPlanLimitError } from "../utils/planLimits";
import type { Trade } from "../types";
import {
  defaultTransferFactor,
  alreadyCopiedIds,
  sanitizeFactor,
  summarizeTransfer,
  tradesInRange,
  type TransferMode,
} from "../trading/tradeTransfer";
import { AccountScaleBridge } from "../trading/AccountScaleBridge";
import {
  Badge,
  Modal,
  Button,
  DateField,
  SelectPicker,
  RollingFigure,
  FIELD_BASE,
  cn,
} from "@/shared/ui";
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
  const { accounts, activeAccount, mainAccount, transfer, switchAccount } = useAccounts();
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
  const inFlight = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const source = accounts.find((a) => a.id === sourceId) ?? null;
  const target = accounts.find((a) => a.id === targetId) ?? null;

  // Le compte source peut ne pas être le compte affiché : ses trades sont lus
  // à part, une fois par changement de source.
  const [sourceTrades, setSourceTrades] = useState<Trade[] | null>(null);
  const [targetTrades, setTargetTrades] = useState<Trade[]>([]);
  useEffect(() => {
    if (!user || !sourceId) return;
    let alive = true;
    setSourceTrades(null);
    setLoadError(false);
    setError(null);
    Promise.all([
      loadUserTrades(user.id, { accountId: sourceId }),
      mode === "copy" && skipCopied && targetId
        ? loadUserTrades(user.id, { accountId: targetId })
        : Promise.resolve([]),
    ])
      .then(([list, copies]) => {
        if (!alive) return;
        setTargetTrades(copies);
        setSourceTrades(list);
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [user?.id, sourceId, targetId, mode, skipCopied, reloadKey]);

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
  const existingCopies = useMemo(() => alreadyCopiedIds(targetTrades), [targetTrades]);
  const eligible = useMemo(
    () =>
      sourceTrades?.filter(
        (trade) => mode !== "copy" || !skipCopied || !existingCopies.has(trade.id),
      ) ?? null,
    [sourceTrades, mode, skipCopied, existingCopies],
  );
  const skipped =
    sourceTrades && eligible
      ? tradesInRange(sourceTrades, range.from, range.to).length -
        tradesInRange(eligible, range.from, range.to).length
      : 0;
  const summary = useMemo(
    () => (eligible ? summarizeTransfer(eligible, { ...range, factor }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligible, range.from, range.to, factor],
  );

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    hint: `${formatMoney(a.startingBalance, { whole: true })}${a.id === mainAccount?.id ? ` · ${t("account.mainBadge")}` : ""}`,
  }));

  const sameAccount = !!sourceId && sourceId === targetId;
  const badRange = !allDates && !!from && !!to && from > to;
  const badFactor =
    rescale &&
    (!Number.isFinite(Number(factorText.replace(",", "."))) ||
      Number(factorText.replace(",", ".")) <= 0);
  const canSubmit =
    !busy &&
    !loadError &&
    !badFactor &&
    !!source &&
    !!target &&
    !sameAccount &&
    !badRange &&
    (summary?.count ?? 0) > 0;

  const swap = () => {
    setSourceId(targetId);
    setTargetId(sourceId);
  };

  const submit = async () => {
    if (!isPro) return openUpgrade();
    if (inFlight.current || !canSubmit || !source || !target) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
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
      if (res.transferred > 0)
        toast(
          t(mode === "copy" ? "transfer.doneCopy" : "transfer.doneMove")
            .replace("{n}", String(res.transferred))
            .replace("{account}", target.name),
          res.failed > 0 || res.screenshotsFailed > 0 ? "info" : "success",
        );
      setResult(res);
    } catch (e) {
      console.error("Transfer failed", e);
      setError(
        e instanceof TransferSchemaError
          ? t("transfer.schemaUnavailable")
          : isPlanLimitError(e)
            ? t("transfer.planLimit")
            : t("transfer.failed"),
      );
      setProgress(null);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const label = "tv-label block text-slate-400 mb-1.5";
  const fmtDate = (d: string | null) =>
    d ? new Date(`${d}T12:00:00`).toLocaleDateString(locale, { dateStyle: "medium" }) : "—";

  const retry = () => {
    setResult(null);
    setProgress(null);
    setReloadKey((key) => key + 1);
  };
  const resultFailed = result && result.transferred === 0 && result.failed > 0;
  const resultPartial = result && (result.failed > 0 || result.screenshotsFailed > 0);

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

      {result ? (
        <div
          className="motion-safe:animate-fade-in-up space-y-5 p-4 sm:p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
                resultPartial
                  ? "border-[var(--tv-border)] text-amber-400"
                  : "border-[var(--tv-border-accent)] text-[var(--tv-accent)]",
              )}
            >
              {resultPartial ? <CircleAlert className="h-5 w-5" /> : <Check className="h-5 w-5" />}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t(
                  resultFailed
                    ? "transfer.resultFailed"
                    : resultPartial
                      ? "transfer.resultPartial"
                      : "transfer.resultDone",
                )}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {result.transferred > 0
                  ? t(mode === "copy" ? "transfer.doneCopy" : "transfer.doneMove")
                      .replace("{n}", String(result.transferred))
                      .replace("{account}", target?.name ?? "")
                  : t(
                      result.skipped > 0 && result.failed === 0
                        ? "transfer.skippedNote"
                        : "transfer.failed",
                    ).replace("{n}", String(result.skipped))}
              </p>
            </div>
          </div>
          {source && target && (
            <AccountScaleBridge
              from={{
                label: t("transfer.from"),
                name: source.name,
                balance: source.startingBalance,
              }}
              to={{ label: t("transfer.to"), name: target.name, balance: target.startingBalance }}
              factor={factor}
            />
          )}
          <div className="grid grid-cols-3 divide-x divide-[var(--tv-border)] rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] py-4">
            {(
              [
                ["transfer.countDone", result.transferred],
                ["transfer.countSkipped", result.skipped],
                ["transfer.countFailed", result.failed],
              ] as const
            ).map(([key, count]) => (
              <div key={key} className="px-3 text-center">
                <div className="tv-figure text-2xl text-white">{count}</div>
                <div className="mt-1 text-xs text-slate-500">{t(key)}</div>
              </div>
            ))}
          </div>
          {resultPartial && (
            <p className="text-sm text-amber-400">
              {t("transfer.partialNote")
                .replace("{failed}", String(result.failed))
                .replace("{shots}", String(result.screenshotsFailed))}
            </p>
          )}
          {result.planLimitReached && (
            <p className="text-sm text-amber-400">{t("transfer.planLimit")}</p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--tv-border)] pt-4">
            <Button variant="ghost" onClick={onClose}>
              {t("common.close")}
            </Button>
            {resultPartial && (
              <Button variant="subtle" onClick={retry}>
                {t("transfer.reviewSettings")}
              </Button>
            )}
            {result.transferred > 0 && (
              <Button
                onClick={() => {
                  switchAccount(targetId);
                  onClose();
                }}
              >
                <MoveRight className="h-4 w-4" />
                {t("transfer.openTarget")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <fieldset
            disabled={busy}
            className="m-0 min-w-0 max-h-[65vh] overflow-y-auto border-0 p-0"
            aria-busy={busy}
          >
            <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              {/* ── LES RÉGLAGES ── */}
              <div className="space-y-5 p-4 sm:px-6 sm:py-5">
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
                {sameAccount && (
                  <p className="text-xs text-amber-400">{t("transfer.sameAccount")}</p>
                )}

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
                              .replace(
                                "{from}",
                                formatMoney(source.startingBalance, { whole: true }),
                              )
                              .replace("{to}", formatMoney(target.startingBalance, { whole: true }))
                          : null}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">{t("transfer.noScaleHint")}</p>
                  )}
                  {badFactor && (
                    <p className="mt-1.5 text-xs text-amber-400">{t("transfer.badFactor")}</p>
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
              <div className="border-t border-[var(--tv-border)] bg-[var(--tv-plate-0)] p-4 sm:px-6 sm:py-5 md:border-l md:border-t-0">
                <div className="space-y-4 md:sticky md:top-0">
                  <span className="tv-label text-slate-500">{t("transfer.preview")}</span>
                  {source && target && !sameAccount && (
                    <AccountScaleBridge
                      key={`${sourceId}:${targetId}`}
                      className="motion-safe:animate-fade-in-up"
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
                  {loadError ? (
                    <div
                      role="alert"
                      className="space-y-3 rounded-xl border border-[var(--tv-border)] p-4"
                    >
                      <p className="text-sm text-amber-400">{t("transfer.loadFailed")}</p>
                      <Button variant="subtle" onClick={retry}>
                        {t("error.retry")}
                      </Button>
                    </div>
                  ) : !summary ? (
                    <div
                      className="h-28 rounded-xl bg-white/[0.04] motion-safe:animate-pulse"
                      aria-label={t("transfer.loading")}
                      role="status"
                    />
                  ) : summary.count === 0 ? (
                    <p className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-4 py-3 text-sm text-slate-400">
                      {t(skipped > 0 ? "transfer.alreadyCopied" : "transfer.empty")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-4">
                      <div>
                        <div className="tv-figure text-2xl text-white">
                          <RollingFigure value={String(summary.count)} />
                        </div>
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
                          <RollingFigure value={formatMoney(summary.pnlAfter, { signed: true })} />
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

                  {skipped > 0 && (
                    <p className="text-xs text-slate-500">
                      {t("transfer.skippedNote").replace("{n}", String(skipped))}
                    </p>
                  )}

                  {busy && progress && (
                    <div
                      className="motion-safe:animate-fade-in-up space-y-3 rounded-xl border border-[var(--tv-border-accent)] bg-[var(--tv-plate-1)] p-4"
                      aria-live="polite"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Loader2 className="h-4 w-4 text-[var(--tv-accent)] motion-safe:animate-spin" />
                        {t(progress.done === 0 ? "transfer.preparing" : "transfer.running")}
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                        role="progressbar"
                        aria-label={t("transfer.running")}
                        aria-valuemin={0}
                        aria-valuemax={progress.total || 1}
                        aria-valuenow={progress.done}
                      >
                        <div
                          className="h-full origin-left rounded-full bg-[var(--tv-accent)] transition-transform duration-180 motion-reduce:transition-none"
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
          </fieldset>

          {error && (
            <p role="alert" className="px-4 py-3 text-sm text-red-400 sm:px-6">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 border-t border-[var(--tv-border)] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
            {!isPro && (
              <p className="text-xs leading-snug text-slate-500 sm:flex-1">
                {t("transfer.proNote")}
              </p>
            )}
            <div className="flex justify-end gap-2 sm:ml-auto">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {t("common.cancel")}
              </Button>
              {isPro ? (
                <Button onClick={submit} disabled={!canSubmit}>
                  {busy && <Loader2 className="h-4 w-4 motion-safe:animate-spin" />}
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
        </>
      )}
    </Modal>
  );
}
