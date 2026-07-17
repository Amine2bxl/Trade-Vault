// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
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
