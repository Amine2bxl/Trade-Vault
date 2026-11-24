import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useTrades } from "@/app/trading/useTrades";
import { useScreenshotUrls } from "@/app/hooks/useScreenshotUrls";
import { ScreenshotImage } from "@/app/components/ScreenshotImage";
import { compressImageToFile } from "@/app/utils/image";
import { handOff } from "@/app/utils/handoff";
import { navigateTo } from "@/app/utils/navigate";
import { upsertTrade } from "@/app/store/trades";
import { uploadScreenshot } from "@/app/store/storage";
import {
  dismissCapture,
  loadCaptureHistory,
  loadOpenCaptures,
  markCaptureApplied,
  type CaptureItem,
} from "@/app/store/captures";
import { CAPTURE_LIMITS, hasAnyValue } from "@/domain/capture";
import { enrichCapture } from "@/domain/captureEnrich";
import { findTradeMatches, type TradeMatch } from "@/domain/captureMatch";
import type { Trade } from "@/domain/trade";
import { Button, cn } from "@/shared/ui";
import { ImagePlus, Loader2, ScanLine, X } from "@/shared/ui/icons";
import { useCaptureAnalysis } from "./useCaptureAnalysis";

/**
 * LES CAPTURES À TRAITER — la file de l'Inbox.
 *
 * Le trader dépose ses captures de la journée (glisser, coller, ajouter).
 * Chacune est lue par le moteur de capture, rapprochée du journal, puis
 * PRÉPARÉE : joindre à un trade existant (la correspondance est montrée), créer
 * le trade (formulaire pré-rempli, il valide), en faire un setup manqué, ou
 * l'écarter. Rien n'entre dans le journal sans son geste.
 *
 * Plusieurs captures du même trade (entrée, sortie) s'analysent ensemble.
 */

const MAX_SCREENSHOTS_PER_TRADE = 3;

interface Prepared {
  item: CaptureItem;
  title: string;
  detail: string;
  match: (TradeMatch & { trade: Trade }) | null;
  readable: boolean;
}

export function CaptureQueue() {
  const { t } = useT();
  const { user } = useAuth();
  const userId = user?.id;
  const { activeId } = useAccounts();
  const { toast } = useToast();
  const { trades } = useTrades(userId, activeId, true);
  const { analyze, busy } = useCaptureAnalysis();
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [history, setHistory] = useState<CaptureItem[]>([]);
  const [staged, setStaged] = useState<string[]>([]);
  const [sameTrade, setSameTrade] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [open, past] = await Promise.all([
        loadOpenCaptures(userId),
        loadCaptureHistory(userId, 10),
      ]);
      setItems(open);
      setHistory(past);
    } catch {
      /* file vide plutôt qu'une erreur : la table peut manquer sur un aperçu */
    }
  }, [userId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!userId) return;
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      setUploading(true);
      try {
        const paths: string[] = [];
        for (const f of images.slice(0, 12)) {
          paths.push(await uploadScreenshot(userId, await compressImageToFile(f)));
        }
        setStaged((s) => [...s, ...paths]);
      } catch {
        toast(t("capture.error.unreadable"), "error");
      } finally {
        setUploading(false);
      }
    },
    [userId, t, toast],
  );

  // Coller une capture sur la page — sauf quand un formulaire est ouvert par-dessus.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((it) => it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (!files.length) return;
      e.preventDefault();
      void addFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const analyzeStaged = async () => {
    const groups = sameTrade ? [staged.slice(0, CAPTURE_LIMITS.maxImages)] : staged.map((p) => [p]);
    for (const paths of groups) {
      await analyze({ paths, source: "image", target: "trade", accountId: activeId ?? null });
    }
    setStaged((s) => (sameTrade ? s.slice(CAPTURE_LIMITS.maxImages) : []));
    await reload();
  };

  const prepared: Prepared[] = useMemo(
    () =>
      items.map((item) => {
        const x = item.extraction;
        if (!x) return { item, title: "", detail: "", match: null, readable: false };
        const d = enrichCapture(x);
        const title = [
          x.symbol.value,
          x.direction.value && t(x.direction.value === "long" ? "common.long" : "common.short"),
          d.dateEt.value,
          d.entryTimeEt.value,
        ]
          .filter(Boolean)
          .join(" · ");
        const detail = [
          d.realizedR.value !== null ? `${d.realizedR.value}R` : null,
          d.plannedR.value !== null
            ? t("capture.derived.plannedR").replace("{r}", String(d.plannedR.value))
            : null,
          x.timeframe.value,
        ]
          .filter(Boolean)
          .join(" · ");
        const [best] = findTradeMatches(
          {
            date: d.dateEt.value,
            symbol: x.symbol.value,
            direction: x.direction.value,
            entryTime: d.entryTimeEt.value,
            entryPrice: x.entryPrice.value,
          },
          trades,
          1,
        );
        const trade =
          best && best.level !== "possible" ? trades.find((tr) => tr.id === best.id) : undefined;
        return {
          item,
          title,
          detail,
          match: best && trade ? { ...best, trade } : null,
          readable: hasAnyValue(x),
        };
      }),
    [items, trades, t],
  );

  const attach = async (p: Prepared) => {
    if (!userId || !p.match) return;
    const trade = p.match.trade;
    const shots = Array.from(new Set([...trade.screenshots, ...p.item.screenshots]));
    if (shots.length > MAX_SCREENSHOTS_PER_TRADE) {
      toast(t("queue.full"), "info");
      return;
    }
    setWorking(p.item.id);
    try {
      await upsertTrade(userId, { ...trade, screenshots: shots });
      await markCaptureApplied(p.item.id, { tradeId: trade.id }, {});
    } catch {
      toast(t("capture.error.failed"), "error");
    } finally {
      setWorking(null);
      await reload();
    }
  };

  const sureMatches = prepared.filter((p) => p.match?.level === "exact");

  const createTrade = (p: Prepared) => {
    if (!p.item.extraction) return;
    handOff("tradeCapture", {
      itemId: p.item.id,
      extraction: p.item.extraction,
      screenshots: p.item.screenshots,
    });
    window.dispatchEvent(new CustomEvent("tv:new-trade"));
  };
  const toMissed = (p: Prepared) => {
    if (!p.item.extraction) return;
    handOff("missedCapture", {
      itemId: p.item.id,
      extraction: p.item.extraction,
      screenshots: p.item.screenshots,
    });
    navigateTo({ page: "missed" });
  };
  const dismiss = async (id: string) => {
    setWorking(id);
    try {
      await dismissCapture(id);
    } finally {
      setWorking(null);
      await reload();
    }
  };
  const retry = async (item: CaptureItem) => {
    setWorking(item.id);
    await analyze({
      paths: item.screenshots,
      note: item.note ?? undefined,
      source: item.source,
      target: item.target,
      accountId: item.accountId,
      force: true,
    });
    setWorking(null);
    await reload();
  };

  const thumbs = useScreenshotUrls(
    useMemo(() => [...staged, ...items.flatMap((i) => i.screenshots.slice(0, 1))], [staged, items]),
  );

  return (
    <section
      aria-labelledby="capture-queue-title"
      className="mb-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <ScanLine className="h-3.5 w-3.5 shrink-0 text-[var(--tv-highlight)]" aria-hidden />
        <h2 id="capture-queue-title" className="tv-label shrink-0 text-[var(--tv-highlight)]">
          {t("queue.title")}
        </h2>
        {items.length > 0 && (
          <span className="tv-num text-[11px] text-slate-500">{items.length}</span>
        )}
        <span aria-hidden className="h-px flex-1 bg-[var(--tv-border)]" />
        {sureMatches.length > 1 && (
          <Button
            variant="subtle"
            size="sm"
            onClick={async () => {
              for (const p of sureMatches) await attach(p);
            }}
          >
            {t("queue.attachAll").replace("{n}", String(sureMatches.length))}
          </Button>
        )}
        <Button
          variant="subtle"
          size="sm"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="hidden sm:inline">{t("queue.add")}</span>
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {staged.length > 0 ? (
        <div className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-2.5 md:p-3">
          <div className="flex flex-wrap gap-2">
            {staged.map((path) => (
              <div
                key={path}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--tv-border)]"
              >
                <ScreenshotImage
                  path={path}
                  url={thumbs[path] ?? ""}
                  alt=""
                  boxClassName="h-full w-full"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={t("common.remove")}
                  onClick={() => setStaged((s) => s.filter((x) => x !== path))}
                  className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {staged.length > 1 && (
              <label className="flex min-h-[36px] items-center gap-2 text-[12px] text-slate-300">
                <input
                  type="checkbox"
                  checked={sameTrade}
                  onChange={(e) => setSameTrade(e.target.checked)}
                />
                {t("queue.sameTrade")}
              </label>
            )}
            <Button
              variant="accent"
              size="sm"
              className="ml-auto"
              disabled={busy}
              onClick={() => void analyzeStaged()}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {t("queue.analyzeN").replace("{n}", String(staged.length))}
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--tv-border)] px-3 py-3 text-[12px] leading-snug text-slate-500">
          {t("queue.drop")}
        </p>
      ) : null}

      {prepared.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {prepared.map((p) => (
            <li
              key={p.item.id}
              className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-2.5"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)]">
                {p.item.screenshots[0] && (
                  <ScreenshotImage
                    path={p.item.screenshots[0]}
                    url={thumbs[p.item.screenshots[0]] ?? ""}
                    alt=""
                    boxClassName="h-full w-full"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="tv-figure truncate text-[13px] font-semibold text-white">
                  {p.item.status === "processing"
                    ? t("queue.processing")
                    : p.item.status === "failed"
                      ? t("queue.failed")
                      : p.readable
                        ? p.title || t("queue.nothing")
                        : t("queue.nothing")}
                </p>
                <p className="tv-figure truncate text-[12px] text-slate-500">
                  {p.match
                    ? t("queue.match").replace(
                        "{desc}",
                        `${p.match.trade.symbol} · ${p.match.trade.date} · ${p.match.trade.entryTime}`,
                      )
                    : p.detail}
                </p>
              </div>
              <div
                className={cn(
                  "flex flex-wrap gap-1.5",
                  working === p.item.id && "pointer-events-none opacity-50",
                )}
              >
                {p.item.status === "failed" ? (
                  <Button variant="subtle" size="sm" onClick={() => void retry(p.item)}>
                    {t("queue.retry")}
                  </Button>
                ) : p.item.status === "completed" ? (
                  <>
                    {p.match ? (
                      <Button variant="accent" size="sm" onClick={() => void attach(p)}>
                        {t("queue.attach")}
                      </Button>
                    ) : (
                      <Button variant="accent" size="sm" onClick={() => createTrade(p)}>
                        {t("queue.createTrade")}
                      </Button>
                    )}
                    <Button variant="subtle" size="sm" onClick={() => toMissed(p)}>
                      {t("queue.missed")}
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="subtle"
                  size="sm"
                  aria-label={t("queue.dismiss")}
                  onClick={() => void dismiss(p.item.id)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <details className="mt-2">
          <summary className="tv-label inline-flex min-h-[32px] cursor-pointer items-center text-slate-500">
            {t("queue.history")} · {history.length}
          </summary>
          <ul className="mt-1 divide-y divide-[var(--tv-border)]">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                <span className="text-slate-400">
                  {t(
                    (h.status === "dismissed"
                      ? "queue.dismissed"
                      : h.missedId
                        ? "queue.appliedMissed"
                        : "queue.applied") as TKey,
                  )}
                </span>
                <span className="tv-figure truncate text-slate-500">
                  {[h.extraction?.symbol.value, h.extraction?.date.value]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {(h.tradeId || h.missedId) && (
                  <button
                    type="button"
                    className="ml-auto inline-flex min-h-[32px] items-center font-semibold text-[var(--tv-highlight)] hover:underline"
                    onClick={() =>
                      h.tradeId
                        ? navigateTo({ page: "journal", focus: { kind: "trade", id: h.tradeId } })
                        : navigateTo({ page: "missed", focus: { kind: "missed", id: h.missedId! } })
                    }
                  >
                    {t("queue.open")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
