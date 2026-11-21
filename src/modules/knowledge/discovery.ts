import { hasMeasuredRisk, isBreakEven, measuredR, type Trade } from "@/domain/trade";
import { getSessionForTrade } from "@/domain/quantStats";
import { compareChronological, verifiedPriorClosedTrade } from "@/domain/tradeOrder";
import { easternClockOf } from "@/domain/easternClock";
import {
  analyzeDimension,
  benjaminiHochberg,
  dimensionValue,
  FDR_ALPHA,
  sessionKey,
  type EdgeDimension,
} from "@/modules/research";
import { seedFrom } from "@/modules/probability/rng";
import {
  MIN_GROUP,
  MIN_GROUP_SESSIONS,
  MIN_R_DELTA,
  MIN_TRADES,
} from "@/modules/patterns/thresholds";
import { median } from "./build";
import { KnowledgeGraph } from "./graph";
import { sessionBlockDiff, DIFF_METHOD } from "./stats";
import type { MissedInput, SimulationInput } from "./types";

/**
 * LES DÉCOUVERTES — ce que les données montrent et que le trader n'a pas
 * demandé. Module PUR et déterministe (Neural Brain, lot 1).
 *
 * Un détecteur compare DEUX groupes de trades sur UNE dimension (une paire
 * d'erreurs, le rang du trade dans la journée, la note de setup…). Il ne
 * publie que si, à la fois :
 *
 *   1. chaque groupe atteint `MIN_GROUP` trades et `MIN_GROUP_SESSIONS`
 *      séances (sinon : rien, pas même un chiffre) ;
 *   2. l'intervalle bootstrap PAR SÉANCES de l'écart exclut zéro ;
 *   3. le q de Benjamini-Hochberg, calculé sur TOUTES les comparaisons
 *      testées par TOUS les détecteurs, reste sous `FDR_ALPHA`.
 *
 * Ce qui sort est une ASSOCIATION OBSERVÉE, jamais une cause : chaque
 * découverte porte ses explications concurrentes et une expérience mesurable
 * qui permettrait de trancher. Un scénario (setups manqués, hypothèses d'une
 * simulation) est étiqueté `hypothetical`.
 *
 * Les textes vivent dans l'i18n de l'app (`brain.disc.*`) : le module ne rend
 * que des clés et des nombres.
 */

export const DISCOVERY_VERSION = 1;

export type DiscoveryCategory =
  | "hidden_pattern"
  | "psychological_contradiction"
  | "execution_weakness"
  | "risk_anomaly"
  | "strategy_inefficiency"
  | "unexpected_strength"
  | "knowledge_gap";

export type DetectorId =
  | "edge_condition"
  | "mistake_pair"
  | "risk_after_loss"
  | "day_rank"
  | "setup_grade"
  | "confidence"
  | "missed_vs_taken"
  | "simulation_risk"
  | "data_gap";

/** Explications concurrentes — clés i18n `brain.alt.*`. */
export type AlternativeKey =
  | "regime"
  | "selection"
  | "labeling"
  | "single_outlier"
  | "costs"
  | "hindsight"
  | "day_context"
  | "sizing_rule"
  | "missing_data";

/** Expériences proposées — clés i18n `brain.exp.*`. */
export type ExperimentKey =
  | "focus_condition"
  | "reduce_condition"
  | "pair_check"
  | "fixed_risk"
  | "cap_trades"
  | "grade_before_entry"
  | "log_missed_live"
  | "align_simulation"
  | "complete_field";

export type EvidenceUnit = "pnl" | "risk_ratio" | "r" | "currency" | "share";

export interface DiscoveryEvidence {
  unit: EvidenceUnit;
  /** Groupe étudié. */
  n: number;
  sessions: number;
  /** Groupe de comparaison (0 pour une comparaison à une référence fixe). */
  nCompare: number;
  sessionsCompare: number;
  value: number;
  baseline: number;
  diff: number;
  /** Intervalle à 95 % de l'écart ; `null` pour un constat descriptif. */
  low: number | null;
  high: number | null;
  p: number | null;
  q: number | null;
  method: string;
  seed: number | null;
  iterations: number | null;
  version: number;
}

export interface Discovery {
  /** `détecteur:clé` — stable d'un calcul à l'autre (retour du trader, liens). */
  id: string;
  detector: DetectorId;
  category: DiscoveryCategory;
  /** Le sens de l'écart, pour choisir la formulation. */
  direction: "higher" | "lower";
  /** Valeurs nommées du titre (noms saisis, nombres) — jamais du texte rédigé. */
  params: Record<string, string | number>;
  evidence: DiscoveryEvidence;
  hypothetical: boolean;
  /** L'écart survit-il au retrait de son trade le plus extrême ? `null` sans objet. */
  fragile: boolean | null;
  /** Nœuds du graphe concernés (moyeux). */
  entities: string[];
  /** Trades du groupe étudié, puis du groupe de comparaison. */
  trades: string[];
  compareTrades: string[];
  alternatives: AlternativeKey[];
  experiment: ExperimentKey;
  /** Empreinte de la preuve : si elle change, une revue passée est à relire. */
  fingerprint: string;
}

export interface DiscoveryInput {
  trades: readonly Trade[];
  missed?: readonly MissedInput[];
  simulations?: readonly SimulationInput[];
  /** Compte du graphe (nœud de rattachement des constats globaux). */
  accountKey?: string;
}

/** Seuil de dérive entre le risque supposé par une simulation et le risque pris. */
export const SIMULATION_RISK_TOLERANCE = 0.25;
/** Part de trades au-delà de la tolérance à partir de laquelle la dérive est signalée. */
export const SIMULATION_RISK_SHARE = 0.25;
/** Couverture sous laquelle un champ manquant devient une lacune de connaissance. */
export const DATA_GAP_COVERAGE = 0.7;

// ── Outils communs ──────────────────────────────────────────────────────────

const nodeId = KnowledgeGraph.nodeId;

/** Séance d'un trade, cloisonnée par compte. */
function sessionOf(t: Trade): string {
  return `${t.accountId ?? ""}|${sessionKey(t)}`;
}

function groupBySession(list: readonly Trade[], value: (t: Trade) => number): number[][] {
  const map = new Map<string, number[]>();
  for (const t of list) {
    const k = sessionOf(t);
    let arr = map.get(k);
    if (!arr) map.set(k, (arr = []));
    arr.push(value(t));
  }
  return [...map.keys()].sort().map((k) => map.get(k)!);
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

interface Candidate {
  discovery: Omit<Discovery, "fingerprint">;
  /** p de la comparaison testée ; `null` pour un constat descriptif. */
  p: number | null;
  /** Un constat descriptif est publié par sa propre règle (sans test). */
  publish: boolean;
}

/**
 * Compare A et B (valeur par trade), avec garde d'échantillon, intervalle par
 * séances et test de fragilité. `null` sous les minimums.
 */
function compareGroups(
  a: readonly Trade[],
  b: readonly Trade[],
  value: (t: Trade) => number,
  seedKey: string,
): {
  evidence: DiscoveryEvidence;
  fragile: boolean;
} | null {
  if (a.length < MIN_GROUP || b.length < MIN_GROUP) return null;
  const sa = groupBySession(a, value);
  const sb = groupBySession(b, value);
  if (sa.length < MIN_GROUP_SESSIONS || sb.length < MIN_GROUP_SESSIONS) return null;
  const seed = seedFrom(`${seedKey}:v${DISCOVERY_VERSION}`);
  const d = sessionBlockDiff(sa, sb, { seed });
  if (!d) return null;
  // Fragilité : sans le trade de A le plus favorable au sens de l'écart,
  // l'écart garde-t-il son signe et au moins la moitié de sa taille ?
  const va = a.map(value).sort((x, y) => x - y);
  const without = d.diff > 0 ? va.slice(0, -1) : va.slice(1);
  const meanWithout = without.reduce((s, v) => s + v, 0) / Math.max(1, without.length);
  const diffWithout = meanWithout - d.meanB;
  const fragile =
    Math.sign(diffWithout) !== Math.sign(d.diff) || Math.abs(diffWithout) < Math.abs(d.diff) / 2;
  return {
    fragile,
    evidence: {
      unit: "pnl",
      n: a.length,
      sessions: sa.length,
      nCompare: b.length,
      sessionsCompare: sb.length,
      value: round(d.meanA),
      baseline: round(d.meanB),
      diff: round(d.diff),
      low: round(d.low),
      high: round(d.high),
      p: d.p,
      q: null,
      method: DIFF_METHOD,
      seed,
      iterations: d.iterations,
      version: DISCOVERY_VERSION,
    },
  };
}

const ids = (list: readonly Trade[]) => list.map((t) => t.id);

// ── 1. Conditions de performance (EdgeLab) ─────────────────────────────────

const EDGE_DIMENSIONS: readonly EdgeDimension[] = ["strategy", "symbol", "session", "weekday"];

function edgeConditions(input: DiscoveryInput): Candidate[] {
  const out: Candidate[] = [];
  const accountNode = nodeId("account", input.accountKey ?? "main");
  for (const dimension of EDGE_DIMENSIONS) {
    const report = analyzeDimension(input.trades, dimension);
    for (const cell of report.cells) {
      const b = cell.bootstrap;
      if (!b) continue;
      const kind = dimension === "weekday" ? null : dimension;
      const members = input.trades.filter((t) => dimensionValue(t, dimension) === cell.key);
      const positive = b.estimate > 0;
      out.push({
        p: b.p,
        publish: true,
        discovery: {
          id: `edge_condition:${dimension}:${cell.key}`,
          detector: "edge_condition",
          category: positive ? "unexpected_strength" : "strategy_inefficiency",
          direction: positive ? "higher" : "lower",
          params: { dimension, key: cell.key },
          evidence: {
            unit: "pnl",
            n: cell.n,
            sessions: cell.sessions,
            nCompare: 0,
            sessionsCompare: 0,
            value: round(b.estimate),
            baseline: 0,
            diff: round(b.estimate),
            low: round(b.low),
            high: round(b.high),
            p: b.p,
            q: null,
            method: `edgelab:${b.method}`,
            seed: b.seed,
            iterations: b.iterations,
            version: report.version,
          },
          hypothetical: false,
          fragile: cell.fragile,
          entities: [kind ? nodeId(kind, cell.key) : accountNode],
          trades: ids(members),
          compareTrades: [],
          alternatives: ["regime", "selection", "costs"],
          experiment: positive ? "focus_condition" : "reduce_condition",
        },
      });
    }
  }
  return out;
}

// ── 2. Paires d'erreurs ─────────────────────────────────────────────────────

function mistakePairs(input: DiscoveryInput): Candidate[] {
  const norm = (m: string) => m.trim().replace(/\s+/g, " ");
  const sets = new Map<string, Set<string>>();
  for (const t of input.trades)
    sets.set(t.id, new Set((t.mistakes ?? []).map(norm).filter(Boolean)));
  const names = [...new Set([...sets.values()].flatMap((s) => [...s]))].sort();
  const out: Candidate[] = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const both = input.trades.filter((t) => sets.get(t.id)!.has(a) && sets.get(t.id)!.has(b));
      if (both.length < MIN_GROUP) continue;
      const one = input.trades.filter((t) => sets.get(t.id)!.has(a) !== sets.get(t.id)!.has(b));
      const cmp = compareGroups(both, one, (t) => t.pnl, `mistake_pair:${a}|${b}`);
      if (!cmp) continue;
      out.push({
        p: cmp.evidence.p,
        publish: true,
        discovery: {
          id: `mistake_pair:${a}|${b}`,
          detector: "mistake_pair",
          category: "execution_weakness",
          direction: cmp.evidence.diff > 0 ? "higher" : "lower",
          params: { a, b },
          evidence: cmp.evidence,
          hypothetical: false,
          fragile: cmp.fragile,
          entities: [nodeId("mistake", a), nodeId("mistake", b)],
          trades: ids(both),
          compareTrades: ids(one),
          // Une erreur cochée APRÈS coup se coche plus volontiers sur une perte.
          alternatives: ["labeling", "selection", "single_outlier"],
          experiment: "pair_check",
        },
      });
    }
  return out;
}

// ── 3. Le risque après une perte ────────────────────────────────────────────

function riskAfterLoss(input: DiscoveryInput): Candidate[] {
  const ordered = [...input.trades].sort(compareChronological);
  const measured = ordered.filter((t) => hasMeasuredRisk(t));
  if (measured.length < MIN_GROUP) return [];
  const med = median(measured.map((t) => t.riskAmount));
  if (!med || med <= 0) return [];
  const afterLoss: Trade[] = [];
  const afterWin: Trade[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const cur = ordered[i];
    if (!hasMeasuredRisk(cur)) continue;
    const prev = verifiedPriorClosedTrade(ordered, i);
    if (!prev || isBreakEven(prev)) continue;
    (prev.pnl < 0 ? afterLoss : afterWin).push(cur);
  }
  const cmp = compareGroups(afterLoss, afterWin, (t) => t.riskAmount / med, "risk_after_loss");
  if (!cmp) return [];
  return [
    {
      p: cmp.evidence.p,
      publish: true,
      discovery: {
        id: "risk_after_loss",
        detector: "risk_after_loss",
        category: "risk_anomaly",
        direction: cmp.evidence.diff > 0 ? "higher" : "lower",
        params: { median: round(med, 2) },
        evidence: { ...cmp.evidence, unit: "risk_ratio" },
        hypothetical: false,
        fragile: cmp.fragile,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(afterLoss),
        compareTrades: ids(afterWin),
        alternatives: ["sizing_rule", "regime", "selection"],
        experiment: "fixed_risk",
      },
    },
  ];
}

// ── 4. Le rang du trade dans la journée ─────────────────────────────────────

/** L'heure d'entrée est-elle une preuve d'ordre dans la journée ? */
function hasEntryClock(t: Trade): boolean {
  if (easternClockOf(t.entryAt)) return true;
  if (t.broker || t.reviewPending) return false;
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(t.entryTime?.trim() ?? "");
}

function dayRank(input: DiscoveryInput): Candidate[] {
  const days = new Map<string, Trade[]>();
  for (const t of input.trades) {
    const k = sessionOf(t);
    let list = days.get(k);
    if (!list) days.set(k, (list = []));
    list.push(t);
  }
  const early: Trade[] = [];
  const late: Trade[] = [];
  for (const list of days.values()) {
    // Une seule heure manquante, et l'ordre de toute la journée est inconnu.
    if (!list.every(hasEntryClock)) continue;
    list.sort(compareChronological).forEach((t, i) => (i < 2 ? early : late).push(t));
  }
  const cmp = compareGroups(late, early, (t) => t.pnl, "day_rank");
  if (!cmp) return [];
  return [
    {
      p: cmp.evidence.p,
      publish: true,
      discovery: {
        id: "day_rank",
        detector: "day_rank",
        category: "hidden_pattern",
        direction: cmp.evidence.diff > 0 ? "higher" : "lower",
        params: { rank: 3 },
        evidence: cmp.evidence,
        hypothetical: false,
        fragile: cmp.fragile,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(late),
        compareTrades: ids(early),
        alternatives: ["day_context", "selection", "regime"],
        experiment: "cap_trades",
      },
    },
  ];
}

// ── 5 et 6. Ce que le trader déclare face à ce qui arrive ───────────────────

function selfAssessment(
  input: DiscoveryInput,
  detector: "setup_grade" | "confidence",
  high: (t: Trade) => boolean,
  low: (t: Trade) => boolean,
): Candidate[] {
  const usable = input.trades.filter((t) => !t.reviewPending);
  const a = usable.filter(high);
  const b = usable.filter(low);
  const cmp = compareGroups(a, b, (t) => t.pnl, detector);
  if (!cmp) return [];
  const agrees = cmp.evidence.diff > 0;
  return [
    {
      p: cmp.evidence.p,
      publish: true,
      discovery: {
        id: detector,
        detector,
        // Une note haute qui précède de MOINS bons résultats contredit l'auto-évaluation.
        category: agrees ? "unexpected_strength" : "psychological_contradiction",
        direction: agrees ? "higher" : "lower",
        params: {},
        evidence: cmp.evidence,
        hypothetical: false,
        fragile: cmp.fragile,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(a),
        compareTrades: ids(b),
        alternatives: ["labeling", "selection", "single_outlier"],
        experiment: "grade_before_entry",
      },
    },
  ];
}

// ── 7. Setups manqués face aux trades pris (HYPOTHÉTIQUE) ──────────────────

function missedVsTaken(input: DiscoveryInput): Candidate[] {
  // `estimatedR` vaut 0 quand le champ n'a pas été rempli : ce n'est pas une estimation.
  const missed = (input.missed ?? []).filter(
    (m) => Number.isFinite(m.estimatedR) && m.estimatedR !== 0,
  );
  if (missed.length < MIN_GROUP) return [];
  const symbols = new Set(missed.map((m) => m.symbol.trim().toUpperCase()).filter(Boolean));
  const taken = input.trades.filter((t) => symbols.has(t.symbol.trim().toUpperCase()));
  const rs = taken
    .map((t) => ({ t, r: measuredR(t) }))
    .filter((x): x is { t: Trade; r: number } => x.r !== null);
  if (rs.length < MIN_GROUP) return [];
  const missedMean = missed.reduce((s, m) => s + m.estimatedR, 0) / missed.length;
  const takenMean = rs.reduce((s, x) => s + x.r, 0) / rs.length;
  const diff = missedMean - takenMean;
  // Sans test possible (une estimation après coup n'est pas un tirage),
  // seul un écart au-dessus du plancher de bruit d'un R moyen est rapporté.
  if (Math.abs(diff) < MIN_R_DELTA) return [];
  return [
    {
      p: null,
      publish: true,
      discovery: {
        id: "missed_vs_taken",
        detector: "missed_vs_taken",
        category: "hidden_pattern",
        direction: diff > 0 ? "higher" : "lower",
        params: { symbols: [...symbols].sort().join(", ") },
        evidence: {
          unit: "r",
          n: missed.length,
          sessions: new Set(missed.map((m) => m.date)).size,
          nCompare: rs.length,
          sessionsCompare: new Set(rs.map((x) => sessionOf(x.t))).size,
          value: round(missedMean),
          baseline: round(takenMean),
          diff: round(diff),
          low: null,
          high: null,
          p: null,
          q: null,
          method: "descriptive:estimated-vs-measured-r",
          seed: null,
          iterations: null,
          version: DISCOVERY_VERSION,
        },
        hypothetical: true,
        fragile: null,
        entities: [...symbols].sort().map((s) => nodeId("symbol", s)),
        trades: [],
        compareTrades: rs.map((x) => x.t.id),
        alternatives: ["hindsight", "costs", "selection"],
        experiment: "log_missed_live",
      },
    },
  ];
}

// ── 8. Une simulation face au risque réellement pris ───────────────────────

function simulationRisk(input: DiscoveryInput): Candidate[] {
  const measured = input.trades.filter((t) => hasMeasuredRisk(t));
  if (measured.length < MIN_TRADES) return [];
  const actual = median(measured.map((t) => t.riskAmount))!;
  const out: Candidate[] = [];
  for (const s of input.simulations ?? []) {
    const assumed = s.riskPerTrade;
    if (!assumed || !(assumed > 0)) continue;
    const over = measured.filter((t) => t.riskAmount > assumed * (1 + SIMULATION_RISK_TOLERANCE));
    const share = over.length / measured.length;
    const drift = Math.abs(actual - assumed) / assumed;
    if (share < SIMULATION_RISK_SHARE && drift < SIMULATION_RISK_TOLERANCE) continue;
    out.push({
      p: null,
      publish: true,
      discovery: {
        id: `simulation_risk:${s.id}`,
        detector: "simulation_risk",
        category: "risk_anomaly",
        direction: actual > assumed ? "higher" : "lower",
        params: { name: s.name, share: round(share, 3) },
        evidence: {
          unit: "currency",
          n: measured.length,
          sessions: new Set(measured.map(sessionOf)).size,
          nCompare: 0,
          sessionsCompare: 0,
          value: round(actual, 2),
          baseline: round(assumed, 2),
          diff: round(actual - assumed, 2),
          low: null,
          high: null,
          p: null,
          q: null,
          method: `descriptive:median-risk-vs-assumption:tol=${SIMULATION_RISK_TOLERANCE}`,
          seed: s.seed,
          iterations: null,
          version: DISCOVERY_VERSION,
        },
        hypothetical: true,
        fragile: null,
        entities: [nodeId("simulation", s.id)],
        trades: ids(over),
        compareTrades: [],
        alternatives: ["sizing_rule", "missing_data"],
        experiment: "align_simulation",
      },
    });
  }
  return out;
}

// ── 9. Ce que le journal ne permet pas encore de savoir ────────────────────

function dataGaps(input: DiscoveryInput): Candidate[] {
  const n = input.trades.length;
  if (n < MIN_GROUP) return [];
  const fields: { key: string; covered: (t: Trade) => boolean }[] = [
    { key: "risk", covered: (t) => hasMeasuredRisk(t) },
    { key: "time", covered: (t) => getSessionForTrade(t) !== null },
    { key: "setup", covered: (t) => !t.reviewPending && !!t.strategy?.trim() },
  ];
  const out: Candidate[] = [];
  for (const f of fields) {
    const missing = input.trades.filter((t) => !f.covered(t));
    const coverage = (n - missing.length) / n;
    if (coverage >= DATA_GAP_COVERAGE) continue;
    out.push({
      p: null,
      publish: true,
      discovery: {
        id: `data_gap:${f.key}`,
        detector: "data_gap",
        category: "knowledge_gap",
        direction: "lower",
        params: { field: f.key },
        evidence: {
          unit: "share",
          n: n - missing.length,
          sessions: 0,
          nCompare: n,
          sessionsCompare: 0,
          value: round(coverage, 3),
          baseline: DATA_GAP_COVERAGE,
          diff: round(coverage - DATA_GAP_COVERAGE, 3),
          low: null,
          high: null,
          p: null,
          q: null,
          method: `coverage:${f.key}`,
          seed: null,
          iterations: null,
          version: DISCOVERY_VERSION,
        },
        hypothetical: false,
        fragile: null,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(missing),
        compareTrades: [],
        alternatives: ["missing_data"],
        experiment: "complete_field",
      },
    });
  }
  return out;
}

/** Le registre des détecteurs : en ajouter un = une ligne. */
const DETECTORS: readonly ((input: DiscoveryInput) => Candidate[])[] = [
  edgeConditions,
  mistakePairs,
  riskAfterLoss,
  dayRank,
  (i) =>
    selfAssessment(
      i,
      "setup_grade",
      (t) => t.setupQuality >= 4,
      (t) => t.setupQuality > 0 && t.setupQuality <= 2,
    ),
  (i) =>
    selfAssessment(
      i,
      "confidence",
      (t) => Number.isFinite(t.confidence) && t.confidence >= 75,
      (t) => Number.isFinite(t.confidence) && t.confidence > 0 && t.confidence < 50,
    ),
  missedVsTaken,
  simulationRisk,
  dataGaps,
];

export interface DiscoveryRun {
  discoveries: Discovery[];
  /** Comparaisons réellement testées (base de la correction des tests multiples). */
  tests: number;
  alpha: number;
  version: number;
}

/**
 * Exécute tous les détecteurs et ne garde que ce qui tient. Les découvertes
 * sont triées : constats testés d'abord (q croissant), puis descriptifs, puis
 * lacunes de données.
 */
export function runDiscoveries(input: DiscoveryInput): DiscoveryRun {
  const candidates = DETECTORS.flatMap((d) => d(input));
  const qs = benjaminiHochberg(candidates.map((c) => c.p));
  const kept: Discovery[] = [];
  candidates.forEach((c, i) => {
    const ev = c.discovery.evidence;
    if (c.p !== null) {
      const q = qs[i];
      if (q === null || q > FDR_ALPHA) return;
      if (ev.low === null || ev.high === null || !(ev.low > 0 || ev.high < 0)) return;
      ev.q = round(q);
    } else if (!c.publish) return;
    kept.push({ ...c.discovery, fingerprint: fingerprintOf(ev) });
  });
  const rank = (d: Discovery) =>
    d.category === "knowledge_gap" ? 2 : d.evidence.q === null ? 1 : 0;
  kept.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.evidence.q ?? 1) - (b.evidence.q ?? 1) ||
      Math.abs(b.evidence.diff) - Math.abs(a.evidence.diff) ||
      a.id.localeCompare(b.id),
  );
  return {
    discoveries: kept,
    tests: candidates.filter((c) => c.p !== null).length,
    alpha: FDR_ALPHA,
    version: DISCOVERY_VERSION,
  };
}

/** L'empreinte d'une preuve : échantillons et écart arrondi. */
export function fingerprintOf(ev: DiscoveryEvidence): string {
  return `${ev.n}/${ev.nCompare}/${round(ev.diff, 2)}`;
}

/**
 * Pose les découvertes dans le graphe : un nœud par découverte, relié aux
 * moyeux qu'elle concerne (`supported_by`, avec sa preuve). Une découverte
 * dont aucun moyeu n'existe reste rattachée au compte — jamais flottante.
 */
export function addDiscoveriesToGraph(g: KnowledgeGraph, run: DiscoveryRun, now: string): void {
  for (const d of run.discoveries) {
    const id = nodeId("discovery", d.id);
    g.addNode({
      id,
      kind: "discovery",
      key: d.id,
      label: d.detector,
      data: {
        category: d.category,
        n: d.evidence.n,
        q: d.evidence.q,
        hypothetical: d.hypothetical,
      },
    });
    let linked = 0;
    for (const target of d.entities) {
      const e = g.addEdge({
        source: id,
        target,
        type: "supported_by",
        weight: d.evidence.q === null ? 0.5 : 1 - Math.min(1, d.evidence.q / FDR_ALPHA) / 2,
        provenance: {
          origin: "statistical",
          validation: d.hypothetical ? "hypothesis" : "observed_association",
          methodology: `${d.detector}:${d.evidence.method}:v${d.evidence.version}`,
          confidence: d.evidence.q === null ? 0.5 : 1 - d.evidence.q,
          createdAt: now,
          sources: d.trades.slice(0, 50).map((t) => ({ table: "trades", id: t })),
          evidence: { n: d.evidence.n, nCompare: d.evidence.nCompare, q: d.evidence.q },
        },
      });
      if (e) linked++;
    }
    if (!linked) {
      for (const n of g.nodes.values()) {
        if (n.kind !== "account") continue;
        g.addEdge({
          source: id,
          target: n.id,
          type: "supported_by",
          weight: 0.5,
          provenance: {
            origin: "statistical",
            validation: d.hypothetical ? "hypothesis" : "observed_association",
            methodology: `${d.detector}:${d.evidence.method}:v${d.evidence.version}`,
            confidence: 0.5,
            createdAt: now,
            sources: [],
          },
        });
        break;
      }
    }
  }
}
