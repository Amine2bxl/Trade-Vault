/**
 * magnet — L'AIMANT DU DESSIN.
 *
 * Module PUR, hors de la couche de dessin, pour deux raisons : il se teste
 * sans écran, et il décide d'un COMPORTEMENT — où une ancre atterrit — qu'on
 * ne veut pas voir dériver à la faveur d'un remaniement de vue.
 */

import type { OhlcBar } from "@/modules/replay";

/** Ce que l'aimant a besoin de savoir du graphe : convertir un prix en pixels. */
export interface PriceProjection {
  priceToCoordinate: (price: number) => number | null;
}

/**
 * L'AIMANT — coller une ancre à l'OHLC de la bougie visée.
 *
 * Tracer « sur le haut » à la souris revient à viser un pixel : selon le zoom,
 * un pixel vaut deux ou dix ticks, et le niveau qu'on relit trois bougies plus
 * tard n'est pas celui qu'on croyait poser. L'aimant retire cette loterie.
 *
 * DEUX GARDE-FOUS, sans lesquels il ferait plus de mal que de bien :
 *
 *  • il ne colle QUE si le prix visé est déjà proche — au-delà d'un seuil, le
 *    trader vise clairement autre chose qu'une extrémité de bougie, et
 *    l'aimanter lui volerait son geste. Le seuil est exprimé en PIXELS, pas en
 *    prix : c'est la distance à l'écran qui dit « je visais ça », et elle doit
 *    valoir la même chose à tous les zooms ;
 *  • sans bougie sous le curseur, il ne fait rien. Inventer un niveau sur une
 *    zone vide serait le contraire de ce qu'on lui demande.
 */
export const MAGNET_PIXELS = 12;

export function snapToBar(
  ms: number,
  price: number,
  candles: readonly OhlcBar[] | undefined,
  series: PriceProjection,
): number {
  if (!candles || candles.length === 0) return price;
  // La bougie la plus proche dans le temps — `coordinateToTime` rend un
  // horodatage interpolé, pas forcément celui d'une bougie existante.
  let best: OhlcBar | null = null;
  let bestDt = Infinity;
  for (const b of candles) {
    const dt = Math.abs(b.time - ms);
    if (dt < bestDt) {
      bestDt = dt;
      best = b;
    }
  }
  if (!best) return price;

  const cursorY = series.priceToCoordinate(price);
  if (cursorY == null) return price;

  let snapped = price;
  let bestPx = MAGNET_PIXELS;
  for (const candidate of [best.open, best.high, best.low, best.close]) {
    const y = series.priceToCoordinate(candidate);
    if (y == null) continue;
    const px = Math.abs(y - cursorY);
    if (px < bestPx) {
      bestPx = px;
      snapped = candidate;
    }
  }
  return snapped;
}
