/**
 * Générateur aléatoire SEEDABLE — module pur.
 *
 * POURQUOI PAS `Math.random()`. Une simulation Monte Carlo est une
 * fonctionnalité dont on doit pouvoir prouver le comportement. Avec
 * `Math.random()`, un test qui vérifie « le taux de réussite est de 82 % »
 * échoue une fois sur vingt sans qu'aucun code n'ait changé — et l'équipe
 * apprend à ignorer les échecs de tests, ce qui coûte bien plus cher que le
 * bug qu'ils auraient dû attraper.
 *
 * Avec une graine, la même configuration produit toujours exactement le même
 * résultat. Trois conséquences directes :
 *   - les tests sont déterministes, jamais flaky ;
 *   - une simulation sauvegardée peut être REJOUÉE à l'identique des mois
 *     plus tard (voir `engineVersion` dans les résultats persistés) ;
 *   - un utilisateur qui relance la même configuration retrouve les mêmes
 *     chiffres, au lieu de voir sa « probabilité de réussite » osciller de
 *     deux points à chaque clic — ce qui détruirait sa confiance.
 *
 * ALGORITHME. `mulberry32` : 32 bits d'état, période 2^32, distribution
 * uniforme de bonne qualité, quelques opérations entières par tirage. Le
 * Mersenne Twister serait plus rigoureux mais coûte 2,5 Ko d'état et une
 * initialisation lourde ; pour du rééchantillonnage de trades, où l'on tire
 * des INDICES dans un tableau de quelques centaines d'éléments, la qualité de
 * mulberry32 est très au-delà du nécessaire. Le facteur limitant de la
 * précision est la taille de l'échantillon historique, pas le générateur.
 */

/** Un tirage uniforme dans [0, 1). Interface minimale pour pouvoir substituer
 *  le générateur dans un test sans toucher au moteur. */
export type Rng = () => number;

/**
 * Construit un générateur déterministe à partir d'une graine entière.
 *
 * La graine est décalée par une constante impaire (0x6d2b79f5) à chaque
 * tirage : c'est ce qui évite que deux graines proches (1 et 2, typiquement
 * `seed` et `seed + 1` d'une boucle) produisent des séquences corrélées.
 */
export function makeRng(seed: number): Rng {
  // `>>> 0` force l'entier non signé sur 32 bits : sans lui, une graine
  // négative ou décimale produirait des NaN au premier décalage de bits.
  let a = Math.trunc(seed) >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Entier uniforme dans [0, n). Utilisé pour tirer un indice de trade.
 *
 * `Math.floor(rng() * n)` peut théoriquement rendre `n` si `rng()` rendait
 * exactement 1 ; mulberry32 ne le fait jamais (division par 2^32 sur un
 * entier < 2^32), mais le `Math.min` garantit la borne quelle que soit
 * l'implémentation substituée dans un test.
 */
export function randomIndex(rng: Rng, n: number): number {
  if (n <= 0) return 0;
  return Math.min(n - 1, Math.floor(rng() * n));
}

/**
 * Graine par défaut d'une simulation, dérivée d'une chaîne stable
 * (identifiant de scénario, de compte…).
 *
 * Permet à une même configuration de rendre le même résultat sans que
 * l'appelant ait à inventer un nombre — tout en restant reproductible, ce
 * qu'un `Date.now()` ne serait pas.
 */
export function seedFrom(text: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
