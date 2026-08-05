/**
 * Historique de l'Edge Score — la TRAJECTOIRE de discipline du trader.
 *
 * Pourquoi ce module existe
 * -------------------------
 * Le Dashboard calculait déjà l'Edge Score et son delta jour/jour, mais ne
 * conservait qu'UN instantané, écrasé chaque jour. Le trader pouvait donc voir
 * s'il avait monté depuis hier, jamais s'il PROGRESSE. Or « est-ce que je
 * m'améliore ? » est le besoin auquel aucune page ne répondait.
 *
 * Un score sans historique est un constat. Avec historique, c'est une
 * trajectoire — et une trajectoire donne une raison de revenir demain.
 *
 * Choix de conception
 * -------------------
 * - PUR : aucune dépendance à React ni au réseau. Le stockage est injecté, donc
 *   la logique est testable sans navigateur et migrable vers Supabase (Phase 3)
 *   sans toucher aux appelants.
 * - BORNÉ : au plus `MAX_DAYS` entrées. Un historique non borné dans
 *   localStorage finit par saturer le quota et casser des écritures sans rapport.
 * - UNE ENTRÉE PAR JOUR : le score d'un jour est réécrit tant que la journée
 *   n'est pas terminée (il bouge à chaque trade), jamais dupliqué.
 */

/** Fenêtre conservée. 30 jours ≈ un mois de trading : assez pour une tendance,
 *  assez court pour rester léger et pour que la progression reste lisible. */
export const MAX_DAYS = 30;

/** Fenêtre de la tendance affichée. 7 jours = une semaine de trading. */
export const TREND_DAYS = 7;

export interface EdgePoint {
  /** Jour ISO `YYYY-MM-DD`. */
  date: string;
  /** Edge Score 0–100 de ce jour. */
  score: number;
}

/** Contrat de stockage minimal — `localStorage` le satisfait tel quel. */
export interface EdgeStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function edgeHistoryKey(userId: string): string {
  return `tv.edge.${userId}`;
}

/**
 * Lit l'historique, tolérant au FORMAT HÉRITÉ.
 *
 * L'ancienne version stockait un objet unique `{date, score}`. On le convertit
 * en historique à un point au lieu de le jeter : la trajectoire d'un utilisateur
 * existant démarre donc avec son dernier score, pas à zéro.
 */
export function readHistory(store: EdgeStore, userId: string): EdgePoint[] {
  let raw: string | null;
  try {
    raw = store.getItem(edgeHistoryKey(userId));
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    // Format hérité : un instantané unique.
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      const snap = parsed as { date?: unknown; score?: unknown };
      return isValidPoint(snap) ? [{ date: snap.date as string, score: snap.score as number }] : [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidPoint)
      .map((p) => ({ date: (p as EdgePoint).date, score: (p as EdgePoint).score }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_DAYS);
  } catch {
    // Donnée corrompue : on repart d'un historique vide plutôt que de propager
    // une exception dans le rendu du Dashboard.
    return [];
  }
}

function isValidPoint(p: unknown): boolean {
  if (!p || typeof p !== "object") return false;
  const { date, score } = p as { date?: unknown; score?: unknown };
  return (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    typeof score === "number" &&
    Number.isFinite(score)
  );
}

/**
 * Ajoute (ou met à jour) le score du jour et renvoie l'historique borné.
 *
 * Le score du jour est RÉÉCRIT tant que la journée court : l'Edge Score bouge à
 * chaque trade ajouté, et c'est la valeur de fin de journée qui fait foi.
 */
export function appendToday(history: EdgePoint[], today: string, score: number): EdgePoint[] {
  const withoutToday = history.filter((p) => p.date !== today);
  return [...withoutToday, { date: today, score }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_DAYS);
}

export function writeHistory(store: EdgeStore, userId: string, history: EdgePoint[]): void {
  try {
    store.setItem(edgeHistoryKey(userId), JSON.stringify(history));
  } catch {
    // Quota dépassé ou stockage indisponible (navigation privée) : la
    // trajectoire est un CONFORT, jamais un bloquant. On abandonne en silence.
  }
}

/**
 * Delta jour/jour — comportement IDENTIQUE à l'implémentation d'origine :
 * comparaison au dernier jour ANTÉRIEUR à aujourd'hui, `null` s'il n'existe pas.
 */
export function dayOverDayDelta(
  history: EdgePoint[],
  today: string,
  todayScore: number,
): number | null {
  const previous = history.filter((p) => p.date !== today);
  if (previous.length === 0) return null;
  return todayScore - previous[previous.length - 1].score;
}

/**
 * Tendance sur `TREND_DAYS` jours — ce que le delta jour/jour ne peut pas dire.
 *
 * Renvoie `null` tant qu'il n'y a pas au moins deux points : annoncer une
 * tendance à partir d'une seule mesure serait une affirmation non fondée, et ce
 * produit ne montre jamais un chiffre qu'il ne peut pas justifier.
 */
export function trend(
  history: EdgePoint[],
  days: number = TREND_DAYS,
): { delta: number; from: number; to: number; points: number } | null {
  const window = history.slice(-days);
  if (window.length < 2) return null;
  const from = window[0].score;
  const to = window[window.length - 1].score;
  return { delta: to - from, from, to, points: window.length };
}
