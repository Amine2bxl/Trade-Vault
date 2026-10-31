/**
 * La carte du plan — géométrie PURE de l'échelle des niveaux.
 *
 * POURQUOI. Trois prix écrits côte à côte (« 21 450 · FVG 21 520 · 21 580 »)
 * ne disent pas d'un coup d'œil ce que le plan promet. Posés sur une échelle,
 * ils montrent la forme du trade : la distance à la cible face à la distance à
 * l'invalidation, le sens, et le scénario B à côté. Une cible saisie du mauvais
 * côté de l'entrée saute aux yeux avant le verrou, pas après le stop.
 *
 * Le module ne dessine rien : il rend des positions (0 = haut, 1 = bas) et des
 * multiples de R. Le composant `PlanLadder` les pose à l'écran.
 */

import { levelPrice, planRR, type SessionPlan } from "./sessionPlan";

export type LadderKind = "target" | "entry" | "invalidation" | "altTarget";

export interface LadderLevel {
  kind: LadderKind;
  price: number;
  /** Le niveau tel que le trader l'a écrit (« FVG 21 520 »). */
  text: string;
  /** Position verticale, 0 = haut, 1 = bas. Le prix le plus haut est en haut. */
  y: number;
  /**
   * Position de l'étiquette : la ligne reste au prix exact, mais deux niveaux
   * proches ne doivent pas écrire l'un sur l'autre.
   */
  labelY: number;
  /** Hors de l'échelle du scénario A : épinglé au bord, dans ce sens. */
  beyond?: "above" | "below";
  /**
   * Multiple de R depuis l'entrée du scénario A : +R vers la cible, −1 à
   * l'invalidation. `null` pour la cible B, dont le risque n'est pas défini.
   */
  r: number | null;
}

export interface Ladder {
  levels: LadderLevel[];
  /** Zone de gain (entrée → cible) et zone de risque (entrée → invalidation). */
  reward: { top: number; bottom: number };
  risk: { top: number; bottom: number };
  rr: number;
  direction: "long" | "short";
}

/** Marge haute et basse : un niveau collé au bord se lit mal. */
const PAD = 0.1;

/** Position d'un niveau hors échelle, épinglé contre le bord. */
const EDGE = 0.03;

/** Écart minimal entre deux étiquettes, en fraction de la hauteur. */
export const LABEL_GAP = 0.16;

/**
 * Écarte des positions triées d'au moins `LABEL_GAP`, en restant dans [0, 1] :
 * une passe vers le bas qui repousse, une passe vers le haut qui ramène ce qui
 * déborde. Les positions déjà assez espacées ne bougent pas.
 */
export function spreadLabels(ys: readonly number[], gap = LABEL_GAP): number[] {
  const out = ys.slice();
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k], out[k - 1] + gap);
  const overflow = out.length ? out[out.length - 1] - 1 : 0;
  if (overflow > 0) {
    out[out.length - 1] = 1;
    for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k], out[k + 1] - gap);
  }
  return out.map((y) => Math.max(0, Math.min(1, y)));
}

/**
 * La géométrie, ou `null` quand l'échelle mentirait : sens non directionnel,
 * un des trois niveaux sans prix, ou entrée confondue avec l'invalidation.
 */
export function planLadder(plan: SessionPlan): Ladder | null {
  if (plan.bias !== "long" && plan.bias !== "short") return null;
  const e = levelPrice(plan.entry);
  const t = levelPrice(plan.target);
  const i = levelPrice(plan.invalidation);
  const rr = planRR(plan);
  if (e === null || t === null || i === null || rr === null) return null;
  const risk = Math.abs(e - i);

  const raw: Omit<LadderLevel, "y" | "labelY">[] = [
    {
      kind: "target",
      price: t,
      text: plan.target.trim(),
      r: Math.sign(t - e) * (plan.bias === "long" ? 1 : -1) * (Math.abs(t - e) / risk),
    },
    { kind: "entry", price: e, text: plan.entry.trim(), r: 0 },
    { kind: "invalidation", price: i, text: plan.invalidation.trim(), r: -1 },
  ];
  const alt = levelPrice(plan.alt.target);
  if (plan.alt.bias && alt !== null) {
    raw.push({ kind: "altTarget", price: alt, text: plan.alt.target.trim(), r: null });
  }

  // L'échelle suit le scénario A : c'est lui qu'on trade. Une cible B
  // lointaine l'aurait tassé dans un coin ; hors cadre, elle est épinglée au
  // bord et marquée comme telle.
  const hi = Math.max(t, e, i);
  const lo = Math.min(t, e, i);
  const span = hi - lo || 1;
  const yOf = (p: number) => PAD + ((hi - p) / span) * (1 - 2 * PAD);
  const placed = raw
    .map((l) => {
      const y = yOf(l.price);
      if (y < 0) return { ...l, y: EDGE, beyond: "above" as const };
      if (y > 1) return { ...l, y: 1 - EDGE, beyond: "below" as const };
      return { ...l, y };
    })
    .sort((a, b) => a.y - b.y);
  const labels = spreadLabels(placed.map((l) => l.y));
  const levels = placed.map((l, k) => ({ ...l, labelY: labels[k] }));

  const band = (a: number, b: number) => ({
    top: Math.min(yOf(a), yOf(b)),
    bottom: Math.max(yOf(a), yOf(b)),
  });
  return {
    levels,
    reward: band(e, t),
    risk: band(e, i),
    rr,
    direction: plan.bias,
  };
}
