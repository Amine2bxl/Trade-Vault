# SEO_ROUTES — la surface publique de TradeVault

Toutes les routes du produit, et pour chacune : indexable ou non, sa langue, son
canonical, ses alternatives. C'est la carte qu'on relit avant d'ajouter une
route — parce que la question « est-ce que ça doit être indexé ? » se pose au
moment de créer le fichier, pas six mois après.

---

## Routes indexables

| Route | Langue | Canonical | `hreflang` | `changefreq` | Fichier |
|---|---|---|---|---|---|
| `/` | en | `https://tradevault.be/` | en · fr · x-default | weekly | `src/routes/index.tsx` |
| `/fr` | fr | `https://tradevault.be/fr` | en · fr · x-default | weekly | `src/routes/fr.tsx` |
| `/privacy` | multi¹ | `…/privacy` | — | yearly | `src/routes/privacy.tsx` |
| `/terms` | multi¹ | `…/terms` | — | yearly | `src/routes/terms.tsx` |
| `/cgu` | multi¹ | `…/cgu` | — | yearly | `src/routes/cgu.tsx` |
| `/contact` | multi¹ | `…/contact` | — | monthly | `src/routes/contact.tsx` |

¹ Ces quatre pages lisent la langue **persistée** du visiteur
(`usePersistedLang`) et existent donc dans les douze langues de l'application —
mais à une seule URL. Elles ne déclarent aucun `hreflang`, et c'est délibéré :
déclarer une alternative qui n'a pas d'adresse est pire que de n'en déclarer
aucune, le moteur suivant un lien vers un 404. Si un jour ces pages méritent
d'être indexées par langue, elles suivront le motif de `/fr` — un préfixe, une
URL, une déclaration réciproque.

---

## Routes explicitement non indexées

| Route | Pourquoi | Fichier |
|---|---|---|
| `/$page` | Les 18 écrans authentifiés (`/journal`, `/settings`, `/analytics`…). Un crawler n'y verra jamais qu'un squelette ; les indexer diluerait le référencement sur des URL vides. | `src/routes/$page.tsx` |
| `/demo` | Parcours produit en lecture automatique, pas une page de contenu. | `src/routes/demo.tsx` |
| `/demo-site` | Découverte guidée sur données d'exemple. Même raison. | `src/routes/demo-site.tsx` |
| `/reset-password` | Page transactionnelle atteinte par un lien à usage unique. | `src/routes/reset-password.tsx` |
| `/dev/ui`, `/dev/ai` | Ateliers internes. | `src/routes/dev.*.tsx` |

**Ces routes restent EXPLORABLES.** C'est le point que rate la plupart des
configurations : un `Disallow` dans `robots.txt` empêche le robot de **lire** le
`noindex` de la page — l'URL peut alors rester dans l'index, sans titre ni
description, et il n'existe plus aucun moyen de l'en sortir. *Explorable +
`noindex`* est la seule combinaison qui désindexe réellement.

Ce que le produit doit garder hors de l'index sans exception : tableaux de bord,
réglages, journal, conversations avec le coach, mémoire de Jarvis, rapports
privés. Tous vivent derrière `/$page`, donc tous sont couverts par une seule
déclaration — et `tests/seo.test.ts` échoue si elle disparaît.

---

## Chemins hors routeur

| Chemin | Sert | Généré par |
|---|---|---|
| `/robots.txt` | `Allow: /` + `Disallow: /api/` + le sitemap sur l'hôte canonique ; `Disallow: /` partout ailleurs | `src/server.ts` — `robotsTxt()` |
| `/sitemap.xml` | Les 6 URL indexables, avec `lastmod`, `changefreq` et les alternatives de langue | `src/server.ts` — `sitemapXml()` |
| `/llms.txt` | Résumé lisible par un agent | `public/llms.txt` (statique) |
| `/api/*` | Webhooks, crons, facturation. Ne rend jamais de HTML. | `src/server.ts` |
| `/og-image.png` | L'aperçu social, 1200×630 | `public/` — régénéré par `bun scripts/og-image.ts` |

⚠️ **Ne jamais recréer `public/robots.txt` ni `public/sitemap.xml`.** Sur Vercel,
le CDN sert `public/` **avant** d'atteindre la fonction : ces deux fichiers ont
déjà existé et rendaient les gestionnaires dynamiques inatteignables. La
protection des préversions ne s'appliquait donc pas — chaque branche déployée
était indexable — et le sitemap tenu à la main avait divergé (il ignorait
`/contact`). `tests/publicSurface.test.ts` échoue si l'un des deux réapparaît.

---

## Ajouter une route : la liste à cocher

1. **Doit-elle être indexée ?** Si non → `index: false` dans `pageSeo`, et rien
   d'autre à faire.
2. Si oui → l'ajouter à `PUBLIC_ROUTES` (`src/server.ts`) avec une `priority` et
   une `changefreq` **honnêtes**. Un sitemap qui exagère est un sitemap que le
   moteur cesse de lire.
3. **Existe-t-elle en deux langues ?** Si oui, chaque version a sa propre URL, et
   les deux se citent mutuellement via `alternates`. Une grappe `hreflang` à
   sens unique est ignorée en bloc.
4. **Est-elle atteignable par un lien ?** Une page présente au sitemap et liée
   par rien est orpheline — c'était le cas de `/contact`. Le pied de page
   (`FOOTER_PRODUCT` / `FOOTER_RESOURCES` dans `Landing.tsx`) est l'endroit par
   défaut.
5. **Son mot-clé principal est-il déjà attribué ?** Voir `KEYWORD_MAP.md`. Si
   oui, ce n'est pas une nouvelle page : c'est une mise à jour de l'existante.
6. **Porte-t-elle un fil d'Ariane ?** Toute page qui n'est pas l'accueil devrait
   émettre un `breadcrumbJsonLd`.
