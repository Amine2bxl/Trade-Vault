import { useState } from "react";
import { Badge, Button, Card, ChoiceGroup, Disclosure, EmptyState, Textarea } from "@/shared/ui";
import { Bot, Crosshair, ExternalLink, Sparkles } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { MIN_GROUP, MIN_GROUP_SESSIONS } from "@/modules/patterns/thresholds";
import type { Discovery, DiscoveryRun } from "@/modules/knowledge";
import { discoveryText, evidenceLine, formatEvidence } from "./presentation";
import type { Review, ReviewStatus } from "./useDiscoveryFeedback";

/**
 * LE CENTRE DES DÉCOUVERTES — ce que les données montrent, avec la preuve.
 *
 * Chaque carte : la constatation (jamais une cause), la preuve (n, séances,
 * intervalle, q), les explications concurrentes, une expérience mesurable,
 * et la revue du trader. Une revue dont la preuve a changé depuis est
 * signalée avec l'ancienne et la nouvelle valeur : la connaissance évolue
 * à découvert.
 */

const STATUSES: ReviewStatus[] = ["confirmed", "rejected", "inconclusive", "saved"];

function DiscoveryCard({
  d,
  review,
  active,
  onReview,
  onShow,
  onAsk,
  onOpenTrades,
}: {
  d: Discovery;
  review: Review | undefined;
  active: boolean;
  onReview: (status: ReviewStatus | null, note?: string) => void;
  onShow: () => void;
  onAsk: () => void;
  onOpenTrades: () => void;
}) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(active);
  const [note, setNote] = useState(review?.note ?? "");
  const { title, body } = discoveryText(d, t, lang);
  const changed = review && review.fingerprint !== d.fingerprint;

  return (
    <Card pad="default" className="brain-disc" data-active={active || undefined}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="tv-label text-slate-500">{t(`brain.dcat.${d.category}` as TKey)}</span>
        {d.hypothetical && <Badge variant="warning">{t("brain.hypothetical")}</Badge>}
        {d.fragile && <Badge variant="warning">{t("brain.fragile")}</Badge>}
        {review && <Badge variant="accent">{t(`brain.review.${review.status}` as TKey)}</Badge>}
      </div>
      <h3 className="tv-title mt-1 leading-snug text-white">{title}</h3>
      <p className="tv-prose mt-1 text-slate-300">{body}</p>
      <p className="tv-hint tv-num mt-1.5 text-slate-500">{evidenceLine(d, t)}</p>
      {changed && (
        <p className="tv-hint mt-1.5 text-[var(--tv-warning)]">
          {t("brain.review.changed")
            .replace("{before}", formatEvidence(review.diff, d.evidence.unit, true))
            .replace("{nBefore}", String(review.n))
            .replace("{after}", formatEvidence(d.evidence.diff, d.evidence.unit, true))
            .replace("{nAfter}", String(d.evidence.n))}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={onShow}>
          <Crosshair className="h-3.5 w-3.5" />
          {t("brain.showInGraph")}
        </Button>
        {d.trades.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onOpenTrades}>
            <ExternalLink className="h-3.5 w-3.5" />
            {t("brain.openTrades").replace("{n}", String(d.trades.length))}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onAsk}>
          <Bot className="h-3.5 w-3.5" />
          {t("brain.investigate")}
        </Button>
      </div>

      <Disclosure title={t("brain.details")} open={open} onChange={setOpen} className="mt-2">
        <span className="tv-label text-slate-500">{t("brain.alternatives")}</span>
        <ul className="tv-prose mt-1 list-disc pl-4 text-slate-300">
          {d.alternatives.map((a) => (
            <li key={a}>{t(`brain.alt.${a}` as TKey)}</li>
          ))}
        </ul>
        <span className="tv-label mt-3 block text-slate-500">{t("brain.experiment")}</span>
        <p className="tv-prose mt-1 text-slate-300">{t(`brain.exp.${d.experiment}` as TKey)}</p>
        <p className="tv-hint mt-2 text-slate-500">
          {t("brain.method")
            .replace("{method}", d.evidence.method)
            .replace("{seed}", d.evidence.seed === null ? "—" : String(d.evidence.seed))
            .replace("{version}", String(d.evidence.version))}
        </p>

        <div className="mt-3">
          <ChoiceGroup
            label={t("brain.review.label")}
            value={review?.status ?? null}
            options={STATUSES.map((s) => ({ value: s, label: t(`brain.review.${s}` as TKey) }))}
            onChange={(s) => onReview(s, note.trim() || undefined)}
          />
          <Textarea
            className="mt-2"
            rows={2}
            maxLength={1000}
            value={note}
            placeholder={t("brain.review.note")}
            aria-label={t("brain.review.note")}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => review && onReview(review.status, note.trim() || undefined)}
          />
          {review && (
            <button
              type="button"
              className="tv-hint mt-1 text-slate-400 hover:text-white"
              onClick={() => onReview(null)}
            >
              {t("brain.review.clear")}
            </button>
          )}
        </div>
      </Disclosure>
    </Card>
  );
}

export function DiscoveryPanel({
  run,
  tradeCount,
  reviews,
  activeId,
  onReview,
  onShow,
  onAsk,
  onOpenTrades,
}: {
  run: DiscoveryRun;
  tradeCount: number;
  reviews: Record<string, Review>;
  activeId: string | null;
  onReview: (d: Discovery, status: ReviewStatus | null, note?: string) => void;
  onShow: (d: Discovery) => void;
  onAsk: (d: Discovery) => void;
  onOpenTrades: (d: Discovery) => void;
}) {
  const { t } = useT();
  if (!run.discoveries.length) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title={t("brain.disc.emptyTitle")}
        description={
          tradeCount < MIN_GROUP * 2
            ? t("brain.disc.emptyFew")
                .replace("{n}", String(MIN_GROUP))
                .replace("{s}", String(MIN_GROUP_SESSIONS))
            : t("brain.disc.emptyNone").replace("{tests}", String(run.tests))
        }
      />
    );
  }
  return (
    <div>
      <p className="tv-hint mb-2 text-slate-500">
        {t("brain.disc.summary")
          .replace("{n}", String(run.discoveries.length))
          .replace("{tests}", String(run.tests))
          .replace("{alpha}", String(run.alpha))}
      </p>
      {run.discoveries.map((d) => (
        <DiscoveryCard
          key={d.id}
          d={d}
          review={reviews[d.id]}
          active={d.id === activeId}
          onReview={(s, note) => onReview(d, s, note)}
          onShow={() => onShow(d)}
          onAsk={() => onAsk(d)}
          onOpenTrades={() => onOpenTrades(d)}
        />
      ))}
    </div>
  );
}
