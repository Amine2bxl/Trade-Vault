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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dices, ShieldAlert, Target, TrendingDown, Info, Scale } from "lucide-react";
import type { Trade } from "../types";
import { useT } from "../i18n/LanguageContext";
import { useAccounts } from "../contexts/AccountContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { loadScenarios, saveScenario, type SavedScenario } from "../store/simulations";
import { cn } from "../utils/cn";
import { assessDataset } from "../utils/datasetQuality";
import { Button, Card, CardBody, FIELD_BASE, PageHeader, Badge } from "@/shared/ui";
import { buildDataset } from "@/modules/probability/dataset";
import { buildScenario, type Horizon } from "@/modules/probability/scenario";
import { runSimulation } from "@/modules/probability/engine";
import { defaultLevers, runSensitivity } from "@/modules/probability/sensitivity";
import { bestBy, compareScenarios } from "@/modules/probability/compare";
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
  const { activeAccount, activeId } = useAccounts();
  const { user } = useAuth();
  const { toast } = useToast();

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
  // Ce que le journal permet — ou non — de simuler. Calcule ici, affiche a
  // cote du resultat : un manque signale loin du chiffre qu'il limite ne se
  // traduit jamais en action.
  const quality = useMemo(() => assessDataset(trades), [trades]);

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

  // ── Scénarios sauvegardés ────────────────────────────────────────────────
  // Sans eux, le trader ressaisit les règles de son contrat à chaque visite —
  // c'est ce qui transforme une fonctionnalité en jouet qu'on essaie une fois.
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadScenarios(activeId).then((list) => active && setSaved(list));
    return () => {
      active = false;
    };
  }, [activeId]);

  const persist = useCallback(async () => {
    if (!user || !built.ok) return;
    setSaving(true);
    try {
      const created = await saveScenario(user.id, {
        accountId: activeId,
        name: activeAccount?.name ?? "",
        rules,
        horizon,
        riskMultiplier: risk,
        stopAfterLosses: null,
        runs: built.config.runs,
        seed: built.config.seed,
        engineVersion: result?.engineVersion ?? null,
        lastPassProbability: result?.passProbability ?? null,
        lastRiskOfRuin: result?.riskOfRuin ?? null,
        lastSampleSize: built.sample.size,
      });
      if (created) setSaved((prev) => [created, ...prev]);
      toast(t("sim.saved"), "success");
    } catch {
      toast(t("sim.saveError"), "error");
    } finally {
      setSaving(false);
    }
  }, [user, built, rules, horizon, risk, result, activeId, activeAccount?.name, toast, t]);

  /** Recharge un scénario dans le formulaire. Les champs vides restent vides :
   *  une règle absente n'a jamais été saisie et ne doit pas réapparaître à 0. */
  const restore = useCallback((s: SavedScenario) => {
    const r = s.rules;
    setBalance(String(r.startingBalance ?? ""));
    setTarget(r.profitTarget != null ? String(r.profitTarget) : "");
    setMaxDd(r.maxDrawdown != null ? String(r.maxDrawdown) : "");
    setDdType(r.drawdownType ?? "static");
    setDailyLoss(r.dailyLossLimit != null ? String(r.dailyLossLimit) : "");
    setMinDays(r.minTradingDays != null ? String(r.minTradingDays) : "");
    setMaxDays(r.maxTradingDays != null ? String(r.maxTradingDays) : "");
    setHorizonDays(String(s.horizon.value));
    setRisk(s.riskMultiplier);
  }, []);

  // ── Comparaison ──────────────────────────────────────────────────────────
  // « Firme A ou firme B ? » ne se répond pas en rejouant deux fois la même
  // page de mémoire : les deux chiffres doivent être côte à côte, calculés sur
  // le même historique.
  const [compared, setCompared] = useState<string[]>([]);

  const toggleCompare = useCallback((id: string) => {
    setCompared((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : // Au-delà de trois colonnes le tableau devient illisible sur mobile,
          // et la décision ne s'éclaircit pas pour autant.
          prev.length >= 3
          ? prev
          : [...prev, id],
    );
  }, []);

  const comparison = useMemo(() => {
    const entries = compared
      .map((id) => saved.find((s) => s.id === id))
      .filter((s): s is SavedScenario => !!s)
      // Un scénario sauvegardé sans graine n'a jamais été simulé : le rejouer
      // avec une graine inventée donnerait un chiffre différent de celui que le
      // trader a vu au moment où il l'a enregistré.
      .filter((s) => s.seed !== null)
      .map((s) => ({
        id: s.id,
        label: s.name || money.format(s.rules.startingBalance ?? 0),
        config: {
          rules: s.rules,
          tradesPerPath:
            s.horizon.unit === "trades"
              ? s.horizon.value
              : Math.max(1, Math.round((dataset.tradesPerDay ?? 1) * s.horizon.value)),
          tradesPerDay: Math.max(1, Math.round(dataset.tradesPerDay ?? 1)),
          runs: s.runs,
          riskMultiplier: s.riskMultiplier,
          stopAfterLosses: s.stopAfterLosses,
          seed: s.seed as number,
        },
      }));
    return entries.length >= 2 ? compareScenarios(dataset, entries) : null;
  }, [compared, saved, dataset, money]);

  const qualityLabel: Record<SampleQuality, string> = {
    low: t("sim.sample.low"),
    limited: t("sim.sample.limited"),
    moderate: t("sim.sample.moderate"),
    strong: t("sim.sample.strong"),
  };

  return (
    <div className="space-y-5">
      <PageHeader icon={<Dices className="w-5 h-5 text-cyan-400" />} title={t("sim.title")} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ── Colonne des paramètres ─────────────────────────────────────── */}
        <Card>
          <CardBody className="space-y-3">
            <p className="tv-label text-slate-500">{t("sim.rulesTitle")}</p>
            {/* Le rappel n'est pas décoratif : il dit au trader d'où viennent
                les chiffres qu'il saisit, et que TradeVault ne les connaît pas. */}
            <p className="tv-row-label flex gap-1.5">
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

            <Button
              variant="primary"
              size="sm"
              className="w-full"
              disabled={!built.ok || saving || !user}
              onClick={() => void persist()}
            >
              {t("sim.save")}
            </Button>

            {saved.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="tv-label text-slate-500">{t("sim.savedTitle")}</p>
                {saved.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2",
                      compared.includes(s.id)
                        ? "border-cyan-500/40 bg-cyan-500/[0.06]"
                        : "border-white/5 bg-white/[0.02]",
                    )}
                  >
                    <button
                      onClick={() => restore(s)}
                      className="flex-1 min-h-11 text-left min-w-0"
                    >
                      <span className="text-xs text-slate-300 block truncate">
                        {money.format(s.rules.startingBalance ?? 0)} ·{" "}
                        {t(`sim.dd.${s.rules.drawdownType ?? "static"}` as never)}
                      </span>
                      {s.lastRiskOfRuin !== null && (
                        <span className="tv-figure block text-[11px] text-slate-500">
                          {t("sim.ruinShort")} {pct(s.lastRiskOfRuin)}
                          {s.lastSampleSize !== null && ` · n=${s.lastSampleSize}`}
                        </span>
                      )}
                    </button>
                    {/* Un scénario jamais simulé n'a pas de graine : le rejouer
                        donnerait un autre chiffre que celui qu'il affiche. */}
                    <button
                      onClick={() => toggleCompare(s.id)}
                      disabled={s.seed === null}
                      title={t("sim.compareToggle")}
                      className={cn(
                        "shrink-0 min-h-11 min-w-11 grid place-items-center rounded-lg text-[11px]",
                        compared.includes(s.id) ? "text-cyan-400" : "text-slate-600",
                        s.seed === null && "opacity-30",
                      )}
                    >
                      <Scale className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                    <p className="tv-label text-slate-500">{t("sim.resultsTitle")}</p>
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

                  <p className="tv-row-label">
                    {t("sim.disclaimer")} · {result.engineVersion}
                  </p>

                  {/* Ce que le journal ne permet PAS encore de simuler. Le
                      trader voit le manque au moment où il regarde le
                      résultat, avec le geste précis qui le comble — pas une
                      analyse grisée sans explication. */}
                  {quality.gaps.length > 0 && (
                    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3 space-y-1">
                      <p className="text-[11px] text-amber-400/90">
                        {t("sim.quality").replace("{score}", String(quality.score))}
                      </p>
                      {quality.gaps.slice(0, 2).map((gap) => (
                        <p key={gap.dimension} className="text-[11px] text-slate-400">
                          {t(`sim.gap.${gap.dimension}` as never).replace(
                            "{pct}",
                            String(Math.round((1 - gap.coverage) * 100)),
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardBody className="space-y-2">
                  <p className="tv-label text-slate-500">{t("sim.pnlTitle")}</p>
                  <div className="tv-figure grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm">
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
                        <p className="tv-row-label">{label}</p>
                        <p className={v >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {money.format(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {comparison && (
                <Card>
                  <CardBody className="space-y-2">
                    <p className="tv-label text-slate-500">{t("sim.compareTitle")}</p>
                    <div className="overflow-x-auto">
                      <table className="tv-figure w-full text-sm">
                        <thead>
                          <tr className="text-[11px] text-slate-500 text-left">
                            <th className="font-normal pb-1 pr-3">{t("sim.compareScenario")}</th>
                            <th className="font-normal pb-1 pr-3">{t("sim.passProb")}</th>
                            <th className="font-normal pb-1 pr-3">{t("sim.ruin")}</th>
                            <th className="font-normal pb-1">{t("sim.median")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.map((row, i) => (
                            <tr key={row.id} className="border-t border-white/5">
                              <td className="py-1.5 pr-3 text-slate-300 max-w-[140px] truncate">
                                {row.label}
                              </td>
                              {/* Le meilleur est souligné par critère, jamais
                                  par un classement global : « le meilleur »
                                  dépend de ce que le trader cherche. En cas
                                  d'égalité, personne n'est mis en avant. */}
                              <td
                                className={cn(
                                  "py-1.5 pr-3",
                                  bestBy(comparison, "pass") === i && "text-emerald-400",
                                )}
                              >
                                {pct(row.result.passProbability)}
                              </td>
                              <td
                                className={cn(
                                  "py-1.5 pr-3",
                                  bestBy(comparison, "ruin") === i && "text-emerald-400",
                                )}
                              >
                                {pct(row.result.riskOfRuin)}
                              </td>
                              <td
                                className={cn(
                                  "py-1.5",
                                  bestBy(comparison, "pnl") === i && "text-emerald-400",
                                )}
                              >
                                {money.format(row.result.pnl.median)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="tv-row-label">{t("sim.compareHint")}</p>
                  </CardBody>
                </Card>
              )}

              {sensitivity && (
                <Card>
                  <CardBody className="space-y-2">
                    <p className="tv-label text-slate-500">{t("sim.leversTitle")}</p>
                    <div className="space-y-1.5">
                      {sensitivity.rows.map((row) => (
                        <div
                          key={row.lever.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-slate-300">
                            {t(`sim.lever.${row.lever.id}` as never)}
                          </span>
                          <span className="tv-figure text-slate-400">
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
      <p className="text-xl tv-figure mt-1">{value}</p>
      <p className="tv-figure text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
