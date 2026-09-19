import { Trade } from "../types";
import { getSession, TradingSession } from "./quantStats";
import { localDateOf } from "@/shared/calendar-date";

// ── Behavioral taxonomy ─────────────────────────────────────────────────────
// Each logged mistake maps to a severity tier. Severity weights the discipline
// score and drives the "fix this first" ordering.
export type Severity = "high" | "medium" | "low";
export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export const MISTAKE_SEVERITY: Record<string, Severity> = {
  "No stop loss": "high",
  "Revenge trade": "high",
  "Size too large": "high",
  "Averaged down": "high",
  "FOMO entry": "medium",
  Overtrading: "medium",
  "Chased entry": "medium",
  "Ignored plan": "medium",
  "Ignored market conditions": "medium",
  "Premature exit": "low",
  "Holding too long": "low",
  "Low liquidity": "low",
};

/** Durée d'une fenêtre de comparaison. 30 jours ≈ un mois de trading :
 *  assez long pour lisser le bruit, assez court pour que le trader ressente
 *  l'amélioration pendant qu'il la produit. */
export const TREND_WINDOW_DAYS = 30;

function severityOf(mistake: string): Severity {
  return MISTAKE_SEVERITY[mistake] ?? "medium";
}

export interface MistakeTrend {
  /** Occurrences sur la fenêtre récente. */
  recent: number;
  /** Occurrences sur la fenêtre précédente, de même durée. */
  previous: number;
  /** Variation en %, arrondie. Négatif = l'erreur RECULE. */
  deltaPct: number;
}

interface MistakeRow {
  mistake: string;
  severity: Severity;
  count: number;
  totalPnl: number;
  avgPnl: number;
  /**
   * Cette erreur recule-t-elle ?
   *
   * La tendance AGRÉGÉE existait déjà (`weeklyTrend`), mais elle ne dit pas
   * LAQUELLE des erreurs s'améliore — or c'est ça que le trader veut savoir,
   * et c'est la meilleure raison de revenir sur cette page. `null` tant que la
   * fenêtre précédente est vide : annoncer « −100 % » pour une erreur qui
   * vient d'apparaître serait faux.
   */
  trend: MistakeTrend | null;
  /**
   * LA DÉGRESSION, SEMAINE PAR SEMAINE — le seul affichage qui récompense.
   *
   * `trend` compare deux fenêtres et rend un pourcentage : c'est un verdict,
   * et un verdict ne se ressent pas. Ce que le trader veut voir, c'est la
   * PENTE — six barres qui descendent, puis une septième plus basse que lui
   * doit à son propre travail. C'est ce qui donne envie de continuer, là où
   * « −40 % » se lit et s'oublie.
   *
   * L'axe est celui de `weeklyTrend`, EXACTEMENT : mêmes semaines, même ordre,
   * y compris celles où l'erreur n'est pas apparue (à zéro). Deux séries qui
   * ne partagent pas leur axe ne se comparent pas, et une semaine propre
   * simplement absente de la série se lirait comme une semaine manquante au
   * lieu d'une semaine réussie.
   */
  weekly: number[];
}

interface BehavioralReport {
  rows: MistakeRow[];
  totalIncidents: number;
  totalCost: number;
  tradesWithMistakes: number;
  cleanTrades: number;
  cleanWinRate: number | null;
  mistakeWinRate: number | null;
  /** 0–100; 100 = flawless discipline, penalized by severity-weighted incidents */
  /**
   * Score d'EXÉCUTION, 0–100, dérivé uniquement des erreurs que le trader a
   * lui-même cochées, pondérées par gravité.
   *
   * Ce n'est PAS un score de discipline, et il s'appelait ainsi. La différence
   * est décisive : un trader qui ne coche rien obtient 100, et la page le
   * félicitait (« Aucune erreur — excellente discipline ! »). Le produit
   * récompensait donc le fait de NE PAS journaliser — alors que la
   * journalisation honnête est l'effort le plus pénible qu'il demande et la
   * source de toute sa valeur analytique.
   *
   * La discipline, au sens de « tenir ses règles », se mesure dans
   * `ruleAdherence.ts`, et nulle part ailleurs.
   *
   * NOM : ni `disciplineScore` (il ne mesure pas la discipline), ni
   * `executionScore` — ce dernier existe DÉJÀ dans
   * `modules/trading/analysis/engine.ts` où il désigne l'efficacité de sortie
   * calculée depuis MAE/MFE. Deux choses différentes portant le même nom, c'est
   * précisément le défaut que cette série de corrections élimine.
   */
  cleanJournalScore: number;
  severityCounts: Record<Severity, number>;
  bySession: Record<TradingSession, number>;
  byDay: Record<number, number>;
  /** last 8 ISO-week buckets, oldest→newest */
  weeklyTrend: { week: string; count: number; cost: number }[];
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day + 3); // nearest Thursday
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7,
    );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function computeBehavioral(trades: Trade[]): BehavioralReport {
  const agg: Record<string, { count: number; totalPnl: number }> = {};
  const severityCounts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  const bySession: Record<TradingSession, number> = { london: 0, newyork: 0, asia: 0 };
  const byDay: Record<number, number> = {};
  const weekMap: Record<string, { count: number; cost: number }> = {};
  const weekByMistake: Record<string, Record<string, number>> = {};

  let weightedInfractions = 0;

  for (const t of trades) {
    if (t.mistakes.length === 0) continue;
    const session = getSession(t.entryTime);
    const dow = new Date(t.date + "T12:00:00").getDay();
    const wk = isoWeekKey(t.date);
    for (const m of t.mistakes) {
      if (!agg[m]) agg[m] = { count: 0, totalPnl: 0 };
      agg[m].count++;
      agg[m].totalPnl += t.pnl;
      const sev = severityOf(m);
      severityCounts[sev]++;
      weightedInfractions += SEVERITY_WEIGHT[sev];
      if (session) bySession[session]++;
      byDay[dow] = (byDay[dow] || 0) + 1;
      if (!weekMap[wk]) weekMap[wk] = { count: 0, cost: 0 };
      weekMap[wk].count++;
      weekMap[wk].cost += t.pnl;
      // La même ventilation, mais PAR ERREUR : c'est elle qui portera la pente
      // affichée sur chaque ligne de la page Erreurs.
      if (!weekByMistake[m]) weekByMistake[m] = {};
      weekByMistake[m][wk] = (weekByMistake[m][wk] ?? 0) + 1;
    }
  }

  // ── Tendance par erreur ────────────────────────────────────────────────────
  // Deux fenêtres de MÊME durée, adossées à la DERNIÈRE date journalisée plutôt
  // qu'à aujourd'hui : un trader en pause verrait sinon toutes ses erreurs
  // « reculer » simplement parce qu'il ne trade plus.
  const dated = trades.filter((t) => t.mistakes.length > 0).map((t) => t.date);
  const lastDate = dated.length ? dated.reduce((a, b) => (a > b ? a : b)) : null;
  const trendByMistake: Record<string, MistakeTrend | null> = {};
  if (lastDate) {
    const end = new Date(lastDate + "T12:00:00");
    const midCut = new Date(end);
    midCut.setDate(midCut.getDate() - TREND_WINDOW_DAYS);
    const startCut = new Date(end);
    startCut.setDate(startCut.getDate() - TREND_WINDOW_DAYS * 2);
    const iso = (d: Date) => localDateOf(d);
    const midKey = iso(midCut);
    const startKey = iso(startCut);

    const recent: Record<string, number> = {};
    const previous: Record<string, number> = {};
    for (const t of trades) {
      if (t.mistakes.length === 0) continue;
      const bucket = t.date > midKey ? recent : t.date > startKey ? previous : null;
      if (!bucket) continue;
      for (const m of t.mistakes) bucket[m] = (bucket[m] ?? 0) + 1;
    }
    for (const m of Object.keys(agg)) {
      const r = recent[m] ?? 0;
      const p = previous[m] ?? 0;
      // Sans point de comparaison, on n'affirme rien.
      trendByMistake[m] =
        p === 0 ? null : { recent: r, previous: p, deltaPct: Math.round(((r - p) / p) * 100) };
    }
  }

  /* L'AXE DES SEMAINES — calculé une fois, partagé par tout le monde.
     Les huit dernières semaines PRÉSENTES dans les données. C'est le même axe
     pour la tendance globale et pour la pente de chaque erreur : sans cela,
     deux séries voisines sur le même écran couvriraient des périodes
     différentes tout en se ressemblant, ce qui est pire que de ne rien
     afficher. */
  const axeSemaines = Object.keys(weekMap).sort().slice(-8);

  const rows: MistakeRow[] = Object.entries(agg)
    .map(([mistake, d]) => ({
      mistake,
      severity: severityOf(mistake),
      count: d.count,
      totalPnl: Math.round(d.totalPnl * 100) / 100,
      avgPnl: Math.round((d.totalPnl / d.count) * 100) / 100,
      trend: trendByMistake[mistake] ?? null,
      // Les semaines sans occurrence valent ZÉRO, elles ne sont pas omises :
      // une semaine propre est un résultat, pas un trou dans la donnée.
      weekly: axeSemaines.map((wk) => weekByMistake[mistake]?.[wk] ?? 0),
    }))
    // worst first: severity weight × cost magnitude
    .sort((a, b) => SEVERITY_WEIGHT[b.severity] * b.count - SEVERITY_WEIGHT[a.severity] * a.count);

  const totalIncidents = rows.reduce((s, r) => s + r.count, 0);
  const totalCost = rows.reduce((s, r) => s + r.totalPnl, 0);
  const tradesWithMistakes = trades.filter((t) => t.mistakes.length > 0).length;
  const cleanTrades = trades.length - tradesWithMistakes;

  const cleanDecided = trades.filter((t) => t.mistakes.length === 0 && t.direction !== "be");
  const mistakeDecided = trades.filter((t) => t.mistakes.length > 0 && t.direction !== "be");
  const cleanWinRate =
    cleanDecided.length > 0
      ? cleanDecided.filter((t) => t.pnl > 0).length / cleanDecided.length
      : null;
  const mistakeWinRate =
    mistakeDecided.length > 0
      ? mistakeDecided.filter((t) => t.pnl > 0).length / mistakeDecided.length
      : null;

  // Discipline: perfect at 0 infractions, each severity-weighted incident per
  // trade chips away. Tuned so ~1 medium mistake every 3 trades ≈ 85.
  const cleanJournalScore =
    trades.length === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round(100 - (weightedInfractions / trades.length) * 22)));

  // Le même axe que la pente de chaque erreur — voir `axeSemaines`.
  const weeklyTrend = axeSemaines.map((week) => ({
    week: week.slice(5),
    count: weekMap[week].count,
    cost: Math.round(weekMap[week].cost * 100) / 100,
  }));

  return {
    rows,
    totalIncidents,
    totalCost,
    tradesWithMistakes,
    cleanTrades,
    cleanWinRate,
    mistakeWinRate,
    cleanJournalScore,
    severityCounts,
    bySession,
    byDay,
    weeklyTrend,
  };
}
