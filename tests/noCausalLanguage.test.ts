import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `ECOSYSTEM_WIRING.md` interdit toute formulation CAUSALE dans ce que le
 * produit affirme sur le comportement du trader. Le produit observe une
 * association sur une variable en partie déclarative ; écrire « ton score de
 * préparation améliore ton expectancy » revient à promettre une causalité que
 * la donnée ne porte pas.
 *
 * Le spec demande explicitement un grep. Le voici, en test : il tourne en CI et
 * couvre les clés des surfaces concernées — séances, familles d'erreurs,
 * motifs — dans TOUTES les locales, pas seulement `fr`.
 *
 * Portée volontairement étroite : les mots visés sont courants et parfaitement
 * légitimes ailleurs (une FAQ marketing, un message d'erreur). Élargir la
 * recherche à tout le dictionnaire produirait des faux positifs, donc des
 * exceptions, donc une règle qu'on désactive.
 */

const LOCALES = resolve(import.meta.dir, "../src/app/i18n/locales");
const SOURCE = resolve(import.meta.dir, "../src/app/i18n/translations.ts");

/** Préfixes des clés qui portent des affirmations comportementales. */
const WATCHED = ["session.", "cluster.", "pattern."];

/** Formulations qui promettent une cause. */
const BANNED = [
  "parce que",
  "améliore",
  "ameliore",
  "grâce à",
  "grace a",
  "à cause de",
  "improves",
  "because",
  "causes",
];

function watchedLines(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => WATCHED.some((prefix) => line.trimStart().startsWith(`"${prefix}`)));
}

test("no behavioural string claims a cause, in any locale", () => {
  const files = [SOURCE, ...readdirSync(LOCALES).map((f) => resolve(LOCALES, f))];
  const offenders: string[] = [];
  for (const file of files) {
    for (const line of watchedLines(file)) {
      const lower = line.toLowerCase();
      for (const word of BANNED) {
        if (lower.includes(word)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

test("the scan actually reads the keys it claims to guard", () => {
  // Sans ce garde-fou, renommer un préfixe rendrait le test vert pour la pire
  // des raisons : il ne regarderait plus rien.
  expect(watchedLines(SOURCE).length).toBeGreaterThan(10);
});
