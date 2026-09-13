import { describe, expect, test } from "bun:test";
import { MAGNET_PIXELS, snapToBar, type PriceProjection } from "../src/app/replay/magnet";
import type { OhlcBar } from "../src/modules/replay";

/**
 * L'AIMANT DÉPLACE CE QUE LE TRADER POSE.
 *
 * C'est le genre de confort qui devient nuisible dès qu'il déborde : un aimant
 * trop gourmand vole le geste, un aimant qui se trompe de bougie pose le
 * niveau ailleurs, et dans les deux cas le trader relit un trait qu'il n'a pas
 * tracé. D'où ces cas.
 */

function bar(time: number, o: number, h: number, l: number, c: number): OhlcBar {
  return { time, open: o, high: h, low: l, close: c, volume: 100 };
}

/**
 * Un graphe fictif où 1 point de prix vaut 1 pixel, l'axe pointant vers le bas
 * comme sur un écran. Cela rend les distances lisibles : « à 5 points » veut
 * dire « à 5 pixels », donc sous le seuil de 12.
 */
const linear: PriceProjection = { priceToCoordinate: (p) => -p };

/** Un graphe très dézoomé : 1 point de prix ne vaut qu'un dixième de pixel. */
const zoomedOut: PriceProjection = { priceToCoordinate: (p) => -p / 10 };

const bars = [
  bar(1_000, 100, 110, 90, 105),
  bar(2_000, 105, 120, 100, 118),
  bar(3_000, 118, 125, 115, 116),
];

describe("ce à quoi l'aimant colle", () => {
  test("il colle au HAUT quand le curseur en est proche", () => {
    expect(snapToBar(2_000, 119, bars, linear)).toBe(120);
  });

  test("il colle au BAS, à l'OUVERTURE et à la CLÔTURE aussi", () => {
    expect(snapToBar(2_000, 101, bars, linear)).toBe(100);
    expect(snapToBar(1_000, 99.5, bars, linear)).toBe(100); // open 100
    expect(snapToBar(3_000, 116.5, bars, linear)).toBe(116); // close 116
  });

  test("il choisit le point le PLUS PROCHE, pas le premier trouvé", () => {
    // Bougie 3 : open 118, high 125, low 115, close 116. Les quatre sont dans
    // le seuil ; c'est la distance qui doit trancher, et elle seule.
    expect(snapToBar(3_000, 116.4, bars, linear)).toBe(116);
    expect(snapToBar(3_000, 117.7, bars, linear)).toBe(118);
  });
});

describe("ce à quoi il NE colle PAS", () => {
  test("AU-DELÀ DU SEUIL, il rend le prix visé intact", () => {
    // 40 points au-dessus du haut : le trader vise clairement autre chose
    // qu'une extrémité de bougie. Lui voler son geste serait le pire service.
    expect(snapToBar(2_000, 160, bars, linear)).toBe(160);
  });

  test("le seuil est en PIXELS, donc il suit le zoom", () => {
    // Une bougie aux extrémités bien écartées : sans elle, les OHLC sont trop
    // serrés pour qu'un prix tombe hors de portée de tous les quatre.
    const sparse = [bar(2_000, 100, 200, 50, 150)];
    // 130 est à 20 points de la clôture (150), la plus proche. Au zoom normal
    // cela fait 20 pixels — au-delà du seuil, donc on n'y touche pas.
    expect(snapToBar(2_000, 130, sparse, linear)).toBe(130);
    // Dix fois plus dézoomé, ces mêmes 20 points ne valent que 2 pixels à
    // l'écran : l'aimant doit alors les rattraper, parce que c'est la distance
    // VUE qui dit « je visais ça ».
    expect(snapToBar(2_000, 130, sparse, zoomedOut)).toBe(150);
  });

  test("sans bougie, il ne fabrique aucun niveau", () => {
    expect(snapToBar(2_000, 119, [], linear)).toBe(119);
    expect(snapToBar(2_000, 119, undefined, linear)).toBe(119);
  });

  test("une projection muette le laisse passer", () => {
    // Hors du champ visible, la librairie rend `null`. Traiter ce `null` comme
    // un zéro collerait l'ancre au bord de l'écran.
    const blind: PriceProjection = { priceToCoordinate: () => null };
    expect(snapToBar(2_000, 119, bars, blind)).toBe(119);
  });
});

describe("la bougie retenue", () => {
  test("c'est la plus proche DANS LE TEMPS, pas la première", () => {
    // `coordinateToTime` rend un horodatage interpolé qui tombe rarement pile
    // sur une bougie : 2 400 est plus proche de 2 000 que de 3 000.
    expect(snapToBar(2_400, 119, bars, linear)).toBe(120); // high de la bougie 2
    // 2 900 bascule sur la bougie 3, dont le haut est 125.
    expect(snapToBar(2_900, 124, bars, linear)).toBe(125);
  });

  test("un instant hors plage retombe sur la bougie la plus proche", () => {
    expect(snapToBar(50_000, 124, bars, linear)).toBe(125);
    expect(snapToBar(0, 109, bars, linear)).toBe(110);
  });
});

describe("le seuil est une constante partagée", () => {
  test("il vaut ce que la couche de dessin croit qu'il vaut", () => {
    // Le test ci-dessus sur le zoom repose sur cette valeur : si quelqu'un la
    // change, c'est ici qu'il doit s'en rendre compte.
    expect(MAGNET_PIXELS).toBe(12);
  });
});
