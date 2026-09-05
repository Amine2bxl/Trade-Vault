import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lire une source du dépôt pour la tester.
 *
 * Plusieurs garanties de ce projet ne vivent pas dans une valeur de retour mais
 * dans la STRUCTURE du code : l'ordre de deux appels, la présence d'un
 * middleware, l'absence d'une méthode qui n'existe pas. Elles se vérifient sur
 * la source — c'est la convention déjà établie par `tests/proposalAccept.test.ts`.
 */
export function readSource(fromDir: string, relativePath: string): string {
  return readFileSync(resolve(fromDir, relativePath), "utf8");
}

/**
 * La source SANS ses commentaires.
 *
 * INDISPENSABLE pour tout test d'interdiction. Les commentaires de ce dépôt
 * citent volontiers le motif fautif pour expliquer pourquoi il a disparu
 * (« il appelait `.onConflict().ignore()`, qui n'existe pas », « ces fonctions
 * exigent une adresse listée dans `ADMIN_EMAILS` »). Chercher le motif dans la
 * prose ferait échouer le test sur son propre commentaire d'explication — et
 * pousserait, à terme, à retirer les explications pour faire passer les tests.
 *
 * Le découpage est volontairement simple (blocs `/* … *\/` puis fins de ligne
 * `//`) : il sert à retirer de la prose, pas à analyser du TypeScript. Une
 * chaîne contenant `//` — typiquement une URL — est préservée grâce au garde
 * sur le caractère précédent.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * L'index d'un motif, avec un message d'échec utile quand il est absent.
 *
 * Un `indexOf` qui rend -1 ferait passer une comparaison d'ordre (`-1 < 42`)
 * alors que le code cherché n'existe plus du tout : le test dirait « l'ordre
 * est bon » à propos de rien.
 */
export function requireIndex(haystack: string, needle: string): number {
  const i = haystack.indexOf(needle);
  if (i === -1) throw new Error(`motif introuvable dans la source : ${needle}`);
  return i;
}
