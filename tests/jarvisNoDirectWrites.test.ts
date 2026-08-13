import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * JARVIS N'ÉCRIT PAS DANS LES DONNÉES DU TRADER.
 *
 * C'est la garantie de toute la Phase 4, et elle ne tient pas par
 * l'architecture seule : il suffit d'un `supabase.from("profiles").update(…)`
 * ajouté dans un module de l'assistant pour qu'elle tombe, sans qu'aucun test
 * de comportement ne le remarque.
 *
 * Ce test lit donc le SOURCE. Il balaie tout `src/modules/ai/` — le moteur de
 * l'assistant, ses outils, son routeur — et refuse toute écriture Supabase
 * ailleurs que dans les tables `ai_*`.
 *
 * POURQUOI CETTE EXCEPTION, ET SEULEMENT ELLE. `ai_memory` et `ai_agent_runs`
 * sont la mémoire et la télémétrie de l'assistant : ses propres affaires. Les
 * données du TRADER — trades, profil, règles, checklist, séances, objectifs —
 * ne lui appartiennent pas, et il n'y touche jamais de sa propre initiative.
 * L'autorisation est écrite en liste blanche (`ai_`) plutôt qu'en liste noire :
 * une table ajoutée demain est refusée par défaut.
 *
 * La seule voie d'écriture dans les données du trader est l'acceptation
 * explicite d'une proposition, qui vit ailleurs
 * (`src/backend/proposals.functions.ts`) et demande un geste.
 *
 * Si un jour l'assistant doit écrire autre chose, ce test échouera — et c'est
 * exactement le moment où quelqu'un doit décider consciemment d'ouvrir cette
 * porte, plutôt que de la découvrir ouverte.
 */

const ROOT = "src/modules/ai";

/** `.from("x").insert(` / `.update(` / `.upsert(` / `.delete(`, sur une ou deux lignes. */
const WRITE_CALL =
  /\.from\(\s*["'`]([a-z_0-9]+)["'`]\s*\)\s*(?:\r?\n\s*)?\.\s*(insert|update|upsert|delete)\s*\(/g;

/** Les affaires de l'assistant : sa mémoire, sa télémétrie. Rien du trader. */
function isOwnTable(table: string): boolean {
  return table.startsWith("ai_");
}

function forbiddenWrites(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(WRITE_CALL)) {
    const [, table, verb] = match;
    if (!isOwnTable(table)) out.push(`${verb} ${table}`);
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe("Jarvis ne mute rien hors acceptation d'une proposition", () => {
  const files = walk(ROOT);

  it("balaie bien un arbre non vide (garde-fou du test lui-même)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("aucun module de l'assistant n'écrit dans les données du trader", () => {
    const offenders = files.flatMap((file) =>
      forbiddenWrites(readFileSync(file, "utf8")).map((write) => `${file}: ${write}`),
    );
    expect(offenders).toEqual([]);
  });

  it("le chemin d'acceptation, lui, écrit — sinon ce test ne prouverait rien", () => {
    const accept = readFileSync("src/backend/proposals.functions.ts", "utf8");
    expect(forbiddenWrites(accept).length).toBeGreaterThan(0);
  });
});
