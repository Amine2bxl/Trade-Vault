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

export interface ChartPrefs {
  /** Corps des bougies haussières / baissières. */
  up: string;
  down: string;
  /** Fond de la zone de tracé. */
  background: string;
  /** Grille — le quadrillage se coupe d'un interrupteur. */
  grid: boolean;
  gridColor: string;
  /** Le viseur : sa couleur, et s'il est plein ou pointillé. */
  crosshair: string;
  crosshairDashed: boolean;
  /** Le volume en bas du graphe. */
  volume: boolean;
  /**
   * Le fuseau d'AFFICHAGE de l'axe des temps.
   *
   * Il ne déplace RIEN : les séances, l'ouverture, la clôture et l'ombrage
   * RTH/ETH restent calés sur New York, parce que c'est le marché qui les
   * fixe, pas le lecteur. Seules les étiquettes changent de langue horaire.
   */
  timezone: string;
}

export const CHART_PREFS_DEFAULT: ChartPrefs = {
  up: "var(--tv-chart-green)",
  down: "var(--tv-chart-red)",
  background: "transparent",
  grid: true,
  gridColor: "var(--tv-border)",
  crosshair: "var(--tv-accent)",
  crosshairDashed: true,
  volume: true,
  timezone: "America/New_York",
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
    // de champs qu'aujourd'hui, et il ne faut pas qu'il en manque un.
    return { ...CHART_PREFS_DEFAULT, ...parsed };
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
