import { isBreakEven, type Trade } from "../types";

/**
 * LA TEINTE D'UNE JOURNÉE DU CALENDRIER — calculée sur les VRAIS résultats.
 *
 * Le calendrier est une carte de performance : la couleur dit la journée, sans
 * chiffre dans la case. Une journée à +2R puis −1R n'est ni « verte » ni
 * « rouge » : elle est aux deux tiers positive. On additionne donc les
 * contributions positives et négatives (pas le nombre de gagnants contre le
 * nombre de perdants) et la case se partage dans cette proportion.
 *
 * L'UNITÉ. En R quand CHAQUE trade décisif de la journée porte un R (c'est la
 * mesure qui ne dépend pas de la taille de position) ; sinon en P&L, qui existe
 * toujours. Mélanger les deux dans une même journée fausserait la proportion.
 */

export type DayToneKind = "win" | "loss" | "mixed" | "flat";

export interface DayTone {
  kind: DayToneKind;
  /** Part POSITIVE des contributions, de 0 à 1 (0,67 pour +2R / −1R). */
  positiveShare: number;
  /** Part NEUTRE (trades à l'équilibre), de 0 à 1 : une bande grise entre le
   *  vert et le rouge, pour qu'un break-even se VOIE sans chiffre. */
  neutralShare: number;
  /** Somme des |contributions| — sert à l'intensité relative dans le mois. */
  magnitude: number;
  /** Le résultat net dans l'unité retenue. */
  net: number;
  unit: "R" | "pnl";
}

const FLAT: DayTone = {
  kind: "flat",
  positiveShare: 0.5,
  neutralShare: 1,
  magnitude: 0,
  net: 0,
  unit: "pnl",
};

export function dayTone(trades: Trade[]): DayTone {
  const decisive = trades.filter((t) => !isBreakEven(t));
  if (decisive.length === 0) return FLAT;

  const useR = decisive.every((t) => Number.isFinite(t.rMultiple) && t.rMultiple !== 0);
  const value = (t: Trade) => (useR ? t.rMultiple : t.pnl);

  let gains = 0;
  let losses = 0;
  for (const t of decisive) {
    const v = value(t);
    if (v > 0) gains += v;
    else if (v < 0) losses += -v;
  }
  const magnitude = gains + losses;
  if (magnitude === 0) return { ...FLAT, unit: useR ? "R" : "pnl" };

  /* Un break-even pèse le tiers d'un trade moyen de la journée : assez pour
     se voir, jamais assez pour masquer le résultat. */
  const beCount = trades.length - decisive.length;
  const neutral = beCount * 0.33 * (magnitude / decisive.length);
  const total = magnitude + neutral;
  const positiveShare = gains / total;
  const neutralShare = neutral / total;
  const kind: DayToneKind = losses === 0 ? "win" : gains === 0 ? "loss" : "mixed";
  return {
    kind,
    positiveShare,
    neutralShare,
    magnitude,
    net: gains - losses,
    unit: useR ? "R" : "pnl",
  };
}

/**
 * Le fond d'une case : un dégradé diagonal vert → rouge dont la frontière se
 * pose à la part positive. Couleurs de performance du thème (`--tv-chart-*`),
 * jamais d'arc-en-ciel : deux teintes, une transition douce, une intensité
 * qui suit l'ampleur de la journée dans le mois (`intensity` de 0 à 1).
 */
export function dayToneBackground(tone: DayTone, intensity: number): string | undefined {
  if (tone.kind === "flat") return undefined;
  const a = (0.1 + 0.3 * Math.min(1, Math.max(0, intensity))).toFixed(3);
  const soft = (Number(a) * 0.45).toFixed(3);
  const green = (alpha: string) => `rgb(var(--tv-chart-green-rgb) / ${alpha})`;
  const red = (alpha: string) => `rgb(var(--tv-chart-red-rgb) / ${alpha})`;
  const grey = `rgb(148 163 184 / ${(Number(a) * 0.6).toFixed(3)})`;
  // Composition : vert (gains) → gris (équilibre) → rouge (pertes), chaque
  // frontière adoucie sur ±7 %. Une journée pure garde un seul ton qui s'éteint.
  const g = Math.round(tone.positiveShare * 100);
  const n = Math.round((tone.positiveShare + tone.neutralShare) * 100);
  const soften = (x: number, d: number) => Math.min(100, Math.max(0, x + d));
  if (tone.kind === "win" && tone.neutralShare === 0)
    return `linear-gradient(155deg, ${green(a)}, ${green(soft)})`;
  if (tone.kind === "loss" && tone.neutralShare === 0)
    return `linear-gradient(155deg, ${red(a)}, ${red(soft)})`;
  const stops = [`${green(a)} 0%`];
  if (g > 0) stops.push(`${green(a)} ${soften(g, -7)}%`);
  if (tone.neutralShare > 0) {
    stops.push(`${grey} ${soften(g, 7)}%`, `${grey} ${soften(n, -7)}%`);
  }
  if (tone.kind === "win") {
    stops.push(`${green(soft)} 100%`);
  } else {
    stops.push(`${red(a)} ${soften(n, 7)}%`, `${red(soft)} 100%`);
  }
  if (g === 0) stops[0] = `${red(a)} 0%`;
  return `linear-gradient(155deg, ${stops.join(", ")})`;
}
