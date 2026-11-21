import { hasMeasuredRisk, isBreakEven, measuredR, type Trade } from "@/domain/trade";
import { getSessionForTrade } from "@/domain/quantStats";
import { compareChronological, verifiedPriorClosedTrade } from "@/domain/tradeOrder";
import {
  analyzeDimension,
  benjaminiHochberg,
  dimensionValue,
  FDR_ALPHA,
  type EdgeDimension,
} from "@/modules/research";
import { seedFrom } from "@/modules/probability/rng";
import {
  MIN_GROUP,
  MIN_GROUP_SESSIONS,
  MIN_R_DELTA,
  MIN_TRADES,
} from "@/modules/patterns/thresholds";
import {
  detectSignatures,
  hasEntryClock,
  median,
  sequence,
  sessionOf,
  ERROR_LIBRARY,
  type BehaviorContext,
} from "./behavior";
import { KnowledgeGraph } from "./graph";
import { sessionBlockDiff, sessionBlockSpearman, DIFF_METHOD } from "./stats";
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

export const DISCOVERY_VERSION = 2;

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
  | "data_gap"
  | "after_loss_outcome"
  | "loss_concentration"
  | "winrate_trap"
  | "combo"
  | "risk_vs_quality"
  | "process_outcome"
  | "plan_adherence"
  | "mistake_trend"
  | "planned_risk"
  | "untagged_signature"
  | "missed_avoided";

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
  | "missing_data"
  | "tagging_habit"
  | "luck"
  | "multiple_conditions";

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
  | "complete_field"
  | "pause_after_loss"
  | "review_segment"
  | "rr_target"
  | "process_checklist"
  | "plan_review"
  | "keep_tracking"
  | "planned_risk_rule"
  | "tag_honestly";

export type EvidenceUnit = "pnl" | "risk_ratio" | "r" | "currency" | "share" | "rho";

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
  /**
   * Impact potentiel : l'écart cumulé sur le groupe étudié (écart par trade ×
   * n), en monnaie du compte — une ARITHMÉTIQUE descriptive, pas un gain promis.
   */
  impact: number | null;
  /** Validation chronologique : le même sens d'écart sur les 30 % de séances les plus récentes ? */
  validation: "confirmed" | "not_confirmed" | "insufficient" | null;
  /** Niveau de confiance déclaré, dérivé de q, de la fragilité et de la validation. */
  confidence: "strong" | "moderate" | "tentative" | "descriptive";
}

export interface DiscoveryInput {
  trades: readonly Trade[];
  missed?: readonly MissedInput[];
  simulations?: readonly SimulationInput[];
  /** Compte du graphe (nœud de rattachement des constats globaux). */
  accountKey?: string;
  /** Réflexions (plan respecté) et intentions (risque prévu) par trade. */
  behavior?: BehaviorContext;
}

/** Seuil de dérive entre le risque supposé par une simulation et le risque pris. */
export const SIMULATION_RISK_TOLERANCE = 0.25;
/** Part de trades au-delà de la tolérance à partir de laquelle la dérive est signalée. */
export const SIMULATION_RISK_SHARE = 0.25;
/** Couverture sous laquelle un champ manquant devient une lacune de connaissance. */
export const DATA_GAP_COVERAGE = 0.7;

// ── Outils communs ──────────────────────────────────────────────────────────

const nodeId = KnowledgeGraph.nodeId;

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
  discovery: Omit<Discovery, "fingerprint" | "impact" | "validation" | "confidence"> &
    Partial<Pick<Discovery, "impact" | "validation">>;
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
  validation: Discovery["validation"];
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
    validation: holdoutCheck(a, b, value, d.diff),
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

/**
 * VALIDATION CHRONOLOGIQUE. Les séances sont ordonnées ; les 30 % les plus
 * récentes servent de contrôle : l'écart y garde-t-il son sens ? Sous trois
 * trades par groupe dans ce contrôle, on ne sait pas (`insufficient`).
 */
const HOLDOUT_SHARE = 0.3;
const HOLDOUT_MIN = 3;
function holdoutCheck(
  a: readonly Trade[],
  b: readonly Trade[],
  value: (t: Trade) => number,
  diff: number,
): Discovery["validation"] {
  const days = [...new Set([...a, ...b].map((t) => sessionOf(t).split("|")[1]))].sort();
  if (days.length < 2) return "insufficient";
  const cut = days[Math.floor(days.length * (1 - HOLDOUT_SHARE))];
  const recent = (t: Trade) => sessionOf(t).split("|")[1] >= cut;
  const ha = a.filter(recent).map(value);
  const hb = b.filter(recent).map(value);
  if (ha.length < HOLDOUT_MIN || hb.length < HOLDOUT_MIN) return "insufficient";
  const m = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sign(m(ha) - m(hb)) === Math.sign(diff) ? "confirmed" : "not_confirmed";
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
          validation: cmp.validation,
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
        validation: cmp.validation,
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
        validation: cmp.validation,
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
        validation: cmp.validation,
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

// ── 10. Le trade suivant une perte ─────────────────────────────────────────

/**
 * Après une perte PROUVÉE de la même séance, le trade suivant rend-il moins
 * qu'après un gain ? On conditionne sur le trade PRÉCÉDENT, jamais sur le
 * résultat du trade étudié : aucune sélection par l'issue.
 */
function afterLossOutcome(input: DiscoveryInput): Candidate[] {
  const seq = sequence(input.trades);
  const prevIs = (sign: 1 | -1) =>
    seq
      .filter((s) => s.prev && !isBreakEven(s.prev) && Math.sign(s.prev.pnl) === sign)
      .map((s) => s.trade);
  const afterLoss = prevIs(-1);
  const afterWin = prevIs(1);
  const cmp = compareGroups(afterLoss, afterWin, (t) => t.pnl, "after_loss_outcome");
  if (!cmp) return [];
  return [
    {
      p: cmp.evidence.p,
      publish: true,
      discovery: {
        id: "after_loss_outcome",
        detector: "after_loss_outcome",
        category: cmp.evidence.diff < 0 ? "execution_weakness" : "unexpected_strength",
        direction: cmp.evidence.diff > 0 ? "higher" : "lower",
        params: {},
        evidence: cmp.evidence,
        hypothetical: false,
        fragile: cmp.fragile,
        validation: cmp.validation,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(afterLoss),
        compareTrades: ids(afterWin),
        alternatives: ["day_context", "regime", "single_outlier"],
        experiment: "pause_after_loss",
      },
    },
  ];
}

// ── 11. Où se concentrent les pertes ───────────────────────────────────────

/** Part des pertes à partir de laquelle un segment est « concentré ». */
export const CONCENTRATION_SHARE = 0.3;
/** Et combien de fois sa part de trades, au moins. */
export const CONCENTRATION_RATIO = 2;

/**
 * Un segment (une erreur, une paire, l'état « après une perte », un setup,
 * une séance, une signature) qui porte une part des pertes très supérieure à
 * sa part des trades. Des TOTAUX, vrais à toute taille — mais un segment sous
 * `MIN_GROUP` trades n'est pas examiné. Deux segments au plus : la page n'est
 * pas un classement.
 */
function lossConcentration(input: DiscoveryInput): Candidate[] {
  const trades = input.trades.filter((t) => Number.isFinite(t.pnl));
  const losers = trades.filter((t) => t.pnl < 0 && !isBreakEven(t));
  if (trades.length < MIN_TRADES || losers.length < MIN_GROUP) return [];
  const totalLoss = losers.reduce((s, t) => s - t.pnl, 0);
  const segments = new Map<
    string,
    { kind: string; key: string; members: Trade[]; nodes: string[] }
  >();
  const put = (kind: string, key: string, t: Trade, nodes: string[]) => {
    const k = `${kind}:${key}`;
    let seg = segments.get(k);
    if (!seg) segments.set(k, (seg = { kind, key, members: [], nodes }));
    seg.members.push(t);
  };
  const norm = (m: string) => m.trim().replace(/\s+/g, " ");
  for (const t of trades) {
    const ms = [...new Set((t.mistakes ?? []).map(norm).filter(Boolean))].sort();
    for (const m of ms) put("mistake", m, t, [nodeId("mistake", m)]);
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++)
        put("pair", `${ms[i]} + ${ms[j]}`, t, [nodeId("mistake", ms[i]), nodeId("mistake", ms[j])]);
    const strategy = dimensionValue(t, "strategy");
    if (strategy) put("strategy", strategy, t, [nodeId("strategy", strategy)]);
    const session = dimensionValue(t, "session");
    if (session) put("session", session, t, [nodeId("session", session)]);
  }
  for (const s of sequence(trades))
    if (s.prev && !isBreakEven(s.prev) && s.prev.pnl < 0)
      put("after_loss", "after_loss", s.trade, [nodeId("account", input.accountKey ?? "main")]);
  const byId = new Map(trades.map((t) => [t.id, t]));
  for (const [sig, list] of detectSignatures(trades, input.behavior))
    for (const id of list) {
      const t = byId.get(id);
      if (t) put("signature", sig, t, [nodeId("error_pattern", sig)]);
    }

  const found = [...segments.values()]
    .filter((seg) => seg.members.length >= MIN_GROUP)
    .map((seg) => {
      const loss = seg.members.reduce((s, t) => s + (t.pnl < 0 ? -t.pnl : 0), 0);
      return {
        ...seg,
        loss,
        lossShare: loss / totalLoss,
        tradeShare: seg.members.length / trades.length,
      };
    })
    .filter(
      (seg) =>
        seg.lossShare >= CONCENTRATION_SHARE &&
        seg.lossShare >= CONCENTRATION_RATIO * seg.tradeShare,
    )
    .sort((a, b) => b.lossShare - a.lossShare || a.key.localeCompare(b.key))
    .slice(0, 2);

  return found.map((seg) => ({
    p: null,
    publish: true,
    discovery: {
      id: `loss_concentration:${seg.kind}:${seg.key}`,
      detector: "loss_concentration" as const,
      category: "risk_anomaly" as const,
      direction: "higher" as const,
      params: { segment: seg.kind, key: seg.key },
      evidence: {
        unit: "share" as const,
        n: seg.members.length,
        sessions: new Set(seg.members.map(sessionOf)).size,
        nCompare: trades.length,
        sessionsCompare: new Set(trades.map(sessionOf)).size,
        value: round(seg.lossShare, 3),
        baseline: round(seg.tradeShare, 3),
        diff: round(seg.lossShare - seg.tradeShare, 3),
        low: null,
        high: null,
        p: null,
        q: null,
        method: `descriptive:loss-share>=${CONCENTRATION_SHARE}&>=${CONCENTRATION_RATIO}x-trade-share`,
        seed: null,
        iterations: null,
        version: DISCOVERY_VERSION,
      },
      hypothetical: false,
      fragile: null,
      impact: round(-seg.loss, 2),
      entities: seg.nodes,
      trades: ids(seg.members),
      compareTrades: [],
      alternatives: ["selection", "labeling", "single_outlier"] as AlternativeKey[],
      experiment: "review_segment" as const,
    },
  }));
}

// ── 12. Le piège du taux de réussite ───────────────────────────────────────

/** Écart de taux de réussite (points) à partir duquel la question se pose. */
export const WINRATE_GAP = 0.1;

/**
 * Une condition qui GAGNE plus souvent que le reste mais RAPPORTE moins par
 * trade : le taux de réussite y masque une espérance plus faible (petits gains,
 * grosses pertes). Publié seulement si l'écart d'espérance tient.
 */
function winrateTrap(input: DiscoveryInput): Candidate[] {
  const out: Candidate[] = [];
  const wr = (list: readonly Trade[]) => {
    const w = list.filter((t) => t.pnl > 0 && !isBreakEven(t)).length;
    const l = list.filter((t) => t.pnl < 0 && !isBreakEven(t)).length;
    return w + l ? w / (w + l) : null;
  };
  for (const dimension of ["strategy", "symbol", "session"] as const) {
    const values = new Set(input.trades.map((t) => dimensionValue(t, dimension)).filter(Boolean));
    for (const v of values) {
      const a = input.trades.filter((t) => dimensionValue(t, dimension) === v);
      const b = input.trades.filter((t) => {
        const x = dimensionValue(t, dimension);
        return x !== null && x !== v;
      });
      const wa = wr(a);
      const wb = wr(b);
      if (wa === null || wb === null || wa - wb < WINRATE_GAP) continue;
      const cmp = compareGroups(a, b, (t) => t.pnl, `winrate_trap:${dimension}:${v}`);
      if (!cmp || cmp.evidence.diff >= 0) continue;
      out.push({
        p: cmp.evidence.p,
        publish: true,
        discovery: {
          id: `winrate_trap:${dimension}:${v}`,
          detector: "winrate_trap",
          category: "hidden_pattern",
          direction: "lower",
          params: {
            dimension,
            key: String(v),
            winRate: Math.round(wa * 100),
            winRateRest: Math.round(wb * 100),
          },
          evidence: cmp.evidence,
          hypothetical: false,
          fragile: cmp.fragile,
          validation: cmp.validation,
          entities: [nodeId(dimension, String(v))],
          trades: ids(a),
          compareTrades: ids(b),
          alternatives: ["single_outlier", "regime", "selection"],
          experiment: "rr_target",
        },
      });
    }
  }
  return out;
}

// ── 13. Deux conditions réunies, validées hors échantillon ─────────────────

const COMBO_PAIRS: readonly (readonly [EdgeDimension, EdgeDimension])[] = [
  ["strategy", "session"],
  ["strategy", "weekday"],
  ["strategy", "symbol"],
  ["symbol", "session"],
];

/**
 * À l'intérieur d'une condition (un setup), une seconde condition (une
 * séance, un jour…) sépare-t-elle les résultats ? Chaque combinaison testée
 * entre dans la correction des tests multiples ; seule une combinaison dont
 * l'écart garde son SENS sur les séances les plus récentes est publiée.
 */
function combos(input: DiscoveryInput): Candidate[] {
  const out: Candidate[] = [];
  for (const [d1, d2] of COMBO_PAIRS) {
    const outer = new Map<string, Trade[]>();
    for (const t of input.trades) {
      const v1 = dimensionValue(t, d1);
      if (v1 === null) continue;
      let list = outer.get(v1);
      if (!list) outer.set(v1, (list = []));
      list.push(t);
    }
    for (const [v1, group] of outer) {
      if (group.length < 2 * MIN_GROUP) continue;
      const known = group.filter((t) => dimensionValue(t, d2) !== null);
      const inner = new Set(known.map((t) => dimensionValue(t, d2)!));
      if (inner.size < 2) continue;
      for (const v2 of inner) {
        const a = known.filter((t) => dimensionValue(t, d2) === v2);
        const b = known.filter((t) => dimensionValue(t, d2) !== v2);
        const cmp = compareGroups(a, b, (t) => t.pnl, `combo:${d1}:${v1}:${d2}:${v2}`);
        if (!cmp) continue;
        const nodes = [
          ...(d1 === "weekday" ? [] : [nodeId(d1, v1)]),
          ...(d2 === "weekday" ? [] : [nodeId(d2, v2)]),
        ];
        out.push({
          p: cmp.evidence.p,
          publish: cmp.validation === "confirmed",
          discovery: {
            id: `combo:${d1}:${v1}:${d2}:${v2}`,
            detector: "combo",
            category: cmp.evidence.diff > 0 ? "unexpected_strength" : "strategy_inefficiency",
            direction: cmp.evidence.diff > 0 ? "higher" : "lower",
            params: { d1, v1, d2, v2 },
            evidence: cmp.evidence,
            hypothetical: false,
            fragile: cmp.fragile,
            validation: cmp.validation,
            entities: nodes.length ? nodes : [nodeId("account", input.accountKey ?? "main")],
            trades: ids(a),
            compareTrades: ids(b),
            alternatives: ["multiple_conditions", "regime", "selection"],
            experiment: cmp.evidence.diff > 0 ? "focus_condition" : "reduce_condition",
          },
        });
      }
    }
  }
  return out;
}

// ── 14. Le risque suit-il la qualité du setup ? ─────────────────────────────

function riskVsQuality(input: DiscoveryInput): Candidate[] {
  const usable = input.trades.filter(
    (t) => hasMeasuredRisk(t) && !t.reviewPending && t.setupQuality > 0,
  );
  if (usable.length < MIN_TRADES) return [];
  const med = median(usable.map((t) => t.riskAmount));
  if (!med) return [];
  const bySession = new Map<string, [number, number][]>();
  for (const t of usable) {
    const k = sessionOf(t);
    let list = bySession.get(k);
    if (!list) bySession.set(k, (list = []));
    list.push([t.setupQuality, t.riskAmount / med]);
  }
  const keys = [...bySession.keys()].sort();
  if (keys.length < MIN_GROUP_SESSIONS) return [];
  const seed = seedFrom(`risk_vs_quality:v${DISCOVERY_VERSION}`);
  const r = sessionBlockSpearman(
    keys.map((k) => bySession.get(k)!),
    { seed },
  );
  if (!r) return [];
  // Contrôle chronologique : le même signe sur les 30 % de séances récentes.
  const recent = keys
    .slice(Math.floor(keys.length * (1 - HOLDOUT_SHARE)))
    .flatMap((k) => bySession.get(k)!);
  const rRecent =
    recent.length >= MIN_GROUP
      ? (sessionBlockSpearman([recent, recent], { seed })?.rho ?? null)
      : null;
  const validation: Discovery["validation"] =
    rRecent === null
      ? "insufficient"
      : Math.sign(rRecent) === Math.sign(r.rho)
        ? "confirmed"
        : "not_confirmed";
  return [
    {
      p: r.p,
      publish: true,
      discovery: {
        id: "risk_vs_quality",
        detector: "risk_vs_quality",
        category: r.rho < 0 ? "risk_anomaly" : "unexpected_strength",
        direction: r.rho > 0 ? "higher" : "lower",
        params: { median: round(med, 2) },
        evidence: {
          unit: "rho",
          n: usable.length,
          sessions: keys.length,
          nCompare: 0,
          sessionsCompare: 0,
          value: round(r.rho, 3),
          baseline: 0,
          diff: round(r.rho, 3),
          low: round(r.low, 3),
          high: round(r.high, 3),
          p: r.p,
          q: null,
          method: "spearman-session-block-percentile",
          seed: r.seed,
          iterations: r.iterations,
          version: DISCOVERY_VERSION,
        },
        hypothetical: false,
        fragile: null,
        validation,
        impact: null,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(usable),
        compareTrades: [],
        alternatives: ["sizing_rule", "labeling", "selection"],
        experiment: "fixed_risk",
      },
    },
  ];
}

// ── 15. La qualité de la décision, indépendamment du résultat ──────────────

/**
 * Processus PROPRE : aucune erreur cochée, setup noté 4–5, plan non renié.
 * Processus SIGNALÉ : au moins une erreur, ou plan renié. On compare leur
 * rendement par trade, et l'on compte ce que le résultat brut cache : les
 * gains venus d'un processus signalé (la chance) et les pertes d'un processus
 * propre (le coût normal du métier).
 */
function processOutcome(input: DiscoveryInput): Candidate[] {
  const plan = input.behavior?.planRespected ?? {};
  const usable = input.trades.filter((t) => !t.reviewPending);
  const flaggedOf = (t: Trade) => (t.mistakes ?? []).some((m) => m.trim()) || plan[t.id] === "no";
  const clean = usable.filter((t) => !flaggedOf(t) && t.setupQuality >= 4);
  const flagged = usable.filter(flaggedOf);
  const cmp = compareGroups(clean, flagged, (t) => t.pnl, "process_outcome");
  if (!cmp) return [];
  const wins = usable.filter((t) => t.pnl > 0 && !isBreakEven(t));
  const luckyWins = wins.filter(flaggedOf).length;
  const cleanLosses = clean.filter((t) => t.pnl < 0 && !isBreakEven(t)).length;
  return [
    {
      p: cmp.evidence.p,
      publish: true,
      discovery: {
        id: "process_outcome",
        detector: "process_outcome",
        category: cmp.evidence.diff > 0 ? "unexpected_strength" : "psychological_contradiction",
        direction: cmp.evidence.diff > 0 ? "higher" : "lower",
        params: {
          luckyWinsShare: wins.length ? round(luckyWins / wins.length, 3) : 0,
          cleanLosses,
        },
        evidence: cmp.evidence,
        hypothetical: false,
        fragile: cmp.fragile,
        validation: cmp.validation,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(clean),
        compareTrades: ids(flagged),
        alternatives: ["labeling", "luck", "selection"],
        experiment: "process_checklist",
      },
    },
  ];
}

// ── 16. Plan tenu, plan renié ───────────────────────────────────────────────

function planAdherence(input: DiscoveryInput): Candidate[] {
  const plan = input.behavior?.planRespected;
  if (!plan) return [];
  const broke = input.trades.filter((t) => plan[t.id] === "no");
  const kept = input.trades.filter((t) => plan[t.id] === "yes");
  const cmp = compareGroups(broke, kept, (t) => t.pnl, "plan_adherence");
  if (!cmp) return [];
  return [
    {
      p: cmp.evidence.p,
      publish: true,
      discovery: {
        id: "plan_adherence",
        detector: "plan_adherence",
        category: cmp.evidence.diff < 0 ? "psychological_contradiction" : "hidden_pattern",
        direction: cmp.evidence.diff > 0 ? "higher" : "lower",
        params: {},
        evidence: cmp.evidence,
        hypothetical: false,
        fragile: cmp.fragile,
        validation: cmp.validation,
        entities: [nodeId("account", input.accountKey ?? "main")],
        trades: ids(broke),
        compareTrades: ids(kept),
        // Le bilan s'écrit APRÈS le résultat : un plan « renié » se reconnaît
        // plus volontiers sur une perte.
        alternatives: ["labeling", "selection", "regime"],
        experiment: "plan_review",
      },
    },
  ];
}

// ── 17. Une erreur qui recule, une erreur qui monte ────────────────────────

/** Part des séances, les plus récentes, comparée au reste. */
export const RECENT_SHARE = 0.4;

function mistakeTrend(input: DiscoveryInput): Candidate[] {
  const norm = (m: string) => m.trim().replace(/\s+/g, " ");
  const days = [...new Set(input.trades.map((t) => sessionOf(t).split("|")[1]))].sort();
  if (days.length < 2 * MIN_GROUP_SESSIONS) return [];
  const cut = days[Math.floor(days.length * (1 - RECENT_SHARE))];
  const recent = input.trades.filter((t) => sessionOf(t).split("|")[1] >= cut);
  const earlier = input.trades.filter((t) => sessionOf(t).split("|")[1] < cut);
  const counts = new Map<string, number>();
  for (const t of input.trades)
    for (const m of new Set((t.mistakes ?? []).map(norm).filter(Boolean)))
      counts.set(m, (counts.get(m) ?? 0) + 1);
  const out: Candidate[] = [];
  for (const [m, total] of counts) {
    if (total < MIN_GROUP) continue;
    const has = (t: Trade) => ((t.mistakes ?? []).map(norm).includes(m) ? 1 : 0);
    const cmp = compareGroups(recent, earlier, has, `mistake_trend:${m}`);
    if (!cmp) continue;
    const down = cmp.evidence.diff < 0;
    out.push({
      p: cmp.evidence.p,
      publish: true,
      discovery: {
        id: `mistake_trend:${m}`,
        detector: "mistake_trend",
        category: down ? "unexpected_strength" : "execution_weakness",
        direction: down ? "lower" : "higher",
        params: { mistake: m, since: cut },
        evidence: { ...cmp.evidence, unit: "share" },
        hypothetical: false,
        fragile: null,
        validation: null,
        impact: null,
        entities: [nodeId("mistake", m)],
        trades: ids(recent.filter((t) => has(t))),
        compareTrades: ids(earlier.filter((t) => has(t))),
        alternatives: ["tagging_habit", "regime", "selection"],
        experiment: down ? "keep_tracking" : "review_segment",
      },
    });
  }
  return out;
}

// ── 18. Risque prévu, risque pris ───────────────────────────────────────────

export const PLANNED_RISK_TOLERANCE = 0.1;

function plannedRisk(input: DiscoveryInput): Candidate[] {
  const planned = input.behavior?.plannedRisk;
  if (!planned) return [];
  const pairs = input.trades
    .filter((t) => hasMeasuredRisk(t) && typeof planned[t.id] === "number" && planned[t.id]! > 0)
    .map((t) => ({ t, ratio: t.riskAmount / planned[t.id]! }));
  if (pairs.length < MIN_GROUP) return [];
  const over = pairs.filter((x) => x.ratio > 1 + PLANNED_RISK_TOLERANCE);
  const share = over.length / pairs.length;
  if (share < SIMULATION_RISK_SHARE) return [];
  const med = median(pairs.map((x) => x.ratio))!;
  return [
    {
      p: null,
      publish: true,
      discovery: {
        id: "planned_risk",
        detector: "planned_risk",
        category: "risk_anomaly",
        direction: "higher",
        params: { share: round(share, 3) },
        evidence: {
          unit: "risk_ratio",
          n: pairs.length,
          sessions: new Set(pairs.map((x) => sessionOf(x.t))).size,
          nCompare: 0,
          sessionsCompare: 0,
          value: round(med, 3),
          baseline: 1,
          diff: round(med - 1, 3),
          low: null,
          high: null,
          p: null,
          q: null,
          method: `descriptive:measured/planned-risk:tol=${PLANNED_RISK_TOLERANCE}`,
          seed: null,
          iterations: null,
          version: DISCOVERY_VERSION,
        },
        hypothetical: false,
        fragile: null,
        impact: null,
        entities: [nodeId("error_pattern", "risk_above_plan")],
        trades: over.map((x) => x.t.id),
        compareTrades: [],
        alternatives: ["sizing_rule", "missing_data"],
        experiment: "planned_risk_rule",
      },
    },
  ];
}

// ── 19. Observé, mais pas déclaré ──────────────────────────────────────────

/**
 * Une signature (« un trade pris dans les 30 minutes d'une perte ») apparaît
 * souvent, mais le trader ne coche presque jamais l'erreur correspondante.
 * L'écart entre ce qu'on fait et ce qu'on écrit — rien de plus : la signature
 * n'est pas une preuve d'intention.
 */
function untaggedSignatures(input: DiscoveryInput): Candidate[] {
  const sigs = detectSignatures(input.trades, input.behavior);
  const byId = new Map(input.trades.map((t) => [t.id, t]));
  const out: Candidate[] = [];
  for (const entry of ERROR_LIBRARY) {
    if (entry.detection.mode !== "signature" || !entry.tags.length) continue;
    const list = (sigs.get(entry.id) ?? []).map((id) => byId.get(id)!).filter(Boolean);
    if (list.length < MIN_GROUP) continue;
    const tagged = list.filter((t) =>
      (t.mistakes ?? []).some((m) => entry.tags.includes(m.trim())),
    );
    const share = tagged.length / list.length;
    if (share >= 0.5) continue;
    out.push({
      p: null,
      publish: true,
      discovery: {
        id: `untagged_signature:${entry.id}`,
        detector: "untagged_signature",
        category: "psychological_contradiction",
        direction: "lower",
        params: { error: entry.id, tag: entry.tags[0] },
        evidence: {
          unit: "share",
          n: list.length,
          sessions: new Set(list.map(sessionOf)).size,
          nCompare: tagged.length,
          sessionsCompare: 0,
          value: round(share, 3),
          baseline: 1,
          diff: round(share - 1, 3),
          low: null,
          high: null,
          p: null,
          q: null,
          method: `descriptive:signature:${entry.detection.method}`,
          seed: null,
          iterations: null,
          version: DISCOVERY_VERSION,
        },
        hypothetical: false,
        fragile: null,
        impact: round(
          list.reduce((s, t) => s + t.pnl, 0),
          2,
        ),
        entities: [
          nodeId("error_pattern", entry.id),
          ...entry.tags.map((m) => nodeId("mistake", m)),
        ],
        trades: ids(list),
        compareTrades: ids(tagged),
        alternatives: ["tagging_habit", "missing_data"],
        experiment: "tag_honestly",
      },
    });
  }
  return out;
}

// ── 20. Ce que les décisions de ne pas trader ont évité (HYPOTHÉTIQUE) ──────

function missedAvoided(input: DiscoveryInput): Candidate[] {
  const rated = (input.missed ?? []).filter(
    (m) => Number.isFinite(m.estimatedR) && m.estimatedR !== 0,
  );
  const avoided = rated.filter((m) => m.estimatedR < 0);
  if (avoided.length < MIN_GROUP) return [];
  const sum = avoided.reduce((s, m) => s + m.estimatedR, 0);
  const symbols = [
    ...new Set(avoided.map((m) => m.symbol.trim().toUpperCase()).filter(Boolean)),
  ].sort();
  return [
    {
      p: null,
      publish: true,
      discovery: {
        id: "missed_avoided",
        detector: "missed_avoided",
        category: "unexpected_strength",
        direction: "lower",
        params: { share: round(avoided.length / rated.length, 3) },
        evidence: {
          unit: "r",
          n: avoided.length,
          sessions: new Set(avoided.map((m) => m.date)).size,
          nCompare: rated.length,
          sessionsCompare: 0,
          value: round(sum, 2),
          baseline: 0,
          diff: round(sum, 2),
          low: null,
          high: null,
          p: null,
          q: null,
          method: "descriptive:estimated-r<0",
          seed: null,
          iterations: null,
          version: DISCOVERY_VERSION,
        },
        hypothetical: true,
        fragile: null,
        impact: null,
        entities: symbols.map((s) => nodeId("symbol", s)),
        trades: [],
        compareTrades: [],
        alternatives: ["hindsight", "selection"],
        experiment: "log_missed_live",
      },
    },
  ];
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
  afterLossOutcome,
  lossConcentration,
  winrateTrap,
  combos,
  riskVsQuality,
  processOutcome,
  planAdherence,
  mistakeTrend,
  plannedRisk,
  untaggedSignatures,
  missedAvoided,
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
    // Testé mais non publiable (une combinaison non confirmée) : il a compté
    // dans la correction, il ne sort pas.
    if (!c.publish) return;
    if (c.p !== null) {
      const q = qs[i];
      if (q === null || q > FDR_ALPHA) return;
      if (ev.low === null || ev.high === null || !(ev.low > 0 || ev.high < 0)) return;
      ev.q = round(q);
    }
    const validation = c.discovery.validation ?? null;
    const fragile = c.discovery.fragile === true;
    const confidence: Discovery["confidence"] =
      ev.q === null
        ? "descriptive"
        : ev.q <= 0.01 && !fragile && validation === "confirmed"
          ? "strong"
          : ev.q <= 0.05 && !fragile && validation !== "not_confirmed"
            ? "moderate"
            : "tentative";
    const impact =
      c.discovery.impact !== undefined
        ? c.discovery.impact
        : ev.unit === "pnl"
          ? round(ev.diff * ev.n, 2)
          : null;
    kept.push({ ...c.discovery, impact, validation, confidence, fingerprint: fingerprintOf(ev) });
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
