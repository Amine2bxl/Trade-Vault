import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `.vercel` est LA sortie de build de ce projet (`nitro.preset = "vercel"`,
  // voir vite.config.ts) — elle manquait à cette liste. En CI le lint passe
  // avant le build, donc personne ne l'a vu ; en local, `bun run build` puis
  // `bun run lint` fait parcourir des milliers de fichiers générés et le lint
  // ne rend jamais la main.
  { ignores: ["dist", ".output", ".vinxi", ".vercel", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Re-enabled (progressive): unused code and imports are surfaced again
      // as warnings. Kept at "warn" for now so the existing debt is visible
      // without breaking the build; a dedicated cleanup sprint promotes this
      // to "error". An underscore prefix (_unused) is the escape hatch.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Tracked debt, not a hard gate yet: surfaces every `any` cast as a
      // warning so the type-safety erosion is visible and can be resolved
      // progressively without breaking the build.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  eslintPluginPrettier,
);
