import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { Badge, Button, Textarea, cn } from "@/shared/ui";
import { ImagePlus, Loader2, Mic, RotateCcw, ScanLine, Square } from "@/shared/ui/icons";
import { CONFLUENCE_LABELS, TIMEFRAME_MINUTES, type CaptureExtraction } from "@/domain/capture";
import type { CaptureDerived } from "@/domain/captureEnrich";
import { missingFields, type Proposal, type ProposalKind } from "./capturePrefill";
import { useCaptureAnalysis, type CaptureRequest, type CaptureRun } from "./useCaptureAnalysis";
import { useDictation } from "./useDictation";

/**
 * LE MOTEUR DE CAPTURE, À L'ÉCRAN — un seul composant pour le formulaire de
 * trade et celui de setup manqué.
 *
 * Il ne possède pas le formulaire : il lance l'analyse, demande au parent
 * d'appliquer les propositions (champs vides seulement) et montre, en une
 * liste compacte, ce qui a été DÉTECTÉ, CALCULÉ, ESTIMÉ, ce qui est À REVOIR
 * et ce qui MANQUE. Le trader corrige directement dans le formulaire ; une
 * proposition douteuse ou en conflit ne s'applique que d'un geste.
 */

export interface ApplyOutcome<F extends string> {
  applied: Proposal<F>[];
  conflicts: Proposal<F>[];
}

export interface CaptureAssistProps<F extends string> {
  target: "trade" | "missed";
  /** Les captures déjà jointes au formulaire (chemins Storage). */
  paths: string[];
  uploading?: boolean;
  canAddMore: boolean;
  onAddFiles: (files: File[]) => void;
  accountId: string | null;
  hints?: CaptureRequest["hints"];
  plannedRiskDollars?: number | null;
  essential: readonly F[];
  propose: (x: CaptureExtraction, d: CaptureDerived) => Proposal<F>[];
  apply: (
    proposals: Proposal<F>[],
    opts: { includeReview?: boolean; force?: boolean },
  ) => ApplyOutcome<F>;
  /** Une analyse est arrivée et a été appliquée (pour les corrections, les doublons). */
  onResult?: (run: CaptureRun, outcome: ApplyOutcome<F>) => void;
  /** Ce que le parent veut montrer sous le résumé (doublon probable…). */
  children?: ReactNode;
  /** Une analyse déjà faite (capture venue de l'Inbox, banc visuel) : appliquée au montage, sans appel serveur. */
  previewRun?: CaptureRun;
}

const KIND_BADGE: Record<ProposalKind, "accent" | "neutral" | "warning"> = {
  detected: "accent",
  calculated: "neutral",
  estimated: "neutral",
  needs_review: "warning",
};

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

export function CaptureAssist<F extends string>(props: CaptureAssistProps<F>) {
  const { t, lang } = useT();
  const analysis = useCaptureAnalysis();
  const { busy, error, analyze } = analysis;
  const run = analysis.run ?? props.previewRun ?? null;
  const dictation = useDictation(lang);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [fromVoice, setFromVoice] = useState(false);
  const [outcome, setOutcome] = useState<ApplyOutcome<F> | null>(null);
  const [pendingReview, setPendingReview] = useState<Proposal<F>[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const label = (f: string) => t(`capture.field.${f}` as TKey) || f;

  const settle = (res: CaptureRun) => {
    const proposals = props.propose(res.extraction, res.derived);
    const out = props.apply(proposals, {});
    setOutcome(out);
    const appliedFields = new Set(out.applied.map((p) => p.field));
    const conflictFields = new Set(out.conflicts.map((p) => p.field));
    setPendingReview(
      proposals.filter(
        (p) =>
          p.kind === "needs_review" && !appliedFields.has(p.field) && !conflictFields.has(p.field),
      ),
    );
    props.onResult?.(res, out);
  };
  const previewed = useRef(false);
  useEffect(() => {
    if (!props.previewRun || previewed.current) return;
    previewed.current = true;
    settle(props.previewRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async (force = false) => {
    const res = await analyze({
      paths: props.paths,
      note,
      source: props.paths.length ? "image" : fromVoice ? "voice" : "note",
      target: props.target,
      accountId: props.accountId,
      hints: props.hints,
      plannedRiskDollars: props.plannedRiskDollars,
      force,
    });
    if (res) settle(res);
  };

  const applyOne = (p: Proposal<F>, force: boolean) => {
    const out = props.apply([p], force ? { force: true } : { includeReview: true });
    setOutcome((o) =>
      o
        ? {
            applied: [...o.applied.filter((a) => a.field !== p.field), ...out.applied],
            conflicts: o.conflicts.filter((c) => c.field !== p.field),
          }
        : out,
    );
    setPendingReview((r) => r.filter((x) => x.field !== p.field));
  };

  const hasInput = props.paths.length > 0 || note.trim().length > 0;
  const proposals = run ? props.propose(run.extraction, run.derived) : [];
  const missing = run ? missingFields(proposals, props.essential) : [];
  const d = run?.derived;
  const x = run?.extraction;
  const tf = x?.timeframe.value;

  return (
    <section
      aria-labelledby="capture-assist-title"
      className="mb-3 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-2.5 md:p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ScanLine className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" aria-hidden />
        <h3 id="capture-assist-title" className="tv-label min-w-0 flex-1 text-slate-200">
          {t("capture.title")}
        </h3>
        {props.canAddMore && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={props.uploading}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t("capture.add")}</span>
          </Button>
        )}
        {dictation.supported && (
          <Button
            variant="subtle"
            size="sm"
            aria-pressed={dictation.listening}
            onClick={() =>
              dictation.listening
                ? dictation.stop()
                : dictation.start((text) => {
                    setNote((n) => (n ? `${n} ${text}` : text));
                    setFromVoice(true);
                  })
            }
          >
            {dictation.listening ? (
              <Square className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Mic className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">
              {dictation.listening ? t("capture.stopDictate") : t("capture.dictate")}
            </span>
          </Button>
        )}
        {(hasInput || run) && (
          <Button
            variant={run ? "subtle" : "accent"}
            size="sm"
            disabled={!hasInput || busy || props.uploading}
            onClick={() => void start(!!run)}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : run ? (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            ) : null}
            {run ? t("capture.reanalyze") : t("capture.analyze")}
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) props.onAddFiles(files);
            e.target.value = "";
          }}
        />
      </div>

      {!run && !busy && !error && props.paths.length === 0 && !note && !dictation.listening && (
        <p className="mt-1.5 text-[12px] leading-snug text-slate-500">{t("capture.hint")}</p>
      )}

      {(showNote || note || dictation.listening) && (
        <div className="mt-2">
          <Textarea
            aria-label={t("capture.notePh")}
            value={
              dictation.listening && dictation.interim
                ? `${note} ${dictation.interim}`.trim()
                : note
            }
            onChange={(e) => {
              setNote(e.target.value);
              setFromVoice(false);
            }}
            placeholder={t("capture.notePh")}
            rows={2}
            maxGrowPx={140}
          />
          {dictation.listening && (
            <p className="mt-1 text-[11px] text-[var(--tv-highlight)]" aria-live="polite">
              {t("capture.listening")}
            </p>
          )}
        </div>
      )}
      {!showNote && !note && !dictation.listening && props.paths.length === 0 && (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="mt-1 -my-1 inline-flex min-h-[32px] items-center text-[12px] text-slate-400 underline-offset-2 hover:text-white hover:underline"
        >
          {t("capture.notePh")}
        </button>
      )}
      {dictation.denied && (
        <p className="mt-1 text-[11px] text-amber-400">{t("capture.micDenied")}</p>
      )}

      <div aria-live="polite">
        {busy && <p className="mt-2 text-[12px] text-slate-400">{t("capture.analyzing")}</p>}
        {error && !busy && (
          <p
            className={cn(
              "mt-2 text-[12px]",
              error === "nothing" ? "text-slate-400" : "text-amber-400",
            )}
          >
            {t(`capture.error.${error}` as TKey)}
          </p>
        )}
      </div>

      {run && outcome && !busy && (
        <div className="mt-2 space-y-2">
          <p className="tv-figure text-[12px] text-slate-300">
            {fill(t("capture.summary"), {
              applied: outcome.applied.length,
              review: pendingReview.length + outcome.conflicts.length,
              missing: missing.length,
            })}
            {run.cached && <span className="text-slate-500"> · {t("capture.cached")}</span>}
          </p>

          {(outcome.applied.length > 0 ||
            pendingReview.length > 0 ||
            outcome.conflicts.length > 0) && (
            <ul className="grid gap-1 sm:grid-cols-2">
              {outcome.applied.map((p) => (
                <ProposalRow
                  key={`a-${p.field}`}
                  label={label(p.field)}
                  proposal={p}
                  kindLabel={t(
                    p.evidence?.startsWith("learned:")
                      ? "capture.kind.learned"
                      : (`capture.kind.${p.kind}` as TKey),
                  )}
                />
              ))}
              {pendingReview.map((p) => (
                <ProposalRow
                  key={`r-${p.field}`}
                  label={label(p.field)}
                  proposal={p}
                  kindLabel={t("capture.kind.needs_review")}
                  action={
                    <Button variant="subtle" size="sm" onClick={() => applyOne(p, false)}>
                      {t("capture.apply")}
                    </Button>
                  }
                />
              ))}
              {outcome.conflicts.map((p) => (
                <ProposalRow
                  key={`c-${p.field}`}
                  label={label(p.field)}
                  proposal={p}
                  kindLabel={t(`capture.kind.${p.kind}` as TKey)}
                  action={
                    <Button variant="subtle" size="sm" onClick={() => applyOne(p, true)}>
                      {t("capture.replace")}
                    </Button>
                  }
                />
              ))}
            </ul>
          )}

          {missing.length > 0 && (
            <p className="text-[12px] text-slate-500">
              {t("capture.missingLabel")} {missing.map(label).join(" · ")}
            </p>
          )}

          {d && (
            <p className="tv-figure text-[12px] leading-relaxed text-slate-400">
              {[
                d.contract &&
                  fill(t("capture.derived.contract"), {
                    symbol: d.contract.symbol,
                    tick: d.contract.tickSize,
                    value: d.contract.tickValue,
                  }),
                d.riskDollars.value !== null &&
                  [
                    fill(t("capture.derived.risk"), { risk: d.riskDollars.value }),
                    d.plannedRiskDollars.value !== null
                      ? fill(t("capture.derived.plannedRisk"), {
                          planned: d.plannedRiskDollars.value,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                d.contractsForPlannedRisk.value !== null &&
                  fill(t("capture.derived.contracts"), { n: d.contractsForPlannedRisk.value }),
                d.plannedR.value !== null &&
                  fill(t("capture.derived.plannedR"), { r: d.plannedR.value }),
                d.elapsedMinutes.value !== null &&
                  fill(t("capture.derived.duration"), { minutes: d.elapsedMinutes.value }),
                d.theoreticalCandles.value !== null &&
                  tf &&
                  TIMEFRAME_MINUTES[tf] &&
                  `${fill(t("capture.derived.candles"), { n: d.theoreticalCandles.value, tf })}, ${t("capture.derived.candlesActual")}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {x &&
            x.confluences.some((c) => c.state === "visual_confirmed" || c.state === "probable") && (
              <div className="flex flex-wrap gap-1">
                {x.confluences
                  .filter((c) => c.state === "visual_confirmed" || c.state === "probable")
                  .map((c) => (
                    <Badge
                      key={c.key}
                      variant={c.state === "visual_confirmed" ? "accent" : "neutral"}
                    >
                      {CONFLUENCE_LABELS[c.key]}
                      <span className="font-medium opacity-70">
                        {t(`capture.conf.${c.state}` as TKey)}
                      </span>
                    </Badge>
                  ))}
              </div>
            )}

          {x?.warnings.length ? (
            <ul className="space-y-0.5">
              {x.warnings.map((w) => (
                <li key={w} className="text-[12px] text-amber-400">
                  {t(`capture.warn.${w}` as TKey)}
                </li>
              ))}
            </ul>
          ) : null}

          {x?.summary && <p className="text-[12px] italic text-slate-500">{x.summary}</p>}

          {props.children}
        </div>
      )}
    </section>
  );
}

function ProposalRow({
  label,
  proposal,
  kindLabel,
  action,
}: {
  label: string;
  proposal: Proposal<string>;
  kindLabel: string;
  action?: ReactNode;
}) {
  const value = Array.isArray(proposal.value) ? proposal.value.join(", ") : proposal.value;
  return (
    <li className="flex min-h-[36px] items-center gap-2 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1">
      <span className="tv-row-label w-20 shrink-0 truncate">{label}</span>
      <span
        className="tv-figure min-w-0 flex-1 truncate text-[13px] text-white"
        title={
          proposal.evidence && !proposal.evidence.startsWith("learned:")
            ? proposal.evidence
            : undefined
        }
      >
        {value}
      </span>
      <Badge variant={KIND_BADGE[proposal.kind]} className="shrink-0 px-2 py-0.5">
        {kindLabel}
      </Badge>
      {action}
    </li>
  );
}
