import { describe, expect, test } from "bun:test";
import {
  atr,
  bollinger,
  computeIndicator,
  defaultIndicator,
  ema,
  heikinAshi,
  indicatorTitle,
  INDICATOR_SPECS,
  macd,
  rma,
  rsi,
  sma,
  sourceOf,
  stochastic,
  vwap,
  wma,
  type OhlcBar,
} from "@/modules/replay";

/**
 * LES INDICATEURS SONT DES CHIFFRES QU'ON LIT POUR DÉCIDER.
 *
 * Une EMA qui n'amorce pas sur une SMA, un RSI lissé en EMA plutôt qu'en
 * Wilder, un VWAP qui ne repart pas à l'ouverture : chacune de ces erreurs
 * donne une courbe qui RESSEMBLE à la bonne. C'est précisément pour cela
 * qu'elle doit être testée contre des valeurs calculées à la main plutôt que
 * vérifiée à l'œil.
 */

/** Des bougies fabriquées, avec la clôture qu'on veut. */
function barsOf(closes: number[], startMs = 0, stepMs = 60_000): OhlcBar[] {
  return closes.map((c, i) => ({
    time: startMs + i * stepMs,
    open: c,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 100,
  }));
}

describe("les moyennes", () => {
  test("la SMA est nulle tant que la fenêtre n'est pas pleine", () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });

  test("la SMA glisse sans dériver sur une longue série", () => {
    const values = Array.from({ length: 200 }, (_, i) => i + 1);
    const out = sma(values, 10);
    // Moyenne de 191…200.
    expect(out[199]).toBeCloseTo(195.5, 10);
  });

  test("l'EMA AMORCE SUR UNE SMA, pas sur la première valeur", () => {
    // SMA(3) des trois premières = 2 ; puis k = 2/(3+1) = 0,5.
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBe(2);
    expect(out[3]).toBeCloseTo(3, 10);
    expect(out[4]).toBeCloseTo(4, 10);
  });

  test("l'EMA reste nulle si la série est plus courte que sa période", () => {
    expect(ema([1, 2], 5)).toEqual([null, null]);
  });

  test("la WMA pèse les valeurs récentes plus lourd", () => {
    // (3×3 + 2×2 + 1×1) / 6 = 14/6.
    expect(wma([1, 2, 3], 3)![2]).toBeCloseTo(14 / 6, 10);
  });

  test("le lissage de Wilder n'est pas une EMA de même période", () => {
    const values = [1, 2, 3, 4, 5, 6];
    const w = rma(values, 3);
    const e = ema(values, 3);
    expect(w[2]).toBe(2);
    // RMA : (2×2 + 4)/3 = 8/3 ; EMA : 4×0,5 + 2×0,5 = 3.
    expect(w[3]).toBeCloseTo(8 / 3, 10);
    expect(e[3]).toBeCloseTo(3, 10);
  });
});

describe("les sources", () => {
  const bar: OhlcBar = { time: 0, open: 10, high: 20, low: 6, close: 12, volume: 1 };

  test("chaque source lit ce qu'elle annonce", () => {
    expect(sourceOf(bar, "open")).toBe(10);
    expect(sourceOf(bar, "high")).toBe(20);
    expect(sourceOf(bar, "low")).toBe(6);
    expect(sourceOf(bar, "close")).toBe(12);
    expect(sourceOf(bar, "hl2")).toBe(13);
    expect(sourceOf(bar, "hlc3")).toBeCloseTo((20 + 6 + 12) / 3, 10);
    expect(sourceOf(bar, "ohlc4")).toBe(12);
  });
});

describe("Bollinger", () => {
  test("les bandes encadrent la base de `mult` écarts-types de POPULATION", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const { basis, upper, lower } = bollinger(values, 8, 2);
    // Moyenne 5, écart-type de population 2 (l'échantillon donnerait ~2,14).
    expect(basis[7]).toBe(5);
    expect(upper[7]).toBeCloseTo(9, 10);
    expect(lower[7]).toBeCloseTo(1, 10);
  });
});

describe("RSI", () => {
  test("une série qui ne fait que monter vaut 100", () => {
    const out = rsi([1, 2, 3, 4, 5, 6, 7, 8], 3);
    expect(out[7]).toBe(100);
  });

  test("une série qui ne fait que descendre vaut 0", () => {
    const out = rsi([8, 7, 6, 5, 4, 3, 2, 1], 3);
    expect(out[7]).toBe(0);
  });

  test("des variations symétriques tiennent autour de 50", () => {
    const values = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11];
    const out = rsi(values, 14);
    expect(out[15]).toBeGreaterThan(35);
    expect(out[15]).toBeLessThan(65);
  });

  test("il reste nul tant que Wilder n'a pas sa fenêtre", () => {
    const out = rsi([1, 2, 3], 14);
    expect(out.every((v) => v == null)).toBe(true);
  });
});

describe("MACD", () => {
  test("la ligne est la différence des deux EMA, et l'histogramme son écart au signal", () => {
    const values = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const { macd: line, signal, histogram } = macd(values, 12, 26, 9);
    const fast = ema(values, 12);
    const slow = ema(values, 26);
    const i = 119;
    expect(line[i]).toBeCloseTo((fast[i] as number) - (slow[i] as number), 10);
    expect(histogram[i]).toBeCloseTo((line[i] as number) - (signal[i] as number), 10);
  });

  test("le signal ne démarre pas avant la ligne", () => {
    const values = Array.from({ length: 60 }, (_, i) => i);
    const { macd: line, signal } = macd(values, 12, 26, 9);
    const firstLine = line.findIndex((v) => v != null);
    const firstSignal = signal.findIndex((v) => v != null);
    expect(firstSignal).toBeGreaterThanOrEqual(firstLine);
  });
});

describe("ATR", () => {
  test("sur des bougies d'amplitude constante, il vaut cette amplitude", () => {
    // Chaque bougie : haut = close+1, bas = close−1, et la clôture ne bouge
    // pas → le true range vaut 2 partout.
    const bars = barsOf(Array(30).fill(100));
    const out = atr(bars, 14);
    expect(out[29]).toBeCloseTo(2, 10);
  });
});

describe("stochastique", () => {
  test("une clôture au plus haut de la fenêtre vaut 100", () => {
    const bars: OhlcBar[] = [
      { time: 0, open: 1, high: 10, low: 0, close: 5, volume: 1 },
      { time: 1, open: 5, high: 10, low: 0, close: 5, volume: 1 },
      { time: 2, open: 5, high: 10, low: 0, close: 10, volume: 1 },
    ];
    const { k } = stochastic(bars, 3, 1, 1);
    expect(k[2]).toBe(100);
  });

  test("une fenêtre entièrement plate rend 50, pas une division par zéro", () => {
    const bars: OhlcBar[] = Array.from({ length: 3 }, (_, i) => ({
      time: i,
      open: 5,
      high: 5,
      low: 5,
      close: 5,
      volume: 1,
    }));
    const { k } = stochastic(bars, 3, 1, 1);
    expect(k[2]).toBe(50);
  });
});

describe("VWAP", () => {
  const newSession = (bar: OhlcBar, prev: OhlcBar) =>
    Math.floor(bar.time / 86_400_000) !== Math.floor(prev.time / 86_400_000);

  test("il pondère par le volume", () => {
    const bars: OhlcBar[] = [
      { time: 0, open: 10, high: 10, low: 10, close: 10, volume: 1 },
      { time: 1000, open: 20, high: 20, low: 20, close: 20, volume: 3 },
    ];
    // (10×1 + 20×3) / 4 = 17,5.
    expect(vwap(bars, newSession)[1]).toBeCloseTo(17.5, 10);
  });

  test("IL REPART À L'OUVERTURE — sinon il traîne la veille", () => {
    const day = 86_400_000;
    const bars: OhlcBar[] = [
      { time: 0, open: 10, high: 10, low: 10, close: 10, volume: 100 },
      { time: day, open: 50, high: 50, low: 50, close: 50, volume: 1 },
    ];
    const out = vwap(bars, newSession);
    // Sans remise à zéro, la veille (10, volume 100) écraserait la séance.
    expect(out[1]).toBeCloseTo(50, 10);
  });
});

describe("Heikin-Ashi", () => {
  test("la clôture est la moyenne OHLC et l'ouverture le milieu de la précédente", () => {
    const bars: OhlcBar[] = [
      { time: 0, open: 10, high: 14, low: 8, close: 12, volume: 1 },
      { time: 1, open: 12, high: 18, low: 10, close: 16, volume: 1 },
    ];
    const ha = heikinAshi(bars);
    expect(ha[0].close).toBe((10 + 14 + 8 + 12) / 4); // 11
    expect(ha[0].open).toBe((10 + 12) / 2); // 11
    expect(ha[1].close).toBe((12 + 18 + 10 + 16) / 4); // 14
    expect(ha[1].open).toBe((ha[0].open + ha[0].close) / 2);
    // Le haut et le bas englobent toujours le corps.
    expect(ha[1].high).toBeGreaterThanOrEqual(Math.max(ha[1].open, ha[1].close));
    expect(ha[1].low).toBeLessThanOrEqual(Math.min(ha[1].open, ha[1].close));
  });

  test("elle garde le volume et l'horodatage d'origine", () => {
    const bars = barsOf([1, 2, 3]);
    const ha = heikinAshi(bars);
    expect(ha.map((b) => b.time)).toEqual(bars.map((b) => b.time));
    expect(ha.map((b) => b.volume)).toEqual(bars.map((b) => b.volume));
  });
});

describe("le catalogue", () => {
  const anchor = () => false;

  test("chaque étude rend AUTANT DE LIGNES que le catalogue en annonce", () => {
    const bars = barsOf(Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 7) * 5));
    for (const kind of Object.keys(INDICATOR_SPECS) as (keyof typeof INDICATOR_SPECS)[]) {
      const cfg = defaultIndicator(kind, `t-${kind}`);
      const lines = computeIndicator(cfg, bars, anchor);
      expect(lines.length).toBe(INDICATOR_SPECS[kind].lines.length);
      for (const line of lines) {
        // Une ligne doit couvrir TOUTES les bougies, quitte à valoir `null` :
        // c'est ce qui permet à la légende de lire la valeur par index.
        expect(line.points.length).toBe(bars.length);
      }
    }
  });

  test("une étude sans assez d'histoire ne fabrique aucune valeur", () => {
    const bars = barsOf([100, 101, 102]);
    const cfg = defaultIndicator("ema", "t-ema"); // période 21 par défaut
    const [line] = computeIndicator(cfg, bars, anchor);
    expect(line.points.every((p) => p.value == null)).toBe(true);
  });

  test("les réglages voyagent jusqu'au calcul", () => {
    const bars = barsOf(Array.from({ length: 40 }, (_, i) => i + 1));
    const cfg = { ...defaultIndicator("ma", "t-ma"), params: { length: 5 } };
    const [line] = computeIndicator(cfg, bars, anchor);
    // Moyenne de 36…40.
    expect(line.points[39].value).toBeCloseTo(38, 10);
  });

  test("le titre de légende porte les réglages, comme sur la plateforme", () => {
    const cfg = { ...defaultIndicator("bb", "t-bb"), params: { length: 20, mult: 2 } };
    expect(indicatorTitle(cfg, "BB")).toBe("BB 20 2");
    expect(indicatorTitle(defaultIndicator("vwap", "t-v"), "VWAP")).toBe("VWAP");
  });

  test("aucune couleur de marque en dur — les défauts sont des jetons de thème", () => {
    for (const spec of Object.values(INDICATOR_SPECS)) {
      for (const color of spec.defaultColors) {
        expect(color.startsWith("var(--tv-")).toBe(true);
      }
    }
  });
});
