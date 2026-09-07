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

/**
 * CE QUI SE PASSE JUSTE APRÈS UNE PERTE.
 *
 * ── POURQUOI CETTE MESURE-LÀ ────────────────────────────────────────────────
 *
 * La page savait dire QUELLE erreur revient, et à quelle fréquence. Elle ne
 * savait pas dire QUAND. Or la question que se pose un trader devant sa liste
 * d'erreurs n'est pas « laquelle » — il la connaît — mais « qu'est-ce qui
 * déclenche ça ». Le moment le plus documenté du métier est le trade qui SUIT
 * une perte, et c'est aussi le seul déclencheur qu'on puisse lire dans le
 * journal sans rien demander de plus au trader.
 *
 * ── CE QUE LE CHIFFRE DIT, ET CE QU'IL NE DIT PAS ───────────────────────────
 *
 * Deux taux comparés : la part de trades portant une erreur parmi ceux qui
 * suivent une perte, et la même part parmi les autres. C'est une ASSOCIATION
 * observée sur ce que le trader a coché lui-même — pas une cause. Le produit
 * l'écrit comme tel : « après une perte, X % de tes trades portent une erreur,
 * contre Y % sinon. » Il ne dit pas que la perte produit l'erreur.
 *
 * `null` sous cinq trades dans l'un des deux groupes : deux trades sur trois
 * font 67 %, un chiffre qui a l'air d'un fait et n'en est pas un.
 */
export interface AfterLoss {
  /** Trades suivant une perte : combien, et combien portent une erreur. */
  apres: { avecErreur: number; total: number };
  /** Tous les autres trades décidés. */
  autres: { avecErreur: number; total: number };
}

/** Sous ce seuil dans un groupe, on ne publie rien plutôt qu'un taux de sable. */
export const AFTER_LOSS_MIN = 5;

export function computeAfterLoss(trades: Trade[]): AfterLoss | null {
  const ordre = chronologique(trades);
  const apres = { avecErreur: 0, total: 0 };
  const autres = { avecErreur: 0, total: 0 };

  for (let i = 1; i < ordre.length; i++) {
    const precedent = ordre[i - 1];
    const t = ordre[i];
    const groupe = precedent.pnl < 0 ? apres : autres;
    groupe.total++;
    if (t.mistakes.length > 0) groupe.avecErreur++;
  }

  if (apres.total < AFTER_LOSS_MIN || autres.total < AFTER_LOSS_MIN) return null;
  return { apres, autres };
}

/* ────────────────────────────────────────────────────────────────────────────
   LE PONT VERS MONTE-CARLO
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * CE QUE LES DEUX PAGES SE DOIVENT.
 *
 * « Erreurs » dit ce que le trader fait mal. Monte-Carlo dit où son compte va
 * s'il continue. Chacune répond à la moitié d'une question — et aucune des deux
 * ne posait la seule qui les relie : ces erreurs-là, elles changent quoi à la
 * suite ?
 *
 * On y répond sans rien inventer : en rejouant la simulation sur le
 * SOUS-ENSEMBLE de ses trades qui ne portent aucune erreur cochée. Ce sont ses
 * vrais trades, sa vraie forme de gains et de pertes — simplement ceux qu'il a
 * lui-même jugés propres.
 *
 * ── CE QUE CETTE COMPARAISON N'EST PAS ──────────────────────────────────────
 *
 * Ce n'est PAS « ce que tu aurais gagné sans tes erreurs ». Deux raisons, et
 * elles doivent rester écrites à l'écran :
 *
 *   1. Un trade propre et un trade marqué ne sont pas le même trade dans un
 *      autre état : ce sont deux trades différents. Retirer les seconds ne
 *      « corrige » rien, ça change l'échantillon.
 *   2. Le marquage est DÉCLARATIF. Un trader marque plus volontiers ses
 *      pertes que ses gains — le sous-ensemble propre est donc biaisé vers le
 *      haut par construction, et l'écart surestime probablement le gain.
 *
 * La formulation honnête est descriptive : « en rejouant uniquement tes trades
 * sans erreur cochée ». Pas de causalité, pas de promesse.
 */
export interface CleanSplit {
  /** Les trades sans aucune erreur cochée. */
  clean: Trade[];
  /** Ceux qui en portent au moins une. */
  flagged: Trade[];
  /**
   * La comparaison est-elle publiable ? Faux dès qu'un des deux côtés est trop
   * mince : comparer deux échantillons dont l'un compte trois trades produit un
   * écart qui ne mesure que le hasard.
   */
  comparable: boolean;
}

/** Sous ce nombre de trades propres, aucune simulation comparative. */
export const CLEAN_SPLIT_MIN = 20;

export function splitCleanTrades(trades: Trade[]): CleanSplit {
  const clean: Trade[] = [];
  const flagged: Trade[] = [];
  for (const t of trades) (t.mistakes.length === 0 ? clean : flagged).push(t);
  return {
    clean,
    flagged,
    // Il faut assez de trades propres pour que la simulation ait une forme, ET
    // au moins un trade marqué — sinon les deux échantillons sont le même et
    // la comparaison ne compare rien.
    comparable: clean.length >= CLEAN_SPLIT_MIN && flagged.length > 0,
  };
}
