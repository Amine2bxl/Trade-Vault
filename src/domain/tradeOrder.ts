import type { Trade } from "./trade";
import { instantMs } from "./easternClock";

/**
 * L'ORDRE CHRONOLOGIQUE D'UN TRADE — la date, puis l'HEURE D'ENTRÉE.
 *
 * Le journal ne triait que sur la date : les trades d'une même journée
 * gardaient l'ordre de chargement, et « 09:47 » pouvait s'afficher au-dessus
 * de « 11:42 ». La clé secondaire est l'heure d'ENTRÉE (le moment où la
 * décision a été prise), jamais celle de sortie.
 *
 * Les heures sont stockées en « HH:MM » ; une heure saisie sans zéro (« 9:05 »)
 * est normalisée pour que la comparaison de chaînes reste chronologique. Une
 * heure absente passe AVANT toutes les autres dans l'ordre croissant — donc en
 * bas de la journée dans le journal, qui lit du plus récent au plus ancien.
 */

function hhmm(time: string | undefined | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec((time ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Les champs qui suffisent à ordonner des entrées. */
type EntryClock = Pick<Trade, "date" | "entryTime"> & Partial<Pick<Trade, "entryAt">>;

/** Croissant : le plus ancien d'abord (date, puis heure d'entrée). Deux
 *  instants UTC prouvés (lot 1) se comparent directement : plus de minuit ni
 *  de fuseau du trader pour brouiller l'ordre. Un trade sans instant garde la
 *  clé date + heure : le comparateur reste un ordre TOTAL (une seule clé par
 *  trade), et `verifiedPriorClosedTrade` refuse de conclure entre les deux. */
export function compareChronological(a: EntryClock, b: EntryClock): number {
  return entryKey(a).localeCompare(entryKey(b));
}

/** Clé de tri d'une entrée : l'instant UTC s'il est prouvé, sinon date + heure. */
function entryKey(t: EntryClock): string {
  const ms = instantMs(t.entryAt);
  if (ms !== null)
    return (
      new Date(ms).toISOString().slice(0, 16).replace("T", " ") + ":" + String(ms).padStart(16, "0")
    );
  return `${t.date} ${hhmm(t.entryTime)}`;
}

/** Décroissant : le plus récent d'abord — l'ordre du journal. */
export function newestFirst(a: EntryClock, b: EntryClock): number {
  return -compareChronological(a, b);
}

/** Ordre de matérialisation du P&L, qui peut différer de l'ordre d'entrée.
 * Une sortie le lendemain ou une heure invalide est non vérifiable sans date
 * de clôture complète ; on conserve alors un tri de secours non probant. */
function verifiedClock(time: string | undefined | null): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((time ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function validSameDayExit(t: Pick<Trade, "entryTime" | "exitTime">): string | null {
  const entry = verifiedClock(t.entryTime);
  const exit = verifiedClock(t.exitTime);
  if (!entry || !exit || exit < entry) return null;
  return exit;
}

/** Les champs qui suffisent à ordonner des clôtures. */
type RealizedClock = Pick<Trade, "date" | "entryTime" | "exitTime"> &
  Partial<Pick<Trade, "entryAt" | "exitAt">>;

/** Croissant : du P&L réalisé le plus ancien au plus récent, si identifiable. */
export function compareRealizedChronological(a: RealizedClock, b: RealizedClock): number {
  const x = instantMs(a.exitAt);
  const y = instantMs(b.exitAt);
  if (x !== null && y !== null) return x - y;
  const dates = a.date.localeCompare(b.date);
  if (dates !== 0) return dates;
  const first = validSameDayExit(a) ?? verifiedClock(a.entryTime) ?? "";
  const second = validSameDayExit(b) ?? verifiedClock(b.entryTime) ?? "";
  return first.localeCompare(second) || compareChronological(a, b);
}

/** Sans une clôture non ambiguë, aucun drawdown intrajournalier n'est certifié. */
export function hasVerifiedRealizedOrder(trades: readonly RealizedClock[]): boolean {
  // Toutes les sorties ont un instant prouvé : l'ordre est certain, sauf deux
  // sorties au même instant. Sinon, l'ancienne preuve (date + heure locale).
  const instants = trades.map((t) => instantMs(t.exitAt));
  if (trades.length > 0 && instants.every((ms) => ms !== null)) {
    return new Set(instants).size === instants.length;
  }
  const seen = new Set<string>();
  for (const trade of trades) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.date)) return false;
    const exit = validSameDayExit(trade);
    if (!exit) return false;
    const key = trade.date + "T" + exit;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return trades.length > 0;
}

/** Vrai si un trade du même compte, sans instant prouvé, tombe dans la
 *  fenêtre de dates de la paire (± 1 jour). Fenêtre bornée : la liste est
 *  triée, on ne parcourt que les voisins de même époque. */
function unprovenNeighbour(
  list: readonly PriorTradeEvidence[],
  index: number,
  previous: PriorTradeEvidence,
  current: PriorTradeEvidence,
): boolean {
  const lo = shiftDay(previous.date < current.date ? previous.date : current.date, -1);
  const hi = shiftDay(previous.date > current.date ? previous.date : current.date, 1);
  const unproven = (t: PriorTradeEvidence) =>
    t.accountId === current.accountId &&
    (instantMs(t.entryAt) === null || instantMs(t.exitAt) === null) &&
    t.date >= lo &&
    t.date <= hi;
  for (let i = index - 2; i >= 0 && list[i].date >= lo; i--) if (unproven(list[i])) return true;
  for (let i = index + 1; i < list.length && list[i].date <= hi; i++)
    if (unproven(list[i])) return true;
  return false;
}

function shiftDay(date: string, days: number): string {
  const ms = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(ms)) return date;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/** Only the immediately previous ENTRY can be called "the previous trade".
 * Its outcome must have been finalized strictly before the current entry.
 * Otherwise a claim about trading "after a loss" would use future P&L.
 * Same-minute ties, overlapping positions and unverified import clocks are
 * deliberately UNKNOWN; reconstruction from fills belongs to Lot 1. */
export type PriorTradeEvidence = Pick<
  Trade,
  "date" | "entryTime" | "exitTime" | "accountId" | "broker" | "reviewPending"
> &
  Partial<Pick<Trade, "entryAt" | "exitAt">>;

export function verifiedPriorClosedTrade<T extends PriorTradeEvidence>(
  orderedByEntry: readonly T[],
  index: number,
): T | null {
  if (index <= 0 || index >= orderedByEntry.length) return null;
  const previous = orderedByEntry[index - 1];
  const current = orderedByEntry[index];
  if (previous.accountId !== current.accountId) return null;
  // Instants prouvés des deux côtés : la règle devient exacte, y compris pour
  // un import broker et une position tenue la nuit.
  const prevEntry = instantMs(previous.entryAt);
  const prevExit = instantMs(previous.exitAt);
  const curEntry = instantMs(current.entryAt);
  if (prevExit !== null && curEntry !== null) {
    if (prevEntry !== null && prevEntry >= curEntry) return null;
    // Un trade du même compte SANS instant, autour de ces dates, pourrait
    // s'être intercalé : son heure locale ne se compare pas à un instant UTC.
    if (unprovenNeighbour(orderedByEntry, index, previous, current)) return null;
    return prevExit < curEntry ? previous : null;
  }
  if (previous.broker || current.broker || previous.reviewPending || current.reviewPending) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(previous.date) || !/^\d{4}-\d{2}-\d{2}$/.test(current.date)) {
    return null;
  }
  const previousEntry = verifiedClock(previous.entryTime);
  const currentEntry = verifiedClock(current.entryTime);
  const previousExit = validSameDayExit(previous);
  if (!previousEntry || !currentEntry || !previousExit) return null;
  if (previous.date > current.date) return null;
  if (previous.date < current.date) return previous;
  if (previousEntry >= currentEntry || previousExit >= currentEntry) return null;
  return previous;
}
