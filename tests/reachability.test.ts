import { describe, expect, test } from "bun:test";
import { readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSource } from "./helpers/source";

/**
 * CE QUE LE PRODUIT NE MONTRE À PERSONNE.
 *
 * Un fichier que rien n'importe ne coûte pas seulement de la place : il se
 * relit, se corrige, se traduit et se teste comme du code vivant, alors qu'il
 * ne s'exécute jamais. Deux existaient :
 *
 *   • `contexts/TradingRulesContext.tsx` — supplanté par
 *     `hooks/useTradingRules.ts`. Son `useTradingRulesContext` LEVAIT une
 *     erreur si on l'appelait, puisque son fournisseur n'était monté nulle
 *     part. Supprimé.
 *   • `components/SessionPanel.tsx` — celui-là n'est PAS du code mort, et
 *     c'est plus grave : voir l'exception documentée plus bas.
 */

const SRC = resolve(import.meta.dir, "..", "src");

/**
 * Fichier → pourquoi il n'est importé nulle part.
 *
 * Une seule entrée, et ce n'est pas un déchet à balayer : c'est un
 * SIGNALEMENT. La retirer d'ici veut dire « le problème est réglé », pas
 * « on a cessé d'en parler ».
 */
const UNREACHED: Record<string, string> = {
  "app/components/SessionPanel.tsx": `
    La séance du jour — ouverture, état émotionnel déclaré, objectif, score de
    préparation, clôture et bilan. Fonctionnalité complète, traduite (28 clés
    "session.*"), adossée à la table \`trading_sessions\`, fusionnée par la PR
    #181 — et montée sur AUCUNE page.

    Ce n'est donc pas un fichier oublié, c'est une fonctionnalité livrée qui
    n'atteint aucun trader. Les conséquences se voient ailleurs :
    \`openSession\` et \`closeSession\` n'ont pas d'autre appelant, la table
    reste donc vide, \`trades.session_id\` reste toujours nul, et le
    \`loadTodaySession\` de Jarvis rend invariablement null.

    Le monter est un choix de PRODUIT : son propre en-tête indique où il devait
    aller (« au-dessus de la checklist qui l'alimente »), mais l'ajouter change
    l'écran de préparation. Signalé plutôt que décidé unilatéralement.`,
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(full) && !full.includes("/tests/") && !full.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Les points d'entrée : personne ne les importe, le framework les charge. */
function isEntryPoint(rel: string): boolean {
  return (
    rel.startsWith("routes/") ||
    ["server.ts", "client.tsx", "router.tsx"].includes(rel) ||
    rel.endsWith(".d.ts")
  );
}

describe("aucun composant n'est écrit pour personne", () => {
  const files = sourceFiles(SRC);
  const blob = files
    .map((f) => readSource(import.meta.dir, relative(import.meta.dir, f)))
    .join("\n");

  test("chaque fichier de `src/` est atteint depuis un point d'entrée", () => {
    const unreached: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file);
      if (isEntryPoint(rel)) continue;
      const stem = file.replace(/\.tsx?$/, "");
      const base = stem.split("/").pop() as string;
      const modulePath = relative(SRC, stem);
      const referenced =
        blob.includes(modulePath) ||
        new RegExp(`[/"']${base}["']`).test(blob) ||
        (base === "index" && blob.includes(relative(SRC, join(file, ".."))));
      if (!referenced) unreached.push(rel);
    }
    expect(unreached.sort()).toEqual(Object.keys(UNREACHED).sort());
  });

  test("le contexte mort a bien disparu", () => {
    // Il dupliquait `hooks/useTradingRules.ts` et son hook levait une erreur
    // dès qu'on l'appelait : son fournisseur n'était monté nulle part.
    expect(existsSync(join(SRC, "app/contexts/TradingRulesContext.tsx"))).toBe(false);
    expect(existsSync(join(SRC, "app/hooks/useTradingRules.ts"))).toBe(true);
  });

  test("la fonctionnalité « séance » reste bien inatteignable — et on le sait", () => {
    // Ce test ÉCHOUE le jour où quelqu'un monte enfin le panneau : il faudra
    // alors retirer l'exception, ce qui est exactement la bonne réaction.
    const store = readSource(import.meta.dir, "../src/app/store/sessions.ts");
    expect(store).toContain("export async function openSession");
    const callers = sourceFiles(SRC).filter((f) => {
      if (f.endsWith("store/sessions.ts") || f.endsWith("store.ts")) return false;
      return /\bopenSession\s*\(/.test(readSource(import.meta.dir, relative(import.meta.dir, f)));
    });
    expect(callers.map((f) => relative(SRC, f))).toEqual(["app/components/SessionPanel.tsx"]);
  });
});
