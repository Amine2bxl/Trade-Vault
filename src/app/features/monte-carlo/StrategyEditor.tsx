import { useId, useState } from "react";
import { Button, Field, Input, SelectPicker, InfoTip } from "@/shared/ui";
import { RotateCcw, ArrowRight } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { currencySymbol } from "@/shared/currency";
import type {
  StrategyConfig,
  StrategyMetrics,
  StrategyModel,
} from "@/modules/probability/strategy";

export function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  help?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) {
      const n = Number(draft.replace(",", "."));
      if (draft.trim() && Number.isFinite(n) && n !== value)
        onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
      setDraft(null);
    }
  };
  return (
    <Field
      htmlFor={id}
      label={
        <span className="strategy-field-label">
          {label}
          {help && <InfoTip text={help} />}
        </span>
      }
    >
      <div className="strategy-number">
        <Input
          id={id}
          inputMode="decimal"
          value={draft ?? Number(value.toFixed(4))}
          onFocus={() => setDraft(String(Number(value.toFixed(4))))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
        />
        {unit && (
          <span className="strategy-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
    </Field>
  );
}

export function StrategyEditor({
  model,
  sessionsAvailable,
  effectiveSample,
  metrics,
  onMetrics,
  config,
  onConfig,
  onVariant,
  onReset,
  objective,
}: {
  model: StrategyModel | null;
  /** L'historique permet un tirage par séances (mode C). */
  sessionsAvailable: boolean;
  /** Observations indépendantes derrière la projection affichée. */
  effectiveSample: number | null;
  metrics: StrategyMetrics;
  onMetrics: (patch: Partial<StrategyMetrics>) => void;
  config: StrategyConfig;
  onConfig: (patch: Partial<StrategyConfig>) => void;
  onVariant: () => void;
  onReset: () => void;
  objective: boolean;
}) {
  const { t } = useT();
  const manual = model?.kind === "planned";
  const number = (
    key: keyof StrategyConfig,
    label: string,
    min: number,
    max: number,
    step = 1,
    unit?: string,
    help?: string,
  ) => (
    <NumberControl
      label={label}
      value={config[key] as number}
      min={min}
      max={max}
      step={step}
      unit={unit}
      help={help}
      onChange={(v) => onConfig({ [key]: v })}
    />
  );
  return (
    <div className="strategy-editor-body">
      <div className="strategy-editor-heading">
        <h3>{t(manual ? "lab.yourScenario" : "lab.yourStrategy")}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          title={t("common.reset")}
          aria-label={t("common.reset")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
      {manual ? (
        <div className="strategy-input-grid">
          <NumberControl
            label={t("lab.winRate")}
            value={metrics.winRate * 100}
            min={0}
            max={100}
            step={0.1}
            unit="%"
            help={t("lab.winRateHelp")}
            onChange={(v) => onMetrics({ winRate: v / 100 })}
          />
          <NumberControl
            label={t("lab.avgWin")}
            value={metrics.avgWinR}
            min={0.01}
            max={30}
            step={0.01}
            unit="R"
            onChange={(v) => onMetrics({ avgWinR: v })}
          />
          <NumberControl
            label={t("lab.avgLoss")}
            value={metrics.avgLossR}
            min={0.01}
            max={30}
            step={0.01}
            unit="R"
            onChange={(v) => onMetrics({ avgLossR: v })}
          />
          <NumberControl
            label={t("lab.breakEven")}
            value={metrics.breakEvenRate * 100}
            min={0}
            max={100}
            step={0.1}
            unit="%"
            onChange={(v) => onMetrics({ breakEvenRate: v / 100 })}
          />
        </div>
      ) : (
        <>
          <div className="strategy-observed">
            <span>
              {t("lab.winRate")}
              <b className="tv-figure">
                {model && model.values.filter((r) => r !== 0).length < 5
                  ? "—"
                  : `${(metrics.winRate * 100).toFixed(1)}%`}
              </b>
            </span>
            <span>
              {t("lab.avgWin")}
              <b className="tv-figure">+{metrics.avgWinR.toFixed(2)}R</b>
            </span>
            <span>
              {t("lab.avgLoss")}
              <b className="tv-figure">−{metrics.avgLossR.toFixed(2)}R</b>
            </span>
          </div>
          <Button variant="subtle" className="w-full" onClick={onVariant}>
            {t("lab.buildVariant")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
      <div className="strategy-input-grid strategy-main-inputs">
        {number("risk", t("lab.risk"), 1, Math.max(1, config.balance), 1, currencySymbol())}
        {number("trades", t("lab.horizon"), 10, 1000, 1, t("mc.dataTrades").toLowerCase())}
      </div>
      <p className="strategy-editor-meta tv-figure">
        {((config.risk / config.balance) * 100).toFixed(2)}% {t("lab.ofBalance")} ·{" "}
        {Math.ceil(config.trades / config.perDay)} {t("mc.days")}
      </p>
      <details
        className="strategy-editor-section"
        open={objective || undefined}
        key={String(objective)}
      >
        <summary>{t("lab.targetRules")}</summary>
        <div className="strategy-input-grid">
          {number("target", t("lab.target"), 1, config.balance * 10, 1, currencySymbol())}
          {number("lossLimit", t("lab.lossLimit"), 1, config.balance, 1, currencySymbol())}
          {number("perDay", t("lab.perDay"), 1, 10, 1)}
          {number(
            "dailyLimit",
            t("lab.dailyLimit"),
            0,
            config.balance,
            1,
            currencySymbol(),
            t("lab.zeroDisabled"),
          )}
        </div>
        <SelectPicker
          label={t("lab.drawdownType")}
          value={config.drawdownType}
          onChange={(v) => onConfig({ drawdownType: v })}
          options={[
            { value: "static", label: t("lab.static") },
            { value: "trailing", label: t("lab.trailing") },
            { value: "trailingEod", label: t("lab.eod") },
          ]}
          variant="field"
        />
        {config.drawdownType === "trailing" && (
          <p className="tv-prose text-amber-300">{t("lab.trailingApprox")}</p>
        )}
        <p className="tv-prose text-slate-500">{t("lab.rulesHint")}</p>
      </details>
      <details className="strategy-editor-section">
        <summary>{t("lab.moreAssumptions")}</summary>
        <div className="strategy-input-grid">
          {number("balance", t("lab.balance"), 100, 1_000_000, 100, currencySymbol())}
          {number(
            "extraCost",
            t("lab.extraCost"),
            0,
            config.risk * 5,
            0.1,
            currencySymbol(),
            t("lab.costHelp"),
          )}
        </div>
        <SelectPicker
          label={t("lab.winHaircut")}
          value={String(config.winHaircut ?? 0)}
          neutralValue="0"
          onChange={(v) => onConfig({ winHaircut: Number(v) })}
          options={["0", "0.1", "0.2", "0.3"].map((v) => ({
            value: v,
            label:
              v === "0"
                ? t("lab.haircutNone")
                : t("lab.haircutPct").replace("{n}", String(Number(v) * 100)),
          }))}
          variant="field"
        />
        {sessionsAvailable && (
          <SelectPicker
            label={t("lab.sampling")}
            value={config.sampling ?? "trade"}
            onChange={(v) => onConfig({ sampling: v })}
            options={[
              { value: "trade", label: t("lab.samplingTrade") },
              { value: "session", label: t("lab.samplingSession") },
            ]}
            variant="field"
          />
        )}
        {effectiveSample !== null && (
          <p className="tv-prose text-slate-500">
            {t(
              config.sampling === "session" && sessionsAvailable
                ? "lab.effectiveSessions"
                : "lab.effectiveTrades",
            ).replace("{n}", String(effectiveSample))}
          </p>
        )}
      </details>
      <p className="strategy-editor-foot">
        {t(
          manual
            ? model.values.length
              ? "lab.calibratedModel"
              : "lab.fixedModel"
            : "lab.bootstrapModel",
        )}
      </p>
    </div>
  );
}
