import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Loader2, Shuffle, SlidersHorizontal, X } from "@/shared/ui/icons";
import { Trade } from "@/app/types";
import { useT } from "@/app/i18n/LanguageContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { cn } from "@/shared/ui/cn";
import { usePageActions } from "@/app/contexts/PageActionsContext";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { PageContainer, Kpi, KpiGrid, Modal } from "@/shared/ui";
import { splitCleanTrades } from "@/app/features/mistakes/mistakePlan";
import {
  parseCsv,
  guessMapping,
  mapRowsToTrades,
  rejectFile,
  MC_REQUIRED,
} from "@/app/features/journal/csvImport";
import { extractRSamples, deriveRFromPnl, type RMultipleSample } from "./monteCarloEngine";
import {
  dollarPerR,
  expectancyR,
  modelFromSamples,
  poolsFromSamples,
  syntheticPools,
  type EdgeModel,
} from "./strategy";
import { riskLevels } from "./simulation";
import { changedKeys, configOf, modelOfPlan, roundPlan, type Plan } from "./plan";
import { useSimulation, type RunInput } from "./useSimulation";
import { FanChart } from "./FanChart";
import { EdgeMap, EdgePanel } from "./EdgeCards";
import { RiskCurve } from "./RiskCurve";
import { PlanPanel } from "./PlanPanel";
import { formatMoney } from "./format";

interface Props {
  trades: Trade[];
}

/** Dix mille comptes : l'erreur sur un taux tombe sous ±0,5 point. */
const RUNS = 10_000;
/** Le scénario de départ, pour les écarts : assez pour un écart lisible. */
const BASE_RUNS = 4_000;
/** Chaque niveau de risque du balayage. */
const SWEEP_RUNS = 1_200;
/** La forme modèle, quand il n'y a pas (encore) de trades. */
const SYNTH = syntheticPools();
const MODEL_DEFAULT: EdgeModel = { winRate: 0.5, beRate: 0.05, avgWinR: 1.5, avgLossR: 1 };

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * MONTE-CARLO — « ma stratégie, jouée dix mille fois : où va mon compte ? »
 *
 * ══ CE QUE LA REFONTE CHANGE ══
 *
 * La page parlait trop et ne laissait rien planifier. Une quinzaine de blocs
 * de texte (lancement en trois étapes, lecture en phrases, « données
 * utilisées », « ce qui est rejoué »…), quatre graphes séparés pour un même
 * tirage, 2 000 comptes dont 24 trajectoires grises — et pour essayer une
 * autre stratégie, il fallait quitter ses propres trades pour une saisie à la
 * main.
 *
 *   1. ELLE S'OUVRE SUR LA RÉPONSE. Le plan est prérempli depuis le journal
 *      (taux, gain et perte moyens, neutres, cadence, risque réel en R) et la
 *      simulation part seule. L'écran de lancement a disparu : le panneau dit
 *      d'emblée sur quoi porte le calcul, et combien de trades le portent.
 *   2. DIX MILLE COMPTES, TOUS VISIBLES. Le faisceau (`FanChart`) est une
 *      carte de densité de toutes les trajectoires, teintée par leur issue,
 *      avec la médiane, l'enveloppe neuf-sur-dix, les murs et l'arrivée. Il
 *      se remplit pendant le calcul — découpé en tranches, l'écran ne gèle
 *      jamais (`useSimulation`).
 *   3. LA STRATÉGIE SE PLANIFIE. Chaque métrique se modifie ; les trades du
 *      trader sont redimensionnés, pas remplacés (`strategy.ts`). Les quatre
 *      chiffres disent l'écart avec le point de départ, et la médiane d'avant
 *      reste tracée en pointillé.
 *   4. L'EDGE S'EXPLIQUE EN IMAGES. L'équation gains − pertes et le point
 *      mort (`EdgePanel`), la carte de toutes les stratégies possibles où l'on
 *      clique pour en essayer une (`EdgeMap`), et la courbe « combien
 *      risquer » calculée à onze niveaux (`RiskCurve`).
 *
 * Tout chiffre de la page sort du moteur ; aucun n'est écrit à la main.
 */
export default function MonteCarloPage({ trades }: Props) {
  const { t } = useT();
  const { activeAccount } = useAccounts();
  const { boxRef, height } = useAvailableHeight();
  const [editOpen, setEditOpen] = useState(false);

  /* ══ LA SOURCE — le journal, ou un CSV déposé ══════════════════════════
     Le journal passe par `deriveRFromPnl` comme un CSV : un journal importé
     d'un courtier ne porte pas toujours de R, et des R nuls donnaient une
     simulation parfaitement plate. */
  const journalDerived = useMemo(() => deriveRFromPnl(trades), [trades]);
  const journalSamples = useMemo(() => extractRSamples(journalDerived), [journalDerived]);
  const [csv, setCsv] = useState<{ name: string; samples: RMultipleSample[] } | null>(null);
  const [csvErreur, setCsvErreur] = useState<string | null>(null);
  const samples = csv?.samples ?? journalSamples;
  const realPools = useMemo(() => poolsFromSamples(samples), [samples]);
  const real = samples.length >= 5 && realPools !== null;
  const pools = real && realPools ? realPools : SYNTH;
  const sourceModel = useMemo(
    () => (real ? modelFromSamples(samples) : MODEL_DEFAULT),
    [real, samples],
  );

  /* ══ LE PLAN DE DÉPART — lu dans les trades ════════════════════════════
     Le risque par trade est ce que vaut UN R chez ce trader (médiane de
     |P&L ÷ R|), rapporté au solde de son compte actif ; la cadence, son
     nombre de trades par journée tradée. */
  const lu = useMemo<Plan>(() => {
    const balance = Math.max(1000, Math.round(activeAccount?.startingBalance || 10_000));
    const perR = real ? dollarPerR(samples) : null;
    const riskPct = Math.min(5, Math.max(0.05, perR ? (perR / balance) * 100 : 1));
    const jours = new Set(trades.map((tr) => tr.date)).size;
    const parJour = !csv && jours > 0 ? trades.length / jours : 3;
    return roundPlan({
      winRate: sourceModel.winRate * 100,
      avgWinR: Math.max(0.1, sourceModel.avgWinR),
      avgLossR: Math.max(0.1, sourceModel.avgLossR),
      beRate: sourceModel.beRate * 100,
      tradesPerDay: parJour,
      balance,
      riskPct,
      days: 30,
      targetPct: 10,
      limitPct: 10,
    });
  }, [activeAccount?.startingBalance, real, samples, sourceModel, trades, csv]);
  /* LE MÊME PLAN GARDE LA MÊME RÉFÉRENCE. Le tableau `trades` change
     d'identité à chaque mise à jour du store, même sans changer de contenu :
     sans cette clé, chaque rafraîchissement relançait dix mille tirages. */
  const cle = JSON.stringify(lu);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => lu, [cle]);

  const [plan, setPlan] = useState<Plan>(base);
  // Le plan de départ arrive après le premier rendu (le compte se charge en
  // parallèle) : on l'adopte tant que le trader n'a rien touché.
  const touche = useRef(false);
  useEffect(() => {
    if (!touche.current) setPlan(base);
  }, [base]);
  const modifier = useCallback((patch: Partial<Plan>) => {
    touche.current = true;
    setPlan((p) => ({ ...p, ...patch }));
  }, []);
  const reinitialiser = useCallback(() => {
    touche.current = false;
    setPlan(base);
  }, [base]);

  /* « SANS MES ERREURS » — les métriques de ses trades sans erreur cochée,
     quand il y en a assez pour comparer. Même forme, même compte : seule
     l'edge change. */
  const clean = useMemo(() => {
    if (csv) return null;
    const sep = splitCleanTrades(journalDerived);
    if (!sep.comparable) return null;
    const s = extractRSamples(sep.clean);
    if (!poolsFromSamples(s)) return null;
    const m = modelFromSamples(s);
    const edge = roundPlan({
      ...base,
      winRate: m.winRate * 100,
      avgWinR: Math.max(0.1, m.avgWinR),
      avgLossR: Math.max(0.1, m.avgLossR),
      beRate: m.beRate * 100,
    });
    return { n: sep.clean.length, edge };
  }, [csv, journalDerived, base]);
  const cleanActive =
    !!clean &&
    plan.winRate === clean.edge.winRate &&
    plan.avgWinR === clean.edge.avgWinR &&
    plan.avgLossR === clean.edge.avgLossR &&
    plan.beRate === clean.edge.beRate;

  /** Lecture d'un fichier — le module d'import du produit fait tout le travail. */
  const lireCsv = useCallback(
    async (file: File) => {
      setCsvErreur(null);
      const refus = rejectFile({ name: file.name, size: file.size, type: file.type });
      if (refus) {
        setCsvErreur(t(`mc.csv_${refus}` as never));
        return;
      }
      try {
        const { headers, rows } = parseCsv(await file.text());
        const mapping = guessMapping(headers);
        // Monte-Carlo n'exige que le résultat (voir `MC_REQUIRED`).
        const { valid } = mapRowsToTrades(rows, mapping, { required: MC_REQUIRED });
        if (mapping.pnl === undefined) {
          setCsvErreur(t("mc.csvNoPnl").replace("{cols}", headers.slice(0, 8).join(", ")));
          return;
        }
        if (valid.length < 5) {
          setCsvErreur(t("mc.csv_tooFew").replace("{n}", String(valid.length)));
          return;
        }
        const lus = extractRSamples(deriveRFromPnl(valid));
        // Sans au moins un gain ET une perte, il n'y a pas de forme à rejouer :
        // mieux vaut le dire que simuler une stratégie modèle sous son nom.
        if (!poolsFromSamples(lus)) {
          setCsvErreur(t("mc.csvNeedsBoth"));
          return;
        }
        touche.current = false;
        setCsv({ name: file.name, samples: lus });
      } catch {
        setCsvErreur(t("mc.csv_unreadable"));
      }
    },
    [t],
  );

  /* ══ LE CALCUL ══════════════════════════════════════════════════════════
     La même graine pour tout : le plan, le départ et chaque niveau de risque
     voient les mêmes hasards — les écarts affichés viennent des réglages. */
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 1_000_000));
  const changed = changedKeys(plan, base).length > 0;
  const input = useMemo<RunInput>(
    () => ({
      main: configOf(plan, pools, RUNS, seed),
      baseline: changed ? configOf(base, pools, BASE_RUNS, seed) : null,
      sweep: { cfg: configOf(plan, pools, SWEEP_RUNS, seed), levels: riskLevels(plan.riskPct) },
    }),
    [plan, base, pools, seed, changed],
  );
  const run = useSimulation(input);
  const s = run.summary;
  const before = changed && run.baseline ? run.baseline.summary : null;
  const generating = !!run.sim && !run.sim.finished;
  const model = modelOfPlan(plan);
  const negatif = expectancyR(model) < 0;

  const actions = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditOpen(true)} className="mc-alt lg:hidden">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t("mc.planTitle")}
        </button>
        <button
          type="button"
          onClick={() => setSeed((v) => v + 1)}
          disabled={run.running}
          className="mc-rerun"
          title={t("mc.rerunHint")}
        >
          {run.running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shuffle className="h-3.5 w-3.5" />
          )}
          {t("mc.rerun")}
        </button>
      </div>
    ),
    [run.running, t],
  );
  usePageActions(actions);

  const source = csv
    ? { kind: "csv" as const, label: csv.name, n: csv.samples.length }
    : real
      ? { kind: "journal" as const, label: t("mc.srcJournal"), n: journalSamples.length }
      : { kind: "model" as const, label: t("mc.srcModel"), n: 0 };

  const panneau = (
    <PlanPanel
      plan={plan}
      base={base}
      onChange={modifier}
      onReset={reinitialiser}
      source={source}
      clean={clean ? { n: clean.n, active: cleanActive } : null}
      onCleanPreset={() => clean && modifier(clean.edge)}
      onCsv={lireCsv}
      onCsvClear={() => {
        touche.current = false;
        setCsv(null);
        setCsvErreur(null);
      }}
      csvError={csvErreur}
    />
  );

  return (
    <PageContainer
      ref={boxRef}
      style={height ? { minHeight: height } : undefined}
      className="flex h-full flex-col overflow-y-auto"
    >
      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_316px]">
        <div className="flex min-w-0 flex-col gap-3">
          {/* ══ LES DIX MILLE FUTURS ══ */}
          <section className="mc-card mc-hero animate-fade-in-up">
            <KpiGrid cols={4}>
              <Kpi
                inset
                label={t("mc.probTarget")}
                value={s ? pct(s.passRate) : "—"}
                tone={s && s.passRate >= 0.5 ? "pos" : "neutral"}
                hint={
                  <Ecart
                    d={s && before ? s.passRate - before.passRate : null}
                    text={
                      s?.daysToTarget
                        ? t("mc.hintDays").replace("{d}", String(s.daysToTarget.p50))
                        : t("mc.hintNoTarget")
                    }
                  />
                }
              />
              <Kpi
                inset
                label={t("mc.probLimit")}
                value={s ? pct(s.failRate) : "—"}
                tone={s && s.failRate > 0.3 ? "neg" : "neutral"}
                hint={
                  <Ecart
                    d={s && before ? s.failRate - before.failRate : null}
                    inverse
                    text={s ? t("mc.hintStreak").replace("{n}", String(s.streak.p95)) : ""}
                  />
                }
              />
              <Kpi
                inset
                label={t("mc.probProfit")}
                value={s ? pct(s.profitRate) : "—"}
                hint={
                  <Ecart
                    d={s && before ? s.profitRate - before.profitRate : null}
                    text={t("mc.probProfitHint").replace("{h}", String(plan.days))}
                  />
                }
              />
              <Kpi
                inset
                label={t("mc.medianDD")}
                value={s ? formatMoneyNeg(s.dd.p50) : "—"}
                tone="neg"
                hint={s ? `${t("mc.worst5")} ${formatMoneyNeg(s.dd.p95)}` : undefined}
              />
            </KpiGrid>

            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="tv-title">{t("mc.fanTitle").replace("{n}", RUNS.toLocaleString())}</h2>
              <span
                className={cn(
                  "tv-figure text-xs",
                  generating ? "text-[var(--tv-highlight)]" : "text-slate-500",
                )}
              >
                {generating && run.sim
                  ? t("mc.generating")
                      .replace("{k}", run.sim.done.toLocaleString())
                      .replace("{n}", RUNS.toLocaleString())
                  : s
                    ? t("mc.margin").replace("{se}", (s.se * 100).toFixed(1))
                    : ""}
              </span>
            </div>
            <div className="mt-2">
              <FanChart
                sim={run.sim}
                bands={run.bandsOf === run.sim ? run.bands : null}
                baseline={changed ? run.baseline : null}
                running={run.running}
              />
            </div>
            <Legende avant={changed && !!run.baseline} />

            {s && (
              <p className={cn("tv-prose mt-3", negatif ? "rp-neg" : "text-slate-300")}>
                {negatif
                  ? t("mc.verdictNeg")
                  : t("mc.verdict")
                      .replace("{runs}", RUNS.toLocaleString())
                      .replace("{pass}", pct(s.passRate))
                      .replace("{obj}", String(plan.targetPct))
                      .replace("{lim}", String(plan.limitPct))
                      .replace("{h}", String(plan.days))}
              </p>
            )}
          </section>

          {/* ══ L'EDGE, EXPLIQUÉ ══ */}
          <div className="grid gap-3 xl:grid-cols-2">
            <EdgePanel
              model={model}
              pools={pools}
              n={source.n}
              risk={(plan.balance * plan.riskPct) / 100}
              sourceLabel={source.label}
            />
            <EdgeMap
              plan={model}
              base={real ? modelOfPlan(base) : null}
              onPick={(wr, rr) =>
                modifier({
                  winRate: Math.round(wr * 100),
                  avgWinR: Math.round(rr * plan.avgLossR * 100) / 100,
                })
              }
            />
          </div>

          <RiskCurve
            points={run.sweep}
            currentPct={plan.riskPct}
            runsPer={SWEEP_RUNS}
            stale={run.running}
            onPick={(riskPct) => modifier({ riskPct })}
          />
        </div>

        {/* LE PLAN — à côté sur bureau (on voit le faisceau bouger en le
            touchant), dans une fenêtre sur téléphone. */}
        <aside className="mc-plan hidden lg:block">
          <div className="mc-plan-inner">{panneau}</div>
        </aside>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        className="max-h-[88dvh] overflow-hidden md:max-w-lg"
        labelledBy="mc-edit-title"
      >
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b border-[var(--tv-border)] px-5 py-4">
            <h2 id="mc-edit-title" className="tv-title">
              {t("mc.planTitle")}
            </h2>
            <button
              onClick={() => setEditOpen(false)}
              className="tv-pop-nav"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{panneau}</div>
          <div className="flex justify-end border-t border-[var(--tv-border)] px-5 py-3">
            <button
              onClick={() => setEditOpen(false)}
              className="tv-accent-fill inline-flex h-9 items-center rounded-xl px-4 text-sm font-semibold"
            >
              {t("common.done")}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

/** Une baisse s'écrit avec son signe : « −840 $ », pas « 840 $ ». */
function formatMoneyNeg(v: number) {
  return v > 0 ? `−${formatMoney(v)}` : formatMoney(0);
}

/**
 * L'ÉCART AVEC LE DÉPART — en points, jamais en % d'un %.
 * « +45 % » sur un taux qui passe de 40 à 58 est vrai et illisible ; des
 * POINTS se lisent sans ambiguïté. `inverse` : pour la limite, plus est pire.
 */
function Ecart({ d, inverse, text }: { d: number | null; inverse?: boolean; text: string }) {
  const { t } = useT();
  const pts = d === null ? 0 : Math.round(d * 100);
  return (
    <span>
      {d !== null && pts !== 0 && (
        <span className={cn("tv-figure", pts > 0 !== !!inverse ? "rp-pos" : "rp-neg")}>
          {t("mc.deltaPts").replace("{d}", `${pts > 0 ? "+" : "−"}${Math.abs(pts)}`)}
          {text ? " · " : ""}
        </span>
      )}
      {text}
    </span>
  );
}

function Legende({ avant }: { avant: boolean }) {
  const { t } = useT();
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <Swatch cls="mc-sw-median" label={t("mc.legendMedian")} />
      <Swatch cls="mc-sw-p90" label={t("mc.legend90")} />
      <Swatch cls="mc-sw-band" label={t("mc.legend50")} />
      {avant && <Swatch cls="mc-sw-before" label={t("mc.legendBefore")} />}
      <Swatch cls="mc-sw-pos" label={t("mc.legendPass")} />
      <Swatch cls="mc-sw-neg" label={t("mc.legendFail")} />
    </div>
  );
}

function Swatch({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("mc-sw", cls)} />
      <span className="tv-row-label">{label}</span>
    </span>
  );
}
