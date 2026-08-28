import type { MissedOpportunity, Trade } from "../types";

/**
 * Le jeu de données de DÉMONSTRATION des pages verrouillées.
 *
 * Une page premium floutée sur un compte vide ne montre rien : ni graphique,
 * ni chiffre, ni ce que l'outil sait faire. On ne s'abonne pas à un écran gris.
 * Ces trades donnent aux pages verrouillées de quoi se remplir — un historique
 * plausible de six mois, avec ses séries, ses erreurs et sa courbe — pour que
 * le trader voie EXACTEMENT ce qu'il achète.
 *
 * Deux garde-fous :
 *  - déterministe (générateur à graine fixe) : la même page montre toujours la
 *    même chose, donc jamais deux captures d'écran contradictoires ;
 *  - `isExample: true` et jamais écrit en base : ces trades n'existent que dans
 *    le rendu d'une page verrouillée, ils ne peuvent pas polluer un compte.
 */

/** PRNG déterministe (mulberry32) — pas de `Math.random`, pas de surprise. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYMBOLS = ["NQ", "ES", "EURUSD", "GBPUSD", "XAUUSD", "BTCUSD"];
const STRATS = [
  "Silver Bullet",
  "Order Block",
  "FVG Entry",
  "Breakout",
  "Trend Following",
  "Reversal",
];
const CONFLUENCES = [
  "Liquidity sweep",
  "Fair value gap",
  "Order block",
  "Market structure",
  "Trend line",
  "Volume spike",
];
const MISTAKES = ["FOMO entry", "Revenge trade", "Premature exit", "Size too large", "Overtrading"];

/** Un R plausible : beaucoup de petites pertes à -1R, des gains étalés. */
function drawR(r: () => number): number {
  const roll = r();
  if (roll < 0.42) return -1; // stop touché, le cas le plus fréquent
  if (roll < 0.5) return -0.4 - r() * 0.5; // sortie anticipée dans le rouge
  if (roll < 0.56) return 0; // break-even
  if (roll < 0.86) return 0.8 + r() * 1.6; // gain courant
  return 2.5 + r() * 2.5; // le trade qui paie le mois
}

export interface PreviewOptions {
  /** Nombre de trades générés (défaut 140 — six mois d'activité régulière). */
  count?: number;
  /** Graine du générateur. Changer la graine change l'historique montré. */
  seed?: number;
}

let cache: { key: string; trades: Trade[] } | null = null;

/**
 * L'historique de démonstration, mémoïsé : les pages verrouillées le
 * demandent à chaque rendu, le générer à chaque fois créerait des courbes qui
 * bougent sous les yeux du visiteur.
 */
export function previewTrades({ count = 140, seed = 20260827 }: PreviewOptions = {}): Trade[] {
  const key = `${count}:${seed}`;
  if (cache?.key === key) return cache.trades;

  const r = rng(seed);
  const trades: Trade[] = [];
  const day = new Date();
  day.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    // On remonte le temps en sautant les week-ends, 0 à 2 trades par séance.
    if (i % 2 === 0) {
      do {
        day.setDate(day.getDate() - 1);
      } while (day.getDay() === 0 || day.getDay() === 6);
    }

    const rMultiple = Math.round(drawR(r) * 10) / 10;
    const riskAmount = [75, 100, 125, 150, 200][Math.floor(r() * 5)];
    const direction = rMultiple === 0 ? "be" : r() < 0.55 ? "long" : "short";
    const entryHour = 8 + Math.floor(r() * 8);
    const entryMin = Math.floor(r() * 60);
    const durationMin = 8 + Math.floor(r() * 110);
    const end = new Date(2000, 0, 1, entryHour, entryMin + durationMin);
    const pad = (n: number) => String(n).padStart(2, "0");

    // Les erreurs n'arrivent presque que sur les trades perdants — c'est ce qui
    // rend la page « Erreurs » lisible plutôt que décorative.
    const mistakes =
      rMultiple < 0 && r() < 0.45 ? [MISTAKES[Math.floor(r() * MISTAKES.length)]] : [];

    trades.push({
      id: `preview-${i}`,
      date: day.toISOString().slice(0, 10),
      symbol: SYMBOLS[Math.floor(r() * SYMBOLS.length)],
      direction,
      pnl: Math.round(riskAmount * rMultiple * 100) / 100,
      riskAmount,
      rMultiple,
      strategy: STRATS[Math.floor(r() * STRATS.length)],
      mistakes,
      setupQuality: rMultiple > 1 ? 4 + Math.round(r()) : 2 + Math.round(r() * 2),
      notes: "",
      screenshots: [],
      entryTime: `${pad(entryHour)}:${pad(entryMin)}`,
      exitTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      confluences: [
        CONFLUENCES[Math.floor(r() * CONFLUENCES.length)],
        ...(r() < 0.5 ? [CONFLUENCES[Math.floor(r() * CONFLUENCES.length)]] : []),
      ],
      confidence: 45 + Math.floor(r() * 50),
      mae: null,
      mfe: null,
      slippage: null,
      isExample: true,
    });
  }

  // Même ordre que les vraies données : la plus récente d'abord.
  trades.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  cache = { key, trades };
  return trades;
}

/**
 * Setups manqués de démonstration.
 *
 * La page « Setups manqués » ne lit pas les trades : sans jeu dédié, son
 * aperçu serait un état vide — l'écran le moins vendeur du produit.
 */
export function previewMissed(fr: boolean): MissedOpportunity[] {
  const day = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  const rows: [string, string, string, string, string, number][] = fr
    ? [
        [
          "NQ",
          "Pas devant l'écran à l'ouverture",
          "Le setup est parti sans moi, +3,2R en 40 minutes",
          "Mes meilleurs setups sont dans la première heure",
          "Alarme 15 min avant l'open, plus de réunion à cette heure-là",
          3.2,
        ],
        [
          "XAUUSD",
          "Hésitation, j'ai attendu une confirmation de plus",
          "Entrée ratée de 4 points, le trade a fait +2,5R",
          "Ma confirmation supplémentaire ne change rien au résultat",
          "Entrer au signal prévu dans le plan, pas un cran plus tard",
          2.5,
        ],
        [
          "EURUSD",
          "Déjà deux pertes ce jour-là, je me suis arrêté",
          "Le troisième setup était le meilleur de la semaine",
          "Ma règle d'arrêt me coûte parfois plus qu'elle ne me protège",
          "Arrêt après 2 pertes, sauf setup noté 5/5",
          1.8,
        ],
        [
          "ES",
          "Spread trop large à l'annonce",
          "Le mouvement a suivi le plan, +2R sans moi",
          "Attendre 2 minutes après l'annonce suffisait",
          "Plan d'entrée post-news défini à l'avance",
          2,
        ],
      ]
    : [
        [
          "NQ",
          "Not at the screen at the open",
          "Setup ran without me, +3.2R in 40 minutes",
          "My best setups are in the first hour",
          "Alarm 15 min before the open, no meetings then",
          3.2,
        ],
        [
          "XAUUSD",
          "Hesitated, waited for one more confirmation",
          "Missed entry by 4 points, the trade made +2.5R",
          "The extra confirmation changes nothing about the outcome",
          "Enter on the planned signal, not one step later",
          2.5,
        ],
        [
          "EURUSD",
          "Two losses that day, I stopped",
          "The third setup was the best of the week",
          "My stop rule sometimes costs more than it protects",
          "Stop after 2 losses, unless the setup grades 5/5",
          1.8,
        ],
        [
          "ES",
          "Spread too wide at the release",
          "The move followed the plan, +2R without me",
          "Waiting 2 minutes after the release was enough",
          "Pre-defined post-news entry plan",
          2,
        ],
      ];

  return rows.map(([symbol, reason, happened, lesson, plan, r], i) => ({
    id: `preview-missed-${i}`,
    date: day(2 + i * 3),
    symbol,
    reasonNotTaken: reason,
    whatHappened: happened,
    lessonLearned: lesson,
    nextTimePlan: plan,
    estimatedR: r,
    screenshots: [],
  }));
}
