import { useEffect, useMemo, useState } from "react";
import { Badge, ChoiceGroup, MultiPicker, SelectPicker, Toggle } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import type { Trade } from "@/app/types";
import type { BehaviorContext, PathStats, ScenarioRule } from "@/modules/knowledge";
import { formatMoney } from "@/shared/currency";
import type { SimulateResult } from "./brainCompute";
import type { useBrainCompute } from "./useBrainCompute";

/**
 * SIMULER — rejouer son historique avec d'autres décisions.
 *
 * Trois natures, trois étiquettes, jamais mélangées : la courbe OBSERVÉE, la
 * courbe HYPOTHÉTIQUE (les mêmes trades, la règle appliquée), et l'éventail
 * STATISTIQUE (séances passées rééchantillonnées). Le calcul part dans le
 * Worker ; l'écran ne bloque jamais.
 */

export interface SimConfig {
  risk: number;
  cap: number;
  stop: number;
  mistakes: string[];
  setupMode: "all" | "only" | "exclude";
  setup: string;
  planOnly: boolean;
  horizon: number;
}

export const DEFAULT_SIM: SimConfig = {
  risk: 1,
  cap: 0,
  stop: 0,
  mistakes: [],
  setupMode: "all",
  setup: "",
  planOnly: false,
  horizon: 60,
};

export function rulesOf(c: SimConfig): ScenarioRule[] {
  const out: ScenarioRule[] = [];
  for (const m of c.mistakes) out.push({ kind: "exclude_mistake", mistake: m });
  if (c.setupMode !== "all" && c.setup)
    out.push({ kind: c.setupMode === "only" ? "only_setup" : "exclude_setup", setup: c.setup });
  if (c.planOnly) out.push({ kind: "plan_only" });
  if (c.cap > 0) out.push({ kind: "cap_per_session", max: c.cap });
  if (c.stop > 0) out.push({ kind: "stop_after_losses", losses: c.stop });
  if (c.risk !== 1) out.push({ kind: "risk_scale", factor: c.risk });
  return out;
}

/** La simulation courante, recalculée (dans le Worker) à chaque réglage. */
export function useSimulation(
  active: boolean,
  trades: readonly Trade[],
  behavior: BehaviorContext,
  compute: ReturnType<typeof useBrainCompute>,
) {
  const [config, setConfig] = useState<SimConfig>(DEFAULT_SIM);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active) return;
    let live = true;
    setBusy(true);
    const id = setTimeout(() => {
      compute<SimulateResult>({
        type: "simulate",
        trades: [...trades],
        rules: rulesOf(config),
        behavior,
        horizon: config.horizon,
      })
        .then((r) => live && setResult(r))
        .catch(() => {})
        .finally(() => live && setBusy(false));
    }, 200);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [active, trades, behavior, config, compute]);
  return { config, setConfig, result, busy };
}

// ── Réglages (panneau) ──────────────────────────────────────────────────────

export function SimulateControls({
  trades,
  behavior,
  config,
  onChange,
}: {
  trades: readonly Trade[];
  behavior: BehaviorContext;
  config: SimConfig;
  onChange: (c: SimConfig) => void;
}) {
  const { t } = useT();
  const set = (patch: Partial<SimConfig>) => onChange({ ...config, ...patch });
  const mistakes = useMemo(
    () =>
      [
        ...new Set(trades.flatMap((x) => (x.mistakes ?? []).map((m) => m.trim()).filter(Boolean))),
      ].sort(),
    [trades],
  );
  const setups = useMemo(
    () =>
      [
        ...new Set(
          trades
            .filter((x) => !x.reviewPending)
            .map((x) => x.strategy?.trim())
            .filter(Boolean),
        ),
      ].sort() as string[],
    [trades],
  );
  const hasPlan = Object.keys(behavior.planRespected ?? {}).length > 0;
  const off = t("brain.sim.off");
  return (
    <div className="grid gap-4">
      <p className="tv-prose text-slate-400">{t("brain.sim.intro")}</p>
      <label className="grid gap-1.5">
        <span className="tv-label text-slate-500">
          {t("brain.sim.risk").replace("{v}", `${config.risk.toFixed(2)}×`)}
        </span>
        <input
          type="range"
          min={0.25}
          max={2}
          step={0.25}
          value={config.risk}
          onChange={(e) => set({ risk: Number(e.target.value) })}
          aria-valuetext={`${config.risk.toFixed(2)}×`}
        />
      </label>
      <span className="tv-label -mb-2 text-slate-500">{t("brain.sim.cap")}</span>
      <ChoiceGroup
        label={t("brain.sim.cap")}
        value={config.cap}
        options={[0, 1, 2, 3, 4].map((v) => ({ value: v, label: v ? String(v) : off }))}
        onChange={(v) => set({ cap: v })}
      />
      <span className="tv-label -mb-2 text-slate-500">{t("brain.sim.stop")}</span>
      <ChoiceGroup
        label={t("brain.sim.stop")}
        value={config.stop}
        options={[0, 1, 2, 3].map((v) => ({ value: v, label: v ? String(v) : off }))}
        onChange={(v) => set({ stop: v })}
      />
      {mistakes.length > 0 && (
        <div className="grid gap-1.5">
          <MultiPicker
            label={t("brain.sim.excludeMistakes")}
            values={config.mistakes}
            options={mistakes.map((m) => ({ value: m, label: m }))}
            onChange={(v) => set({ mistakes: v })}
            allLabel={t("brain.sim.none")}
            moreLabel={t("filters.more")}
            lessLabel={t("filters.less")}
            searchLabel={t("picker.search")}
          />
        </div>
      )}
      {setups.length > 0 && (
        <div className="grid gap-1.5">
          <span className="tv-label text-slate-500">{t("brain.sim.setup")}</span>
          <ChoiceGroup
            label={t("brain.sim.setup")}
            value={config.setupMode}
            options={[
              { value: "all", label: t("brain.sim.allSetups") },
              { value: "only", label: t("brain.sim.only") },
              { value: "exclude", label: t("brain.sim.without") },
            ]}
            onChange={(v) => set({ setupMode: v, setup: config.setup || setups[0] })}
          />
          {config.setupMode !== "all" && (
            <SelectPicker
              label={t("brain.sim.setup")}
              value={config.setup || setups[0]}
              options={setups.map((s) => ({ value: s, label: s }))}
              onChange={(v) => set({ setup: v })}
            />
          )}
        </div>
      )}
      {hasPlan && (
        <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>{t("brain.sim.plan")}</span>
          <Toggle
            on={config.planOnly}
            onChange={(v) => set({ planOnly: v })}
            label={t("brain.sim.plan")}
          />
        </label>
      )}
      <span className="tv-label -mb-2 text-slate-500">{t("brain.sim.horizon")}</span>
      <ChoiceGroup
        label={t("brain.sim.horizon")}
        value={config.horizon}
        options={[30, 60, 120].map((v) => ({
          value: v,
          label: t("brain.sim.sessions").replace("{n}", String(v)),
        }))}
        onChange={(v) => set({ horizon: v })}
      />
    </div>
  );
}

// ── Résultats (plateau central) ─────────────────────────────────────────────

const W = 640;
const H = 220;
const PAD = 28;

function scaleOf(values: number[]) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  return (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
}

function line(values: readonly number[], y: (v: number) => number, n = values.length) {
  return values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${(PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD)).toFixed(1)},${y(v).toFixed(1)}`,
    )
    .join(" ");
}

function band(low: readonly number[], high: readonly number[], y: (v: number) => number) {
  const n = low.length;
  const top = high.map(
    (v, i) =>
      `${i ? "L" : "M"}${(PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD)).toFixed(1)},${y(v).toFixed(1)}`,
  );
  const bottom = low
    .map(
      (v, i) =>
        `L${(PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD)).toFixed(1)},${y(v).toFixed(1)}`,
    )
    .reverse();
  return `${top.join(" ")} ${bottom.join(" ")} Z`;
}

function StatsRow({
  label,
  a,
  b,
  money = true,
  pct = false,
}: {
  label: string;
  a: number | null;
  b: number | null;
  money?: boolean;
  pct?: boolean;
}) {
  const f = (v: number | null) =>
    v === null
      ? "—"
      : pct
        ? `${Math.round(v * 100)} %`
        : money
          ? formatMoney(v, { signed: true })
          : String(v);
  const delta = a !== null && b !== null ? b - a : null;
  return (
    <tr className="border-t border-[var(--tv-border)]">
      <td className="py-1.5 text-slate-400">{label}</td>
      <td className="tv-figure py-1.5 text-right">{f(a)}</td>
      <td className="tv-figure py-1.5 text-right">{f(b)}</td>
      <td
        className={`tv-figure py-1.5 text-right ${delta && delta > 0 ? "text-emerald-400" : delta && delta < 0 ? "text-red-400" : "text-slate-500"}`}
      >
        {delta === null
          ? "—"
          : pct
            ? `${delta > 0 ? "+" : ""}${Math.round(delta * 100)} pts`
            : money
              ? formatMoney(delta, { signed: true })
              : `${delta > 0 ? "+" : ""}${delta}`}
      </td>
    </tr>
  );
}

export function SimulateResults({
  result,
  busy,
}: {
  result: SimulateResult | null;
  busy: boolean;
}) {
  const { t } = useT();
  if (!result) return <p className="tv-prose text-slate-400">{t("brain.sim.computing")}</p>;
  const { scenario: s, actualProjection: ap, scenarioProjection: sp } = result;
  const y1 = scaleOf([...s.actualPath, ...s.scenarioPath]);
  const fanValues = sp ? [...sp.p5, ...sp.p95, ...(ap?.p50 ?? [])] : [];
  const y2 = scaleOf(fanValues.length ? fanValues : [0]);
  const stat = (k: keyof PathStats) =>
    [s.actual[k], s.scenario[k]] as [number | null, number | null];
  return (
    <div className="grid gap-5" aria-busy={busy}>
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="tv-title text-white">{t("brain.sim.historyTitle")}</h3>
          <Badge variant="warning">{t("brain.sim.hypotheticalBadge")}</Badge>
        </div>
        <p className="tv-hint mt-1 text-slate-500">{t("brain.sim.disclaimer")}</p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="brain-chart mt-2 w-full"
          role="img"
          aria-label={t("brain.sim.historyTitle")}
        >
          <line x1={PAD} x2={W - PAD} y1={y1(0)} y2={y1(0)} stroke="var(--tv-border-strong)" />
          <path
            d={line(s.actualPath, y1)}
            fill="none"
            stroke="var(--tv-text-secondary)"
            strokeWidth={1.6}
          />
          <path
            d={line(s.scenarioPath, y1)}
            fill="none"
            stroke="var(--tv-accent)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <text x={W - PAD} y={y1(s.actualPath.at(-1) ?? 0) - 6} textAnchor="end">
            {formatMoney(s.actual.net, { signed: true })}
          </text>
          <text x={W - PAD} y={y1(s.scenarioPath.at(-1) ?? 0) + 14} textAnchor="end">
            {formatMoney(s.scenario.net, { signed: true })}
          </text>
        </svg>
        <div className="brain-legend-inline mt-1">
          <span>
            <i style={{ background: "var(--tv-text-secondary)" }} />
            {t("brain.sim.observed")}
          </span>
          <span>
            <i style={{ background: "var(--tv-accent)" }} />
            {t("brain.sim.scenarioCurve")}
          </span>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="tv-label text-slate-500">
              <th className="text-left font-normal" />
              <th className="text-right font-normal">{t("brain.sim.observed")}</th>
              <th className="text-right font-normal">{t("brain.sim.scenarioCurve")}</th>
              <th className="text-right font-normal">{t("brain.sim.delta")}</th>
            </tr>
          </thead>
          <tbody>
            <StatsRow label={t("brain.sim.net")} a={stat("net")[0]} b={stat("net")[1]} />
            <StatsRow
              label={t("brain.sim.maxDd")}
              a={-(stat("maxDrawdown")[0] ?? 0)}
              b={-(stat("maxDrawdown")[1] ?? 0)}
            />
            <StatsRow
              label={t("brain.sim.trades")}
              a={stat("trades")[0]}
              b={stat("trades")[1]}
              money={false}
            />
            <StatsRow
              label={t("brain.sim.winRate")}
              a={stat("winRate")[0]}
              b={stat("winRate")[1]}
              pct
            />
            <StatsRow
              label={t("brain.sim.expectancy")}
              a={stat("expectancy")[0]}
              b={stat("expectancy")[1]}
            />
          </tbody>
        </table>
        <ul className="tv-hint mt-2 grid gap-0.5 text-slate-500">
          <li>{t("brain.sim.removed").replace("{n}", String(s.removed))}</li>
          {s.scaled + s.unscaled > 0 && (
            <li>
              {t("brain.sim.scaled")
                .replace("{n}", String(s.scaled))
                .replace("{u}", String(s.unscaled))}
            </li>
          )}
          {s.unprovenSessions > 0 && (
            <li>{t("brain.sim.unproven").replace("{n}", String(s.unprovenSessions))}</li>
          )}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="tv-title text-white">{t("brain.sim.fanTitle")}</h3>
          <Badge variant="accent">{t("brain.sim.statisticalBadge")}</Badge>
        </div>
        <p className="tv-hint mt-1 text-slate-500">{t("brain.sim.statistical")}</p>
        {sp && ap ? (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="brain-chart mt-2 w-full"
              role="img"
              aria-label={t("brain.sim.fanTitle")}
            >
              <line x1={PAD} x2={W - PAD} y1={y2(0)} y2={y2(0)} stroke="var(--tv-border-strong)" />
              <path d={band(sp.p5, sp.p95, y2)} fill="var(--tv-accent)" fillOpacity={0.1} />
              <path d={band(sp.p25, sp.p75, y2)} fill="var(--tv-accent)" fillOpacity={0.16} />
              {sp.samples.slice(0, 16).map((path, i) => (
                <path
                  key={i}
                  d={line(path, y2)}
                  fill="none"
                  stroke="var(--tv-accent)"
                  strokeOpacity={0.12}
                  strokeWidth={1}
                />
              ))}
              <path
                d={line(ap.p50, y2)}
                fill="none"
                stroke="var(--tv-text-secondary)"
                strokeWidth={1.4}
                strokeDasharray="4 4"
              />
              <path d={line(sp.p50, y2)} fill="none" stroke="var(--tv-accent)" strokeWidth={2} />
            </svg>
            <div className="brain-legend-inline mt-1">
              <span>
                <i style={{ background: "var(--tv-accent)" }} />
                {t("brain.sim.median")}
              </span>
              <span>
                <i style={{ background: "var(--tv-text-secondary)" }} />
                {t("brain.sim.actualMedian")}
              </span>
              <span>{t("brain.sim.band")}</span>
            </div>
            <p className="tv-hint tv-num mt-2 text-slate-400">
              {t("brain.sim.probLoss")
                .replace("{a}", `${Math.round(ap.probLoss * 100)} %`)
                .replace("{b}", `${Math.round(sp.probLoss * 100)} %`)
                .replace("{n}", String(sp.sessions))
                .replace("{paths}", String(sp.paths))}
            </p>
          </>
        ) : (
          <p className="tv-prose mt-2 text-slate-400">{t("brain.sim.tooFew")}</p>
        )}
      </section>
    </div>
  );
}
