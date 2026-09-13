/**
 * chartPrefs — l'apparence du graphe, telle que le trader la règle.
 *
 * Ces préférences sont VOLONTAIREMENT hors de la séance : elles ne décrivent
 * pas ce qui s'est passé sur le marché, mais la façon dont un trader aime le
 * regarder. Les enregistrer dans la séance aurait fait voyager le goût de
 * l'un avec les trades de l'autre, et aurait gonflé chaque sauvegarde d'un
 * état qui ne concerne que l'écran.
 *
 * D'où le stockage local : la même personne, sur la même machine, retrouve
 * son graphe ; personne d'autre n'en hérite. La lecture comme l'écriture
 * peuvent échouer (navigation privée, stockage bloqué) — dans ce cas on rend
 * les valeurs par défaut sans rien casser, parce qu'un graphe qui refuse de
 * s'afficher parce qu'il n'a pas pu lire une couleur serait absurde.
 *
 * LES DÉFAUTS SONT DES JETONS DE THÈME, jamais des hex. Une couleur écrite en
 * dur ignore le thème choisi et jure dès qu'on en change ; le test de
 * couverture des thèmes l'interdit, et il a raison. Le trader, lui, peut
 * choisir n'importe quelle couleur : ce qu'il saisit est une donnée, pas du
 * code, et elle ne vit que dans son navigateur.
 */

import type { IndicatorConfig } from "@/modules/replay";

/** Les types de graphe — ceux de la plateforme de référence. */
export type ChartType = "candles" | "hollow" | "bars" | "line" | "area" | "baseline" | "heikin";

export const CHART_TYPES: { id: ChartType; labelKey: string }[] = [
  { id: "candles", labelKey: "rt.type.candles" },
  { id: "hollow", labelKey: "rt.type.hollow" },
  { id: "bars", labelKey: "rt.type.bars" },
  { id: "line", labelKey: "rt.type.line" },
  { id: "area", labelKey: "rt.type.area" },
  { id: "baseline", labelKey: "rt.type.baseline" },
  { id: "heikin", labelKey: "rt.type.heikin" },
];

/**
 * Le VISEUR — et pourquoi il est ÉTEINT par défaut.
 *
 * Une croix qui suit le curseur sur toute la hauteur et toute la largeur du
 * graphe est un objet très présent : elle traverse les bougies, les ordres et
 * les niveaux tracés. Dans le rejeu, où l'accent du thème est chaud, elle
 * devenait la chose la plus visible de l'écran alors qu'elle ne porte aucune
 * information propre — les prix se lisent sur l'axe et la légende.
 *
 * Elle reste disponible pour qui la veut : c'est un réglage, pas une
 * suppression. « magnet » colle la barre horizontale au cours, comme sur la
 * plateforme de référence.
 */
export type CrosshairMode = "off" | "normal" | "magnet";

/** Le mode de l'échelle de prix. */
export type PriceScaleMode = "normal" | "log" | "percent";

export interface ChartPrefs {
  /** Le type de tracé du prix. */
  chartType: ChartType;
  /** Corps des bougies haussières / baissières. */
  up: string;
  down: string;
  /** Mèches — réglables à part du corps, comme sur la plateforme. */
  wickUp: string;
  wickDown: string;
  /** Contour des bougies (types « hollow » et « bars »). */
  borders: boolean;
  /** Fond de la zone de tracé. */
  background: string;
  /** Grille — le quadrillage se coupe d'un interrupteur, ligne par ligne. */
  grid: boolean;
  gridVertical: boolean;
  gridColor: string;
  /** Le viseur : son mode, sa couleur, et s'il est plein ou pointillé. */
  crosshairMode: CrosshairMode;
  crosshair: string;
  crosshairDashed: boolean;
  /** Le volume en bas du graphe. */
  volume: boolean;
  /** L'échelle de prix : mode, et ce qu'elle répète. */
  priceScaleMode: PriceScaleMode;
  /** Le trait du dernier cours et son étiquette d'axe. */
  lastPriceLine: boolean;
  /** Le compte à rebours de la bougie en cours, sur l'axe. */
  countdown: boolean;
  /** La légende OHLC en haut à gauche, façon plateforme. */
  legend: boolean;
  /** L'ombrage des séances RTH / ETH. */
  sessionShading: boolean;
  /** Les marques d'exécution et les lignes d'ordres sur le graphe. */
  showOrders: boolean;
  /**
   * Le fuseau d'AFFICHAGE de l'axe des temps.
   *
   * Il ne déplace RIEN : les séances, l'ouverture, la clôture et l'ombrage
   * RTH/ETH restent calés sur New York, parce que c'est le marché qui les
   * fixe, pas le lecteur. Seules les étiquettes changent de langue horaire.
   */
  timezone: string;
  /** Les études posées sur le graphe, dans l'ordre d'ajout. */
  indicators: IndicatorConfig[];
}

export const CHART_PREFS_DEFAULT: ChartPrefs = {
  chartType: "candles",
  up: "var(--tv-chart-green)",
  down: "var(--tv-chart-red)",
  wickUp: "var(--tv-chart-green)",
  wickDown: "var(--tv-chart-red)",
  borders: false,
  background: "transparent",
  grid: true,
  gridVertical: true,
  gridColor: "var(--tv-border)",
  // Éteint : c'est la demande explicite du produit. Voir `CrosshairMode`.
  crosshairMode: "off",
  crosshair: "var(--tv-text-muted)",
  crosshairDashed: true,
  volume: true,
  priceScaleMode: "normal",
  lastPriceLine: true,
  countdown: true,
  legend: true,
  sessionShading: true,
  showOrders: true,
  timezone: "America/New_York",
  indicators: [],
};

/**
 * Les fuseaux proposés.
 *
 * Attention au piège des identifiants `Etc/GMT±N` : leur signe est INVERSÉ
 * par rapport à l'usage courant. `Etc/GMT+4` vaut UTC−4, c'est-à-dire l'heure
 * d'été de New York. On affiche donc le libellé que le trader attend, et on
 * garde l'identifiant que la plateforme comprend.
 */
export const CHART_TIMEZONES: { id: string; label: string }[] = [
  { id: "America/New_York", label: "New York" },
  { id: "America/Chicago", label: "Chicago" },
  { id: "Etc/GMT+4", label: "UTC−4" },
  { id: "Etc/GMT+5", label: "UTC−5" },
  { id: "UTC", label: "UTC" },
  { id: "Europe/Brussels", label: "Bruxelles" },
  { id: "Europe/London", label: "Londres" },
  { id: "Asia/Tokyo", label: "Tokyo" },
];

/** Les couleurs proposées d'un clic — des jetons, donc thématisées. */
export const CHART_SWATCHES = [
  "var(--tv-chart-green)",
  "var(--tv-chart-red)",
  "var(--tv-accent)",
  "var(--tv-highlight)",
  "var(--tv-warning)",
  "var(--tv-text)",
  "var(--tv-text-muted)",
] as const;

const KEY = "tv:replay:chart-prefs";

export function loadChartPrefs(): ChartPrefs {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    if (!raw) return CHART_PREFS_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<ChartPrefs>;
    // Fusion avec les défauts : une version antérieure a pu enregistrer moins
    // de champs qu'aujourd'hui, et il ne faut pas qu'il en manque un. Les
    // études sont recopiées à part — un tableau absent doit rester un tableau,
    // pas devenir `undefined` au premier `.map`.
    return {
      ...CHART_PREFS_DEFAULT,
      ...parsed,
      indicators: Array.isArray(parsed.indicators) ? parsed.indicators : [],
    };
  } catch {
    return CHART_PREFS_DEFAULT;
  }
}

export function saveChartPrefs(prefs: ChartPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* stockage indisponible : le réglage vaut pour la session en cours */
  }
}
