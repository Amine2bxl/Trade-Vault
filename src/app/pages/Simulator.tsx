/**
 * Simulateur de probabilités — l'écran qui répond à « si je continue comme ça,
 * que peut-il se passer ? », puis « qu'est-ce qui change si je trade
 * autrement ? ».
 *
 * CE FICHIER NE CALCULE RIEN. Tout vient de `modules/probability` : dataset,
 * scénario, moteur, qualification d'échantillon, sensibilité. C'est la règle
 * qui garantit qu'il n'existe qu'une seule définition de chaque chiffre — et
 * qu'un jour, Jarvis et une éventuelle exécution serveur liront exactement les
 * mêmes résultats que cet écran.
 *
 * LES RÈGLES DU COMPTE SONT SAISIES PAR LE TRADER. TradeVault n'embarque
 * aucune donnée de prop firm : afficher « Apex 50k » avec des chiffres non
 * vérifiés ferait acheter un compte à 500 $ sur la foi d'une invention.
 */

import { useMemo, useState } from "react";
import { Dices, ShieldAlert, Target, TrendingDown, Info } from "lucide-react";
import type { Trade } from "../types";
import { useT } from "../i18n/LanguageContext";
import { useAccounts } from "../contexts/AccountContext";
import { cn } from "../utils/cn";
import { Button, Card, CardBody, FIELD_BASE, PageHeader, Badge } from "@/shared/ui";
import { buildDataset } from "@/modules/probability/dataset";
import { buildScenario, type Horizon } from "@/modules/probability/scenario";
import { runSimulation } from "@/modules/probability/engine";
import { defaultLevers, runSensitivity } from "@/modules/probability/sensitivity";
import { wilsonInterval, type SampleQuality } from "@/modules/probability/sample";
import type { AccountRules, DrawdownType } from "@/modules/probability/rules";

/** Champ numérique tenu en texte : un `number` contrôlé empêche d'effacer le
 *  contenu pour retaper, ce qui rend le formulaire pénible sur mobile. */
function numOr(value: string, fallback: number | null): number | null {
  const n = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(n) ? fallback : n;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

export default function Simulator({ trades }: { trades: Trade[] }) {
  const { t, lang } = useT();
  const fr = lang === "fr";
  const { activeAccount } = useAccounts();

  const money = useMemo(
    () =>
      new Intl.NumberFormat(fr ? "fr-FR" : "en-US", {
        style: "currency",
        currency: activeAccount?.currency || "USD",
        maximumFractionDigits: 0,
      }),
    [fr, activeAccount?.currency],
  );

  // Le solde de départ vient du compte actif, jamais d'une valeur en dur.
  const [balance, setBalance] = useState(String(activeAccount?.startingBalance ?? 0));
  const [target, setTarget] = useState("");
  const [maxDd, setMaxDd] = useState("");
  const [ddType, setDdType] = useState<DrawdownType>("static");
  const [dailyLoss, setDailyLoss] = useState("");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [horizonDays, setHorizonDays] = useState("30");
  const [risk, setRisk] = useState(1);

  const dataset = useMemo(() => buildDataset(trades), [trades]);

  const rules: AccountRules = useMemo(
    () => ({
      startingBalance: numOr(balance, 0) ?? 0,
      profitTarget: numOr(target, null),
      maxDrawdown: numOr(maxDd, null),
      drawdownType: ddType,
      dailyLossLimit: numOr(dailyLoss, null),
      minTradingDays: numOr(minDays, null),
      maxTradingDays: numOr(maxDays, null),
    }),
    [balance, target, maxDd, ddType, dailyLoss, minDays, maxDays],
  );

  const horizon: Horizon = useMemo(
    () => ({ unit: "days", value: numOr(horizonDays, 30) ?? 30 }),
    [horizonDays],
  );

  const built = useMemo(
    () => buildScenario(dataset, { rules, horizon, riskMultiplier: risk }),
    [dataset, rules, horizon, risk],
  );

  const result = useMemo(
    () => (built.ok ? runSimulation(dataset, built.config) : null),
    [built, dataset],
  );

  const sensitivity = useMemo(
    () => (built.ok ? runSensitivity(dataset, built.config, defaultLevers(built.config)) : null),
    [built, dataset],
  );

  const qualityLabel: Record<SampleQuality, string> = {
    low: t("sim.sample.low"),
    limited: t("sim.sample.limited"),
    moderate: t("sim.sample.moderate"),
    strong: t("sim.sample.strong"),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Dices className="w-5 h-5 text-cyan-400" />}
        title={t("sim.title")}
        subtitle={t("sim.subtitle")}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ── Colonne des paramètres ─────────────────────────────────────── */}
        <Card>
          <CardBody className="space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t("sim.rulesTitle")}
            </p>
            {/* Le rappel n'est pas décoratif : il dit au trader d'où viennent
                les chiffres qu'il saisit, et que TradeVault ne les connaît pas. */}
            <p className="text-[11px] text-slate-500 flex gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              {t("sim.rulesHint")}
            </p>

            <Row label={t("sim.balance")} value={balance} onChange={setBalance} />
            <Row label={t("sim.target")} value={target} onChange={setTarget} optional />
            <Row label={t("sim.maxDd")} value={maxDd} onChange={setMaxDd} optional />

            <label className="block">
              <span className="text-[11px] text-slate-400">{t("sim.ddType")}</span>
              <select
                className={cn(FIELD_BASE, "mt-1")}
                value={ddType}
                onChange={(e) => setDdType(e.target.value as DrawdownType)}
              >
                <option value="static">{t("sim.dd.static")}</option>
                <option value="trailing">{t("sim.dd.trailing")}</option>
                <option value="trailingEod">{t("sim.dd.trailingEod")}</option>
              </select>
            </label>

            <Row label={t("sim.dailyLoss")} value={dailyLoss} onChange={setDailyLoss} optional />
            <Row label={t("sim.minDays")} value={minDays} onChange={setMinDays} optional />
            <Row label={t("sim.maxDays")} value={maxDays} onChange={setMaxDays} optional />
            <Row label={t("sim.horizon")} value={horizonDays} onChange={setHorizonDays} />

            <div>
              <span className="text-[11px] text-slate-400">{t("sim.risk")}</span>
              <div className="flex gap-1.5 mt-1">
                {[0.5, 0.75, 1, 1.5, 2].map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={risk === m ? "primary" : "ghost"}
                    onClick={() => setRisk(m)}
                  >
                    ×{m}
                  </Button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ── Colonne des résultats ──────────────────────────────────────── */}
        <div className="space-y-4">
          {!built.ok && (
            <Card>
              <CardBody className="text-sm text-slate-400">
                {t(`sim.blocker.${built.blocker}` as never)}
              </CardBody>
            </Card>
          )}

          {built.ok && result && (
            <>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("sim.resultsTitle")}
                    </p>
                    {/* La qualification de l'échantillon est collée au chiffre,
                        jamais reléguée en bas de page : un 92 % sur 8 trades
                        ne se lit pas comme un 92 % sur 400. */}
                    <Badge variant={built.sample.quality === "low" ? "warning" : "neutral"}>
                      {qualityLabel[built.sample.quality]} · {built.sample.size}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Stat
                      icon={<Target className="w-4 h-4 text-emerald-400" />}
                      label={t("sim.passProb")}
                      value={pct(result.passProbability)}
                      hint={interval(result.passProbability, result.runs)}
                    />
                    <Stat
                      icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
                      label={t("sim.ruin")}
                      value={pct(result.riskOfRuin)}
                      hint={interval(result.riskOfRuin, result.runs)}
                    />
                    <Stat
                      icon={<TrendingDown className="w-4 h-4 text-amber-400" />}
                      label={t("sim.medianDd")}
                      value={money.format(result.drawdown.median)}
                      hint={`P95 ${money.format(result.drawdown.p95)}`}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    {t("sim.disclaimer")} · {result.engineVersion}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    {t("sim.pnlTitle")}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm tabular-nums">
                    {(
                      [
                        ["P5", result.pnl.p5],
                        ["P25", result.pnl.p25],
                        [t("sim.median"), result.pnl.median],
                        ["P75", result.pnl.p75],
                        ["P95", result.pnl.p95],
                      ] as const
                    ).map(([label, v]) => (
                      <div key={label}>
                        <p className="text-[11px] text-slate-500">{label}</p>
                        <p className={v >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {money.format(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {sensitivity && (
                <Card>
                  <CardBody className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("sim.leversTitle")}
                    </p>
                    <div className="space-y-1.5">
                      {sensitivity.rows.map((row) => (
                        <div
                          key={row.lever.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-slate-300">
                            {t(`sim.lever.${row.lever.id}` as never)}
                          </span>
                          <span className="tabular-nums text-slate-400">
                            {t("sim.ruinShort")}{" "}
                            <span
                              className={row.deltaRuin <= 0 ? "text-emerald-400" : "text-red-400"}
                            >
                              {row.deltaRuin >= 0 ? "+" : ""}
                              {(row.deltaRuin * 100).toFixed(1)} pt
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Intervalle de tirage à 95 % — dit de combien le chiffre bougerait avec
 *  d'autres trajectoires, et rien de plus (voir `sample.ts`). */
function interval(p: number, runs: number): string {
  const i = wilsonInterval(p, runs);
  return `${(i.low * 100).toFixed(1)}–${(i.high * 100).toFixed(1)} %`;
}

function Row({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-400">{label}</span>
      <input
        className={cn(FIELD_BASE, "mt-1")}
        inputMode="decimal"
        value={value}
        placeholder={optional ? "—" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="text-xl font-display tabular-nums mt-1">{value}</p>
      <p className="text-[11px] text-slate-500 tabular-nums">{hint}</p>
    </div>
  );
}
