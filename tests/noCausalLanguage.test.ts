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

import { CAUSAL_PHRASES, checkCausalLanguage } from "../src/modules/patterns/language";

const LOCALES = resolve(import.meta.dir, "../src/app/i18n/locales");
const SOURCE = resolve(import.meta.dir, "../src/app/i18n/translations.ts");

/** Préfixes des clés qui portent des affirmations comportementales. */
const WATCHED = ["session.", "cluster.", "pattern."];

/**
 * Formulations qui promettent une cause — IMPORTÉES, jamais recopiées.
 *
 * La même liste sert au contrôle d'exécution qui filtre les justifications
 * écrites par Jarvis (`checkCausalLanguage`). Deux copies auraient divergé, et
 * celle qu'on aurait oublié de mettre à jour serait celle du chemin de
 * production — là où aucun test ne regarde.
 */
const BANNED = CAUSAL_PHRASES;

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

// ── Le garde d'EXÉCUTION : ce que le test statique ne peut pas voir ────────

test("a runtime rationale claiming a cause is rejected, with the phrase named", () => {
  // Jarvis rédige cette chaîne au moment de la requête. Aucun test statique ne
  // la verra jamais ; seul ce contrôle-là peut l'arrêter.
  const bad = checkCausalLanguage(
    "Ton score de préparation améliore ton expectancy sur 24 séances.",
  );
  expect(bad.ok).toBe(false);
  expect(bad.matched).toBe("améliore");
});

test("an association phrased as an association passes", () => {
  const good = checkCausalLanguage(
    "Sur 24 séances, celles préparées sont associées à un R moyen plus élevé (n=24 / 22).",
  );
  expect(good.ok).toBe(true);
  expect(good.matched).toBeNull();
});

test("the check is case-insensitive — a capitalised claim is still a claim", () => {
  expect(checkCausalLanguage("Because you skipped the checklist").ok).toBe(false);
});

test("the static scan and the runtime guard share one list", () => {
  // Si quelqu'un ajoute une formulation d'un côté seulement, ce test ne le dira
  // pas — mais l'import garantit qu'il n'y a qu'un côté.
  expect(BANNED).toBe(CAUSAL_PHRASES);
  expect(CAUSAL_PHRASES.length).toBeGreaterThan(5);
});
