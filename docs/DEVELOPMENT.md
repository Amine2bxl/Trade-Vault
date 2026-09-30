# Développement

## 1. Démarrer

```bash
bun install                 # Bun, pas npm
cp .env.example .env        # renseigner au minimum Supabase
bun run dev                 # http://localhost:8080 (port fixé par la config Lovable)
bun run preview             # build node + serveur local :4173 (vérifier le SSR)
```

Sans clé de provider IA, Jarvis répond par un message d'indisponibilité
honnête ; le reste de l'app fonctionne. L'app de dev parle à la base Supabase
**réelle** : voir [`DATABASE.md`](DATABASE.md).

## 2. Commandes

| Commande | Rôle |
| --- | --- |
| `bun run typecheck` | `tsc --noEmit` (inclut `tests/` et `types/`) |
| `bun run lint` | ESLint + Prettier (lent : peut dépasser 5 min) |
| `bun run format` | Prettier en écriture |
| `bun run build` | Build Vite (preset Nitro `vercel`, sortie `.vercel/output`) ; régénère `routeTree.gen.ts` |
| `bun test` | ~1 200 tests `bun:test`, ~5 s |
| `bash scripts/test-sql.sh` | Garanties SQL facturation/quota (Postgres 16 réel) |
| `bun run voices` | Régénère les clips de voix de Jarvis (`public/voices/`) |

## 3. Portes CI (`.github/workflows/ci.yml`)

Sur chaque PR et chaque push sur `main` : `bun install --frozen-lockfile` →
**typecheck → lint → build → test**, puis les tests sous
`TZ=America/New_York` et `TZ=Pacific/Auckland`, et un job SQL séparé. Tout doit
être vert avant de pousser sur `main` (qui déploie sur Vercel).

Les bugs de jour calendaire (`toISOString().slice(0, 10)`) n'apparaissent que
dans ces fuseaux : reproduire avec `TZ=America/New_York bun test`. Pour une
date métier, utiliser `todayLocalDate()` / `localDateOf()`
(`src/shared/calendar-date.ts`), jamais une découpe UTC.

> Si `bun install` échoue localement (le verrou référence un registre npm
> privé Lovable, parfois inaccessible), la CI reste la vérification qui fait foi.

## 4. Tests

- Tests transverses dans `tests/`, tests co-localisés dans `src/**/tests/`
  (ou `*.test.ts` à côté du module testé).
- **Plusieurs tests lisent les sources et vérifient leur contenu** : déplacer un
  fichier ou changer une chaîne peut les casser. Notamment
  `publicSurface` (SEO, langue, robots), `envExample` (toute variable serveur
  lue est documentée dans `.env.example`), `themeCoverage`, `staticCards`,
  `fullScreenPages`, `reachability`, `calendarDate`, `seo`, `httpPerimeter`.
  Toujours lancer la suite complète.
- Ne jamais modifier une assertion pour faire passer un test : corriger le code.
  Seuls les **chemins** lus par un test suivent un déplacement de fichier.

## 5. Internationalisation — trois systèmes, à ne pas mélanger

1. **App** : `src/app/i18n/` — `LanguageContext` + `useT()`, dictionnaire
   anglais source `translations.ts` + `locales/*.ts` (12 langues ; `fr`
   complet, les autres partiellement). **Anglais par défaut, changement
   uniquement par choix explicite dans les Réglages, aucune détection
   navigateur.** Toute nouvelle clé va dans `translations.ts` **et** `fr`
   (couverture testée). Préférence stockée : `tv.lang`.
2. **Landing** : son propre fournisseur `LandingLangProvider` + `useLandingT()`
   et un dictionnaire en/fr par clé dans `src/app/public/landing/i18n.tsx`.
   Aucun lien avec l'i18n de l'app. Préférence : `tv.landing.lang`.
3. **Langue SSR/SEO** : `SSR_LANG` (`src/shared/lang.ts`, `"en"`). Quatre
   endroits doivent concorder : `<html lang>` (`routes/__root.tsx`), le corps
   SSR, titre/description (`routes/index.tsx`) et `og:locale`
   (`shared/seo.ts` + `__root.tsx`). Vérifié par `tests/publicSurface.test.ts`.

Aucune chaîne visible codée en dur (`fr ? … : …` interdit dans les composants) :
tout passe par `t(...)` ou le dictionnaire de la landing.

## 6. Conventions

- **Commentaires en français**, qui expliquent les contraintes que le code ne
  montre pas.
- Commits en français, descriptifs. Travail sur une branche `claude/*` ou de
  feature, PR, CI verte, merge dans `main` en gardant un historique linéaire.
- Structure, placement des fichiers, nommage et règles de suppression :
  [`ARCHITECTURE.md`](ARCHITECTURE.md) §7.
- `src/routeTree.gen.ts` et `src/integrations/supabase/types.ts` sont générés :
  ne jamais les éditer à la main (le premier se committe après `bun run build`).
- Ne jamais réajouter à `vite.config.ts` les plugins déjà fournis par
  `@lovable.dev/vite-tanstack-config`.
- Migrations : additives, jamais exécutées à la main contre la production ;
  la branche de preview Supabase les valide.

## 7. Déployer

Pousser `main` déploie sur Vercel (aperçu par PR). Variables : dashboard
Vercel, contrat dans `.env.example` ([`BACKEND.md`](BACKEND.md) §7). Les
en-têtes de sécurité (CSP, HSTS, `X-Frame-Options`…) et les crons sont dans
`vercel.json`.
