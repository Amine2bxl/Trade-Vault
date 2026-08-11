/**
 * Qualité de l'échantillon — module PUR.
 *
 * POURQUOI CE MODULE EXISTE. Le bootstrap rend un chiffre également net qu'il
 * rééchantillonne 8 trades ou 400. « 92 % » calculé sur 8 trades et « 92 % »
 * calculé sur 400 s'affichent identiquement, et le trader les lit
 * identiquement. C'est le défaut le plus dangereux d'un simulateur : il ne
 * ment pas sur le calcul, il ment sur ce que le calcul vaut.
 *
 * Ce module ne corrige pas la probabilité — la corriger serait inventer une
 * seconde vérité. Il QUALIFIE l'échantillon, et l'interface est tenue
 * d'afficher cette qualification à côté du chiffre.
 *
 * ── POURQUOI DE NOUVEAUX SEUILS, ET NON CEUX QUI EXISTENT ──────────────────
 * Le dépôt porte déjà trois seuils, tous conservés, aucun dupliqué ici :
 *   `MIN_BUCKET_SAMPLE = 5`  (quantStats) — à partir de combien de trades on
 *       ose AFFICHER la statistique d'un sous-groupe (un symbole, une heure).
 *   `MIN_SAMPLE = 10`        (jarvis/insights) — à partir de combien on ose
 *       formuler un INSIGHT sur une observation.
 *   `MIN_KELLY_SAMPLE = 30`  (quantStats) — à partir de combien un
 *       dimensionnement de Kelly cesse d'être dangereux.
 *
 * Aucun ne répond à la question posée ici, qui est différente : combien de
 * trades faut-il pour que la distribution rééchantillonnée ressemble à la
 * distribution réelle ? Le bootstrap ne peut tirer que ce qu'il a vu. Avec 8
 * trades, la pire perte simulée sur 200 trades reste la pire perte de ces 8 —
 * le moteur est structurellement incapable d'imaginer pire, et sous-estime
 * donc la ruine. Les paliers ci-dessous décrivent cette limite, pas un seuil
 * d'affichage.
 *
 * Ils sont volontairement alignés sur les ordres de grandeur usuels du
 * bootstrap (n < 20 : distribution non couverte ; n ≥ 100 : queues
 * raisonnablement échantillonnées) et cohérents avec l'échelle existante —
 * 30 (Kelly) tombe dans « LIMITED », ce qui est le message voulu.
 */

/** Palier de fiabilité de l'échantillon. Ordonné du plus faible au plus fort. */
export type SampleQuality = "low" | "limited" | "moderate" | "strong";

/** Bornes basses de chaque palier, en nombre de trades. */
export const SAMPLE_BANDS = {
  limited: 20,
  moderate: 50,
  strong: 100,
} as const;

export interface SampleAssessment {
  size: number;
  quality: SampleQuality;
  /** `true` quand l'échantillon suffit à ne pas assortir le résultat d'un
   *  avertissement bloquant. */
  usable: boolean;
  /** Combien de trades manquent pour atteindre le palier suivant. `null` au
   *  palier maximal — sert à dire « encore 12 trades » plutôt que « attends ». */
  toNextBand: number | null;
  /** Part des trades portant un R exploitable (0..1), reprise du dataset. */
  rCoverage: number;
}

/** Sous ce nombre de trades, on ne simule pas du tout : rééchantillonner deux
 *  ou trois résultats ne produit pas une distribution, mais leur écho. */
export const MIN_SIMULATABLE = 5;

export function assessSample(size: number, rCoverage = 0): SampleAssessment {
  const n = Math.max(0, Math.trunc(size));
  let quality: SampleQuality = "low";
  let next: number | null = SAMPLE_BANDS.limited - n;

  if (n >= SAMPLE_BANDS.strong) {
    quality = "strong";
    next = null;
  } else if (n >= SAMPLE_BANDS.moderate) {
    quality = "moderate";
    next = SAMPLE_BANDS.strong - n;
  } else if (n >= SAMPLE_BANDS.limited) {
    quality = "limited";
    next = SAMPLE_BANDS.moderate - n;
  }

  return {
    size: n,
    quality,
    usable: n >= MIN_SIMULATABLE,
    toNextBand: next,
    rCoverage: Math.min(1, Math.max(0, rCoverage)),
  };
}

/**
 * Intervalle de confiance à 95 % d'une proportion issue de N tirages, par la
 * méthode de Wilson.
 *
 * ATTENTION À CE QUE CET INTERVALLE MESURE — et à ce qu'il ne mesure pas.
 * Il quantifie l'incertitude de TIRAGE : « avec 2 000 trajectoires au lieu
 * d'une infinité, de combien mon 62 % peut-il bouger ? ». Il ne dit rien de
 * l'incertitude d'ÉCHANTILLON, qui est bien plus grande et vient de ce que
 * l'historique du trader n'est lui-même qu'un tirage. Augmenter le nombre de
 * trajectoires resserre cet intervalle sans rendre le résultat plus vrai.
 * C'est `assessSample` qui porte l'autre moitié du message ; l'interface doit
 * montrer les deux ensemble, jamais l'intervalle seul.
 *
 * Wilson plutôt que l'approximation normale parce que les probabilités du
 * moteur sont souvent proches de 0 ou de 1 (une ruine à 2 %), où l'intervalle
 * normal déborde hors [0,1] et affiche des bornes négatives.
 */
export function wilsonInterval(p: number, n: number): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const z = 1.96;
  const clamped = Math.min(1, Math.max(0, p));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (clamped + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((clamped * (1 - clamped)) / n + z2 / (4 * n * n))) / denom;
  return {
    low: Math.min(1, Math.max(0, centre - margin)),
    high: Math.min(1, Math.max(0, centre + margin)),
  };
}
