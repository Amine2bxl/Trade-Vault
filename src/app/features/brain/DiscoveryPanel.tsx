import { useMemo, useState, type ReactNode } from "react";
import { Badge, Button, ChoiceGroup, Disclosure, EmptyState, Textarea } from "@/shared/ui";
import { ArrowLeft, Bot, Crosshair, ExternalLink, Sparkles } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { MIN_GROUP, MIN_GROUP_SESSIONS } from "@/modules/patterns/thresholds";
import {
  ERROR_LIBRARY,
  type Discovery,
  type DiscoveryRun,
  type KnowledgeGraph,
} from "@/modules/knowledge";
import { formatMoney } from "@/shared/currency";
import { discoveryText, evidenceLine, formatEvidence } from "./presentation";
import type { Review, ReviewStatus } from "./useDiscoveryFeedback";

/**
 * LE CENTRE DES DÉCOUVERTES — la liste, puis la fiche en huit points :
 * ce qui est détecté, comment, sur quelles données, combien d'observations,
 * quelle confiance, quelles autres explications, quel impact, comment
 * vérifier. Une revue dont la preuve a changé est signalée, jamais réécrite.
 */

const STATUSES: ReviewStatus[] = ["confirmed", "rejected", "inconclusive", "saved"];
const CONF_TONE = {
  strong: "profit",
  moderate: "accent",
  tentative: "warning",
  descriptive: "neutral",
} as const;

function Row({ d, review, onOpen }: { d: Discovery; review?: Review; onOpen: () => void }) {
  const { t, lang } = useT();
  const { title } = discoveryText(d, t, lang);
  return (
    <button type="button" className="brain-link items-start py-2" onClick={onOpen}>
      <span className="min-w-0 flex-1">
        <span className="tv-label block text-slate-500">
          {t(`brain.dcat.${d.category}` as TKey)}
        </span>
        <span className="mt-0.5 block text-[var(--tv-text-primary)]">{title}</span>
        <span className="tv-hint tv-num mt-0.5 block text-slate-500">
          n {d.evidence.n}
          {d.hypothetical ? ` · ${t("brain.hypothetical")}` : ""}
          {review ? ` · ${t(`brain.review.${review.status}` as TKey)}` : ""}
        </span>
      </span>
      <Badge variant={CONF_TONE[d.confidence]}>{t(`brain.conf.${d.confidence}` as TKey)}</Badge>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="tv-label text-slate-500">{title}</h4>
      <div className="tv-prose mt-1 text-slate-300">{children}</div>
    </section>
  );
}

function Detail({
  d,
  review,
  onBack,
  onReview,
  onShow,
  onAsk,
  onOpenTrades,
}: {
  d: Discovery;
  review: Review | undefined;
  onBack: () => void;
  onReview: (status: ReviewStatus | null, note?: string) => void;
  onShow: () => void;
  onAsk: () => void;
  onOpenTrades: () => void;
}) {
  const { t, lang } = useT();
  const [note, setNote] = useState(review?.note ?? "");
  const [open, setOpen] = useState(false);
  const { title, body } = discoveryText(d, t, lang);
  const changed = review && review.fingerprint !== d.fingerprint;
  const ev = d.evidence;
  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="brain-link w-auto self-start text-slate-400"
        onClick={onBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("brain.disc.back")}
      </button>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="tv-label text-slate-500">{t(`brain.dcat.${d.category}` as TKey)}</span>
        <Badge variant={CONF_TONE[d.confidence]}>{t(`brain.conf.${d.confidence}` as TKey)}</Badge>
        {d.hypothetical && <Badge variant="warning">{t("brain.hypothetical")}</Badge>}
        {d.fragile && <Badge variant="warning">{t("brain.fragile")}</Badge>}
      </div>
      <h3 className="tv-title leading-snug text-white">{title}</h3>
      {changed && (
        <p className="tv-hint text-[var(--tv-warning)]">
          {t("brain.review.changed")
            .replace("{before}", formatEvidence(review.diff, ev.unit, true))
            .replace("{nBefore}", String(review.n))
            .replace("{after}", formatEvidence(ev.diff, ev.unit, true))
            .replace("{nAfter}", String(ev.n))}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
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
      <div className="brain-x">
        <Section title={t("brain.x.what")}>{body}</Section>
        <Section title={t("brain.x.why")}>{t(`brain.why.${d.detector}` as TKey)}</Section>
        <Section title={t("brain.x.data")}>
          <span className="tv-num">{evidenceLine(d, t)}</span>
        </Section>
        <Section title={t("brain.x.n")}>
          {t("brain.x.obs")
            .replace("{n}", String(ev.n))
            .replace("{sessions}", String(ev.sessions))
            .replace("{nCompare}", String(ev.nCompare))}
        </Section>
        <Section title={t("brain.x.confidence")}>
          {t(`brain.conf.${d.confidence}` as TKey)}
          {d.validation ? ` · ${t(`brain.valid.${d.validation}` as TKey)}` : ""}
        </Section>
        <Section title={t("brain.x.alternatives")}>
          <ul className="list-disc pl-4">
            {d.alternatives.map((a) => (
              <li key={a}>{t(`brain.alt.${a}` as TKey)}</li>
            ))}
          </ul>
        </Section>
        <Section title={t("brain.x.impact")}>
          {d.impact === null
            ? t("brain.x.impactNone")
            : t("brain.x.impactText")
                .replace("{impact}", formatMoney(d.impact, { signed: true }))
                .replace("{n}", String(ev.n))}
        </Section>
        <Section title={t("brain.x.verify")}>{t(`brain.exp.${d.experiment}` as TKey)}</Section>
      </div>
      <Disclosure title={t("brain.review.label")} open={open} onChange={setOpen}>
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
        <p className="tv-hint mt-2 text-slate-500">
          {t("brain.method")
            .replace("{method}", ev.method)
            .replace("{seed}", ev.seed === null ? "—" : String(ev.seed))
            .replace("{version}", String(ev.version))}
        </p>
      </Disclosure>
    </div>
  );
}

/** La bibliothèque : chaque erreur, et ce que tes données permettent d'en dire. */
function Library({ graph }: { graph: KnowledgeGraph }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const tagged = useMemo(() => {
    const out = new Map<string, number>();
    for (const n of graph.nodes.values())
      if (n.kind === "mistake") out.set(n.key, n.metrics?.n ?? 0);
    return out;
  }, [graph]);
  return (
    <Disclosure title={t("brain.lib.title")} open={open} onChange={setOpen} className="mt-3">
      <ul className="grid gap-1.5">
        {ERROR_LIBRARY.map((e) => {
          const observed = graph.nodes.get(`error_pattern:${e.id}`)?.metrics?.n ?? 0;
          const declared = e.tags.reduce((s, tag) => s + (tagged.get(tag) ?? 0), 0);
          return (
            <li key={e.id} className="flex items-start justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="text-slate-200">{t(`brain.err.${e.id}` as TKey)}</span>
                <span className="tv-hint block text-slate-500">
                  {t(`brain.lib.family.${e.family}` as TKey)} ·{" "}
                  {e.detection.mode === "needs_data"
                    ? `${t("brain.lib.mode.needs_data")} : ${t(`brain.need.${e.detection.data}` as TKey)}`
                    : t(`brain.lib.mode.${e.detection.mode}` as TKey)}
                </span>
              </span>
              <span className="tv-num tv-hint shrink-0 text-right text-slate-400">
                {e.detection.mode === "signature" && (
                  <span className="block">
                    {t("brain.lib.observed").replace("{n}", String(observed))}
                  </span>
                )}
                {e.tags.length > 0 && (
                  <span className="block">
                    {t("brain.lib.declared").replace("{n}", String(declared))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Disclosure>
  );
}

export function DiscoveryPanel({
  run,
  graph,
  tradeCount,
  reviews,
  activeId,
  onOpen,
  onReview,
  onShow,
  onAsk,
  onOpenTrades,
}: {
  run: DiscoveryRun;
  graph: KnowledgeGraph;
  tradeCount: number;
  reviews: Record<string, Review>;
  activeId: string | null;
  onOpen: (d: Discovery | null) => void;
  onReview: (d: Discovery, status: ReviewStatus | null, note?: string) => void;
  onShow: (d: Discovery) => void;
  onAsk: (d: Discovery) => void;
  onOpenTrades: (d: Discovery) => void;
}) {
  const { t } = useT();
  const active = activeId ? run.discoveries.find((d) => d.id === activeId) : undefined;
  if (active)
    return (
      <Detail
        key={active.id}
        d={active}
        review={reviews[active.id]}
        onBack={() => onOpen(null)}
        onReview={(s, note) => onReview(active, s, note)}
        onShow={() => onShow(active)}
        onAsk={() => onAsk(active)}
        onOpenTrades={() => onOpenTrades(active)}
      />
    );
  return (
    <div>
      {run.discoveries.length === 0 ? (
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
      ) : (
        <>
          <p className="tv-hint mb-2 text-slate-500">
            {t("brain.disc.summary")
              .replace("{n}", String(run.discoveries.length))
              .replace("{tests}", String(run.tests))
              .replace("{alpha}", String(run.alpha))}
          </p>
          <div className="grid gap-0.5">
            {run.discoveries.map((d) => (
              <Row key={d.id} d={d} review={reviews[d.id]} onOpen={() => onOpen(d)} />
            ))}
          </div>
        </>
      )}
      <Library graph={graph} />
    </div>
  );
}
