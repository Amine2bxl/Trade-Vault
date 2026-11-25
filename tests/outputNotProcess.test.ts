import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { en } from "../src/app/i18n/translations";
import fr from "../src/app/i18n/locales/fr";

/**
 * LE RÉSULTAT, JAMAIS LE PROCESSUS — règle universelle du 2026-11-25
 * (AGENTS.md, docs/PRODUCT.md).
 *
 * Le trader voit la valeur, son unité, son `n` et ce qu'il doit faire ; jamais
 * l'IA qui l'a lue, la formule qui l'a calculée ni l'origine d'une valeur.
 */

const AI_AND_METHOD =
  /\b(gemini|claude|openai|chatgpt|gpt-\d|llm|ai call|appel (?:à l')?ia|algorithm|algorithme|deterministic|déterministe|formula|how this is calculated|comment c'est calculé|judged on|jugée? sur|never on the p&l|weighted by|pondérée? par|more paths do not add)\b|÷/i;

function offenders(dict: Record<string, string | undefined>): string[] {
  return Object.entries(dict)
    .filter(([, v]) => typeof v === "string" && AI_AND_METHOD.test(v))
    .map(([k]) => k);
}

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("le résultat, jamais le processus", () => {
  test("aucun texte de l'app ne nomme l'IA, son modèle ou une méthode de calcul", () => {
    expect(offenders(en)).toEqual([]);
    expect(offenders(fr)).toEqual([]);
  });

  test("l'interface n'importe ni les fournisseurs IA ni la fiche du modèle", () => {
    const leaks = files(join(import.meta.dir, "../src/app")).filter((f) =>
      /from "@\/modules\/(ai-provider|ai\/jarvis-model)"/.test(readFileSync(f, "utf8")),
    );
    expect(leaks).toEqual([]);
  });

  test("le moteur de capture n'affiche ni confiance, ni origine, ni preuve d'une valeur", () => {
    const dir = join(import.meta.dir, "../src/app/features/capture");
    const leaks = files(dir)
      .filter((f) => f.endsWith(".tsx"))
      .filter((f) => /\.(confidence|origin|evidence)\b/.test(readFileSync(f, "utf8")));
    expect(leaks).toEqual([]);
  });
});
