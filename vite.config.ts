// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Découpage des dépendances du chunk `index` — MESURE D'ABORD, GAIN ENSUITE.
 *
 * Sur la production, `index-*.js` pèse 602 kB, soit 64 % du JavaScript chargé
 * à froid. Les marqueurs présents dedans (`hydrateRoot`, `matchRoutes`,
 * `queryCache`, `GoTrueClient`) disent QUI s'y trouve, mais pas COMBIEN chacun
 * y occupe — et sans ce chiffre, toute décision de découpage est une intuition.
 *
 * Ce découpage est donc d'abord un INSTRUMENT DE MESURE : après déploiement,
 * la taille de chaque chunk EST l'attribution, lisible dans l'onglet réseau
 * sans outil supplémentaire (`rollup-plugin-visualizer` ne peut pas être ajouté
 * ici — le registre du bac à sable refuse `bun install`, et la CI tourne en
 * `--frozen-lockfile`).
 *
 * ── CE QUE ÇA NE FAIT PAS ──────────────────────────────────────────────────
 * Ça ne retire pas un octet. Les mêmes modules sont téléchargés, répartis
 * autrement. Ce qui change : ils descendent en parallèle plutôt qu'en un seul
 * fichier, et surtout ils se mettent en cache SÉPARÉMENT — aujourd'hui, une
 * ligne modifiée dans le code applicatif invalide les 602 kB, React compris.
 *
 * L'objectif de 900 kB ne sera pas atteint par ce découpage, et il faut le dire
 * : `react-dom/client` mesure à lui seul ~386 kB minifié. Le budget se gagnera
 * en retirant des dépendances du chemin froid, pas en les redistribuant.
 *
 * Portée CLIENT uniquement (`environments.client`) : le build serveur de Nitro
 * assemble un fichier unique, où `manualChunks` n'a pas de sens.
 */
const VENDOR_CHUNKS: [test: (id: string) => boolean, name: string][] = [
  [(id) => /node_modules\/(react|react-dom|scheduler)\//.test(id), "vendor-react"],
  [(id) => id.includes("node_modules/@supabase/"), "vendor-supabase"],
  [(id) => id.includes("node_modules/@tanstack/"), "vendor-tanstack"],
];

function manualChunks(id: string): string | undefined {
  for (const [test, name] of VENDOR_CHUNKS) if (test(id)) return name;
  return undefined;
}

export default defineConfig({
  vite: {
    environments: {
      client: {
        build: { rollupOptions: { output: { manualChunks } } },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Hard-pin the deploy target to Vercel now that the project runs outside Lovable
  // (Lovable's builder otherwise defaults to the cloudflare-module preset).
  // NITRO_PRESET escape hatch: `npm run preview` builds a locally runnable
  // node-server bundle (.output/) — the Vercel deploy is unaffected.
  nitro: {
    preset: process.env.NITRO_PRESET || "vercel",
  },
});
