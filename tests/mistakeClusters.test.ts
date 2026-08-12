import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MISTAKE_OPTIONS } from "../src/app/types";
import {
  MISTAKE_CLUSTERS,
  MISTAKE_TO_CLUSTER,
  clusterBreakdown,
  clusterOf,
} from "../src/app/utils/mistakeClusters";

const MIGRATION = resolve(
  import.meta.dir,
  "../supabase/migrations/20260812232956_mistake_taxonomy.sql",
);

test("every mistake maps to exactly one cluster", () => {
  // L'invariant du spec. Ajouter une entrée à MISTAKE_OPTIONS sans la classer
  // casse la CI, plutôt que de produire six mois plus tard un tableau dont la
  // somme ne fait pas le total.
  const mapped = Object.keys(MISTAKE_TO_CLUSTER).sort();
  expect(mapped).toEqual([...MISTAKE_OPTIONS].sort());
});

test("every cluster id used by the mapping exists in MISTAKE_CLUSTERS", () => {
  const known = new Set(MISTAKE_CLUSTERS.map((c) => c.id));
  for (const cluster of Object.values(MISTAKE_TO_CLUSTER)) {
    expect(known.has(cluster)).toBe(true);
  }
});

test("the SQL seed and the TypeScript mapping cannot drift apart", () => {
  // Le compilateur voit la table TypeScript ; il ne voit pas la table SQL.
  // Sans cette comparaison, la base et l'application pourraient classer la même
  // erreur dans deux familles — et personne ne le remarquerait avant qu'un
  // chiffre affiché contredise un autre chiffre affiché.
  const sql = readFileSync(MIGRATION, "utf8");
  const rows = [...sql.matchAll(/\(\s*'([^']+)',\s*'(fomo|plan_violation|risk|exit)'\)/g)];
  const fromSql = Object.fromEntries(rows.map((m) => [m[1], m[2]]));
  expect(fromSql).toEqual(MISTAKE_TO_CLUSTER);
});

test("cluster labels are i18n keys, never literals", () => {
  for (const cluster of MISTAKE_CLUSTERS) {
    expect(cluster.labelKey.startsWith("cluster.")).toBe(true);
  }
  const sql = readFileSync(MIGRATION, "utf8");
  for (const cluster of MISTAKE_CLUSTERS) {
    expect(sql).toContain(`'${cluster.labelKey}'`);
  }
});

test("clusterOf rejects a value that does not come from the product", () => {
  expect(clusterOf("FOMO entry")).toBe("fomo");
  expect(clusterOf("Bad vibes")).toBeNull();
  expect(clusterOf("")).toBeNull();
});

test("the breakdown always returns all four families, zeros included", () => {
  // Une famille absente du résultat se lit « pas de données » ; à zéro elle se
  // lit « aucune erreur de ce type ». Ce sont deux affirmations différentes.
  const out = clusterBreakdown([{ mistakes: ["No stop loss"] }]);
  expect(Object.keys(out.counts).sort()).toEqual(["exit", "fomo", "plan_violation", "risk"]);
  expect(out.counts.risk).toBe(1);
  expect(out.counts.fomo).toBe(0);
});

test("the breakdown carries n so no share can be shown without its sample size", () => {
  const out = clusterBreakdown([
    { mistakes: ["FOMO entry", "Chased entry"] },
    { mistakes: [] },
    { mistakes: null },
    {},
  ]);
  expect(out.n).toBe(4);
  expect(out.counts.fomo).toBe(2);
});

test("an unknown mistake is counted apart, never silently dropped", () => {
  const out = clusterBreakdown([{ mistakes: ["No stop loss", "Something else"] }]);
  expect(out.counts.risk).toBe(1);
  expect(out.unmapped).toBe(1);
});

test("no trade row is required to compute a breakdown", () => {
  const empty = clusterBreakdown([]);
  expect(empty.n).toBe(0);
  expect(Object.values(empty.counts).every((v) => v === 0)).toBe(true);
});
