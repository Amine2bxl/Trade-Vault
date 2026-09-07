import { Trade } from "../types";
import { MISTAKE_SEVERITY, TREND_WINDOW_DAYS, type Severity } from "./behavioral";
import { localDateOf } from "@/shared/calendar-date";

/**
 * LE PLAN DE CORRECTION — ce que la page « Erreurs » aurait dû dire depuis le
 * début.
 *
 * ── CE QU'ELLE DISAIT ───────────────────────────────────────────────────────
 *
 * Un montant en gros (« le P&L de tes trades marqués »), puis un classement des
 * erreurs par coût. Deux façons de répondre à la même question — COMBIEN ÇA
 * M'A COÛTÉ — et le retour du trader a été exactement celui-là : « ce n'est pas
 * ça qu'un trader veut voir ».
 *
 * Il a raison, et pour une raison mesurable : le coût d'une erreur passée n'est
 * pas actionnable. Il ne dit ni quoi faire demain, ni si l'on progresse. Le
 * tableau de bord chiffre déjà les pertes, et mieux.
 *
 * ── CE QU'ELLE DIT MAINTENANT ───────────────────────────────────────────────
 *
 * Trois voies, reprises des mots mêmes de la demande — « les choses qu'on ne
 * fait pas bien, les choses qu'on peut améliorer, les choses à ne plus
 * reproduire du tout » :
 *
 *   • `banish`  — GRAVE et encore présente. La ligne rouge.
 *   • `work`    — encore présente, réparable.
 *   • `stopped` — présente avant, ABSENTE de la fenêtre récente. Ce qu'il a
 *                 déjà arrêté : la seule preuve que la page serve à quelque
 *                 chose.
 *
 * Une erreur qui recule sans disparaître RESTE dans sa voie d'action ; son
 * `deltaPct` négatif l'accompagne. La ranger parmi les progrès reviendrait à
 * féliciter pour une erreur encore commise.
 *
 * ── LA FENÊTRE EST ANCRÉE SUR LE DERNIER TRADE ──────────────────────────────
 *
 * `behavioral.ts` ancre ses fenêtres sur la dernière date où une ERREUR a été
 * journalisée — ce qui empêche un trader en pause de voir toutes ses erreurs
 * « reculer » parce qu'il ne trade plus. Correct pour ce qu'il mesure, mais
 * insuffisant ici : un trader qui trade PROPREMENT depuis un mois n'aurait
 * jamais rien vu bouger, puisque l'ancre serait restée collée à sa dernière
 * erreur.
 *
 * On ancre donc sur le dernier TRADE. Les deux cas tombent juste : trader
 * proprement fait vider la fenêtre récente (progrès visible), et cesser de
 * trader fige les deux fenêtres dans le passé (rien ne bouge, rien n'est
 * promis).
 */

/** Une erreur, vue à travers les deux fenêtres de comparaison. */
export interface PlanItem {
  mistake: string;
  severity: Severity;
  /** Occurrences dans la fenêtre récente. */
  recent: number;
  /** Occurrences dans la fenêtre précédente, de même durée. */
  previous: number;
  /**
   * Variation en %, arrondie. Négatif = l'erreur RECULE.
   * `null` tant que la fenêtre précédente est vide : annoncer « +100 % » pour
   * une erreur qui vient d'apparaître serait une affirmation sans mesure.
   */
  deltaPct: number | null;
  /** Occurrences sur tout l'historique — le poids de l'habitude. */
  total: number;
}

export interface MistakePlan {
  /** Grave ET encore présente. */
  banish: PlanItem[];
  /** Encore présente, sans être de gravité haute. */
  work: PlanItem[];
  /** Présente avant, absente de la fenêtre récente. */
  stopped: PlanItem[];
  /**
   * Y a-t-il assez d'historique pour comparer ? Faux quand la fenêtre
   * précédente est entièrement vide — la page doit alors se taire sur les
   * progrès au lieu d'en inventer.
   */
  hasPrevious: boolean;
  /** Durée d'une fenêtre, en jours — pour l'écrire à l'écran. */
  windowDays: number;
}

/** Combien de trades d'affilée sans une seule erreur cochée. */
export interface CleanStreak {
  /** La série EN COURS, comptée depuis le trade le plus récent. */
  current: number;
  /** La plus longue jamais tenue. */
  best: number;
  /** Trades observés — aucune série ne se lit sans sa base. */
  total: number;
}

/** Le rythme des erreurs, d'une fenêtre à l'autre. */
export interface IncidentRate {
  /** `null` si aucun trade dans la fenêtre : pas de rythme sans trades. */
  recent: { incidents: number; trades: number } | null;
  previous: { incidents: number; trades: number } | null;
  /** Variation du nombre d'erreurs PAR TRADE. Négatif = ça s'améliore. */
  deltaPct: number | null;
}

/** Les deux bornes de fenêtre, ou `null` si l'historique est vide. */
function fenetres(trades: Trade[]): { midKey: string; startKey: string } | null {
  if (trades.length === 0) return null;
  const derniere = trades.reduce((a, t) => (t.date > a ? t.date : a), trades[0].date);
  const fin = new Date(derniere + "T12:00:00");
  const milieu = new Date(fin);
  milieu.setDate(milieu.getDate() - TREND_WINDOW_DAYS);
  const debut = new Date(fin);
  debut.setDate(debut.getDate() - TREND_WINDOW_DAYS * 2);
  return { midKey: localDateOf(milieu), startKey: localDateOf(debut) };
}

function severityOf(mistake: string): Severity {
  return MISTAKE_SEVERITY[mistake] ?? "medium";
}

/**
 * Le classement d'une erreur dans le plan, en un seul endroit.
 *
 * Le tri final ne pouvait pas vivre dans le composant : trois filtres écrits à
 * la main dans du JSX auraient laissé passer le cas qui compte — une erreur
 * absente des trois voies, donc invisible alors qu'elle est journalisée.
 */
export function buildMistakePlan(trades: Trade[]): MistakePlan {
  const bornes = fenetres(trades);
  const total: Record<string, number> = {};
  const recent: Record<string, number> = {};
  const previous: Record<string, number> = {};

  for (const t of trades) {
    if (t.mistakes.length === 0) continue;
    const voie = !bornes
      ? null
      : t.date > bornes.midKey
        ? recent
        : t.date > bornes.startKey
          ? previous
          : null;
    for (const m of t.mistakes) {
      total[m] = (total[m] ?? 0) + 1;
      if (voie) voie[m] = (voie[m] ?? 0) + 1;
    }
  }

  const items: PlanItem[] = Object.keys(total).map((mistake) => {
    const r = recent[mistake] ?? 0;
    const p = previous[mistake] ?? 0;
    return {
      mistake,
      severity: severityOf(mistake),
      recent: r,
      previous: p,
      deltaPct: p === 0 ? null : Math.round(((r - p) / p) * 100),
      total: total[mistake],
    };
  });

  /* Les plus fréquentes d'abord, dans chaque voie : c'est la fréquence RÉCENTE
     qui dit sur quoi agir, pas le total historique — une erreur commise vingt
     fois l'an dernier et jamais depuis n'a plus rien à corriger. */
  const parFrequence = (a: PlanItem, b: PlanItem) => b.recent - a.recent || b.total - a.total;
  const parAncienneté = (a: PlanItem, b: PlanItem) => b.previous - a.previous;

  return {
    banish: items.filter((i) => i.recent > 0 && i.severity === "high").sort(parFrequence),
    work: items.filter((i) => i.recent > 0 && i.severity !== "high").sort(parFrequence),
    stopped: items.filter((i) => i.recent === 0 && i.previous > 0).sort(parAncienneté),
    hasPrevious: items.some((i) => i.previous > 0),
    windowDays: TREND_WINDOW_DAYS,
  };
}

/**
 * L'ORDRE CHRONOLOGIQUE DES TRADES.
 *
 * `date` seule ne suffit pas : plusieurs trades partagent une journée, et une
 * série se compte trade par trade. `entryTime` les départage quand il est
 * renseigné ; il peut être vide (import CSV sans horaire), auquel cas l'ordre
 * de la liste sert de départage — stable, faute de mieux, et jamais faux
 * puisqu'il n'affirme rien.
 */
function chronologique(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.entryTime || "").localeCompare(b.entryTime || ""),
  );
}

/**
 * LA SÉRIE PROPRE — la seule mesure de cette page qu'on ait envie de faire
 * monter.
 *
 * Un score sur 100 dit où l'on en est ; il ne donne aucune raison d'ouvrir la
 * page demain. Une série dit « quatorze trades sans une erreur » — et le
 * quinzième compte.
 *
 * Elle se lit sur les erreurs COCHÉES, donc sur ce que le trader a bien voulu
 * déclarer. Ce n'est pas une mesure de sa discipline réelle et la page ne doit
 * pas le prétendre : c'est une mesure de ce qu'il a journalisé.
 */
export function computeCleanStreak(trades: Trade[]): CleanStreak {
  const ordre = chronologique(trades);
  let best = 0;
  let courant = 0;
  for (const t of ordre) {
    if (t.mistakes.length === 0) {
      courant++;
      if (courant > best) best = courant;
    } else {
      courant = 0;
    }
  }
  return { current: courant, best, total: ordre.length };
}

/**
 * LE RYTHME DES ERREURS, D'UNE FENÊTRE À L'AUTRE.
 *
 * Compté PAR TRADE, jamais en valeur absolue : un mois à trente trades et six
 * erreurs vaut mieux qu'un mois à dix trades et cinq erreurs, alors que le
 * compte brut dit l'inverse. Sans cette normalisation, augmenter son activité
 * suffirait à faire croire qu'on régresse.
 */
export function computeIncidentRate(trades: Trade[]): IncidentRate {
  const bornes = fenetres(trades);
  if (!bornes) return { recent: null, previous: null, deltaPct: null };

  const compte = (dans: (d: string) => boolean) => {
    let incidents = 0;
    let n = 0;
    for (const t of trades) {
      if (!dans(t.date)) continue;
      n++;
      incidents += t.mistakes.length;
    }
    return n === 0 ? null : { incidents, trades: n };
  };

  const recent = compte((d) => d > bornes.midKey);
  const previous = compte((d) => d > bornes.startKey && d <= bornes.midKey);

  let deltaPct: number | null = null;
  if (recent && previous && previous.incidents > 0) {
    const a = recent.incidents / recent.trades;
    const b = previous.incidents / previous.trades;
    deltaPct = Math.round(((a - b) / b) * 100);
  }
  return { recent, previous, deltaPct };
}
