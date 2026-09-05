import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSource, stripComments } from "./helpers/source";

/**
 * `.env.example` CONTRE LE CODE.
 *
 * Ce fichier est la seule liste qu'un opérateur lit avant un déploiement. Il
 * avait dérivé dans les DEUX sens :
 *
 *   • trois variables déclarées qui n'étaient lues nulle part — deux
 *     `*_PROJECT_ID` et `VITE_TRUSTPILOT_BUSINESS_UNIT_ID`, dont le lien
 *     d'avis est en réalité une constante du code. Une variable qui ne
 *     configure rien ne coûte pas rien : elle rend impossible de savoir
 *     lesquelles comptent ;
 *   • et des variables réellement lues par le serveur, absentes du fichier :
 *     le plafond horaire de la voix hébergée, le budget de raisonnement
 *     Gemini, le budget de temps des crons.
 *
 * C'est la même famille de défaut que `ADMIN_EMAILS` manquante : le produit
 * lisait une variable dont personne ne savait qu'il fallait la poser, et se
 * comportait donc en production autrement qu'en local — sans erreur.
 */

const SRC = resolve(import.meta.dir, "..", "src");
const example = readSource(import.meta.dir, "../.env.example");

/** Déclarée = posée, ou présente en commentaire comme option documentée. */
function declared(): Set<string> {
  const out = new Set<string>();
  for (const line of example.split("\n")) {
    const m = /^\s*#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m) out.add(m[1]);
  }
  return out;
}

/**
 * Les familles construites à l'exécution, que rien ne peut trouver par
 * inspection statique — c'est justement pour ça qu'elles sont listées ici.
 */
const DYNAMIC: Record<string, string> = {
  STRIPE_PRICE_PRO_MONTHLY:
    "`process.env[`STRIPE_PRICE_${plan.toUpperCase()}`]`, billing.server.ts",
  STRIPE_PRICE_PRO_YEARLY: "idem",
  STRIPE_PRICE_ELITE_MONTHLY: "idem",
  STRIPE_PRICE_ELITE_YEARLY: "idem",
  OPENAI_API_KEY: "`apiKeyEnv` du provider, ai-provider/openai.ts",
  GROQ_API_KEY: "idem",
  OPENROUTER_API_KEY: "idem",
  OPENAI_MODEL: "idem",
  GROQ_MODEL: "idem",
  OPENROUTER_MODEL: "idem",
  OPENAI_BASE_URL: "idem",
  GROQ_BASE_URL: "idem",
  OPENROUTER_BASE_URL: "idem",
  SUPABASE_ANON_KEY: "fonction edge `delete-account` (Deno), documentée dans le fichier",
  PUBLIC_SITE_URL: "serveur ET fonction edge",
};

/** Fournies par la plateforme : les déclarer inviterait à les poser à la main. */
const PLATFORM = new Set(["PORT", "NITRO_PRESET"]);

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (/\.tsx?$/.test(full) && !full.includes("/tests/")) out.push(full);
  }
  return out;
}

/** Les variables que le PRODUIT DÉPLOYÉ lit statiquement (hors scripts hors-ligne). */
function readByApp(): Set<string> {
  const out = new Set<string>();
  for (const file of tsFiles(SRC)) {
    const code = stripComments(readSource(import.meta.dir, relative(import.meta.dir, file)));
    // `process.env` côté serveur, `import.meta.env` côté client : les deux
    // moitiés du produit lisent leur environnement autrement.
    for (const [, dotted] of code.matchAll(
      /(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)/g,
    )) {
      out.add(dotted);
    }
    for (const [, quoted] of code.matchAll(
      /(?:process\.env|import\.meta\.env)\[\s*"([A-Z][A-Z0-9_]*)"\s*\]/g,
    )) {
      out.add(quoted);
    }
  }
  return out;
}

describe("tout ce que le produit lit est documenté", () => {
  test("aucune variable lue par le serveur n'est absente du fichier", () => {
    const known = declared();
    const missing = [...readByApp()].filter((v) => !known.has(v) && !PLATFORM.has(v)).sort();
    expect(missing).toEqual([]);
  });
});

describe("rien n'y est déclaré pour rien", () => {
  test("chaque variable déclarée est réellement lue quelque part", () => {
    // Le contrôle inverse. Sans lui, le fichier se remplit de variables
    // héritées que plus personne n'ose retirer.
    const app = readByApp();
    const orphans = [...declared()].filter((v) => !app.has(v) && !(v in DYNAMIC)).sort();
    expect(orphans).toEqual([]);
  });

  test("les variables dynamiques listées existent vraiment dans le code", () => {
    // La liste ci-dessus est une dérogation : si elle finissait par contenir
    // des noms morts, elle rendrait le contrôle précédent inopérant.
    const code = [
      "../src/backend/billing.server.ts",
      "../src/modules/ai-provider/openai.ts",
      "../supabase/functions/delete-account/index.ts",
      "../src/shared/site.ts",
    ]
      .map((f) => readSource(import.meta.dir, f))
      .join("\n");
    for (const name of Object.keys(DYNAMIC)) {
      const family = name.startsWith("STRIPE_PRICE_")
        ? "STRIPE_PRICE_"
        : (/^(OPENAI|GROQ|OPENROUTER)_/.exec(name)?.[1] ?? name);
      expect(code, name).toContain(family);
    }
  });
});

describe("les variables retirées ne reviennent pas", () => {
  test("les trois variables mortes ne sont plus proposées", () => {
    for (const dead of [
      "SUPABASE_PROJECT_ID",
      "VITE_SUPABASE_PROJECT_ID",
      "VITE_TRUSTPILOT_BUSINESS_UNIT_ID",
    ]) {
      expect(declared().has(dead), dead).toBe(false);
    }
    // Et la documentation ne les réclame plus non plus : elle les donnait pour
    // nécessaires dans son tableau des variables Supabase.
    const backend = readSource(import.meta.dir, "../docs/development/BACKEND.md");
    expect(backend).not.toContain("SUPABASE_PROJECT_ID");
  });
});
