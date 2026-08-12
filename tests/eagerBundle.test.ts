import { expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Le graphe d'imports STATIQUES du shell, vérifié comme un invariant.
 *
 * `MOTION_AND_PERF.md` demande que recharts (370 Ko) soit absent du chunk
 * initial. Il y était — non pas parce qu'une page le chargeait trop tôt, mais
 * parce que `shared/ui/index.ts` réexportait un `ChartContainer` que PERSONNE
 * n'utilisait : un seul `import { Button } from "@/shared/ui"` suffisait à
 * tirer toute la librairie dans le chunk principal.
 *
 * Ce genre de régression est invisible en revue (une ligne d'export) et
 * invisible à l'exécution (l'application marche, elle est juste lourde). D'où
 * ce test : il marche le graphe depuis le shell en ne suivant QUE les imports
 * statiques — `import()` dynamique = frontière de chunk, donc on s'arrête — et
 * échoue si une dépendance lourde redevient joignable.
 *
 * Il ne remplace pas une mesure de bundle : il attrape la cause la plus
 * fréquente, tôt, et gratuitement.
 */

const ROOT = resolve(import.meta.dir, "..");
/**
 * Deux entrées : le shell authentifié, et la route paramétrée qui l'enveloppe
 * — celle-ci importe AUSSI la landing en statique (c'est le repli SSR d'un
 * visiteur non connecté), donc elle fait partie du chargement initial réel.
 */
const ENTRIES = ["src/app/App.tsx", "src/routes/$page.tsx"];

/** Paquets qui n'ont RIEN à faire dans le chargement initial. */
const MUST_BE_LAZY = ["recharts", "react-markdown"];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

function resolveImport(spec: string, fromFile: string): string | null {
  // Paquet npm : pas un fichier du dépôt, on rend le specifier tel quel.
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return spec;
  const base = spec.startsWith("@/")
    ? resolve(ROOT, "src", spec.slice(2))
    : resolve(dirname(fromFile), spec);
  if (existsSync(base) && !existsSync(base + ".ts")) {
    for (const ext of ["/index.ts", "/index.tsx"]) {
      if (existsSync(base + ext)) return base + ext;
    }
  }
  for (const ext of ["", ...EXTENSIONS]) {
    if (ext === "") {
      if (existsSync(base) && /\.[jt]sx?$/.test(base)) return base;
      continue;
    }
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

/**
 * Imports statiques d'un fichier. On ignore volontairement `import(...)` :
 * c'est exactement la frontière que Vite utilise pour découper un chunk.
 */
function staticImports(source: string): string[] {
  const out: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1]);
  // `import "./styles.css";` — sans clause `from`.
  const bare = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  while ((m = bare.exec(source))) out.push(m[1]);
  return out;
}

function eagerGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [resolve(ROOT, entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of staticImports(source)) {
      const resolved = resolveImport(spec, file);
      if (!resolved) continue;
      if (resolved.startsWith("/")) queue.push(resolved);
      else packages.add(resolved.split("/")[0].startsWith("@") ? resolved : resolved.split("/")[0]);
    }
  }
  return packages;
}

test.each(ENTRIES)("%s reaches no heavy chart or markdown library statically", (entry) => {
  const packages = eagerGraph(entry);
  for (const heavy of MUST_BE_LAZY) {
    expect([...packages]).not.toContain(heavy);
  }
});

test("the eager graph is actually being walked (guard against a silently empty test)", () => {
  const packages = eagerGraph(ENTRIES[0]);
  // Si le marcheur ne résolvait plus rien, le test ci-dessus passerait pour de
  // mauvaises raisons. React est forcément là.
  expect([...packages]).toContain("react");
});
