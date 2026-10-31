import { MISTAKE_CLUSTERS, clusterOf, type MistakeClusterId } from "@/app/trading/mistakeClusters";
import { easternEntryMinute } from "@/domain/quantStats";
import { compareChronological, verifiedPriorClosedTrade } from "@/domain/tradeOrder";
import {
  MIN_GROUP,
  MIN_R_DELTA,
  MIN_SESSIONS,
  MIN_SHARE_DELTA,
  MIN_TRADES,
  notEnough,
  type NotEnough,
} from "./thresholds";

/**
 * Détecteurs de motifs — DÉTERMINISTES, purs, sans IA.
 *
 * La règle qui gouverne ce module vient de `docs/AI.md` : **le moteur
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
 * Troisième règle : `n` ne suffit pas. Balayer beaucoup de tranches finit
 * toujours par en produire une qui paraît extrême — c'est le problème des
 * comparaisons multiples, et aucun seuil de taille ne le règle. Deux gardes en
 * réponse : un PLANCHER D'EFFET par détecteur (`thresholds.ts`) sous lequel on
 * se tait, et `Evidence.comparisons`, le nombre de tranches examinées, qui
 * voyage avec le résultat. Un écart trouvé en regardant vingt tranches ne se
 * lit pas comme le même écart trouvé en en regardant une.
 *
 * Quatrième règle, d'architecture : UNE dimension par détecteur. « Jeudi,
 * après une perte, entre 14 h et 16 h, setup X » empile quatre filtres — c'est
 * la forme qui fabrique des faux positifs, et aucun plancher ne la rattrape.
 *
 * Cinquième règle : le vocabulaire. Un détecteur observe une ASSOCIATION. Les
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
  /**
   * Nombre de tranches examinées pour aboutir à ce résultat.
   *
   * Obligatoire, au même titre que `n` : un affichage qui ne peut pas dire
   * « la plus forte de 4 » ne devrait pas afficher « la plus forte ».
   */
  comparisons: number;
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
  /**
   * R MESURÉ (`domain/trade.measuredR`, calculé par `persist.toTradeLikes`) ;
   * `null` quand le risque initial n'est pas une donnée exploitable. La colonne
   * `r_multiple` vaut 0 par défaut en base : la lire telle quelle faisait d'un
   * risque inconnu un trade à 0R, qui tirait toutes les moyennes vers zéro.
   */
  rMultiple: number | null;
  mistakes?: string[] | null;
  entryTime?: string | null;
  // Champs de chronologie et de provenance : sans eux, « le trade qui suit une
  // perte » et « l'heure du trade » ne sont pas vérifiables (voir `afterLoss`).
  exitTime?: string | null;
  /** Instants UTC prouvés (lot 1) : ordre et heure Eastern sans supposition. */
  entryAt?: string | null;
  exitAt?: string | null;
  accountId?: string | null;
  broker?: string | null;
  reviewPending?: boolean;
}

export interface SessionLike {
  sessionDate: string;
  readinessScore: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const isLoss = (t: Pick<TradeLike, "pnl">) => t.pnl < 0;

/** La forme attendue par les helpers de chronologie du domaine. */
function clockOf(t: TradeLike) {
  return {
    date: t.date,
    entryTime: t.entryTime ?? "",
    exitTime: t.exitTime ?? "",
    entryAt: t.entryAt ?? null,
    exitAt: t.exitAt ?? null,
    accountId: t.accountId ?? null,
    broker: t.broker ?? null,
    reviewPending: !!t.reviewPending,
  };
}

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

  // Un trade compte UNE fois par famille : deux erreurs de la même famille sur
  // un même trade le comptaient deux fois, et la « part des pertes » pouvait
  // dépasser 100 %. Le R n'est sommé que si chaque trade de la famille a un R
  // mesuré — sinon la somme mélangerait mesures et absences.
  const byCluster = new Map<MistakeClusterId, { count: number; r: number; rKnown: boolean }>();
  for (const trade of losses) {
    const families = new Set<MistakeClusterId>();
    for (const mistake of trade.mistakes ?? []) {
      const cluster = clusterOf(mistake);
      if (cluster) families.add(cluster);
    }
    for (const cluster of families) {
      const cur = byCluster.get(cluster) ?? { count: 0, r: 0, rKnown: true };
      cur.count += 1;
      if (trade.rMultiple === null) cur.rKnown = false;
      else cur.r += trade.rMultiple;
      byCluster.set(cluster, cur);
    }
  }
  if (byCluster.size === 0) return null;

  let top: [MistakeClusterId, { count: number; r: number; rKnown: boolean }] | null = null;
  for (const entry of byCluster) {
    if (!top || entry[1].count > top[1].count) top = entry;
  }
  if (!top) return null;

  // Référence : la part qu'aurait cette famille si les erreurs se
  // répartissaient uniformément entre les QUATRE familles définies — une
  // constante, pas une valeur tirée des données.
  //
  // Prendre la moyenne sur les familles OBSERVÉES serait dégénéré : un trader
  // qui n'étiquette qu'une seule famille aurait une référence de 100 %, donc un
  // écart nul, donc un silence permanent — alors que « toutes mes pertes
  // étiquetées relèvent du risque » est précisément une observation.
  const baseline = 1 / MISTAKE_CLUSTERS.length;
  const value = top[1].count / losses.length;
  // Plancher d'effet : sous +15 points au-dessus de la référence, on se tait.
  // Sans lui, une famille à 26 % contre 25 % franchirait toutes les gardes de
  // taille et ne dirait rien.
  if (value - baseline < MIN_SHARE_DELTA) return null;

  return {
    status: "found",
    kind: "cluster_concentration",
    clusterId: top[0],
    evidence: {
      n: losses.length,
      comparisonN: null,
      metric: "loss_share",
      value: Number(value.toFixed(3)),
      baseline: Number(baseline.toFixed(3)),
      comparisons: byCluster.size,
    },
    // La somme des R des trades perdants portant cette famille. C'est une
    // somme observée, pas une projection de ce qui serait arrivé sans elle —
    // ce contrefactuel-là n'est pas mesurable et ne sera pas inventé.
    impactR: top[1].rKnown ? Number(top[1].r.toFixed(2)) : null,
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

  // Ordre d'ENTRÉE (date puis heure), et un prédécesseur retenu seulement s'il
  // était clôturé AVANT l'entrée suivante (`verifiedPriorClosedTrade`, la règle
  // partagée avec les filtres et Jarvis). Trier à la seule date laissait deux
  // trades du même jour dans l'ordre de lecture de la base : « le trade qui
  // suit une perte » pouvait être celui qui la PRÉCÉDAIT.
  const ordered = trades
    .map((t) => ({ trade: t, clock: clockOf(t) }))
    .sort((a, b) => compareChronological(a.clock, b.clock));
  const clocks = ordered.map((o) => o.clock);
  const after: number[] = [];
  const rest: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const r = ordered[i].trade.rMultiple;
    if (r === null) continue;
    const prior = verifiedPriorClosedTrade(clocks, i);
    if (!prior) continue;
    (isLoss(ordered[i - 1].trade) ? after : rest).push(r);
  }
  if (after.length < MIN_GROUP) return notEnough("trades", after.length, MIN_GROUP);
  if (rest.length < MIN_GROUP) return notEnough("trades", rest.length, MIN_GROUP);

  const value = mean(after);
  const baseline = mean(rest);
  // Une comparaison unique, mais le plancher s'applique quand même : un écart
  // de 0,05 R entre deux groupes d'un journal ordinaire est du bruit.
  if (Math.abs(value - baseline) < MIN_R_DELTA) return null;
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
      // Une seule tranche examinée : « après une perte » contre « le reste ».
      comparisons: 1,
    },
    impactR: Number(((value - baseline) * after.length).toFixed(2)),
  };
}

/** Tranche horaire Eastern d'un trade, ou `null` si l'heure n'est pas établie. */
function bucketOf(minute: number | null): string | null {
  if (minute === null) return null;
  const hour = Math.floor(minute / 60);
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
    // Les tranches sont des heures Eastern : l'heure d'un import broker ou d'un
    // CSV non relu n'en est pas une preuve, sauf instant prouvé (`quantStats`).
    if (trade.rMultiple === null) continue;
    const bucket = bucketOf(easternEntryMinute(clockOf(trade)));
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
  // C'est ICI que les comparaisons multiples mordent le plus : on rend le
  // minimum de plusieurs tranches, donc la valeur la plus extrême d'un
  // ensemble bruité. Le plancher d'effet est la seule chose qui empêche de
  // publier « ta pire heure » sur un écart de 0,1 R.
  if (Math.abs(value - baseline) < MIN_R_DELTA) return null;
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
      comparisons: usable.length,
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

  const measured = trades.filter(
    (t): t is TradeLike & { rMultiple: number } => t.rMultiple !== null,
  );
  const highR = measured.filter((t) => high.has(t.date)).map((t) => t.rMultiple);
  const lowR = measured.filter((t) => low.has(t.date)).map((t) => t.rMultiple);
  if (highR.length < MIN_GROUP) return notEnough("trades", highR.length, MIN_GROUP);
  if (lowR.length < MIN_GROUP) return notEnough("trades", lowR.length, MIN_GROUP);

  const value = mean(highR);
  const baseline = mean(lowR);
  if (Math.abs(value - baseline) < MIN_R_DELTA) return null;

  return {
    status: "found",
    kind: "readiness_correlation",
    clusterId: null,
    evidence: {
      n: highR.length,
      comparisonN: lowR.length,
      metric: "avg_r",
      value: Number(value.toFixed(3)),
      baseline: Number(baseline.toFixed(3)),
      // Une coupe unique, à la médiane. Pas de balayage de seuils : chercher
      // « le seuil qui sépare le mieux » serait exactement la recherche libre
      // que ce module refuse.
      comparisons: 1,
    },
    // Pas d'impact en R : l'écart entre deux groupes auto-sélectionnés n'est pas
    // un gain qu'on peut promettre. `null` est ici la réponse honnête.
    impactR: null,
  };
}
