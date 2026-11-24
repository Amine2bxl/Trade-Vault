import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useT } from "@/app/i18n/LanguageContext";
import { useTrades } from "@/app/trading/useTrades";
import { loadRecentCorrections } from "@/app/store/captures";
import { findTradeMatches, type TradeMatch } from "@/domain/captureMatch";
import { CaptureAssist, type ApplyOutcome } from "./CaptureAssist";
import {
  applyLearning,
  applyProposals,
  ESSENTIAL_TRADE_FIELDS,
  learnedRemaps,
  tradeProposals,
  type Proposal,
  type TradeFormField,
  type TradeFormSlice,
} from "./capturePrefill";

import type { CaptureSession } from "./settleCapture";

type FormLike = TradeFormSlice & { riskType: "dollar" | "percent" };

interface Props<S extends FormLike> {
  userId: string;
  accountId: string | null;
  /** Nouveau trade : on cherche les doublons ; trade existant : on ne fait que compléter. */
  isNew: boolean;
  formRef: MutableRefObject<S>;
  pristine: Partial<S>;
  setForm: (next: S) => void;
  /** Des prix ont été remplis : le formulaire ouvre sa section « Prix et plan ». */
  onPricesApplied: () => void;
  session: MutableRefObject<CaptureSession | null>;
  paths: string[];
  uploading: boolean;
  canAddMore: boolean;
  onAddFiles: (files: File[]) => void;
  strategies: readonly string[];
  confluences: readonly string[];
  plannedRiskDollars: number | null;
  /** Ouvre un trade existant (doublon probable) — le formulaire garde son brouillon. */
  onOpenTrade: (id: string) => void;
}

const PRICE_FIELDS = new Set<TradeFormField>([
  "entryPrice",
  "exitPrice",
  "initialStop",
  "initialTarget",
]);

export function TradeCaptureAssist<S extends FormLike>(p: Props<S>) {
  const { t } = useT();
  const { trades } = useTrades(p.userId || undefined, p.accountId, p.isNew);
  const [remaps, setRemaps] = useState<Record<string, Record<string, string>>>({});
  const [matches, setMatches] = useState<TradeMatch[]>([]);

  useEffect(() => {
    if (!p.userId) return;
    let alive = true;
    void loadRecentCorrections(p.userId).then((h) => {
      if (alive) setRemaps(learnedRemaps(h));
    });
    return () => {
      alive = false;
    };
  }, [p.userId]);

  const { formRef, pristine, setForm, onPricesApplied, session } = p;
  const apply = useCallback(
    (
      proposals: Proposal<TradeFormField>[],
      opts: { includeReview?: boolean; force?: boolean },
    ): ApplyOutcome<TradeFormField> => {
      const r = applyProposals(formRef.current, pristine, proposals, opts);
      if (r.applied.length) {
        const next = r.applied.some((a) => a.field === "riskAmount")
          ? { ...r.next, riskType: "dollar" as const }
          : r.next;
        formRef.current = next;
        setForm(next);
        if (r.applied.some((a) => PRICE_FIELDS.has(a.field))) onPricesApplied();
        const prev = session.current?.applied ?? [];
        session.current = {
          itemId: session.current?.itemId ?? null,
          applied: [
            ...prev.filter((x) => !r.applied.some((a) => a.field === x.field)),
            ...r.applied,
          ],
        };
      }
      return { applied: r.applied, conflicts: r.conflicts };
    },
    [formRef, pristine, setForm, onPricesApplied, session],
  );

  const ctx = useMemo(
    () => ({ strategies: p.strategies, confluences: p.confluences }),
    [p.strategies, p.confluences],
  );

  const byId = useMemo(() => new Map(trades.map((tr) => [tr.id, tr])), [trades]);

  return (
    <CaptureAssist<TradeFormField>
      target="trade"
      paths={p.paths}
      uploading={p.uploading}
      canAddMore={p.canAddMore}
      onAddFiles={p.onAddFiles}
      accountId={p.accountId}
      hints={{ setups: p.strategies.slice(0, 20) as string[] }}
      plannedRiskDollars={p.plannedRiskDollars}
      essential={ESSENTIAL_TRADE_FIELDS}
      propose={(x, d) => applyLearning(tradeProposals(x, d, ctx), remaps)}
      apply={apply}
      onResult={(run) => {
        session.current = { itemId: run.itemId, applied: session.current?.applied ?? [] };
        if (!p.isNew) return;
        setMatches(
          findTradeMatches(
            {
              date: run.derived.dateEt.value,
              symbol: run.extraction.symbol.value,
              direction: run.extraction.direction.value,
              entryTime: run.derived.entryTimeEt.value,
              entryPrice: run.extraction.entryPrice.value,
            },
            trades,
          ).filter((m) => m.level !== "possible"),
        );
      }}
    >
      {matches.length > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[12px] text-amber-300">
          <p>{t("capture.duplicate")}</p>
          <ul className="mt-1 space-y-0.5">
            {matches.map((m) => {
              const tr = byId.get(m.id);
              if (!tr) return null;
              return (
                <li key={m.id} className="tv-figure flex flex-wrap items-center gap-x-2">
                  <span className="text-slate-200">
                    {tr.date} · {tr.symbol} · {tr.direction} · {tr.entryTime}
                  </span>
                  <button
                    type="button"
                    onClick={() => p.onOpenTrade(m.id)}
                    className="-my-1 inline-flex min-h-[32px] items-center font-semibold text-[var(--tv-highlight)] underline-offset-2 hover:underline"
                  >
                    {t("capture.duplicateOpen")}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </CaptureAssist>
  );
}
