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
 *     `trading/useTradingRules.ts`. Son `useTradingRulesContext` LEVAIT une
 *     erreur si on l'appelait, puisque son fournisseur n'était monté nulle
 *     part. Supprimé.
 *   • `features/session/SessionPanel.tsx` — une séance complète (état, objectif,
 *     score, clôture) montée sur AUCUNE page : `trading_sessions` restait vide.
 *     Supprimé quand la checklist est devenue le plan de séance : c'est elle
 *     qui ouvre et clôt désormais la séance du jour (voir le dernier test).
 */

const SRC = resolve(import.meta.dir, "..", "src");

/**
 * Fichier → pourquoi il n'est importé nulle part.
 *
 * Chaque entrée est un SIGNALEMENT, pas un déchet à balayer. La retirer d'ici
 * veut dire « le problème est réglé », pas « on a cessé d'en parler ».
 */
const UNREACHED: Record<string, string> = {};

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
        new RegExp(`[/"']${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.tsx?)?["']`).test(
          blob,
        ) ||
        (base === "index" && blob.includes(relative(SRC, join(file, ".."))));
      if (!referenced) unreached.push(rel);
    }
    expect(unreached.sort()).toEqual(Object.keys(UNREACHED).sort());
  });

  test("le contexte mort a bien disparu", () => {
    // Il dupliquait `trading/useTradingRules.ts` et son hook levait une erreur
    // dès qu'on l'appelait : son fournisseur n'était monté nulle part.
    expect(existsSync(join(SRC, "app/contexts/TradingRulesContext.tsx"))).toBe(false);
    expect(existsSync(join(SRC, "app/trading/useTradingRules.ts"))).toBe(true);
  });

  test("la séance du jour est atteinte — par la checklist, et par elle seule", () => {
    // La séance n'était ouverte par aucun écran monté. C'est désormais le
    // verrou du plan de séance qui l'ouvre, et le bilan qui la clôt. Un second
    // appelant recréerait deux façons d'ouvrir la même journée.
    const store = readSource(import.meta.dir, "../src/app/store/sessions.ts");
    expect(store).toContain("export async function openSession");
    expect(existsSync(join(SRC, "app/features/session/SessionPanel.tsx"))).toBe(false);
    const callers = (name: string) =>
      sourceFiles(SRC)
        .filter((f) => {
          if (f.endsWith("store/sessions.ts") || f.endsWith("store.ts")) return false;
          return new RegExp(`\\b${name}\\s*\\(`).test(
            readSource(import.meta.dir, relative(import.meta.dir, f)),
          );
        })
        .map((f) => relative(SRC, f));
    expect(callers("openSession")).toEqual(["app/features/checklist/Checklist.tsx"]);
    expect(callers("closeSession")).toEqual(["app/features/checklist/Checklist.tsx"]);
  });
});
