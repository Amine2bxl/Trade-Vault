import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Shuffle,
  RotateCcw,
  BookOpen,
  SlidersHorizontal,
  Upload,
  X,
  LineChart,
  BarChart3,
  ListTree,
} from "lucide-react";
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
import { useAvailableHeight } from "../hooks/useAvailableHeight";
import { Kpi, KpiGrid, PageToolbar, SubNav, type SubNavItem } from "@/shared/ui";
import {
  extractRSamples,
  runMonteCarlo,
  computeStatistics,
  monteCarloSE,
  generateSamples,
  computeExpectancy,
  computeProfitFactor,
  deriveRFromPnl,
  type MonteCarloParams,
  type MonteCarloResult,
  type RMultipleSample,
} from "../utils/monteCarlo";
import { parseCsv, guessMapping, mapRowsToTrades, rejectFile } from "../utils/csvImport";
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

/** D'où viennent les trades rejoués. */
type Source = "journal" | "manual" | "csv";

/** Les trois lectures d'un même résultat. */
type Vue = "paths" | "dist" | "details";

/**
 * MONTE-CARLO — « où va mon compte, si je continue comme ça ? »
 *
 * ══ CE QUE LA PAGE DEMANDE ══
 *
 * Cinq réglages, tous préremplis DEPUIS SES PROPRES DONNÉES : le solde du
 * compte actif, ce qu'il risque par trade (sa perte médiane réelle),
 * l'horizon, l'objectif et la limite de perte. Ce qu'elle NE demande pas,
 * parce qu'elle le sait : la cadence (mesurée sur le journal) et la forme de
 * ses gains et pertes (rejoués tels quels, par tirage avec remise).
 *
 * ══ CE QUE LA REFONTE CHANGE ══
 *
 * La page était un ROULEAU : une carte de réglages de 320px en tête — cinq
 * curseurs toujours dépliés, plus quatre champs de saisie ou un dépôt de
 * fichier selon la source —, puis le verdict, puis deux graphes. Autrement
 * dit : sur un téléphone, il fallait faire défiler tout le formulaire pour
 * atteindre la RÉPONSE, à chaque ouverture, alors que neuf fois sur dix on ne
 * touche à aucun réglage.
 *
 * Quatre décisions :
 *
 *   1. ON CHOISIT SA SOURCE, EXPLICITEMENT. La page s'ouvrait déjà simulée sur
 *      le journal, sans que personne ne l'ait demandé : un résultat s'affichait
 *      avant qu'on sache sur QUOI il portait. Trois boutons de même poids,
 *      aucun présélectionné, et celui du journal annonce combien de trades il
 *      va prendre. Tant qu'aucun n'est cliqué, rien ne tourne.
 *   2. UN SEUL BLOC POUR TOUTES LES ENTRÉES. Les réglages vivaient dans une
 *      colonne latérale de 320px au-dessus de 1024px, et dans une FEUILLE
 *      ancrée en dessous — deux emplacements pour un même contenu, dont aucun
 *      n'était visible par défaut. Il fallait donc ouvrir un panneau pour
 *      savoir sur quoi tournait la simulation : c'était la friction principale
 *      de la page. Tout est maintenant dans un bloc unique, toujours à l'écran.
 *   3. LA RÉPONSE ENSUITE, ET ENTIÈRE. Le verdict — le pourcentage, la barre
 *      des trois issues — suit immédiatement le bloc d'entrées.
 *   4. UNE VUE À LA FOIS. Les deux graphes et le détail des percentiles sont
 *      trois lectures du MÊME tirage, pas trois sections à empiler.
 *
 * ══ ET ELLE RÉPOND TOUTE SEULE ══
 *
 * Une fois la source choisie, elle tire, et retire 250 ms après le dernier
 * changement de réglage : on déplace un curseur, la réponse suit.
 *
 * ══ L'ÉCHELLE NE BOUGE PAS ══
 *
 * Les deux graphes bornent leurs axes sur les RÉGLAGES (solde, cible, limite),
 * jamais sur les données tirées. Monte-Carlo étant stochastique, une échelle
 * dérivée du tirage se recalibrait à chaque relance : la ligne de cible
 * SEMBLAIT bouger alors que sa valeur ne changeait pas, et deux scénarios
 * devenaient incomparables à l'œil. Voir `domaineY` et le calcul des classes.
 */
export default function MonteCarloPage({ trades }: Props) {
  const { t } = useT();
  const { activeAccount } = useAccounts();
  const { boxRef, height } = useAvailableHeight();

  /* ══ D'OÙ VIENNENT LES TRADES ══════════════════════════════════════════
     Trois sources, la même page derrière :

       • LE JOURNAL — ses trades, rejoués tels quels. C'est le défaut, et c'est
         la meilleure source : elle porte la vraie forme de ses gains et de ses
         pertes, pas une moyenne.
       • LA SAISIE — win rate, gain moyen, perte moyenne, part de neutres. Le
         moteur en tire un échantillon de 500 trades synthétiques. C'est la
         seule façon d'éprouver une stratégie qu'on n'a pas encore tradée.
       • UN CSV — n'importe quel export. La lecture passe par le module
         d'import du produit (`csvImport`), déjà testé et déjà capable de
         deviner les colonnes de la plupart des brokers.

     `sourceSamples` est le SEUL point où les trois se rejoignent ; tout ce qui
     suit — statistiques, défauts, simulation — ne sait pas d'où viennent les
     tirages. */
  /**
   * `null` AU DÉPART — RIEN NE SE CHARGE TOUT SEUL.
   *
   * La source valait « journal » d'office : la page s'ouvrait déjà simulée, sur
   * des trades importés sans que personne ne l'ait demandé. On voyait un
   * résultat sans savoir sur QUOI il portait — et le sélecteur de source, noyé
   * dans une colonne latérale ou une feuille cachée, ne le disait qu'à qui
   * allait le chercher.
   *
   * Le trader choisit maintenant, explicitement, avant qu'un seul tirage ne
   * parte. « Importer mes trades TradeVault » est un BOUTON, avec le nombre de
   * trades qu'il va prendre écrit dessus.
   */
  const [source, setSource] = useState<Source | null>(null);

  // Saisie manuelle
  const [wr, setWr] = useState(50);
  const [avgWin, setAvgWin] = useState(1.5);
  const [avgLoss, setAvgLoss] = useState(1);
  const [beRate, setBeRate] = useState(0);

  // CSV
  const [csvSamples, setCsvSamples] = useState<RMultipleSample[] | null>(null);
  const [csvNom, setCsvNom] = useState<string | null>(null);
  const [csvErreur, setCsvErreur] = useState<string | null>(null);

  const journalSamples = useMemo(() => extractRSamples(trades), [trades]);

  const samples = useMemo(() => {
    // Aucune source choisie = aucun échantillon = aucun tirage. Le garde-fou
    // `samples.length < 5` plus bas suffit donc à tenir la page au repos.
    if (source === null) return [];
    if (source === "manual") {
      if (avgWin <= 0 || avgLoss <= 0) return [];
      return generateSamples(
        { winRate: wr / 100, avgWinR: avgWin, avgLossR: avgLoss, breakEvenRate: beRate / 100 },
        500,
      );
    }
    if (source === "csv") return csvSamples ?? [];
    return journalSamples;
  }, [source, journalSamples, csvSamples, wr, avgWin, avgLoss, beRate]);

  const stats = useMemo(() => computeStatistics(samples), [samples]);

  /* LES DÉFAUTS SE LISENT TOUJOURS DANS LE JOURNAL, JAMAIS DANS LA SOURCE.
     Mesuré : en saisie manuelle, `stats` décrit des trades SYNTHÉTIQUES dont
     le « P&L » vaut le multiple R lui-même (−1.0, +1.5). Le risque par trade
     par défaut, tiré de la perte moyenne, tombait donc à 1 $ — et une cible de
     1 000 $ devenait inatteignable : 0 % de réussite, quels que soient les
     réglages. Le risque doit venir de ce que le trader risque VRAIMENT. */
  const journalStats = useMemo(() => computeStatistics(journalSamples), [journalSamples]);

  /** Lecture d'un fichier — le module d'import fait tout le travail. */
  const lireCsv = useCallback(
    async (file: File) => {
      setCsvErreur(null);
      const refus = rejectFile({ name: file.name, size: file.size, type: file.type });
      if (refus) {
        setCsvErreur(t(`mc.csv_${refus}` as never));
        return;
      }
      try {
        const texte = await file.text();
        const { headers, rows } = parseCsv(texte);
        const { valid } = mapRowsToTrades(rows, guessMapping(headers));
        if (valid.length < 5) {
          setCsvErreur(t("mc.csv_tooFew").replace("{n}", String(valid.length)));
          return;
        }
        // Un CSV de courtier ne porte presque jamais de R : on le dérive de la
        // perte médiane du fichier. Voir `deriveRFromPnl` — extrait ici pour
        // être testable, cette branche n'étant vérifiable par aucun œil.
        const normalises = deriveRFromPnl(valid);
        setCsvSamples(extractRSamples(normalises));
        setCsvNom(`${file.name} · ${valid.length}`);
        setSource("csv");
      } catch {
        setCsvErreur(t("mc.csv_unreadable"));
      }
    },
    [t],
  );

  /* ── LES DÉFAUTS VIENNENT DU TRADER ────────────────────────────────────
     Pas d'un challenge Apex 50k. Le solde est celui de son compte actif ; le
     risque par trade est sa perte moyenne réelle ; la cadence est celle qu'on
     lit dans son journal. */
  const defauts = useMemo(() => {
    const solde = Math.max(1000, Math.round(activeAccount?.startingBalance || 10000));
    const risque = Math.max(1, Math.round(journalStats.avgLossPnl || solde * 0.01));
    // La cadence RÉELLE : nombre de trades ÷ nombre de journées tradées.
    const jours = new Set(trades.map((tr) => tr.date)).size;
    const parJour = jours > 0 ? Math.min(10, Math.max(1, Math.round(trades.length / jours))) : 3;
    return { solde, risque, parJour };
  }, [activeAccount?.startingBalance, journalStats.avgLossPnl, trades]);

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
  const [vue, setVue] = useState<Vue>("paths");

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

  /* L'en-tête de page ne porte plus qu'un rappel de la SOURCE : le bouton
     « réinitialiser » descend dans le panneau de réglages, à côté de ce qu'il
     réinitialise. Une action posée loin de son objet demande de deviner sur
     quoi elle agit. */
  const actions = useMemo(
    () => (
      <span className="tv-row-label hidden shrink-0 truncate sm:inline">
        {samples.length >= 5
          ? t("mc.sampleCount").replace("{n}", String(stats.totalSamples))
          : t("mc.source")}
      </span>
    ),
    [samples.length, stats.totalSamples, t],
  );
  usePageActions(actions);

  const se = result ? monteCarloSE(result.passRate, result.runs.length) : 0;

  const vues: readonly SubNavItem<Vue>[] = useMemo(
    () => [
      /* Les onglets portent un NOM COURT, pas le titre du graphe. « Where the
         account goes » (22 caractères) débordait de la barre sur un téléphone,
         et le titre reste écrit en tête du graphe juste dessous — l'onglet n'a
         pas à le répéter, il a à le désigner. */
      /* L'icône DISPARAÎT sous 640px. Trois onglets + le bouton des réglages
         demandaient 383px dans les 359 disponibles d'un iPhone SE : la rangée
         défilait, et le troisième onglet vivait hors de l'écran. Sans les trois
         icônes (18px chacune), tout tient. L'icône est un appui de repérage,
         le mot est l'information : c'est l'icône qui cède. */
      {
        id: "paths",
        label: t("mc.viewPaths"),
        icon: <LineChart className="hidden h-3.5 w-3.5 sm:block" />,
      },
      {
        id: "dist",
        label: t("mc.viewDist"),
        icon: <BarChart3 className="hidden h-3.5 w-3.5 sm:block" />,
      },
      {
        id: "details",
        label: t("mc.viewDetails"),
        icon: <ListTree className="hidden h-3.5 w-3.5 sm:block" />,
      },
    ],
    [t],
  );

  const panneau = (
    <PanneauReglages
      source={source}
      setSource={setSource}
      stats={stats}
      wr={wr}
      setWr={setWr}
      avgWin={avgWin}
      setAvgWin={setAvgWin}
      avgLoss={avgLoss}
      setAvgLoss={setAvgLoss}
      beRate={beRate}
      setBeRate={setBeRate}
      csvNom={csvNom}
      csvErreur={csvErreur}
      onCsv={lireCsv}
      onCsvClear={() => {
        setCsvSamples(null);
        setCsvNom(null);
        setCsvErreur(null);
      }}
      solde={solde}
      setSolde={(v) => {
        touche.current = true;
        setSolde(v);
      }}
      risque={risque}
      setRisque={(v) => {
        touche.current = true;
        setRisque(v);
      }}
      horizon={horizon}
      setHorizon={setHorizon}
      objectifPct={objectifPct}
      setObjectifPct={setObjectifPct}
      limitePct={limitePct}
      setLimitePct={setLimitePct}
      parJour={defauts.parJour}
      journalCount={journalSamples.length}
    />
  );

  return (
    // Même correction que la page Calendrier, et même raison. La hauteur
    // mesurée est une CIBLE (« remplis l'écran »), pas un plafond (« tiens
    // dans l'écran, quoi qu'il en coûte »).
    //
    // Avec `height` + `overflow-hidden`, la barre d'outils, le verdict, le
    // graphe et la colonne de réglages se disputaient une hauteur fixe : sur un
    // portable, le verdict écrasait le graphe, et la colonne de réglages —
    // pourtant `overflow-y-auto` — se retrouvait tronquée sans que rien ne
    // puisse défiler à l'échelle de la page.
    <div
      ref={boxRef}
      style={height ? { minHeight: height } : undefined}
      className="mx-auto flex h-full max-w-[1400px] flex-col overflow-y-auto p-3 md:p-4"
    >
      {/* ══ LA BARRE D'OUTILS ════════════════════════════════════════════
          Navigation des trois lectures à gauche, réglages à droite. Elle est
          fixe en tête de page : on change de vue sans jamais scroller. */}
      {/* Le bouton « réglages » a disparu de cette barre, et la feuille qu'il
          ouvrait avec lui : les réglages sont maintenant TOUJOURS à l'écran,
          dans le bloc juste en dessous. Un panneau qu'il faut ouvrir pour
          savoir sur quoi tourne la simulation était la friction principale de
          la page. */}
      {result && (
        <div className="shrink-0">
          <PageToolbar>
            <SubNav items={vues} value={vue} onChange={setVue} ariaLabel={t("mc.outcomes")} />
          </PageToolbar>
        </div>
      )}

      {/* ══ LE BLOC UNIQUE ═══════════════════════════════════════════════
          Tout ce que la simulation prend en entrée, à un seul endroit,
          toujours visible : la source, puis les paramètres. Il remplace la
          colonne latérale de 320px (grand écran) ET la feuille ancrée
          (mobile) — deux emplacements pour un même contenu, dont aucun n'était
          visible par défaut. */}
      <section className="glass mt-3 shrink-0 rounded-3xl px-4 py-4 sm:px-5">
        {panneau}
        <div className="mt-3 flex justify-end border-t border-[var(--tv-border)] pt-3">
          <button onClick={reinitialiser} className="btn-ghost btn-sm">
            <RotateCcw className="h-3.5 w-3.5" />
            {t("mc.reset")}
          </button>
        </div>
      </section>

      {/* `min-h-0` retiré : il autorisait cette zone à rétrécir sous son propre
          contenu, ce qui écrasait verdict et graphe dans un cadre de hauteur
          fixe. Les `min-h-0` PLUS BAS, eux, restent — ceux des sections de
          graphe sont indispensables pour que `ResponsiveContainer` puisse
          mesurer sa place au lieu de gonfler indéfiniment. */}
      <div className="mt-3 flex-1">
        {samples.length < 5 ? (
          /* Le garde-fou ne barre plus la PAGE, seulement les résultats : sans
             lui, un trader sans journal ne pouvait pas même atteindre la saisie
             manuelle — la seule qui lui permette d'éprouver sa stratégie. */
          /* Le repos, pas une erreur : tant qu'aucune source n'est choisie, la
             page attend, et le bloc au-dessus dit exactement ce qu'elle
             attend. */
          <div className="glass flex h-full min-h-[220px] flex-col items-center justify-center rounded-3xl px-6 py-10 text-center">
            <Shuffle className="mb-4 h-9 w-9 text-[var(--tv-highlight)] opacity-40" />
            <h3 className="tv-title mb-1.5">{t("mc.emptyTitle")}</h3>
            <p className="max-w-sm text-sm text-slate-500">
              {source === "csv"
                ? t("mc.emptyCsv")
                : source === "manual"
                  ? t("mc.emptyManual")
                  : t("mc.emptyBody")}
            </p>
          </div>
        ) : !result ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <div
            className={cn("flex h-full flex-col gap-3 transition-opacity", running && "opacity-50")}
          >
            <>
              {/* ══ LE VERDICT — il ouvre la page et ne bouge plus ══════════ */}
              <section className="glass shrink-0 animate-fade-in-up rounded-3xl px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0">
                    <div className="tv-label text-slate-500">{t("mc.verdictLabel")}</div>
                    <div
                      className={cn(
                        "tv-figure mt-1 text-[34px] leading-none md:text-5xl",
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
                  {/* DEUX FAITS, PLUS QUATRE.
                      « Taux d'échec » et « taux d'expiration » redisaient
                      exactement ce que la barre d'issues montre juste en
                      dessous — trois segments proportionnels. Leurs
                      pourcentages ont rejoint la légende de cette barre, sous
                      leur propre couleur : l'information est intacte, elle
                      n'est plus écrite deux fois.
                      Restent les deux chiffres que la barre ne peut PAS dire :
                      combien ça coûte en chemin (drawdown médian) et combien
                      de temps ça prend. */}
                  <div className="mc-facts">
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
                      <span
                        className="rp-fill-pos"
                        style={{ width: `${result.passRate * 100}%` }}
                      />
                    )}
                    {result.timeOutRate > 0 && (
                      <span
                        className="rp-fill-flat"
                        style={{ width: `${result.timeOutRate * 100}%` }}
                      />
                    )}
                    {result.failRate > 0 && (
                      <span
                        className="rp-fill-neg"
                        style={{ width: `${result.failRate * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Legende
                      cls="rp-fill-pos"
                      label={t("mc.passed")}
                      value={`${(result.passRate * 100).toFixed(0)}%`}
                    />
                    <Legende
                      cls="rp-fill-flat"
                      label={t("mc.timedOut")}
                      value={`${(result.timeOutRate * 100).toFixed(0)}%`}
                    />
                    <Legende
                      cls="rp-fill-neg"
                      label={t("mc.failed")}
                      value={`${(result.failRate * 100).toFixed(0)}%`}
                    />
                    <span className="tv-hint ml-auto">
                      {t("mc.margin").replace("{se}", (se * 100).toFixed(1))}
                    </span>
                  </div>
                </div>
              </section>

              {/* ══ LA LECTURE CHOISIE — elle remplit l'espace restant ═══════
                  `min-h-[340px]` est un FILET, pas une mise en page : les trois
                  vues montent un `ResponsiveContainer` en hauteur 100 %, qui ne
                  dessine RIEN si son parent n'a pas de hauteur définie. Tant
                  que la page portait une hauteur fixe, `flex-1` en donnait
                  toujours une ; maintenant qu'elle peut défiler, ce plancher
                  garantit que le graphe a de la place même quand la fenêtre est
                  courte — au lieu de disparaître en silence. */}
              <div className="min-h-[340px] flex-1">
                {vue === "paths" && <Faisceau result={result} horizon={horizon} />}
                {vue === "dist" && <Histogramme result={result} />}
                {vue === "details" && <Details result={result} />}
              </div>
            </>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LES RÉGLAGES
   ──────────────────────────────────────────────────────────────────────────*/

function PanneauReglages({
  source,
  setSource,
  stats,
  wr,
  setWr,
  avgWin,
  setAvgWin,
  avgLoss,
  setAvgLoss,
  beRate,
  setBeRate,
  csvNom,
  csvErreur,
  onCsv,
  onCsvClear,
  solde,
  setSolde,
  risque,
  setRisque,
  horizon,
  setHorizon,
  objectifPct,
  setObjectifPct,
  limitePct,
  setLimitePct,
  parJour,
  journalCount,
}: {
  source: Source | null;
  setSource: (s: Source) => void;
  stats: { totalSamples: number };
  wr: number;
  setWr: (v: number) => void;
  avgWin: number;
  setAvgWin: (v: number) => void;
  avgLoss: number;
  setAvgLoss: (v: number) => void;
  beRate: number;
  setBeRate: (v: number) => void;
  csvNom: string | null;
  csvErreur: string | null;
  onCsv: (f: File) => void;
  onCsvClear: () => void;
  solde: number;
  setSolde: (v: number) => void;
  risque: number;
  setRisque: (v: number) => void;
  horizon: number;
  setHorizon: (v: number) => void;
  objectifPct: number;
  setObjectifPct: (v: number) => void;
  limitePct: number;
  setLimitePct: (v: number) => void;
  parJour: number;
  /** Combien de trades le journal fournirait — écrit sur le bouton d'import,
   *  pour qu'on sache ce qu'on prend AVANT de cliquer. */
  journalCount: number;
}) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      {/* ── LA SOURCE — UN CHOIX EXPLICITE, PAS UN ONGLET ────────────────
          C'était une `SubNav` : trois onglets dont le premier était déjà
          sélectionné à l'ouverture. La page arrivait donc simulée sur le
          journal sans que personne ne l'ait demandé, et l'onglet actif — dans
          une colonne latérale ou une feuille cachée — ne le disait qu'à qui
          allait le chercher.
          Trois boutons de même poids, aucun présélectionné, et celui du
          journal annonce COMBIEN de trades il va prendre. Tant qu'aucun n'est
          cliqué, rien ne tourne. */}
      <div>
        <div className="tv-label mb-2 text-slate-500">{t("mc.source")}</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <ChoixSource
            actif={source === "journal"}
            onClick={() => setSource("journal")}
            icone={<BookOpen className="h-4 w-4" />}
            titre={t("mc.srcJournal")}
            detail={t("mc.sampleCount").replace("{n}", String(journalCount))}
            desactive={journalCount < 5}
          />
          <ChoixSource
            actif={source === "manual"}
            onClick={() => setSource("manual")}
            icone={<SlidersHorizontal className="h-4 w-4" />}
            titre={t("mc.srcManual")}
            detail={t("mc.srcManualHint")}
          />
          <ChoixSource
            actif={source === "csv"}
            onClick={() => setSource("csv")}
            icone={<Upload className="h-4 w-4" />}
            titre={t("mc.srcCsv")}
            detail={csvNom ?? t("mc.srcCsvHint")}
          />
        </div>
        {source === "journal" && (
          <p className="tv-hint mt-2">
            {t("mc.derivedFrom")
              .replace("{n}", String(stats.totalSamples))
              .replace("{pace}", String(parJour))}
          </p>
        )}
      </div>

      {/* Ce que la source demande — rien pour le journal, quatre nombres pour
          la saisie, un fichier pour le CSV. */}
      {source === "manual" && (
        <div className="space-y-3.5 border-t border-[var(--tv-border)] pt-4">
          <Reglage
            label={t("stats.winRate")}
            value={wr}
            onChange={setWr}
            min={1}
            max={99}
            step={1}
            unite="%"
            format={(v) => `${v}%`}
          />
          <Reglage
            label={t("mc.avgWin")}
            value={avgWin}
            onChange={setAvgWin}
            min={0.1}
            max={10}
            step={0.1}
            decimals={1}
            unite="R"
            format={(v) => `+${v.toFixed(1)}R`}
          />
          <Reglage
            label={t("mc.avgLoss")}
            value={avgLoss}
            onChange={setAvgLoss}
            min={0.1}
            max={10}
            step={0.1}
            decimals={1}
            unite="R"
            format={(v) => `-${v.toFixed(1)}R`}
          />
          <Reglage
            label={t("mc.beRate")}
            value={beRate}
            onChange={setBeRate}
            min={0}
            max={50}
            step={1}
            unite="%"
            format={(v) => `${v}%`}
          />
          {/* Ce que ces quatre nombres VALENT, tout de suite. Sans ça, on règle
              un win rate sans savoir s'il rend la stratégie gagnante — et
              c'est toute la question. */}
          <KpiGrid cols={2}>
            <Kpi
              inset
              label={t("quant.expectancy")}
              value={`${computeExpectancy(wr / 100, avgWin, avgLoss) >= 0 ? "+" : ""}${computeExpectancy(wr / 100, avgWin, avgLoss).toFixed(2)}R`}
              tone={computeExpectancy(wr / 100, avgWin, avgLoss) >= 0 ? "pos" : "neg"}
            />
            <Kpi
              inset
              label={t("reports.profitFactor")}
              value={
                computeProfitFactor(wr / 100, avgWin, avgLoss) >= 99
                  ? "99+"
                  : computeProfitFactor(wr / 100, avgWin, avgLoss).toFixed(2)
              }
            />
          </KpiGrid>
        </div>
      )}

      {source === "csv" && (
        <div className="border-t border-[var(--tv-border)] pt-4">
          <DepotCsv nom={csvNom} erreur={csvErreur} onFichier={onCsv} onVider={onCsvClear} />
        </div>
      )}

      {/* ── LES CINQ RÉGLAGES ───────────────────────────────────────────
          EN GRILLE, PAS EMPILÉS. Cinq curseurs l'un sous l'autre faisaient
          230px ; c'était supportable dans une colonne latérale de 320px de
          large, ça ne l'est plus dans un bloc posé AU-DESSUS du résultat —
          on repousserait le verdict hors de l'écran, ce que la refonte
          précédente avait justement corrigé.
          Deux colonnes dès 640px, trois à partir de 1024 : deux rangées au
          lieu de cinq, et les cinq valeurs restent lisibles d'un coup d'œil. */}
      <div className="grid gap-x-5 gap-y-3.5 border-t border-[var(--tv-border)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <Reglage
          label={t("mc.balance")}
          value={solde}
          onChange={setSolde}
          min={1000}
          max={500000}
          step={1000}
          format={(v) => formatMoney(v)}
        />
        <Reglage
          label={t("mc.risk")}
          value={risque}
          onChange={setRisque}
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

  /**
   * L'ÉCHELLE EST ANCRÉE SUR LES RÉGLAGES, JAMAIS SUR LE TIRAGE.
   *
   * Elle valait `["dataMin - 500", "dataMax + 500"]` : elle se recalculait donc
   * à partir des chemins SIMULÉS. Or Monte-Carlo est stochastique — relancer
   * sans rien changer donne d'autres extrêmes, donc une autre échelle. Les
   * deux repères, eux, gardaient la même valeur mais se retrouvaient à une
   * hauteur différente à l'écran : la ligne de cible SEMBLAIT bouger d'un
   * scénario à l'autre. Impossible, dans ces conditions, de comparer deux
   * tirages à l'œil — c'est pourtant tout l'intérêt d'en lancer plusieurs.
   *
   * Les trois ancres ci-dessous viennent des paramètres du trader : tant qu'il
   * n'y touche pas, l'échelle est identique à chaque relance, et les repères
   * restent cloués au même pixel.
   *
   * Aucun risque de rognage : un chemin s'ARRÊTE en touchant la cible ou la
   * limite (`runMonteCarlo` marque `passed`/`failed` et sort), il ne peut donc
   * les dépasser que du débordement d'un seul trade — ce que la marge absorbe.
   */
  const domaineY = useMemo<[number, number]>(() => {
    const solde = result.params.startingBalance;
    const bas = Math.min(plancher, cible, solde);
    const haut = Math.max(plancher, cible, solde);
    const marge = Math.max(1, (haut - bas) * 0.12);
    return [bas - marge, haut + marge];
  }, [result.params.startingBalance, cible, plancher]);

  return (
    <section className="glass flex min-h-0 flex-1 flex-col animate-fade-in-up rounded-3xl px-4 py-4 sm:px-5">
      <TitreGraphe titre={t("mc.chartPaths")} sous={t("mc.chartPathsSub")} />
      <div className="min-h-0 flex-1">
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
              domain={domaineY}
              allowDataOverflow
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
 * tranches. Vert au-dessus du solde de départ, rouge en dessous.
 */
function Histogramme({ result }: { result: MonteCarloResult }) {
  const { t } = useT();
  const depart = result.params.startingBalance;

  /**
   * LES CLASSES SONT ANCRÉES SUR LES RÉGLAGES, PAS SUR LE TIRAGE.
   *
   * Elles étaient bornées par `Math.min/max` des soldes finaux SIMULÉS : deux
   * relances des mêmes réglages ne produisaient donc pas les mêmes classes.
   * Les barres changeaient de largeur et de position, et la ligne de départ
   * se retrouvait ailleurs par rapport à elles — impossible de comparer deux
   * scénarios, alors que c'est exactement ce qu'on vient faire ici.
   *
   * Bornes fixes : la limite de perte et la cible, les deux murs que le
   * trader a lui-même posés. Les valeurs qui sortiraient de cette plage sont
   * rangées dans la classe extrême (`Math.min/max` sur l'indice), donc rien
   * n'est perdu du décompte — seule la position de la barre est bornée.
   */
  const { bins } = useMemo(() => {
    const vals = result.runs.map((r) => r.finalBalance);
    const solde = result.params.startingBalance;
    const bas0 = Math.min(solde - result.params.maxDrawdown, solde);
    const haut0 = Math.max(solde + result.params.profitTarget, solde);
    const marge = Math.max(1, (haut0 - bas0) * 0.06);
    const lo = bas0 - marge;
    const hi = haut0 + marge;
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
    return { bins: acc };
  }, [result]);

  return (
    <section className="glass flex min-h-0 flex-1 flex-col animate-fade-in-up stagger-3 rounded-3xl px-4 py-4 sm:px-5">
      <TitreGraphe titre={t("mc.chartDist")} sous={t("mc.chartDistSub")} />
      <div className="min-h-0 flex-1">
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
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LE DÉTAIL DES ISSUES
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * Les percentiles vivaient sous l'histogramme, en quatre cases que rien
 * n'annonçait — on les lisait sans savoir qu'on venait de changer d'unité (des
 * trajectoires aux soldes finaux). Ils sont maintenant une LECTURE nommée :
 * « où ça finit, chiffre par chiffre », avec le nombre de tirages qui la
 * fonde.
 */
function Details({ result }: { result: MonteCarloResult }) {
  const { t } = useT();
  const depart = result.params.startingBalance;
  const d = result.finalBalanceDistribution;

  return (
    <section className="glass flex min-h-0 flex-1 flex-col animate-fade-in-up stagger-3 rounded-3xl px-4 py-4 sm:px-5">
      <TitreGraphe titre={t("mc.chartDist")} sous={t("mc.chartDistSub")} />
      <KpiGrid cols={4}>
        {(
          [
            ["mc.p5", d.p5],
            ["mc.p25", d.p25],
            ["mc.p50", d.p50],
            ["mc.p95", d.p95],
          ] as const
        ).map(([key, value]) => (
          <Kpi
            key={key}
            inset
            label={t(key)}
            value={formatMoney(value)}
            tone={value >= depart ? "pos" : "neg"}
            hint={formatPnl(value - depart)}
          />
        ))}
      </KpiGrid>

      <div className="mt-4 border-t border-[var(--tv-border)] pt-4">
        <KpiGrid cols={4}>
          <Kpi
            inset
            label={t("mc.passed")}
            value={`${(result.passRate * 100).toFixed(1)}%`}
            tone="pos"
            hint={`${Math.round(result.passRate * result.runs.length)} / ${result.runs.length}`}
          />
          <Kpi
            inset
            label={t("mc.timedOut")}
            value={`${(result.timeOutRate * 100).toFixed(1)}%`}
            hint={`${Math.round(result.timeOutRate * result.runs.length)} / ${result.runs.length}`}
          />
          <Kpi
            inset
            label={t("mc.failed")}
            value={`${(result.failRate * 100).toFixed(1)}%`}
            tone="neg"
            hint={`${Math.round(result.failRate * result.runs.length)} / ${result.runs.length}`}
          />
          <Kpi
            inset
            label={t("mc.medianDD")}
            value={formatMoney(result.medianMaxDD)}
            tone="warn"
            hint={`${((result.medianMaxDD / depart) * 100).toFixed(1)}%`}
          />
        </KpiGrid>
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
  unite,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint?: string;
  /** Suffixe affiché dans le champ de saisie ($, %, R…). */
  unite?: string;
  decimals?: number;
}) {
  /* LE CHAMP EST UN BROUILLON TANT QU'ON TAPE.
     Écrire directement dans `value` à chaque frappe rend la saisie
     impossible : effacer « 10000 » pour taper « 25000 » passe par la chaîne
     vide, que `Number("")` transforme en 0 — et le curseur saute au minimum
     sous les doigts. Le brouillon garde ce qui est tapé ; la valeur ne remonte
     que si elle est lisible, et elle est bornée à la sortie du champ. */
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const affiche = brouillon ?? (decimals > 0 ? value.toFixed(decimals) : String(value));

  const poser = (brut: string) => {
    setBrouillon(brut);
    const n = Number(brut.replace(",", "."));
    if (brut.trim() !== "" && Number.isFinite(n)) onChange(n);
  };
  const fermer = () => {
    setBrouillon(null);
    const n = Number(affiche.replace(",", "."));
    onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
  };

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="tv-label truncate text-slate-500">{label}</span>
        {/* La valeur LUE, à droite du libellé : elle était sous le curseur,
            donc à trois lignes de son propre nom. */}
        <span className="tv-figure shrink-0 text-[11px] text-slate-400">{format(value)}</span>
      </div>

      {/* LA VALEUR EXACTE SE TAPE.
          Le curseur seul donne l'ordre de grandeur, jamais le nombre : régler
          un solde à 47 500 $ au pas de 1 000 est impossible, et régler un gain
          moyen à 1,7R au pixel près relève de la chance. Le champ porte la
          valeur, le curseur la déplace — les deux écrivent au même endroit. */}
      <div className="mc-num mb-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={affiche}
          onChange={(e) => poser(e.target.value)}
          onBlur={fermer}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          aria-label={label}
          /* `h-full` : sans lui le champ ne fait que la hauteur de sa ligne
             de texte — 18px mesurés — et cliquer dans le rembourrage de la
             boite ne le met pas au foyer. Il occupe maintenant les 36px. */
          className="tv-figure h-full min-w-0 flex-1 bg-transparent text-base leading-none text-white outline-none"
        />
        {unite && <span className="tv-figure shrink-0 text-xs text-slate-500">{unite}</span>}
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => {
          setBrouillon(null);
          onChange(Number(e.target.value));
        }}
        aria-label={label}
        className="w-full"
      />
      {hint && <div className="tv-row-label mt-1 truncate">{hint}</div>}
    </div>
  );
}

/**
 * LE DÉPÔT DE FICHIER.
 *
 * Il ne relit rien lui-même : `csvImport` — le module d'import du produit,
 * déjà testé, déjà capable de deviner les colonnes de la plupart des brokers —
 * fait tout le travail. Écrire ici une seconde façon de lire un CSV aurait
 * donné deux comportements pour un même fichier.
 */
function DepotCsv({
  nom,
  erreur,
  onFichier,
  onVider,
}: {
  nom: string | null;
  erreur: string | null;
  onFichier: (f: File) => void;
  onVider: () => void;
}) {
  const { t } = useT();
  const [survol, setSurvol] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (nom) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.06)] px-3.5 py-3">
        <Upload className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{nom}</span>
        <button
          onClick={onVider}
          aria-label={t("common.reset")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFichier(f);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center transition",
          survol
            ? "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.08)]"
            : "border-white/[0.12] hover:border-white/[0.2] hover:bg-white/[0.02]",
        )}
      >
        <Upload className="h-5 w-5 text-slate-500" />
        <span className="text-sm font-semibold text-white">{t("mc.csvDrop")}</span>
        <span className="tv-row-label">{t("mc.csvHint")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFichier(f);
          e.target.value = "";
        }}
      />
      {erreur && <p className="rp-neg mt-2 text-xs">{erreur}</p>}
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

/**
 * UNE ISSUE DE LA BARRE — sa couleur, son nom, ET SA PART.
 *
 * La légende ne portait que le nom. Les pourcentages, eux, vivaient dans deux
 * tuiles séparées au-dessus (« taux d'échec », « taux d'expiration ») : le
 * lecteur devait faire l'aller-retour entre un chiffre et un segment de barre
 * pour les rapprocher, et la même donnée occupait deux endroits de l'écran.
 *
 * En posant la valeur sous son propre segment, la barre se suffit — et les
 * deux tuiles ont pu disparaître sans rien perdre.
 */
/**
 * UNE DES TROIS SOURCES — un bouton, pas un onglet.
 *
 * La différence n'est pas cosmétique : un onglet dit « voici la vue courante »
 * et en présélectionne toujours une ; un bouton dit « choisis », et peut
 * n'avoir aucun élu. C'est ce qui permet à la page de rester au repos tant que
 * le trader n'a pas dit sur quoi il veut simuler.
 *
 * `detail` porte ce que le choix engage — le nombre de trades qui seront
 * importés, le nom du fichier déposé — parce que « Mon journal » seul ne dit
 * pas ce qu'on s'apprête à prendre.
 */
function ChoixSource({
  actif,
  onClick,
  icone,
  titre,
  detail,
  desactive,
}: {
  actif: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  titre: string;
  detail: string;
  desactive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-pressed={actif}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
        actif
          ? "border-[rgb(var(--tv-accent-rgb)/0.45)] bg-[rgb(var(--tv-accent-rgb)/0.08)]"
          : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] hover:border-[var(--tv-border-strong)]",
        desactive && "cursor-not-allowed opacity-40",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", actif ? "text-[var(--tv-accent)]" : "text-slate-500")}>
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{titre}</span>
        <span className="tv-row-label mt-0.5 block truncate">{detail}</span>
      </span>
    </button>
  );
}

function Legende({ cls, label, value }: { cls: string; label: string; value?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", cls)} />
      <span className="tv-row-label">{label}</span>
      {value && <span className="tv-figure text-[11px] text-slate-300">{value}</span>}
    </span>
  );
}
