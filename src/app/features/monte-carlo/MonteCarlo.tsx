import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Button,
  Card,
  EmptyState,
  Kpi,
  KpiGrid,
  Modal,
  PageContainer,
  SelectPicker,
  SubNav,
  InfoTip,
  Field,
  Input,
} from "@/shared/ui";
import {
  ArrowRight,
  Bookmark,
  Check,
  Dices,
  FlaskConical,
  Loader2,
  SlidersHorizontal,
  Upload,
  X,
} from "@/shared/ui/icons";
import type { Trade } from "@/app/types";
import { useT } from "@/app/i18n/LanguageContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { formatMoney } from "@/shared/currency";
import { numericText } from "@/shared/ui/NumericText";
import { nsKey, readJSON, writeJSON } from "@/app/utils/persistence";
import { rejectFile } from "@/app/features/journal/csvImport";
import { readStrategyCsv } from "./strategyCsv";
import {
  historicalModel,
  plannedModel,
  strategyEdge,
  validStrategyConfig,
  type StrategyConfig,
  type StrategyMetrics,
  type StrategyModel,
} from "@/modules/probability/strategy";
import { StrategyChart, type ProjectionBaseline, type ProjectionView } from "./StrategyChart";
import { StrategyEditor } from "./StrategyEditor";
import { StrategyDetails } from "./StrategyDetails";
import { useStrategyProjection } from "./useStrategyProjection";

type Source = "journal" | "manual" | "csv";
const DEFAULT_METRICS: StrategyMetrics = {
  winRate: 0.5,
  avgWinR: 1.5,
  avgLossR: 1,
  breakEvenRate: 0,
};
interface SavedPlan {
  version: 1;
  name: string;
  config: StrategyConfig;
  metrics: StrategyMetrics;
  reference?: number[];
}

/** Le compte est une frontière : un changement remonte le laboratoire et
 * abandonne le Worker, la comparaison et le brouillon du compte précédent. */
export default function MonteCarloPage({ trades }: { trades: Trade[] }) {
  const { activeAccount, activeId } = useAccounts();
  const { user } = useAuth();
  return (
    <StrategyLab
      key={`${user?.id}:${activeId}`}
      trades={trades}
      accountBalance={Math.max(100, activeAccount?.startingBalance || 10000)}
      storageKey={nsKey(user?.id, `mc-plan-v1.${activeId ?? "main"}`)}
    />
  );
}

function StrategyLab({
  trades,
  accountBalance,
  storageKey,
}: {
  trades: Trade[];
  accountBalance: number;
  storageKey: string;
}) {
  const { t } = useT();
  const { boxRef, height } = useAvailableHeight();
  const [source, setSource] = useState<Source | null>(null),
    [strategy, setStrategy] = useState("all");
  const [csv, setCsv] = useState<{ model: StrategyModel; name: string } | null>(null),
    [csvError, setCsvError] = useState("");
  const [metrics, setMetrics] = useState<StrategyMetrics>(DEFAULT_METRICS),
    [reference, setReference] = useState<number[]>([]);
  const [view, setView] = useState<ProjectionView>("capital"),
    [cloud, setCloud] = useState(true),
    [editOpen, setEditOpen] = useState(false),
    [detailsOpen, setDetailsOpen] = useState(false);
  const [baseline, setBaseline] = useState<ProjectionBaseline | null>(null),
    [planOpen, setPlanOpen] = useState(false),
    [planName, setPlanName] = useState("");
  const [saved, setSaved] = useState<SavedPlan | null>(() => readJSON(storageKey, null));
  const fileInput = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<StrategyConfig>(() => ({
    balance: Math.max(100, accountBalance),
    risk: Math.max(1, Math.round(accountBalance * 0.005)),
    trades: 100,
    perDay: 2,
    extraCost: 0,
    target: Math.round(accountBalance * 0.1),
    lossLimit: Math.round(accountBalance * 0.1),
    dailyLimit: 0,
    drawdownType: "static",
    seed: 204810,
  }));
  const selectedTrades = useMemo(
    () => (strategy === "all" ? trades : trades.filter((tr) => tr.strategy === strategy)),
    [trades, strategy],
  );
  const journal = useMemo(() => historicalModel(selectedTrades), [selectedTrades]);
  const csvModel = csv?.model ?? null;
  const model = useMemo<StrategyModel | null>(
    () =>
      source === "journal"
        ? journal
        : source === "csv"
          ? csvModel
          : source === "manual"
            ? plannedModel(metrics, reference)
            : null,
    [source, journal, csvModel, metrics, reference],
  );
  const { result, running, error, retry } = useStrategyProjection(model, config);
  const liveMetrics = model?.metrics ?? metrics;
  const edge = useMemo(
    () => (model ? strategyEdge(model, config.risk, config.extraCost) : null),
    [model, config.risk, config.extraCost],
  );
  const isDemo =
    source === "journal" && selectedTrades.length > 0 && selectedTrades.every((tr) => tr.isExample);
  const enough = !model || model.kind === "planned" || model.sampleSize >= 5;
  const pct = (v: number) => (v * 100).toFixed(1) + "%";
  const pin = useCallback(() => {
    if (result && !running)
      setBaseline({
        capital: result.capital,
        drawdowns: result.drawdowns,
        objectives: result.objectives,
        config: result.config,
        profitProbability: result.profitProbability,
        medianPnl: result.medianPnl,
        drawdown95: result.drawdown95,
        passProbability: result.passProbability,
      });
  }, [result, running]);
  const chooseJournal = () => {
    setSource("journal");
    setReference([]);
    setBaseline(null);
    const risks = selectedTrades
      .map((tr) => tr.riskAmount)
      .filter((r) => r > 0 && Number.isFinite(r))
      .sort((a, b) => a - b);
    const days = new Set(selectedTrades.map((tr) => tr.date)).size;
    setConfig((c) => ({
      ...c,
      risk: risks.length
        ? Math.min(c.balance, Math.max(1, Math.round(risks[Math.floor(risks.length / 2)])))
        : c.risk,
      perDay: days ? Math.min(10, Math.max(1, Math.round(selectedTrades.length / days))) : c.perDay,
    }));
  };
  const variant = () => {
    if (model) {
      setMetrics({
        ...model.metrics,
        avgWinR: model.metrics.avgWinR || 1.5,
        avgLossR: model.metrics.avgLossR || 1,
      });
      setReference(model.values);
    }
    setSource("manual");
  };
  const setSourceChoice = (next: Source) => {
    setBaseline(null);
    if (next === "journal") chooseJournal();
    else if (next === "manual") variant();
    else {
      setSource("csv");
      if (!csv) fileInput.current?.click();
    }
  };
  const updateConfig = (patch: Partial<StrategyConfig>) =>
    setConfig((c) => {
      const next = { ...c, ...patch };
      if (patch.balance) {
        next.risk = Math.min(next.risk, next.balance);
        next.lossLimit = Math.min(next.lossLimit, next.balance);
        next.dailyLimit = Math.min(next.dailyLimit, next.balance);
      }
      return next;
    });
  const reset = () => {
    setBaseline(null);
    setMetrics(DEFAULT_METRICS);
    setReference([]);
    setConfig((c) => ({
      ...c,
      balance: accountBalance,
      risk: Math.max(1, Math.round(accountBalance * 0.005)),
      trades: 100,
      perDay: 2,
      extraCost: 0,
      target: Math.round(accountBalance * 0.1),
      lossLimit: Math.round(accountBalance * 0.1),
      dailyLimit: 0,
      drawdownType: "static",
    }));
  };
  const importCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCsvError("");
    setBaseline(null);
    const rejected = rejectFile(file);
    if (rejected) {
      setCsvError(t("lab.csvInvalid"));
      return;
    }
    try {
      const prepared = readStrategyCsv(await file.text());
      setCsv({ model: prepared, name: file.name });
      setSource("csv");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setCsvError(
        t(
          code === "NO_PNL"
            ? "lab.csvNoPnl"
            : code === "TOO_FEW"
              ? "lab.csvTooFew"
              : "lab.csvInvalid",
        ),
      );
    }
  };
  const restore = () => {
    if (!saved) return;
    const candidate = saved.config;
    try {
      if (
        saved.version !== 1 ||
        !validStrategyConfig(candidate) ||
        (saved.reference &&
          (!Array.isArray(saved.reference) || saved.reference.some((v) => !Number.isFinite(v))))
      )
        throw Error();
      plannedModel(saved.metrics, saved.reference ?? []);
      setMetrics(saved.metrics);
      setReference(saved.reference ?? []);
      setConfig(candidate);
      setSource("manual");
      setBaseline(null);
      setPlanName(saved.name);
    } catch {
      setSaved(null);
    }
  };
  const save = () => {
    if (!model || !planName.trim()) return;
    const plan: SavedPlan = {
      version: 1,
      name: planName.trim().slice(0, 60),
      config,
      metrics: {
        ...liveMetrics,
        avgWinR: liveMetrics.avgWinR || 1.5,
        avgLossR: liveMetrics.avgLossR || 1,
      },
      reference: model.values,
    };
    writeJSON(storageKey, plan);
    if (JSON.stringify(readJSON(storageKey, null)) !== JSON.stringify(plan)) {
      setCsvError(t("lab.saveError"));
      return;
    }
    setSaved(plan);
    setPlanOpen(false);
  };
  const stress = (what: "risk" | "wr" | "cost") => {
    pin();
    if (what === "risk") updateConfig({ risk: Math.max(1, config.risk / 2) });
    else if (what === "cost") updateConfig({ extraCost: config.extraCost + config.risk * 0.05 });
    else {
      variant();
      setMetrics({
        ...liveMetrics,
        winRate: Math.max(0, liveMetrics.winRate - 0.05),
        avgWinR: liveMetrics.avgWinR || 1.5,
        avgLossR: liveMetrics.avgLossR || 1,
      });
    }
  };
  const canCompare =
    baseline &&
    baseline.config.trades === config.trades &&
    baseline.config.balance === config.balance;
  const editor = (
    <StrategyEditor
      model={model}
      metrics={liveMetrics}
      onMetrics={(patch) => setMetrics((m) => ({ ...m, ...patch }))}
      config={config}
      onConfig={updateConfig}
      onVariant={variant}
      onReset={reset}
      objective={view === "objective"}
    />
  );

  return (
    <PageContainer
      ref={boxRef}
      style={height ? { minHeight: height } : undefined}
      className="strategy-lab flex h-full flex-col overflow-y-auto"
    >
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => void importCsv(e)}
        aria-label={t("lab.importCsv")}
      />
      <div className="strategy-toolbar">
        <div className="strategy-toolbar-lead">
          <FlaskConical className="h-4 w-4 text-[var(--tv-highlight)]" />
          <h2>{t("lab.title")}</h2>
          {source && <span className="strategy-run-count tv-figure">10 000</span>}
        </div>
        {source && (
          <div className="strategy-toolbar-actions">
            <SelectPicker
              label={t("mc.source")}
              value={source}
              onChange={setSourceChoice}
              options={[
                { value: "journal", label: t("lab.journal") },
                { value: "manual", label: t("lab.scenario") },
                { value: "csv", label: t("lab.csv") },
              ]}
              disabled={false}
            />
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("lab.adjust")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBaseline(null);
                updateConfig({ seed: config.seed + 1 });
              }}
              disabled={running}
              title={t("lab.newDraw")}
              aria-label={t("lab.newDraw")}
            >
              <Dices className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {csvError && (
        <p className="strategy-error" role="alert">
          {csvError}
        </p>
      )}
      {!source ? (
        <Card className="strategy-welcome" pad="loose">
          <span className="strategy-welcome-icon">
            <Dices className="h-6 w-6" />
          </span>
          <h3>{t("lab.welcomeTitle")}</h3>
          <p>{t("lab.welcomeBody")}</p>
          <div className="strategy-welcome-actions">
            <Button onClick={chooseJournal} disabled={journal.sampleSize < 5}>
              {t("lab.runJournal").replace("{n}", String(journal.sampleSize))}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="subtle"
              onClick={() => {
                setSource("manual");
                if (window.matchMedia("(max-width: 1023px)").matches) setEditOpen(true);
              }}
            >
              {t("lab.build")}
            </Button>
            <Button variant="ghost" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" />
              {t("lab.importCsv")}
            </Button>
          </div>
          {saved && (
            <Button variant="ghost" onClick={restore}>
              <Bookmark className="h-3.5 w-3.5" />
              {t("lab.restorePlan")} · {saved.name}
            </Button>
          )}
          {journal.sampleSize < 5 && <p className="tv-prose text-slate-500">{t("lab.minimum")}</p>}
        </Card>
      ) : (
        <div className="strategy-layout">
          <section className="strategy-main" aria-label={t("lab.chartViews")}>
            <div className="strategy-source-line">
              <span className="strategy-provenance">
                {t(isDemo ? "lab.demo" : source === "manual" ? "lab.hypothesis" : "lab.observed")}
              </span>
              <span>
                {source === "csv"
                  ? `${csv?.name} · ${t("lab.sample").replace("{n}", String(model?.sampleSize ?? 0))}`
                  : source === "manual"
                    ? reference.length
                      ? t("lab.calibratedSample").replace("{n}", String(reference.length))
                      : t("lab.fixedOutcomes")
                    : t("lab.sample").replace("{n}", String(journal.sampleSize))}
              </span>
              {model && model.estimated > 0 && (
                <span className="strategy-estimate">
                  {t("lab.estimatedR").replace("{n}", String(model.estimated))}
                  <InfoTip text={t("lab.estimatedHelp")} />
                </span>
              )}
              {source === "journal" && (
                <SelectPicker
                  label={t("lab.strategyFilter")}
                  value={strategy}
                  onChange={(v) => {
                    setStrategy(v);
                    setBaseline(null);
                  }}
                  options={[
                    { value: "all", label: t("lab.allStrategies") },
                    ...Array.from(new Set(trades.map((tr) => tr.strategy).filter(Boolean))).map(
                      (s) => ({ value: s, label: s }),
                    ),
                  ]}
                  neutralValue="all"
                />
              )}
            </div>
            {model && model.kind === "historical" && model.sampleSize < 30 && (
              <p className="strategy-small-sample">
                {t("lab.smallSample").replace("{n}", String(model.sampleSize))}
              </p>
            )}
            {!model ? (
              <EmptyState
                title={t("lab.importCsv")}
                description={t("lab.csvAwaiting")}
                action={
                  <Button onClick={() => fileInput.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {t("lab.importCsv")}
                  </Button>
                }
              />
            ) : !enough ? (
              <EmptyState
                icon={<FlaskConical className="h-6 w-6" />}
                title={t("lab.notEnough")}
                description={t("lab.minimum")}
              />
            ) : error ? (
              <EmptyState
                title={t("lab.computeError")}
                description={t("lab.computeErrorBody")}
                action={<Button onClick={retry}>{t("ai.retry")}</Button>}
              />
            ) : (
              <>
                <Card className="strategy-hero" pad="none" aria-busy={running}>
                  <div className="strategy-hero-top">
                    <SubNav
                      ariaLabel={t("lab.chartViews")}
                      value={view}
                      onChange={setView}
                      items={[
                        { id: "capital", label: t("lab.capital") },
                        { id: "drawdown", label: t("lab.drawdown") },
                        { id: "objective", label: t("lab.target") },
                      ]}
                    />
                    <span className="strategy-calculation" role="status">
                      {running ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t("lab.updating")}
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3" />
                          {t("lab.pathsReady")}
                        </>
                      )}
                    </span>
                  </div>
                  {result ? (
                    <>
                      <KpiGrid cols={4} className="strategy-top-kpis">
                        {view === "objective" ? (
                          <>
                            <Kpi
                              label={t("lab.targetFirst")}
                              value={pct(result.passProbability)}
                              adornment={<InfoTip text={t("lab.targetFirstHelp")} />}
                            />
                            <Kpi
                              label={t("lab.limitFirst")}
                              value={pct(result.failProbability)}
                              tone="neg"
                            />
                            <Kpi label={t("lab.stillOpen")} value={pct(result.openProbability)} />
                            <Kpi
                              label={t("lab.timeToTarget")}
                              value={
                                result.medianTargetTrades === null
                                  ? "—"
                                  : String(result.medianTargetTrades)
                              }
                              hint={t("lab.winnersOnly")}
                              wrapHint
                            />
                          </>
                        ) : (
                          <>
                            <Kpi
                              label={t("lab.medianReturn")}
                              value={formatMoney(result.medianPnl, { signed: true })}
                              tone={
                                result.medianPnl > 0
                                  ? "pos"
                                  : result.medianPnl < 0
                                    ? "neg"
                                    : "neutral"
                              }
                            />
                            <Kpi
                              label={t("lab.finishPositive")}
                              value={pct(result.profitProbability)}
                              adornment={<InfoTip text={t("lab.profitHelp")} />}
                            />
                            <Kpi
                              label={t("lab.dd95")}
                              value={formatMoney(result.drawdown95)}
                              tone="neg"
                              adornment={<InfoTip text={t("lab.dd95Help")} />}
                            />
                            <Kpi
                              label={t("lab.lossRun95")}
                              value={String(Math.round(result.longestStreak95))}
                              hint={t("lab.lossTrades")}
                              adornment={<InfoTip text={t("lab.streakHelp")} />}
                            />
                          </>
                        )}
                      </KpiGrid>
                      <StrategyChart
                        result={result}
                        view={view}
                        baseline={canCompare ? baseline : null}
                        cloud={cloud}
                      />
                      <div className="strategy-chart-actions">
                        <label className="strategy-check">
                          <input
                            type="checkbox"
                            checked={cloud}
                            onChange={(e) => setCloud(e.target.checked)}
                          />
                          {t("lab.showCloud")}
                        </label>
                        <Button
                          variant={baseline ? "accent" : "ghost"}
                          size="sm"
                          onClick={pin}
                          disabled={running}
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          {t("lab.pinReference")}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="strategy-chart-loading" role="status">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("lab.calculating")}
                    </div>
                  )}
                </Card>
                {edge && (
                  <div className="strategy-edge-summary">
                    <span className={edge.netExpectancyR > 0 ? "rp-pos" : "rp-neg"}>
                      {t(edge.netExpectancyR > 0 ? "lab.positiveEdge" : "lab.negativeEdge")}
                    </span>
                    <span className="tv-figure">
                      {edge.netExpectancyR >= 0 ? "+" : ""}
                      {edge.netExpectancyR.toFixed(3)}R / {t("mc.tradeWord")}
                    </span>
                    <InfoTip text={t("lab.edgeHelp")} />
                  </div>
                )}
                {baseline && result && (
                  <Card pad="tight" className="strategy-comparison">
                    <div>
                      <h3>{t("lab.comparison")}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBaseline(null)}
                        aria-label={t("common.close")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {canCompare ? (
                      <KpiGrid cols={view === "objective" ? 2 : 4}>
                        <Kpi
                          label={t("lab.medianDelta")}
                          value={formatMoney(result.medianPnl - baseline.medianPnl, {
                            signed: true,
                          })}
                        />
                        <Kpi
                          label={t("lab.probDelta")}
                          value={`${(result.profitProbability - baseline.profitProbability) * 100 >= 0 ? "+" : ""}${((result.profitProbability - baseline.profitProbability) * 100).toFixed(1)} ${t("lab.pp")}`}
                        />
                        {view !== "objective" && (
                          <>
                            <Kpi
                              label={t("lab.ddDelta")}
                              value={formatMoney(result.drawdown95 - baseline.drawdown95, {
                                signed: true,
                              })}
                            />
                            <Kpi
                              label={t("lab.targetDelta")}
                              value={`${((result.passProbability - baseline.passProbability) * 100).toFixed(1)} ${t("lab.pp")}`}
                            />
                          </>
                        )}
                      </KpiGrid>
                    ) : (
                      <p className="tv-prose text-slate-400">{t("lab.incomparable")}</p>
                    )}
                  </Card>
                )}
                {result && (
                  <Card className="strategy-stress" pad="tight">
                    <span className="tv-label text-slate-500">{t("lab.stressTitle")}</span>
                    <div>
                      <Button
                        variant="subtle"
                        size="sm"
                        disabled={running}
                        onClick={() => stress("risk")}
                      >
                        {t("lab.halfRisk")}
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        disabled={running}
                        onClick={() => stress("wr")}
                      >
                        {t("lab.lowerWR")}
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        disabled={running}
                        onClick={() => stress("cost")}
                      >
                        {t("lab.higherCost")}
                      </Button>
                    </div>
                  </Card>
                )}
                {result && (
                  <details
                    className="strategy-disclosure"
                    onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
                  >
                    <summary>
                      {t("lab.understandEdge")}
                      <span>{t("lab.explore")}</span>
                    </summary>
                    {detailsOpen && <StrategyDetails result={result} />}
                  </details>
                )}
                <details className="strategy-disclosure">
                  <summary>
                    {t("lab.method")}
                    <span>{t("lab.assumptions")}</span>
                  </summary>
                  <div className="strategy-method">
                    <p>{t("lab.methodBody")}</p>
                    <p>{t("lab.modelLimits")}</p>
                    <p>{t("lab.percentileHelp")}</p>
                    {model && model.estimated > 0 && <p>{t("lab.estimatedHelp")}</p>}
                    <p>
                      {numericText(
                        t("lab.calculationInfo")
                          .replace("{n}", String(model?.sampleSize ?? 0))
                          .replace("{seed}", String(config.seed)),
                      )}
                    </p>
                    {model && model.excluded > 0 && (
                      <p>{t("lab.excluded").replace("{n}", String(model.excluded))}</p>
                    )}
                  </div>
                </details>
              </>
            )}
          </section>
          <aside className="strategy-desktop-editor">
            <Card pad="tight">
              {editor}
              <Button
                variant="accent"
                className="w-full"
                onClick={() => {
                  setPlanName(saved?.name ?? t("lab.defaultPlanName"));
                  setPlanOpen(true);
                }}
                disabled={!model || running}
              >
                <Bookmark className="h-3.5 w-3.5" />
                {t("lab.savePlan")}
              </Button>
              {saved && (
                <Button variant="ghost" size="sm" className="w-full mt-2" onClick={restore}>
                  {t("lab.restorePlan")}
                </Button>
              )}
            </Card>
          </aside>
        </div>
      )}
      <Modal
        open={editOpen && source !== null}
        onClose={() => setEditOpen(false)}
        size="sm"
        labelledBy="strategy-mobile-title"
      >
        <div className="strategy-mobile-editor">
          <div className="strategy-modal-header">
            <h2 id="strategy-mobile-title">{t("lab.adjust")}</h2>
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {editor}
          <Button onClick={() => setEditOpen(false)} className="w-full">
            {t("lab.seeProjection")}
          </Button>
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => {
              setEditOpen(false);
              setPlanName(saved?.name ?? t("lab.defaultPlanName"));
              setPlanOpen(true);
            }}
          >
            {t("lab.savePlan")}
          </Button>
        </div>
      </Modal>
      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        size="sm"
        labelledBy="strategy-save-title"
      >
        <div className="p-5 space-y-4">
          <h2 id="strategy-save-title" className="tv-title">
            {t("lab.savePlan")}
          </h2>
          <Field label={t("lab.planName")} htmlFor="strategy-plan-name">
            <Input
              id="strategy-plan-name"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              maxLength={60}
            />
          </Field>
          <p className="tv-prose text-slate-500">{t("lab.savedLocally")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPlanOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={!planName.trim()}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
