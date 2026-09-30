/**
 * LA GRILLE D'UN MOIS — toujours pleine.
 *
 * Septembre 2026 commence un mardi : la grille laissait six colonnes vides
 * avant le 1er, rendues comme des cases noires sans date. Une case vide ne dit
 * rien ; une case datée du 31 août situe le mois dans la semaine réelle. La
 * grille commence donc au LUNDI de la semaine du 1er et finit au DIMANCHE de la
 * semaine du dernier jour — ni plus (pas de sixième semaine artificielle), ni
 * moins.
 *
 * Les dates sont calculées en temps LOCAL (constructeur `Date(y, m, d)`), jamais
 * via `toISOString()` : à Auckland ou à New York, une conversion UTC décalerait
 * chaque case d'un jour.
 */

export interface GridDay {
  /** YYYY-MM-DD, date locale. */
  date: string;
  /** Numéro du jour dans son propre mois (31 pour le 31 août). */
  day: number;
  /** Le jour appartient-il au mois AFFICHÉ ? Sinon : contexte seulement. */
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `month` de 0 à 11. Renvoie les semaines, du lundi au dimanche. */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = new Date(year, month, 1);
  // getDay() : 0 = dimanche. Décalage depuis le lundi.
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const rows: GridDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      // Midi : aucun changement d'heure ne fait glisser la date.
      const d = new Date(year, month, 1 - offset + w * 7 + i, 12);
      row.push({ date: iso(d), day: d.getDate(), inMonth: d.getMonth() === month });
    }
    rows.push(row);
  }
  return rows;
}

export interface WeekTotals {
  /** Résultat des jours DU MOIS affiché — le seul qui compte pour ce mois. */
  pnl: number;
  trades: number;
  days: number;
  /** Ce que les jours des mois voisins de la même semaine ont fait : visible,
   *  jamais additionné au mois. */
  outsidePnl: number;
  outsideTrades: number;
}

/** Totaux d'une semaine, séparés entre le mois affiché et ses voisins. */
export function weekTotals(
  row: GridDay[],
  byDate: Record<string, { pnl: number; count: number } | undefined>,
): WeekTotals {
  const out: WeekTotals = { pnl: 0, trades: 0, days: 0, outsidePnl: 0, outsideTrades: 0 };
  for (const cell of row) {
    const data = byDate[cell.date];
    if (!data || data.count === 0) continue;
    if (cell.inMonth) {
      out.pnl += data.pnl;
      out.trades += data.count;
      out.days += 1;
    } else {
      out.outsidePnl += data.pnl;
      out.outsideTrades += data.count;
    }
  }
  return out;
}
