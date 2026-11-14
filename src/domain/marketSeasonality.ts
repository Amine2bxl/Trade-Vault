/**
 * LA SAISONNALITÉ D'UN MARCHÉ, MESURÉE — module PUR (client et serveur).
 *
 * À partir des clôtures de fin de mois : le rendement de chaque mois complet,
 * puis, par mois du calendrier, sa moyenne, la part d'années positives et le
 * nombre d'années mesurées (`n`). Sous `MIN_YEARS_PER_MONTH` années, un mois
 * ne reçoit AUCUN chiffre (null) : quatre Septembre ne font pas une saison.
 */
export const MIN_YEARS_PER_MONTH = 5;

export interface MonthClose {
  month: string; // « AAAA-MM »
  close: number;
}

export interface MarketSeasonality {
  /** Rendement moyen en %, index 0 = janvier. `null` sous l'échantillon minimum. */
  monthlyAvg: (number | null)[];
  /** Part des années où le mois a fini positif, en %. */
  monthlyWin: (number | null)[];
  /** Années mesurées pour chaque mois. */
  monthlyN: number[];
  /** Années pleines couvertes (le plus petit `n`). */
  years: number;
  from: string | null;
  to: string | null;
}

const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};

export function seasonalityFromCloses(series: readonly MonthClose[]): MarketSeasonality {
  const byMonth = new Map(series.map((s) => [s.month, s.close]));
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const s of series) {
    const prev = byMonth.get(prevMonth(s.month));
    if (!prev || !(prev > 0) || !(s.close > 0)) continue;
    buckets[Number(s.month.slice(5, 7)) - 1].push(s.close / prev - 1);
  }
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const monthlyN = buckets.map((b) => b.length);
  return {
    monthlyAvg: buckets.map((b) =>
      b.length >= MIN_YEARS_PER_MONTH
        ? round2((b.reduce((s, r) => s + r, 0) / b.length) * 100)
        : null,
    ),
    monthlyWin: buckets.map((b) =>
      b.length >= MIN_YEARS_PER_MONTH
        ? Math.round((b.filter((r) => r > 0).length / b.length) * 100)
        : null,
    ),
    monthlyN,
    years: Math.min(...monthlyN),
    from: series[0]?.month ?? null,
    to: series.at(-1)?.month ?? null,
  };
}
