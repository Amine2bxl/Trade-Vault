/**
 * LES TROIS FORMATS, RAMENÉS À UNE SEULE FORME — fonctions PURES, testées.
 *
 * Chaque parseur rend des clôtures de FIN DE MOIS, triées, sans doublon, et
 * sans le mois en cours (encore ouvert : sa « clôture » n'en est pas une).
 */
import type { MonthlyClose } from "./types";

const MONTH = /^\d{4}-\d{2}$/;

/** Dernier mois CLOS, en UTC, par rapport à `now`. */
export function lastClosedMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

function finalize(byMonth: Map<string, number>, now: Date): MonthlyClose[] {
  const cut = lastClosedMonth(now);
  return [...byMonth.entries()]
    .filter(([m, c]) => MONTH.test(m) && m <= cut && Number.isFinite(c) && c > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, close]) => ({ month, close }));
}

/** Yahoo Finance `v8/finance/chart` en `interval=1mo` : une barre par mois.
 *  (Interrogé par `period1`/`period2`, pas `range=max`, qui dégrade le
 *  passé en barres trimestrielles.) */
export function parseYahooMonthly(json: unknown, now: Date): MonthlyClose[] {
  const result = (json as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | {
        timestamp?: number[];
        indicators?: {
          adjclose?: { adjclose?: (number | null)[] }[];
          quote?: { close?: (number | null)[] }[];
        };
      }
    | undefined;
  const ts = result?.timestamp ?? [];
  const closes =
    result?.indicators?.adjclose?.[0]?.adjclose ?? result?.indicators?.quote?.[0]?.close ?? [];
  const byMonth = new Map<string, number>();
  ts.forEach((t, i) => {
    const c = closes[i];
    if (typeof c !== "number") return;
    // L'horodatage d'une barre mensuelle est MINUIT LOCAL de la place, le 1er
    // du mois : à Londres en été, c'est 23 h UTC… le 30 du mois PRÉCÉDENT, et
    // septembre écrasait octobre. Douze heures de marge ramènent toute place
    // (de UTC−12 à UTC+12) dans le bon mois.
    byMonth.set(new Date((t + 12 * 3600) * 1000).toISOString().slice(0, 7), c);
  });
  return finalize(byMonth, now);
}

/** Stooq `q/d/l/?i=m` : CSV « Date,Open,High,Low,Close,Volume ». */
export function parseStooqMonthly(csv: string, now: Date): MonthlyClose[] {
  const lines = csv.trim().split(/\r?\n/);
  const head = (lines.shift() ?? "").toLowerCase().split(",");
  const iDate = head.indexOf("date");
  const iClose = head.indexOf("close");
  const byMonth = new Map<string, number>();
  if (iDate < 0 || iClose < 0) return [];
  for (const line of lines) {
    const cells = line.split(",");
    const close = Number(cells[iClose]);
    const month = (cells[iDate] ?? "").slice(0, 7);
    if (Number.isFinite(close)) byMonth.set(month, close);
  }
  return finalize(byMonth, now);
}

/** FRED `fredgraph.csv` : une valeur par jour (« . » = pas de cotation).
 *  La clôture du mois est la dernière valeur cotée du mois. */
export function parseFredDaily(csv: string, now: Date): MonthlyClose[] {
  const lines = csv.trim().split(/\r?\n/);
  lines.shift();
  const byMonth = new Map<string, number>();
  for (const line of lines) {
    const [date, raw] = line.split(",");
    const v = Number(raw);
    if (!date || raw === "." || !Number.isFinite(v)) continue;
    byMonth.set(date.slice(0, 7), v); // les lignes sont chronologiques
  }
  return finalize(byMonth, now);
}
