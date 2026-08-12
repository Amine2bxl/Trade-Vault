import { clusterOf, type MistakeClusterId } from "@/app/utils/mistakeClusters";
import { MIN_GROUP, MIN_SESSIONS, MIN_TRADES, notEnough, type NotEnough } from "./thresholds";

/**
 * Détecteurs de motifs — DÉTERMINISTES, purs, sans IA.
 *
 * La règle qui gouverne ce module vient de `ECOSYSTEM_WIRING.md` : **le moteur
 * trouve les motifs, le LLM ne fait que les formuler**. Rien ici ne demande à
 * un modèle si un motif existe, n'invente un seuil, ni ne produit une phrase.
 * Les fonctions rendent des NOMBRES et leur taille d'échantillon ; la prose
 * vient après, ailleurs, à partir de ces nombres.
 *
 * Deuxième règle, aussi importante : ces fonctions ne rendent JAMAIS un
 * résultat sans `n`. Le type les y oblige — `Evidence` a `n` obligatoire — de
 * sorte qu'un affichage ne puisse pas montrer une part sans sa base, même par
 * distraction.
 *
 * Troisième règle : le vocabulaire. Un détecteur observe une ASSOCIATION. Les
 * champs s'appellent `value` et `baseline`, pas `cause` ni `effect`, et aucune
 * chaîne produite ici ne contient « parce que ». Le produit observe une
 * corrélation sur une variable en partie déclarative ; il ne peut pas établir
 * de cause, et le dire autrement abîmerait le trader qui le lit.
 */

export interface Evidence {
  /** Taille du groupe observé. OBLIGATOIRE — voir l'en-tête. */
  n: number;
  /** Taille du groupe de comparaison, quand il y en a un. */
  comparisonN: number | null;
  /** Ce qui est mesuré : `loss_share`, `avg_r`, `win_rate`… */
  metric: string;
  /** La valeur observée dans le groupe. */
  value: number;
  /** La référence à laquelle on la compare, si comparaison il y a. */
  baseline: number | null;
}

export interface DetectedPattern {
  status: "found";
  kind: "cluster_concentration" | "after_loss" | "time_of_day" | "readiness_correlation";
  clusterId: MistakeClusterId | null;
  evidence: Evidence;
  /** Impact estimé en R, `null` quand il n'est pas mesurable honnêtement. */
  impactR: number | null;
}

export type DetectorResult = DetectedPattern | NotEnough | null;

export interface TradeLike {
  date: string;
  pnl: number;
  rMultiple: number;
  mistakes?: string[] | null;
  entryTime?: string | null;
}

export interface SessionLike {
  sessionDate: string;
  readinessScore: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const isLoss = (t: TradeLike) => t.pnl < 0;

/**
 * 1. CONCENTRATION D'UNE FAMILLE — quelle part des pertes porte une famille
 *    d'erreurs.
 *
 * Rend la famille la plus lourde et sa part, avec `n` = nombre de trades
 * perdants observés. Ne rend rien s'il n'y a pas assez de trades : une famille
 * « responsable de 60 % des pertes » sur cinq pertes ne veut rien dire.
 */
export function clusterConcentration(trades: TradeLike[]): DetectorResult {
  if (trades.length < MIN_TRADES) return notEnough("trades", trades.length, MIN_TRADES);

  const losses = trades.filter(isLoss);
  if (losses.length < MIN_GROUP) return notEnough("trades", losses.length, MIN_GROUP);

  const byCluster = new Map<MistakeClusterId, { count: number; r: number }>();
  for (const trade of losses) {
    for (const mistake of trade.mistakes ?? []) {
      const cluster = clusterOf(mistake);
      if (!cluster) continue;
      const cur = byCluster.get(cluster) ?? { count: 0, r: 0 };
      cur.count += 1;
      cur.r += trade.rMultiple;
      byCluster.set(cluster, cur);
    }
  }
  if (byCluster.size === 0) return null;

  let top: [MistakeClusterId, { count: number; r: number }] | null = null;
  for (const entry of byCluster) {
    if (!top || entry[1].count > top[1].count) top = entry;
  }
  if (!top) return null;

  return {
    status: "found",
    kind: "cluster_concentration",
    clusterId: top[0],
    evidence: {
      n: losses.length,
      comparisonN: null,
      metric: "loss_share",
      value: top[1].count / losses.length,
      baseline: null,
    },
    // La somme des R des trades perdants portant cette famille. C'est une
    // somme observée, pas une projection de ce qui serait arrivé sans elle —
    // ce contrefactuel-là n'est pas mesurable et ne sera pas inventé.
    impactR: Number(top[1].r.toFixed(2)),
  };
}

/**
 * 2. DÉGRADATION APRÈS UNE PERTE — le trade qui suit une perte se compare-t-il
 *    aux autres.
 *
 * Les deux groupes doivent tenir debout séparément : c'est une comparaison, et
 * une comparaison dont un côté compte quatre trades n'est pas une comparaison.
 */
export function afterLoss(trades: TradeLike[]): DetectorResult {
  if (trades.length < MIN_TRADES) return notEnough("trades", trades.length, MIN_TRADES);

  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const after: number[] = [];
  const rest: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    (isLoss(ordered[i - 1]) ? after : rest).push(ordered[i].rMultiple);
  }
  if (after.length < MIN_GROUP) return notEnough("trades", after.length, MIN_GROUP);
  if (rest.length < MIN_GROUP) return notEnough("trades", rest.length, MIN_GROUP);

  const value = mean(after);
  const baseline = mean(rest);
  return {
    status: "found",
    kind: "after_loss",
    clusterId: null,
    evidence: {
      n: after.length,
      comparisonN: rest.length,
      metric: "avg_r",
      value: Number(value.toFixed(3)),
      baseline: Number(baseline.toFixed(3)),
    },
    impactR: Number(((value - baseline) * after.length).toFixed(2)),
  };
}

/** Tranche horaire d'un trade, ou `null` si l'heure n'a pas été saisie. */
function bucketOf(entryTime: string | null | undefined): string | null {
  if (!entryTime) return null;
  const hour = Number(entryTime.slice(0, 2));
  if (!Number.isFinite(hour)) return null;
  if (hour < 10) return "early";
  if (hour < 13) return "late_morning";
  if (hour < 16) return "afternoon";
  return "close";
}

/**
 * 3. HEURE DE LA JOURNÉE — uniquement pour ≥30 trades répartis sur ≥3 tranches.
 *
 * La condition sur le nombre de tranches est ce qui empêche de conclure sur un
 * trader qui ne trade qu'à l'ouverture : sa « meilleure tranche » serait la
 * seule qu'il ait.
 */
export function timeOfDay(trades: TradeLike[]): DetectorResult {
  if (trades.length < MIN_TRADES) return notEnough("trades", trades.length, MIN_TRADES);

  const buckets = new Map<string, number[]>();
  for (const trade of trades) {
    const bucket = bucketOf(trade.entryTime);
    if (!bucket) continue;
    const list = buckets.get(bucket) ?? [];
    list.push(trade.rMultiple);
    buckets.set(bucket, list);
  }
  const usable = [...buckets].filter(([, rs]) => rs.length >= MIN_GROUP);
  if (usable.length < 3) return null;

  const all = usable.flatMap(([, rs]) => rs);
  const baseline = mean(all);
  let worst: [string, number[]] | null = null;
  for (const entry of usable) {
    if (!worst || mean(entry[1]) < mean(worst[1])) worst = entry;
  }
  if (!worst) return null;

  const value = mean(worst[1]);
  return {
    status: "found",
    kind: "time_of_day",
    clusterId: null,
    evidence: {
      n: worst[1].length,
      comparisonN: all.length,
      metric: "avg_r",
      value: Number(value.toFixed(3)),
      baseline: Number(baseline.toFixed(3)),
    },
    impactR: Number(((value - baseline) * worst[1].length).toFixed(2)),
  };
}

/**
 * 4. PRÉPARATION ET RÉSULTATS — une ASSOCIATION observée, jamais une cause.
 *
 * Exige ≥20 séances PORTANT un score : les séances reprises de l'historique en
 * ont un `null` et sont exclues, parce que personne n'a coché de checklist ces
 * matins-là. Les deux tailles de groupe voyagent avec le résultat pour que
 * l'affichage puisse les montrer toutes les deux — c'est la demande explicite
 * du spec.
 *
 * Le nom du champ reste `value` / `baseline`. Le mot « améliore » n'apparaît
 * nulle part, ici ni dans les libellés qui liront ce résultat.
 */
export function readinessAssociation(sessions: SessionLike[], trades: TradeLike[]): DetectorResult {
  const scored = sessions.filter((s) => s.readinessScore !== null);
  if (scored.length < MIN_SESSIONS) return notEnough("sessions", scored.length, MIN_SESSIONS);

  const median = [...scored].map((s) => s.readinessScore as number).sort((a, b) => a - b)[
    Math.floor(scored.length / 2)
  ];

  const high = new Set(
    scored.filter((s) => (s.readinessScore as number) >= median).map((s) => s.sessionDate),
  );
  const low = new Set(
    scored.filter((s) => (s.readinessScore as number) < median).map((s) => s.sessionDate),
  );

  const highR = trades.filter((t) => high.has(t.date)).map((t) => t.rMultiple);
  const lowR = trades.filter((t) => low.has(t.date)).map((t) => t.rMultiple);
  if (highR.length < MIN_GROUP) return notEnough("trades", highR.length, MIN_GROUP);
  if (lowR.length < MIN_GROUP) return notEnough("trades", lowR.length, MIN_GROUP);

  return {
    status: "found",
    kind: "readiness_correlation",
    clusterId: null,
    evidence: {
      n: highR.length,
      comparisonN: lowR.length,
      metric: "avg_r",
      value: Number(mean(highR).toFixed(3)),
      baseline: Number(mean(lowR).toFixed(3)),
    },
    // Pas d'impact en R : l'écart entre deux groupes auto-sélectionnés n'est pas
    // un gain qu'on peut promettre. `null` est ici la réponse honnête.
    impactR: null,
  };
}
