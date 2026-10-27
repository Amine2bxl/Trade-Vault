import { Clock, Star, BarChart3 } from "@/shared/ui/icons";
import { Trade, isBreakEven } from "@/app/types";
import { formatPnl, getDuration } from "@/domain/tradeCalcs";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import type { TradeIntent, TradeReflection } from "@/app/store/tradeIntel";
import { RichTextView } from "@/shared/ui";
import { formatMoney } from "@/shared/currency";

/**
 * LES BLOCS DE L'APERÇU D'UN TRADE — une seule écriture pour deux formes.
 *
 * L'aperçu existe en modale (bureau) et en feuille plein écran (téléphone).
 * Les deux montrent les mêmes informations, rangées différemment : sur
 * téléphone, ces blocs vivent dans des sections repliables sous le résumé et
 * les captures. Ils sont écrits une fois ici pour que les deux formes ne
 * divergent jamais.
 */

type TradeProps = { trade: Trade };
/** `label={false}` : le titre est déjà porté par la section repliable qui
 *  contient le bloc (feuille mobile) — on ne le répète pas. */
type LabeledProps = TradeProps & { label?: boolean };

export function TradeMetrics({ trade }: TradeProps) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <Clock className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
        <div className="text-[10px] text-slate-500 mb-0.5">{t("tradeDetail.entry")}</div>
        <div className="text-sm font-semibold text-white">{trade.entryTime || "—"}</div>
      </div>
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <Clock className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
        <div className="text-[10px] text-slate-500 mb-0.5">{t("tradeDetail.exit")}</div>
        <div className="text-sm font-semibold text-white">{trade.exitTime || "—"}</div>
      </div>
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <div className="text-[10px] text-slate-500 mb-1">{t("tradeDetail.duration")}</div>
        <div className="text-sm font-semibold text-white">
          {getDuration(trade.entryTime, trade.exitTime)}
        </div>
      </div>
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <BarChart3 className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
        <div className="text-[10px] text-slate-500 mb-0.5">{t("tradeDetail.rr")}</div>
        <div
          className={cn(
            "tv-num",
            "text-sm font-semibold",
            trade.riskAmount <= 0
              ? "text-slate-500"
              : trade.pnl >= 0
                ? "text-emerald-400"
                : "text-red-400",
          )}
        >
          {trade.riskAmount > 0 ? `${(trade.pnl / trade.riskAmount).toFixed(2)}R` : "—"}
        </div>
      </div>
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <Star className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
        <div className="text-[10px] text-slate-500 mb-0.5">{t("tradeDetail.quality")}</div>
        <div className="text-sm font-semibold text-slate-300">
          {trade.reviewPending
            ? "—"
            : "★".repeat(trade.setupQuality) + "☆".repeat(5 - trade.setupQuality)}
        </div>
      </div>
    </div>
  );
}

export function TradeRisk({ trade }: TradeProps) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-3 md:gap-4 text-xs">
      <div className="bg-white/[0.03] rounded-lg px-3 py-2">
        <span className="text-slate-500">{t("tradeDetail.risk")}: </span>
        <span className="tv-num text-white font-semibold">
          {trade.riskAmount > 0 ? formatMoney(trade.riskAmount) : "—"}
        </span>
      </div>
      {trade.riskAmount > 0 && (
        <div className="bg-white/[0.03] rounded-lg px-3 py-2">
          <span className="text-slate-500">{t("tradeDetail.pnlPerRisk")}: </span>
          <span
            className={cn("font-semibold", trade.pnl >= 0 ? "text-emerald-400" : "text-red-400")}
          >
            {(trade.pnl / trade.riskAmount).toFixed(2)}R
          </span>
        </div>
      )}
      {trade.mae != null && (
        <div className="bg-white/[0.03] rounded-lg px-3 py-2">
          <span className="text-slate-500">MAE: </span>
          <span className="tv-num text-red-400 font-semibold">
            {formatMoney(-Math.abs(trade.mae))}
          </span>
        </div>
      )}
      {trade.mfe != null && (
        <div className="bg-white/[0.03] rounded-lg px-3 py-2">
          <span className="text-slate-500">MFE: </span>
          <span className="tv-num text-emerald-400 font-semibold">
            {formatMoney(Math.abs(trade.mfe), { signed: true })}
          </span>
        </div>
      )}
      {trade.slippage != null && (
        <div className="bg-white/[0.03] rounded-lg px-3 py-2">
          <span className="text-slate-500">{t("trade.slippage")}: </span>
          <span className="tv-num text-slate-300 font-semibold">{formatMoney(trade.slippage)}</span>
        </div>
      )}
    </div>
  );
}

export function TradeConfidence({ trade }: TradeProps) {
  const { t } = useT();
  if (trade.reviewPending) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{t("tradeDetail.confidenceLevel")}</span>
        <span className="tv-num text-xs font-bold text-slate-500">—</span>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">{t("tradeDetail.confidenceLevel")}</span>
        <span
          className={cn(
            "tv-num",
            "text-xs font-bold",
            trade.confidence >= 75
              ? "text-emerald-400"
              : trade.confidence >= 50
                ? "text-slate-300"
                : "text-red-400",
          )}
        >
          {trade.confidence}%
        </span>
      </div>
      <div className="w-full bg-white/[0.05] rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition duration-250",
            /* Un aplat, pas un dégradé sur deux nuances de la
               même couleur : à deux pixels de haut, la rampe ne se
               voit pas — elle ne fait qu'ajouter une exception au
               reste des jauges du produit. */
            trade.confidence >= 75
              ? "bg-emerald-400/80"
              : trade.confidence >= 50
                ? "bg-amber-400/80"
                : "bg-red-400/80",
          )}
          style={{ width: `${trade.confidence}%` }}
        />
      </div>
    </div>
  );
}

export function TradeConfluences({ trade, label = true }: LabeledProps) {
  const { t } = useT();
  if (trade.confluences.length === 0) return null;
  return (
    <div>
      {label && (
        <span className="tv-label text-slate-500 block mb-2">{t("tradeDetail.confluences")}</span>
      )}
      <div className="flex flex-wrap gap-2">
        {trade.confluences.map((c) => (
          <span
            key={c}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 text-xs font-medium"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TradeMistakes({ trade, label = true }: LabeledProps) {
  const { t } = useT();
  if (trade.mistakes.length === 0) return null;
  return (
    <div>
      {label && (
        <span className="tv-label text-slate-500 block mb-2">{t("tradeDetail.mistakes")}</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {trade.mistakes.map((m) => (
          <span
            key={m}
            className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/** AVANT → APRÈS → RÉSULTAT (Phase 0b Step 6I). Absent si rien n'a été capturé. */
export function TradeIntentFlow({
  trade,
  intent,
  reflection,
  label = true,
}: {
  trade: Trade;
  intent: TradeIntent | null;
  reflection: TradeReflection | null;
  label?: boolean;
}) {
  const { t } = useT();
  const be = isBreakEven(trade);
  // Étiquettes localisées des capteurs intent/reflection (6I).
  const emotionKey = (e: string) => `session.state${e.charAt(0).toUpperCase() + e.slice(1)}`;
  const planRespectedLabel = (p: TradeReflection["planRespected"]) =>
    p === "yes"
      ? t("tradeDetail.planYes")
      : p === "partial"
        ? t("tradeDetail.planPartial")
        : p === "no"
          ? t("tradeDetail.planNo")
          : "—";
  if (!intent && !reflection) return null;
  return (
    <div className="space-y-2">
      {label && (
        <span className="tv-label text-slate-500 block">{t("tradeDetail.intentFlow")}</span>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {intent ? (
          <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-500/20 p-3">
            <div className="tv-label text-cyan-300 mb-1.5">{t("tradeDetail.intent")}</div>
            <dl className="text-xs text-slate-300 space-y-1">
              {intent.setup && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.intentSetup")}</dt>
                  <dd className="text-right text-white">{intent.setup}</dd>
                </div>
              )}
              {intent.reasoning && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.intentReasoning")}</dt>
                  <dd className="text-right text-white">{intent.reasoning}</dd>
                </div>
              )}
              {intent.confidence != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.intentConfidence")}</dt>
                  <dd className="tv-num text-right text-white">{intent.confidence}%</dd>
                </div>
              )}
              {intent.plannedRisk != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.intentRisk")}</dt>
                  <dd className="tv-num text-right text-white">
                    {formatMoney(intent.plannedRisk)}
                  </dd>
                </div>
              )}
              {intent.plan && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.intentPlan")}</dt>
                  <dd className="text-right text-white italic">{intent.plan}</dd>
                </div>
              )}
              {intent.emotion && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.intentEmotion")}</dt>
                  <dd className="text-right text-white">
                    {t(emotionKey(intent.emotion) as never)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        ) : null}
        {reflection ? (
          <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-3">
            <div className="tv-label text-amber-300 mb-1.5">{t("tradeDetail.reflection")}</div>
            <dl className="text-xs text-slate-300 space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t("tradeDetail.reflectionPlan")}</dt>
                <dd className="text-right text-white">
                  {planRespectedLabel(reflection.planRespected)}
                </dd>
              </div>
              {reflection.reason && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.reflectionReason")}</dt>
                  <dd className="text-right text-white">
                    {t(`trade.reason.${reflection.reason}` as never)}
                  </dd>
                </div>
              )}
              {reflection.note && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("tradeDetail.reflectionNote")}</dt>
                  <dd className="text-right text-white italic">{reflection.note}</dd>
                </div>
              )}
            </dl>
          </div>
        ) : null}
      </div>
      <div className="text-xs text-slate-300 border-t border-white/[0.06] pt-2 mt-1 flex items-center gap-2">
        <span className="tv-label text-slate-500">{t("tradeDetail.result")}</span>
        <span
          className={cn(
            "tv-figure",
            be ? "text-slate-300" : trade.pnl >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          {formatPnl(trade.pnl)}
        </span>
        <span className="text-slate-500">·</span>
        <span className="tv-figure text-white">{trade.rMultiple.toFixed(2)}R</span>
      </div>
    </div>
  );
}

export function TradeNotes({ trade }: TradeProps) {
  const { t } = useT();
  if (!trade.notes) return null;
  return (
    <div>
      <span className="tv-label text-slate-500 block mb-2">{t("tradeDetail.notes")}</span>
      {/* `whitespace-pre-wrap` : les retours à la ligne écrits
          dans la note étaient écrasés à l'affichage — un texte
          structuré redevenait un pavé illisible. */}
      <RichTextView
        value={trade.notes}
        className="bg-white/[0.03] rounded-xl p-4 text-sm text-slate-300 leading-relaxed border border-white/[0.04] whitespace-pre-wrap break-words"
      />
    </div>
  );
}
