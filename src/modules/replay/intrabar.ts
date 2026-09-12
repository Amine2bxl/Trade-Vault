/**
 * Chemin intra-bougie — ce que l'on a le droit de savoir d'une minute en cours.
 *
 * Le rejeu ne dispose que d'OHLC 1m : la minute est un bloc, alors que le
 * trader la vit seconde par seconde. Sans précaution, afficher la 1m en cours
 * revient à MONTRER LE FUTUR — son high et son low sont le résultat d'une
 * minute qui n'a pas encore eu lieu. C'est précisément la fuite que le terminal
 * prétend rendre impossible.
 *
 * On reconstruit donc un chemin plausible à l'intérieur de la bougie :
 *   open → premier extrême → second extrême → close
 * Une bougie haussière va d'abord chercher son low avant de monter ; une
 * baissière fait l'inverse. C'est l'hypothèse usuelle des « bar magnifier »,
 * et elle a deux propriétés indispensables ici :
 *
 *  - DÉTERMINISTE : aucune graine, aucun hasard — le chemin est une fonction
 *    pure de la bougie. `rebuildState` peut donc reconstruire un état identique.
 *  - MONOTONE : les extrêmes courus ne font que s'écarter quand la fraction
 *    avance. Rejouer vers l'avant ne réécrit jamais ce qui a déjà été montré.
 *
 * À f = 1 le chemin a visité les deux extrêmes : la bougie partielle rejoint
 * exactement la bougie réelle, sans discontinuité.
 */

import { OhlcBar } from "./types";

/** Vue partielle d'une bougie à un instant donné de sa formation. */
export interface IntrabarView {
  /** Le prix « vivant » à cette fraction. */
  price: number;
  /** Plus haut ATTEINT depuis l'ouverture — jamais le high futur. */
  high: number;
  /** Plus bas ATTEINT depuis l'ouverture. */
  low: number;
}

/**
 * Les quatre sommets du chemin, dans l'ordre de visite.
 *
 * L'ordre des extrêmes suit le sens de la bougie : une clôture au-dessus de
 * l'ouverture se paie d'un creux préalable, et réciproquement.
 */
export function intrabarNodes(bar: OhlcBar): [number, number, number, number] {
  return bar.close >= bar.open
    ? [bar.open, bar.low, bar.high, bar.close]
    : [bar.open, bar.high, bar.low, bar.close];
}

/**
 * L'état de la bougie à la fraction `f` de sa durée (0 = ouverture, 1 = close).
 *
 * Le temps est distribué proportionnellement au CHEMIN PARCOURU, pas en parts
 * égales : un aller-retour de deux points ne prend pas autant de « temps » que
 * la jambe de vingt points qui suit. Le déplacement paraît régulier.
 */
export function intrabarAt(bar: OhlcBar, f: number): IntrabarView {
  const t = Math.max(0, Math.min(1, f));
  const n = intrabarNodes(bar);

  // Distances cumulées le long du chemin.
  const d = [0, 0, 0, 0];
  for (let i = 1; i < 4; i++) d[i] = d[i - 1] + Math.abs(n[i] - n[i - 1]);
  const total = d[3];

  // Bougie parfaitement plate : rien à parcourir, rien à révéler.
  if (total === 0) return { price: bar.open, high: bar.open, low: bar.open };

  const target = t * total;
  let price = n[3];
  let visited = 3;
  for (let i = 1; i < 4; i++) {
    if (target <= d[i]) {
      const span = d[i] - d[i - 1];
      const k = span === 0 ? 1 : (target - d[i - 1]) / span;
      price = n[i - 1] + (n[i] - n[i - 1]) * k;
      visited = i - 1;
      break;
    }
  }

  // Les extrêmes courus : les sommets déjà franchis, plus la position actuelle.
  let high = price;
  let low = price;
  for (let i = 0; i <= visited; i++) {
    if (n[i] > high) high = n[i];
    if (n[i] < low) low = n[i];
  }
  return { price, high, low };
}

/** La fraction de formation d'une bougie 1m à l'instant `now`. */
export function barFraction(bar: OhlcBar, now: number, spanMs = 60_000): number {
  return Math.max(0, Math.min(1, (now - bar.time) / spanMs));
}

/**
 * La bougie telle qu'on a le DROIT de l'afficher à `now`.
 *
 * Close et en dehors de la fenêtre : la bougie réelle. En formation : sa vue
 * partielle, dont les mèches n'ont pas encore poussé.
 */
export function visibleBar(bar: OhlcBar, now: number, spanMs = 60_000): OhlcBar {
  if (bar.time + spanMs <= now) return bar;
  const f = barFraction(bar, now, spanMs);
  const v = intrabarAt(bar, f);
  // Le volume se révèle lui aussi au fil de la minute : afficher d'emblée le
  // total serait annoncer l'activité d'un temps qui n'est pas écoulé.
  return {
    ...bar,
    high: v.high,
    low: v.low,
    close: v.price,
    volume: Math.max(0, Math.round(bar.volume * f)),
  };
}

/**
 * La PORTION de bougie parcourue entre deux fractions, rendue comme une bougie.
 *
 * Un ordre posé au milieu d'une minute n'a pas vécu son début : l'évaluer
 * contre la bougie entière le remplirait sur un mouvement antérieur à son
 * propre placement. On lui présente donc la seule tranche qu'il a traversée —
 * son ouverture est le prix au moment du placement, ses extrêmes ceux
 * réellement atteints depuis.
 */
export function intrabarSlice(bar: OhlcBar, f1: number, f2: number): OhlcBar {
  const a = Math.max(0, Math.min(1, Math.min(f1, f2)));
  const b = Math.max(0, Math.min(1, Math.max(f1, f2)));
  const from = intrabarAt(bar, a);
  const to = intrabarAt(bar, b);

  // Une tranche qui couvre toute la bougie EST la bougie : on rend l'original,
  // pour que les arrondis d'interpolation ne rabotent jamais un extrême réel.
  if (a <= 0 && b >= 1) return bar;

  let high = Math.max(from.price, to.price);
  let low = Math.min(from.price, to.price);

  // Les sommets franchis STRICTEMENT à l'intérieur de la tranche comptent aussi.
  const n = intrabarNodes(bar);
  const d = [0, 0, 0, 0];
  for (let i = 1; i < 4; i++) d[i] = d[i - 1] + Math.abs(n[i] - n[i - 1]);
  const total = d[3];
  if (total > 0) {
    for (let i = 1; i < 3; i++) {
      const t = d[i] / total;
      if (t > a && t < b) {
        if (n[i] > high) high = n[i];
        if (n[i] < low) low = n[i];
      }
    }
  }
  return { ...bar, open: from.price, close: to.price, high, low };
}
