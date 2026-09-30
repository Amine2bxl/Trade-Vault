# SEO — surface publique

Domaine canonique : `SITE_URL` (`src/shared/site.ts`, `https://tradevault.be`).
Toutes les URL absolues en dérivent ; les métadonnées passent par `pageSeo()`
(`src/shared/seo.ts`). Garde-fous testés : `tests/seo.test.ts`,
`tests/publicSurface.test.ts`, `tests/landingSsrLang.test.tsx`.

## Routes

| Route | Indexée | Note |
| --- | --- | --- |
| `/` | oui | Landing anglaise (`SSR_LANG = "en"`), `hreflang` en · fr · x-default |
| `/fr` | oui | Landing française, réciproque de `/` |
| `/pricing` | oui | Tarifs publics |
| `/privacy`, `/terms`, `/cgu`, `/cookies`, `/contact` | oui | Langue persistée du visiteur, une seule URL, pas de `hreflang` (délibéré) |
| `/$page` (`/journal`, `/settings`…) | **non** | Écrans authentifiés ; explorables + `noindex` |
| `/demo`, `/demo-site`, `/reset-password`, `/dev/*` | **non** | Parcours, transactionnel, ateliers internes |

Pourquoi « explorable + `noindex` » : un `Disallow` empêche le robot de lire le
`noindex`, et l'URL peut rester dans l'index sans moyen de l'en sortir.

**Hors routeur** : `/robots.txt` et `/sitemap.xml` sont **générés** par
`src/server.ts` depuis `PUBLIC_ROUTES` (`Disallow: /` sur tout hôte non
canonique, donc sur les previews). **Ne jamais recréer
`public/robots.txt` ni `public/sitemap.xml`** : le CDN les servirait avant la
fonction. `public/llms.txt` résume le produit pour les agents ;
`public/og-image.png` (1200×630) se régénère avec `bun scripts/og-image.ts`.

## Ajouter une route publique

1. Indexable ? Sinon `index: false` dans `pageSeo`, et c'est tout.
2. Sinon l'ajouter à `PUBLIC_ROUTES` (`src/server.ts`) avec une `priority` et
   une `changefreq` honnêtes.
3. Deux langues ? Une URL par langue, qui se citent mutuellement (`alternates`).
4. La rendre atteignable par un lien (pied de page de la landing par défaut).
5. Un mot-clé principal par page ; ne pas en voler un déjà attribué.

## Données structurées — interdits

Une donnée structurée n'affirme que ce que la page montre à un humain. Jamais :
`aggregateRating` / `ratingValue` / `reviewCount`, `Review`,
`userInteractionCount`, adresse, TVA, effectif ou `foundingDate` non publiés.
Jamais de statistique fabriquée, de promesse de résultat, de mensonge sur un
concurrent, ni de contenu différent servi aux robots. Répéter un mot-clé ne
rend pas une page plus citable.

## Travail restant

Voir [`ROADMAP.md`](ROADMAP.md#acquisition-et-seo) (accroche `<h1>`, pages de
contenu, Search Console).
