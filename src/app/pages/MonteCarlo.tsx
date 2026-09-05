import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Loader2, Shuffle, RotateCcw } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Trade } from "../types";
import { formatPnl } from "../utils/tradeCalcs";
import { useT } from "../i18n/LanguageContext";
import { useAccounts } from "../contexts/AccountContext";
import { cn } from "../utils/cn";
import { usePageActions } from "../contexts/PageActionsContext";
import {
  extractRSamples,
  runMonteCarlo,
  computeStatistics,
  monteCarloSE,
  type MonteCarloParams,
  type MonteCarloResult,
} from "../utils/monteCarlo";
import { formatMoney } from "../utils/propFirms";
import {
  AXIS_TICK,
  CHART_GREEN,
  CHART_RED,
  EQUITY_CURVE_TYPE,
  EQUITY_GRID,
  EQUITY_LINE,
  tooltipStyle,
} from "../utils/chartTheme";

interface Props {
  trades: Trade[];
}

/** Un seul nombre de tirages. Deux mille suffisent, et personne n'a envie de
 *  choisir entre 100 et 10 000 avant de savoir ce que la page va lui dire. */
const TIRAGES = 2000;

/**
 * MONTE-CARLO — « où va mon compte, si je continue comme ça ? »
 *
 * ══ CE QUE LA PAGE DEMANDAIT AVANT ══
 *
 * Une colonne de cinq cartes : un sélecteur de prop firm, un sélecteur de
 * challenge, puis DOUZE champs numériques (solde, objectif, drawdown, perte
 * journalière, drawdown glissant, jours max, trades par jour max, risque par
 * trade), un basculement « journal / manuel » qui rouvrait quatre champs de
 * plus, et une rangée de cinq boutons pour choisir le nombre de tirages. Le
 * tout en anglais codé en dur, dans une application traduite en douze langues.
 *
 * Le trader devait donc REMPLIR UN FORMULAIRE DE PROP FIRM pour obtenir une
 * réponse sur SON compte. Et les valeurs par défaut venaient d'un challenge
 * Apex 50k — pas de lui.
 *
 * ══ CE QU'ELLE DEMANDE MAINTENANT ══
 *
 * Cinq réglages, tous préremplis DEPUIS SES PROPRES DONNÉES, tous sur une
 * seule ligne :
 *
 *   • le solde de son compte actif ;
 *   • ce qu'il risque par trade — sa perte médiane réelle ;
 *   • l'horizon, en jours ;
 *   • l'objectif et la limite de perte, en % du solde.
 *
 * Et ce qu'elle NE demande plus, parce qu'elle le sait : combien de trades il
 * prend par jour (mesuré sur son journal), et à quoi ressemblent ses gains et
 * ses pertes (elle les rejoue tels quels, par tirage avec remise — c'est tout
 * l'intérêt d'un Monte-Carlo sur un journal).
 *
 * Aucun préréglage. Aucun nom de prop firm. La simulation part de la situation
 * du trader, pas d'un catalogue.
 *
 * ══ ET ELLE RÉPOND TOUTE SEULE ══
 *
 * La page se lançait vide, sur un « configure your parameters and run a
 * simulation ». Elle tire maintenant dès l'ouverture, et retire à chaque
 * changement de réglage : on déplace un curseur, la réponse suit.
 */
export default function MonteCarloPage({ trades }: Props) {
  const { t } = useT();
  const { activeAccount } = useAccounts();

  const samples = useMemo(() => extractRSamples(trades), [trades]);
  const stats = useMemo(() => computeStatistics(samples), [samples]);

  /* ── LES DÉFAUTS VIENNENT DU TRADER ────────────────────────────────────
     Pas d'un challenge Apex 50k. Le solde est celui de son compte actif ; le
     risque par trade est sa perte moyenne réelle ; la cadence est celle qu'on
     lit dans son journal. */
  const defauts = useMemo(() => {
    const solde = Math.max(1000, Math.round(activeAccount?.startingBalance || 10000));
    const risque = Math.max(1, Math.round(stats.avgLossPnl || solde * 0.01));
    // La cadence RÉELLE : nombre de trades ÷ nombre de journées tradées.
    const jours = new Set(trades.map((tr) => tr.date)).size;
    const parJour = jours > 0 ? Math.min(10, Math.max(1, Math.round(trades.length / jours))) : 3;
    return { solde, risque, parJour };
  }, [activeAccount?.startingBalance, stats.avgLossPnl, trades]);

  const [solde, setSolde] = useState(defauts.solde);
  const [risque, setRisque] = useState(defauts.risque);
  const [horizon, setHorizon] = useState(30);
  const [objectifPct, setObjectifPct] = useState(10);
  const [limitePct, setLimitePct] = useState(10);

  // Les défauts arrivent APRÈS le premier rendu (le compte actif se charge en
  // parallèle) : on les adopte tant que le trader n'a rien touché lui-même.
  const touche = useRef(false);
  useEffect(() => {
    if (touche.current) return;
    setSolde(defauts.solde);
    setRisque(defauts.risque);
  }, [defauts.solde, defauts.risque]);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloResult | null>(null);

  const params: MonteCarloParams = useMemo(
    () => ({
      startingBalance: solde,
      profitTarget: Math.round((solde * objectifPct) / 100),
      maxDrawdown: Math.round((solde * limitePct) / 100),
      // Les mécaniques de challenge que le trader n'a plus à saisir : elles ne
      // décrivent pas SA situation, elles décrivent un contrat de prop firm.
      maxDailyLoss: 0,
      trailingDrawdown: false,
      maxTradingDays: horizon,
      maxTradesPerDay: defauts.parJour,
      riskPerTrade: risque,
      simulations: TIRAGES,
    }),
    [solde, objectifPct, limitePct, horizon, defauts.parJour, risque],
  );

  /* ── ELLE TIRE TOUTE SEULE ────────────────────────────────────────────
     À l'ouverture, puis 250 ms après le dernier changement de réglage. Deux
     mille tirages sur une centaine de trades, c'est une poignée de
     millisecondes : rien ne justifie de faire attendre un clic. */
  useEffect(() => {
    if (samples.length < 5) return;
    setRunning(true);
    const id = setTimeout(() => {
      setResult(runMonteCarlo(params, samples));
      setRunning(false);
    }, 250);
    return () => clearTimeout(id);
  }, [params, samples]);

  const reinitialiser = useCallback(() => {
    touche.current = false;
    setSolde(defauts.solde);
    setRisque(defauts.risque);
    setHorizon(30);
    setObjectifPct(10);
    setLimitePct(10);
  }, [defauts]);

  const actions = useMemo(
    () => (
      <button
        onClick={reinitialiser}
        className="btn-ghost btn-sm shrink-0"
        title={t("mc.resetHint")}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("mc.reset")}</span>
      </button>
    ),
    [reinitialiser, t],
  );
  usePageActions(actions);

  if (samples.length < 5) {
    return (
      <div className="mx-auto max-w-[1100px] p-4 md:p-5">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shuffle className="mb-5 h-12 w-12 text-[var(--tv-highlight)] opacity-40" />
          <h3 className="tv-title mb-1.5">{t("mc.emptyTitle")}</h3>
          <p className="max-w-sm text-sm text-slate-500">{t("mc.emptyBody")}</p>
        </div>
      </div>
    );
  }

  const se = result ? monteCarloSE(result.passRate, result.runs.length) : 0;

  return (
    <div className="mx-auto max-w-[1100px] space-y-3 p-4 md:p-5">
      {/* ══ LES CINQ RÉGLAGES ═══════════════════════════════════════════ */}
      <section className="glass animate-fade-in-up rounded-3xl px-4 py-4 sm:px-5">
        <div className="mc-params">
          <Reglage
            label={t("mc.balance")}
            value={solde}
            onChange={(v) => {
              touche.current = true;
              setSolde(v);
            }}
            min={1000}
            max={500000}
            step={1000}
            format={(v) => formatMoney(v)}
          />
          <Reglage
            label={t("mc.risk")}
            value={risque}
            onChange={(v) => {
              touche.current = true;
              setRisque(v);
            }}
            min={1}
            max={Math.max(50, Math.round(solde * 0.1))}
            step={Math.max(1, Math.round(solde * 0.001))}
            format={(v) => formatMoney(v)}
            hint={`${((risque / solde) * 100).toFixed(2)}%`}
          />
          <Reglage
            label={t("mc.horizon")}
            value={horizon}
            onChange={setHorizon}
            min={5}
            max={120}
            step={1}
            format={(v) => `${v} ${t("mc.days")}`}
          />
          <Reglage
            label={t("mc.target")}
            value={objectifPct}
            onChange={setObjectifPct}
            min={1}
            max={50}
            step={1}
            format={(v) => `+${v}%`}
            hint={formatMoney(Math.round((solde * objectifPct) / 100))}
          />
          <Reglage
            label={t("mc.limit")}
            value={limitePct}
            onChange={setLimitePct}
            min={1}
            max={50}
            step={1}
            format={(v) => `-${v}%`}
            hint={formatMoney(Math.round((solde * limitePct) / 100))}
          />
        </div>

        {/* CE QUE LA PAGE SAIT DÉJÀ — et ne demande donc pas. */}
        <p className="tv-hint mt-3 border-t border-white/[0.05] pt-3">
          {t("mc.derivedFrom")
            .replace("{n}", String(stats.totalSamples))
            .replace("{pace}", String(defauts.parJour))}
        </p>
      </section>

      {!result ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className={cn("space-y-3 transition-opacity", running && "opacity-50")}>
          {/* ══ LE VERDICT ═══════════════════════════════════════════════ */}
          <section className="glass animate-fade-in-up stagger-1 rounded-3xl px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <div className="tv-label text-slate-500">{t("mc.verdictLabel")}</div>
                <div
                  className={cn(
                    "tv-figure mt-1 text-4xl leading-none md:text-5xl",
                    result.passRate >= 0.5 ? "rp-pos" : "rp-warn",
                  )}
                >
                  {(result.passRate * 100).toFixed(0)}%
                </div>
                <p className="tv-prose mt-2 max-w-md text-slate-400">
                  {t("mc.verdictBody")
                    .replace("{target}", `+${objectifPct}%`)
                    .replace("{limit}", `-${limitePct}%`)
                    .replace("{days}", String(horizon))}
                </p>
              </div>
              {/* `mc-facts` : sur téléphone, quatre faits « shrink-0 » à côté
                  d'un chiffre de 48px demandaient 499px dans 319 disponibles.
                  Ils passent en grille de deux, et ne reprennent leur rangée
                  et leurs filets qu'à partir de `sm`. */}
              <div className="mc-facts">
                <Fait
                  label={t("mc.failRate")}
                  value={`${(result.failRate * 100).toFixed(0)}%`}
                  tone="neg"
                />
                <Fait
                  label={t("mc.timeoutRate")}
                  value={`${(result.timeOutRate * 100).toFixed(0)}%`}
                />
                <Fait
                  label={t("mc.medianDD")}
                  value={formatMoney(result.medianMaxDD)}
                  hint={`${((result.medianMaxDD / solde) * 100).toFixed(1)}%`}
                />
                <Fait
                  label={t("mc.daysToPass")}
                  value={result.avgDaysToPass > 0 ? result.avgDaysToPass.toFixed(0) : "—"}
                  hint={t("mc.days")}
                />
              </div>
            </div>

            {/* Les trois issues, dans une barre — pas trois pourcentages
                dispersés dans une grille de tuiles. */}
            <div className="mt-4">
              <div className="rp-mix" role="img" aria-label={t("mc.outcomes")}>
                {result.passRate > 0 && (
                  <span className="rp-fill-pos" style={{ width: `${result.passRate * 100}%` }} />
                )}
                {result.timeOutRate > 0 && (
                  <span
                    className="rp-fill-flat"
                    style={{ width: `${result.timeOutRate * 100}%` }}
                  />
                )}
                {result.failRate > 0 && (
                  <span className="rp-fill-neg" style={{ width: `${result.failRate * 100}%` }} />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Legende cls="rp-fill-pos" label={t("mc.passed")} />
                <Legende cls="rp-fill-flat" label={t("mc.timedOut")} />
                <Legende cls="rp-fill-neg" label={t("mc.failed")} />
                <span className="tv-hint ml-auto">
                  {t("mc.margin").replace("{se}", (se * 100).toFixed(1))}
                </span>
              </div>
            </div>
          </section>

          {/* ══ LA COURBE ════════════════════════════════════════════════ */}
          <Faisceau result={result} horizon={horizon} />

          {/* ══ LA DISTRIBUTION ══════════════════════════════════════════ */}
          <Histogramme result={result} />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LE FAISCEAU DE TRAJECTOIRES
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * Le graphe existait déjà, mais il n'avait AUCUN AXE DES ABSCISSES
 * (`tick={false}`) : on voyait une forme monter sans jamais savoir sur combien
 * de temps. Il porte maintenant les jours, et sa légende dit ce que chaque
 * bande veut dire au lieu de nommer des percentiles.
 */
function Faisceau({ result, horizon }: { result: MonteCarloResult; horizon: number }) {
  const { t } = useT();
  const sampled = result.runs.slice(0, 200);
  const maxLen = Math.max(...sampled.map((r) => r.equity.length), 1);

  const data = useMemo(() => {
    /* UN PAS = UN JOUR ENTIER. Soixante pas répartis sur trente jours
       donnaient des graduations à « J0 J2 J3 J5 J6 J8 J9 J11 » — des sauts
       irréguliers, parce que deux pas voisins tombaient parfois sur le même
       jour arrondi. */
    const steps = Math.max(2, Math.min(60, horizon));
    const out: {
      jour: number;
      p95: number;
      p75: number;
      p50: number;
      p25: number;
      p5: number;
    }[] = [];
    for (let i = 0; i <= steps; i++) {
      const idx = Math.floor((i / steps) * (maxLen - 1));
      const vals = sampled
        .map((r) => r.equity[Math.min(idx, r.equity.length - 1)])
        .sort((a, b) => a - b);
      const at = (q: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * q))];
      out.push({
        jour: Math.round((i / steps) * horizon),
        p95: at(0.95),
        p75: at(0.75),
        p50: at(0.5),
        p25: at(0.25),
        p5: at(0.05),
      });
    }
    return out;
  }, [sampled, maxLen, horizon]);

  const cible = result.params.startingBalance + result.params.profitTarget;
  const plancher = result.params.startingBalance - result.params.maxDrawdown;

  return (
    <section className="glass animate-fade-in-up stagger-2 rounded-3xl px-4 py-4 sm:px-5">
      <TitreGraphe titre={t("mc.chartPaths")} sous={t("mc.chartPathsSub")} />
      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_GREEN} stopOpacity={0.14} />
                <stop offset="55%" stopColor={CHART_GREEN} stopOpacity={0.05} />
                <stop offset="100%" stopColor={CHART_GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...EQUITY_GRID} />
            <XAxis
              dataKey="jour"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              tickFormatter={(v) => `${t("mc.dayShort")}${v}`}
            />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={(v) => formatMoney(v as number)}
              axisLine={false}
              tickLine={false}
              width={58}
              domain={["dataMin - 500", "dataMax + 500"]}
            />
            <ReferenceLine
              y={cible}
              stroke={CHART_GREEN}
              strokeWidth={1}
              strokeDasharray="6 4"
              label={{
                value: t("mc.target"),
                position: "insideTopLeft",
                fill: CHART_GREEN,
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={plancher}
              stroke={CHART_RED}
              strokeWidth={1}
              strokeDasharray="4 4"
              label={{
                value: t("mc.limit"),
                position: "insideBottomLeft",
                fill: CHART_RED,
                fontSize: 10,
              }}
            />
            <Area
              type={EQUITY_CURVE_TYPE}
              dataKey="p95"
              stroke="none"
              fill="url(#mcBand)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            <Area
              type={EQUITY_CURVE_TYPE}
              dataKey="p75"
              stroke="none"
              fill="rgb(var(--tv-chart-green-rgb) / 0.06)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            <Area
              type={EQUITY_CURVE_TYPE}
              dataKey="p25"
              stroke="none"
              fill="rgb(var(--tv-chart-green-rgb) / 0.06)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            {/* La médiane EST une courbe d'equity — projetée, mais une courbe
                d'equity. Elle porte donc le trait de la référence et son vert,
                qui ne suit pas le thème. */}
            <Line
              type={EQUITY_CURVE_TYPE}
              dataKey="p50"
              stroke={CHART_GREEN}
              {...EQUITY_LINE}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(v) => `${t("mc.dayShort")}${v}`}
              formatter={(value: number | string, name: string) => {
                const libelle: Record<string, string> = {
                  p95: t("mc.bandBest"),
                  p75: t("mc.bandGood"),
                  p50: t("mc.bandMedian"),
                  p25: t("mc.bandPoor"),
                  p5: t("mc.bandWorst"),
                };
                return [formatMoney(Number(value)), libelle[name] ?? name];
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-[var(--tv-chart-green)]" />
          <span className="tv-row-label">{t("mc.bandMedian")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-4 rounded-sm bg-[rgb(var(--tv-chart-green-rgb)/0.18)]"
          />
          <span className="tv-row-label">{t("mc.bandHalf")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-4 rounded-sm bg-[rgb(var(--tv-chart-green-rgb)/0.08)]"
          />
          <span className="tv-row-label">{t("mc.bandNine")}</span>
        </span>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   L'HISTOGRAMME DES ISSUES
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * Cinq barres de percentiles (P5, P25, P50, P75, P95) remplaçaient une
 * distribution. Elles disaient cinq points d'une courbe qu'on ne voyait pas —
 * et personne ne lit « P75 » comme un fait sur son compte.
 *
 * Voici la vraie distribution : les deux mille soldes finaux, rangés par
 * tranches. Vert au-dessus du solde de départ, rouge en dessous. On lit d'un
 * coup où le paquet se pose, et à quel point il traîne à gauche.
 */
function Histogramme({ result }: { result: MonteCarloResult }) {
  const { t } = useT();
  const depart = result.params.startingBalance;

  const { bins, max } = useMemo(() => {
    const vals = result.runs.map((r) => r.finalBalance);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const n = 28;
    const largeur = (hi - lo) / n || 1;
    const acc = Array.from({ length: n }, (_, i) => ({
      centre: lo + largeur * (i + 0.5),
      bas: lo + largeur * i,
      count: 0,
    }));
    for (const v of vals) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((v - lo) / largeur)));
      acc[i].count++;
    }
    return { bins: acc, max: Math.max(...acc.map((b) => b.count), 1) };
  }, [result]);

  return (
    <section className="glass animate-fade-in-up stagger-3 rounded-3xl px-4 py-4 sm:px-5">
      <TitreGraphe titre={t("mc.chartDist")} sous={t("mc.chartDistSub")} />
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...EQUITY_GRID} />
            <XAxis
              dataKey="centre"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
              tickFormatter={(v) => formatMoney(v as number)}
            />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={34}
              allowDecimals={false}
            />
            <ReferenceLine x={depart} stroke="var(--tv-border-strong)" strokeDasharray="3 3" />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(v) => formatMoney(Number(v))}
              formatter={(value: number | string) => [
                `${value} / ${result.runs.length}`,
                t("mc.paths"),
              ]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bins.map((b, i) => (
                <Cell
                  key={i}
                  fill={b.centre >= depart ? CHART_GREEN : CHART_RED}
                  fillOpacity={0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Case
          label={t("mc.p5")}
          value={formatMoney(result.finalBalanceDistribution.p5)}
          delta={result.finalBalanceDistribution.p5 - depart}
        />
        <Case
          label={t("mc.p25")}
          value={formatMoney(result.finalBalanceDistribution.p25)}
          delta={result.finalBalanceDistribution.p25 - depart}
        />
        <Case
          label={t("mc.p50")}
          value={formatMoney(result.finalBalanceDistribution.p50)}
          delta={result.finalBalanceDistribution.p50 - depart}
        />
        <Case
          label={t("mc.p95")}
          value={formatMoney(result.finalBalanceDistribution.p95)}
          delta={result.finalBalanceDistribution.p95 - depart}
        />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LES PIÈCES
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * UN RÉGLAGE — un libellé, sa valeur lisible, et un curseur.
 *
 * L'ancienne page posait un `<input type="number">` de 80px : pour passer de
 * 3 000 à 5 000, il fallait sélectionner le texte et retaper. Un curseur donne
 * l'ordre de grandeur et le sens du réglage dans le même geste ; le champ
 * reste là, sous le doigt, quand on veut une valeur exacte.
 */
function Reglage({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="tv-label truncate text-slate-500">{label}</span>
        {hint && <span className="tv-figure shrink-0 text-[10px] text-slate-600">{hint}</span>}
      </div>
      <div className="tv-figure mb-1.5 text-base leading-none text-white">{format(value)}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full"
      />
    </div>
  );
}

function TitreGraphe({ titre, sous }: { titre: string; sous: string }) {
  return (
    <div className="mb-3">
      <h4 className="flex items-center gap-2">
        <span className="tv-label shrink-0 text-slate-400">{titre}</span>
        <span aria-hidden className="rp-rule h-px flex-1" />
      </h4>
      <p className="tv-row-label mt-1">{sous}</p>
    </div>
  );
}

function Fait({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neg";
}) {
  return (
    <div className="min-w-0">
      <div className="tv-label truncate text-slate-500">{label}</div>
      <div
        className={cn(
          "tv-figure mt-1 truncate text-sm leading-none",
          tone === "neg" ? "rp-neg" : "text-white",
        )}
      >
        {value}
      </div>
      {hint && <div className="tv-row-label mt-1 truncate">{hint}</div>}
    </div>
  );
}

function Legende({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", cls)} />
      <span className="tv-row-label">{label}</span>
    </span>
  );
}

function Case({ label, value, delta }: { label: string; value: string; delta: number }) {
  return (
    <div className="rp-kpi">
      <div className="tv-label truncate text-slate-500">{label}</div>
      <div className="tv-figure mt-1 truncate text-sm text-white">{value}</div>
      <div
        className={cn("tv-figure mt-0.5 truncate text-[10px]", delta >= 0 ? "rp-pos" : "rp-neg")}
      >
        {formatPnl(delta)}
      </div>
    </div>
  );
}
