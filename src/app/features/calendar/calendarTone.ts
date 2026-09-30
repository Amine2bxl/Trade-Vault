import { isBreakEven, type Trade } from "@/app/types";

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
 * LE FOND D'UNE CASE — une teinte SOLIDE, jamais un dégradé.
 *
 * Le dégradé vert → gris → rouge, qui composait la journée dans la case, se
 * lisait comme un bonbon : trop de couleur, trop de mouvement pour une grille
 * qu'on parcourt d'un regard. La case porte désormais UNE teinte à peine
 * posée, celle du résultat net ; son intensité suit l'ampleur de la journée
 * dans le mois (`intensity` de 0 à 1). La composition d'une journée mixte se
 * lit dans un filet discret (`dayToneSegments`), pas dans le fond.
 */
export function dayToneFill(tone: DayTone, intensity: number): string {
  const k = Math.min(1, Math.max(0, intensity));
  const alpha = (0.06 + 0.1 * k).toFixed(3);
  const sign = tone.kind === "win" ? 1 : tone.kind === "loss" ? -1 : Math.sign(tone.net);
  if (tone.kind === "flat" || sign === 0) return "rgb(148 163 184 / 0.07)";
  return sign > 0
    ? `rgb(var(--tv-chart-green-rgb) / ${alpha})`
    : `rgb(var(--tv-chart-red-rgb) / ${alpha})`;
}

/**
 * LA COMPOSITION D'UNE JOURNÉE MIXTE — un filet de deux pixels, en aplats.
 * Gains, break-even, pertes, chacun à sa part. `null` pour une journée pure :
 * sa teinte dit déjà tout.
 */
export function dayToneSegments(tone: DayTone): { color: string; share: number }[] | null {
  if (tone.kind !== "mixed" && tone.neutralShare === 0) return null;
  if (tone.kind === "flat") return null;
  const negative = Math.max(0, 1 - tone.positiveShare - tone.neutralShare);
  return [
    { color: "rgb(var(--tv-chart-green-rgb) / 0.75)", share: tone.positiveShare },
    { color: "rgb(148 163 184 / 0.6)", share: tone.neutralShare },
    { color: "rgb(var(--tv-chart-red-rgb) / 0.75)", share: negative },
  ].filter((s) => s.share > 0.001);
}

/**
 * LE LISERÉ DE LA CASE — la couleur du résultat NET, en filet d'un pixel.
 * La référence visuelle du calendrier sépare les jours par ce liseré : on lit
 * « gagnant / perdant / neutre » avant même de lire le montant. Une journée
 * mixte prend la couleur de son résultat net ; son fond, lui, garde la
 * composition exacte (`dayToneBackground`).
 */
export function dayToneBorder(tone: DayTone): string {
  const sign = tone.kind === "win" ? 1 : tone.kind === "loss" ? -1 : Math.sign(tone.net);
  if (sign > 0) return "rgb(var(--tv-chart-green-rgb) / 0.38)";
  if (sign < 0) return "rgb(var(--tv-chart-red-rgb) / 0.38)";
  return "rgb(148 163 184 / 0.32)";
}
