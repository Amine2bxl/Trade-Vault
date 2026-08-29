import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSource, stripComments } from "./helpers/source";

/**
 * LE CONTRAT ENTRE LE TYPESCRIPT ET LE SQL.
 *
 * Les garanties les plus dures du produit ne vivent pas en TypeScript : le
 * verrou de ligne qui fait de `max_uses` une vraie limite, la projection de
 * webhook qui crée la ligne manquante et ignore une livraison hors ordre, le
 * décompte de quota IA. Le TypeScript les atteint par un NOM, en chaîne de
 * caractères : `sb.rpc("redeem_promo_code", …)`.
 *
 * Rien ne reliait ce nom à la migration qui crée la fonction. Une faute de
 * frappe, ou un renommage côté base, ne casse ni le typecheck, ni le lint, ni
 * le build, ni aucun test : le client Supabase se contente de renvoyer une
 * erreur à l'exécution — c'est-à-dire, pour `redeem_promo_code`, au moment où
 * un client saisit son code promo.
 *
 * C'est la MÊME famille de défaut que `.onConflict().ignore()` : une méthode
 * qui n'existait pas, invisible à toutes les portes, découverte en production.
 * Une mutation l'a confirmé — renommer l'appel RPC laissait la suite verte.
 */

const SRC = resolve(import.meta.dir, "..", "src");
const MIGRATIONS = resolve(import.meta.dir, "..", "supabase", "migrations");

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (/\.tsx?$/.test(full) && !full.includes("/tests/")) out.push(full);
  }
  return out;
}

/** Les fonctions appelées par leur nom depuis le produit. */
function calledFromCode(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of tsFiles(SRC)) {
    const code = stripComments(readSource(import.meta.dir, relative(import.meta.dir, file)));
    for (const [, name] of code.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) {
      out.set(name, [...(out.get(name) ?? []), relative(SRC, file)]);
    }
  }
  return out;
}

/** Les fonctions que les migrations créent réellement. */
function definedInSql(): Set<string> {
  const out = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)) {
    if (!file.endsWith(".sql")) continue;
    const sql = readSource(import.meta.dir, `../supabase/migrations/${file}`);
    for (const [, name] of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)/gi,
    )) {
      out.add(name.toLowerCase());
    }
  }
  return out;
}

describe("chaque appel RPC vise une fonction qui existe", () => {
  const called = calledFromCode();
  const defined = definedInSql();

  test("le relevé n'est pas vide (sinon ce fichier ne prouverait rien)", () => {
    expect(called.size).toBeGreaterThanOrEqual(8);
    expect(defined.size).toBeGreaterThanOrEqual(8);
  });

  test("aucun nom appelé n'est absent des migrations", () => {
    const orphans = [...called.entries()]
      .filter(([name]) => !defined.has(name))
      .map(([name, files]) => `${name} (appelé depuis ${files.join(", ")})`)
      .sort();
    expect(orphans).toEqual([]);
  });

  test("les fonctions qui portent une garantie d'argent sont bien appelées", () => {
    // Le sens inverse : ces trois-là existent précisément pour être appelées.
    // Une migration appliquée mais un code qui ne s'en sert plus, c'est la
    // garantie qui disparaît sans que rien ne change de couleur.
    for (const name of [
      "redeem_promo_code",
      "release_promo_redemption",
      "apply_subscription_event",
    ]) {
      expect(called.has(name), name).toBe(true);
      expect(defined.has(name), name).toBe(true);
    }
  });
});

describe("les déclencheurs de quota sont bien posés, pas seulement écrits", () => {
  test("chaque fonction de déclencheur a son `create trigger`", () => {
    // Une fonction `enforce_*` sans déclencheur est du SQL décoratif : la
    // limite de trades et de comptes ne serait tenue que par React.
    const all = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readSource(import.meta.dir, `../supabase/migrations/${f}`))
      .join("\n")
      .toLowerCase();

    // On teste des BOOLÉENS, pas `toContain` sur le SQL entier : un `toContain`
    // qui échoue imprime les migrations complètes — cent cinquante kilo-octets
    // dans lesquels l'échec devient illisible.
    for (const fn of ["enforce_trade_quota", "enforce_account_quota"]) {
      const definedHere = new RegExp(`create (or replace )?function (public\\.)?${fn}\\(`).test(
        all,
      );
      // Le préfixe de schéma est optionnel — il est présent aujourd'hui.
      const wired = new RegExp(`execute function (public\\.)?${fn}\\(\\)`).test(all);
      expect(definedHere, `${fn} — fonction définie`).toBe(true);
      expect(wired, `${fn} — déclencheur posé`).toBe(true);
    }
  });
});
