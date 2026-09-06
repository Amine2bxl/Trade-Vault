# SEO_AUDIT — TradeVault

Audit réalisé **avant toute modification**, sur `main` à `80fda12`.
Domaine canonique : `https://tradevault.be`.

---

## SEO_SCORE : 58 / 100

Un score moyen qui recouvre deux réalités très différentes, et c'est le point
le plus important de ce rapport.

**La plomberie est bonne.** `robots.txt` et `sitemap.xml` sont *générés* depuis
`SITE_URL`, pas tenus à la main ; les préversions Vercel refusent l'indexation ;
chaque route publique passe par un constructeur unique (`pageSeo`) qui pose un
canonical auto-référent, des URL absolues et un `og:` complet ; la landing est
rendue côté serveur, donc lisible sans JavaScript ; les polices sont chargées
en non-bloquant ; les écrans authentifiés sont en `noindex`. Plusieurs pièges
classiques ont déjà été désamorcés, et le dépôt garde même des tests
d'invariants (`tests/publicSurface.test.ts`) pour qu'ils ne reviennent pas.

**Ce qui manque n'est pas de la plomberie, c'est de la SURFACE.** Le site
possède cinq URL indexables, un `<h1>` qui ne contient aucun mot-clé, treize
liens morts, aucune donnée structurée décrivant ce que la page dit réellement,
et une version française entièrement invisible pour les moteurs alors que
c'est le marché que le produit adresse. Autrement dit : la maison est bien
construite, il n'y a simplement presque rien dedans, et personne ne peut y
entrer par la porte française.

### Notes par axe

| Axe | Note | Lecture |
|---|---|---|
| TECHNICAL_SEO | **78** / 100 | Solide. Génération dynamique, canonicals corrects, noindex bien placés. |
| INDEXABILITY | **80** / 100 | Le meilleur axe. Rien d'important n'est bloqué, rien de privé n'est ouvert. |
| PERFORMANCE | **70** / 100 | SSR + polices non bloquantes + découpage vendor. Plombé par le poids JS et `user-scalable=no`. |
| STRUCTURED_DATA | **45** / 100 | Existe, mais décrit l'entité — jamais le contenu. Une contradiction de langue. |
| SOCIAL_DISCOVERY | **40** / 100 | `summary_large_image` servi avec une icône carrée. Cinq faux profils sociaux. |
| CONTENT | **35** / 100 | Cinq URL. Aucune page de contenu. Le `<h1>` ne porte aucun mot-clé. |
| BRAND_ENTITY | **35** / 100 | `sameAs` absent, un lien Trustpilot cassé, cinq réseaux qui n'existent pas. |
| INTERNAL_LINKING | **25** / 100 | 13 liens morts. `/contact` orphelin. Aucun lien contextuel. |
| AI_SEARCH (GEO) | **40** / 100 | `llms.txt` présent — bon réflexe — mais périmé, incomplet et dans la mauvaise langue. |
| AEO | **30** / 100 | Une FAQ visible existe et n'est balisée nulle part. Aucune réponse extractible. |
| CONVERSION | **55** / 100 | Le parcours fonctionne, mais la moitié des points de sortie du footer ne mènent nulle part. |
| INTERNATIONAL_SEO | **15** / 100 | **L'axe le plus faible.** Deux langues, une seule URL, zéro `hreflang`. |
| AUTHORITY | **20** / 100 | Site jeune, aucun signal externe exploitable. Rien à corriger dans le code. |

---

## Ce qui est déjà bon — et ne doit pas être régressé

Le brief demande explicitement de l'identifier. Cette liste est un **contrat de
non-régression** : chaque point ci-dessous est protégé par un test.

1. **`robots.txt` et `sitemap.xml` sont générés, pas statiques** (`src/server.ts`).
   Deux fichiers statiques les masquaient autrefois — sur Vercel le CDN sert
   `public/` avant d'atteindre la fonction — et le code de protection des
   préversions était donc mort. Ne jamais les recréer dans `public/`.
2. **Les préversions refusent l'indexation** (`isCanonicalHost`). Sans cela
   chaque branche déployée concurrence la production dans l'index.
3. **Un seul constructeur de métadonnées** (`pageSeo`, `src/shared/seo.ts`).
   Titre, description, robots, `og:`, `twitter:` et canonical sortent du même
   endroit. C'est ce qui empêche une route d'oublier son canonical.
4. **Aucun canonical au niveau racine** — et c'est délibéré : TanStack *fusionne*
   les `meta` mais *empile* les `links`. Un canonical racine en ajouterait un
   second, contradictoire, sur chaque page.
5. **La landing est rendue côté serveur** (`<ClientOnly fallback={<Landing />}>`).
   Un crawler et un moteur IA lisent le texte sans exécuter une ligne de JS.
6. **Les écrans authentifiés sont en `noindex`** (`src/routes/$page.tsx`), et
   restent *crawlables* — ce qui est la bonne configuration : un `Disallow`
   empêcherait le robot de lire le `noindex` lui-même.
7. **Les polices ne bloquent pas le rendu** — `preload as=style` basculé en
   feuille de style par un script inline exécuté à l'analyse du document.
8. **Le fichier de vérification Search Console est réellement servi**
   (`public/google576720876a8ff805.html`).
9. **Un `llms.txt` existe.** Le réflexe est juste, même si le contenu a dérivé.
10. **Une seule source pour le domaine** (`SITE_URL`). Changer de domaine ne
    demande qu'une variable d'environnement.

---

## Problèmes, par priorité

Format : sévérité · impact SEO · impact business · solution · fichier · priorité.

---

### P0-1 · La version française n'est indexable nulle part

* **Sévérité** : critique
* **Impact SEO** : le site sert `<html lang="en">` avec un titre, une
  description et un `og:locale` anglais. Le français n'existe que derrière un
  sélecteur client, **à la même URL**. Un moteur de recherche ne peut pas
  indexer un contenu qui n'a pas d'adresse : toute la vitrine française — un
  dictionnaire de plusieurs centaines de chaînes déjà écrit et traduit — est
  invisible.
* **Impact business** : le produit s'adresse manifestement au marché
  francophone (les CGU, la politique de confidentialité, `llms.txt` et le
  `manifest` sont en français ; le tutoiement est la voix du produit). C'est
  précisément le trafic qui ne peut pas arriver. Requêtes perdues : « journal
  de trading », « carnet de trading », « coach IA trading », « psychologie du
  trading ».
* **Solution** : donner une URL au français (`/fr`), la rendre en français **au
  SSR**, et déclarer la paire par `hreflang` (`en`, `fr`, `x-default`) dans le
  `<head>` *et* dans le sitemap. Aucun changement de design.
* **Fichiers** : `src/routes/fr.tsx` (nouveau), `src/shared/seo.ts`,
  `src/server.ts`, `src/app/pages/landing/i18n.tsx`, `src/routes/__root.tsx`.
* **Priorité** : **P0**

---

### P0-2 · Treize liens morts, dont cinq faux profils sociaux

* **Sévérité** : critique
* **Impact SEO** : le footer contient quatre liens « Produit », quatre liens
  « Ressources » et cinq icônes sociales, **tous en `href="#"`** — plus le logo.
  Aucun jus de lien ne circule, aucune page interne n'est découverte par le
  crawl, et le site n'a littéralement aucun maillage interne au-delà des trois
  liens légaux.
* **Impact business** : un visiteur qui clique sur « Twitter » ou sur une
  fonctionnalité du footer ne se passe rien. C'est le signal de confiance le
  plus cher du site — et les cinq icônes sociales **annoncent des comptes qui
  n'existent pas**, ce qui n'est pas seulement inefficace, c'est faux.
* **Solution** : supprimer les icônes sociales tant qu'aucun compte réel
  n'existe (on ne dessine pas une présence qu'on n'a pas), remplacer les liens
  « Produit » par des ancres réelles vers les sections de la page
  (`#problem`, `#ai`, `#features`, `#pricing`) et les liens « Ressources » par
  les vraies routes (`/demo-site`, `#pricing`, `#faq`, `/contact`).
* **Fichier** : `src/app/pages/Landing.tsx`
* **Priorité** : **P0**

---

### P0-3 · `/contact` est orpheline

* **Sévérité** : haute
* **Impact SEO** : la page est déclarée dans le sitemap et n'est atteignable
  par **aucun lien du site**. Une page orpheline est crawlée rarement et
  comprise mal.
* **Impact business** : c'est la page de support. Un prospect qui a une
  question avant d'acheter ne la trouve pas.
* **Solution** : la lier depuis le footer (colonne Ressources et barre légale).
* **Fichier** : `src/app/pages/Landing.tsx`
* **Priorité** : **P0**

---

### P0-4 · Le `<h1>` ne contient aucun mot-clé

* **Sévérité** : haute
* **Impact SEO** : le `<h1>` est « Trade better. Understand why. ». C'est une
  bonne accroche de marque et un très mauvais `<h1>` : le signal on-page le
  plus fort de la page ne dit ni ce qu'est le produit, ni pour qui. Aucune
  occurrence de « trading journal », « trading coach » ou « AI ». Le `<title>`
  et la description, eux, sont corrects — le `<h1>` est le maillon isolé.
* **Impact business** : la page d'accueil ne peut pas se positionner sur sa
  propre catégorie.
* **Solution proposée** (voir la réserve ci-dessous) : conserver exactement la
  structure en deux temps et le souligné manuscrit, changer les mots.
  `hero.h1a` → « Your trading journal. » / `hero.h1b` → « With an AI coach. »
  (FR : « Ton journal de trading. » / « Avec un coach IA. »). Même longueur,
  même rythme, même mise en page.
* **Fichier** : `src/app/pages/landing/i18n.tsx`
* **Priorité** : **P0**
* **⚠️ NON APPLIQUÉ — décision de marque, pas correction évidente.** Le brief
  autorise à appliquer sans confirmation « les corrections évidentes et non
  destructives » ; réécrire l'accroche d'une page de vente n'entre pas dans
  cette catégorie. Les deux chaînes sont prêtes ci-dessus, à appliquer d'un mot.

---

### P1-5 · La carte sociale ne peut pas s'afficher

* **Sévérité** : haute
* **Impact SEO** : `twitter:card` vaut `summary_large_image`, mais `og:image`
  pointe sur `/icon-512.png` — une icône **carrée de 512 px**. Le ratio attendu
  est 1200×630. Le résultat est une carte rognée ou un repli en petite vignette.
  Un `og-image.svg` aux bonnes dimensions existe dans `public/` mais **n'est
  référencé nulle part**, et **aucun scraper social ne rend le SVG** (ni
  Facebook, ni LinkedIn, ni X, ni Slack, ni Discord). Il est en outre resté
  cyan `#22d3ee` — une couleur que le produit n'utilise plus — avec une
  accroche française sur un site servi en anglais.
* **Impact business** : chaque partage du lien — le canal d'acquisition le
  moins cher qui existe — s'affiche sans visuel.
* **Solution** : produire un vrai PNG 1200×630 aux couleurs actuelles
  (graphite + accent émeraude), le pointer depuis `DEFAULT_OG_IMAGE`, et
  déclarer `og:image:width` / `height` / `alt`.
* **Fichiers** : `public/og-image.png` (nouveau), `src/shared/seo.ts`
* **Priorité** : **P1**

---

### P1-6 · Les données structurées contredisent la page

* **Sévérité** : haute
* **Impact SEO** : trois défauts distincts dans `structuredData()`.
  1. `inLanguage: "fr-FR"` est **écrit en dur** alors que `SSR_LANG` vaut
     `"en"` et que `<html lang>`, le titre et `og:locale` disent tous « en ».
     Le dépôt possède un test qui vérifie l'alignement de ces quatre
     déclarations — le schéma est la cinquième, et elle a été oubliée.
  2. Le graphe est injecté depuis `RootShell`, donc sur **toutes** les pages,
     y compris les écrans authentifiés en `noindex`. Un schéma
     `WebSite`/`Organization` de la page d'accueil s'affirme identiquement sur
     `/settings`.
  3. `offers` déclare `price: "0"` en dur, sans rapport avec le catalogue réel
     (`src/domain/plans.ts` : Free 0 €, Pro 15 €/mois ou 120 €/an).
* **Impact business** : aucun rich result n'est éligible, et la fiche
  d'entité est incohérente au moment précis où Google vérifie la marque pour
  l'écran de consentement OAuth.
* **Solution** : aligner `inLanguage` sur `SSR_LANG` ; borner le graphe aux
  pages publiques ; dériver les offres du catalogue.
* **Fichiers** : `src/shared/seo.ts`, `src/routes/__root.tsx`
* **Priorité** : **P1**

---

### P1-7 · Une FAQ visible, jamais balisée (AEO)

* **Sévérité** : haute
* **Impact SEO** : la landing affiche une section `#faq` avec **quatre
  questions/réponses réelles** (« How is it better than a simple journal? »,
  « Is the free plan really free? », « Is my trading data secure? », « Can I
  import my existing history? »). Aucun `FAQPage` ne les décrit. C'est le
  contenu le plus directement extractible du site — par Google comme par un
  moteur IA — et il est laissé sous forme de `<button>` et de `<div>`.
* **Impact business** : ces quatre questions sont exactement les objections
  d'achat. Les rendre extractibles, c'est y répondre avant la visite.
* **Solution** : émettre un `FAQPage` **construit à partir des mêmes clés de
  dictionnaire** que le rendu visible, pour qu'ils ne puissent pas diverger.
* **Fichiers** : `src/shared/seo.ts`, `src/app/pages/Landing.tsx`
* **Priorité** : **P1**

---

### P1-8 · Le lien Trustpilot pointe vers l'ancien domaine

* **Sévérité** : moyenne
* **Impact SEO** : `AuthModal.tsx` renvoie vers
  `trustpilot.com/review/tradevaultt.vercel.app`. Le domaine canonique est
  `tradevault.be` depuis la migration. Le seul signal d'entité externe réel du
  produit désigne une adresse périmée — et c'est aussi le seul candidat
  légitime à un `sameAs`.
* **Impact business** : le lien « Avis vérifiés » de la modale d'inscription,
  affiché au moment exact de la conversion, mène à la mauvaise fiche.
* **Solution** : dériver l'URL de `SITE_DOMAIN` (qui existe déjà, précisément
  pour cet usage) au lieu de l'écrire en dur.
* **Fichier** : `src/app/pages/landing/AuthModal.tsx`
* **Priorité** : **P1**

---

### P1-9 · `lastmod` ment tous les jours

* **Sévérité** : moyenne
* **Impact SEO** : `sitemapXml()` calcule `new Date()` à chaque requête, donc
  **chaque URL est déclarée modifiée aujourd'hui, tous les jours**, y compris
  des CGU inchangées depuis des mois. Google apprend vite qu'un `lastmod` n'est
  pas fiable et cesse alors de le lire — pour toutes les URL, y compris celles
  qui changent vraiment.
* **Impact business** : le recrawl des pages réellement mises à jour est
  retardé.
* **Solution** : figer `lastmod` sur l'horodatage du **build** (le déploiement
  est le seul moment où le contenu peut changer), et ajouter `changefreq`.
* **Fichier** : `src/server.ts`
* **Priorité** : **P1**

---

### P1-10 · `llms.txt` a dérivé (GEO)

* **Sévérité** : moyenne
* **Impact SEO** : le fichier est **en français** alors que le site est servi
  en anglais ; il ignore `/cgu` (page existante et indexée) ; il annonce un
  « calendrier économique » et des « rapports mensuels » sans dire lesquels
  sont payants ; il ne mentionne ni les tarifs réels, ni les langues
  disponibles. Un moteur IA qui le lit décrit donc un produit légèrement faux.
* **Impact business** : c'est le fichier que lisent ChatGPT, Claude, Perplexity
  et Gemini pour répondre « c'est quoi TradeVault ». Autant qu'il soit exact.
* **Solution** : réécrire à partir des faits vérifiables du dépôt — catalogue
  d'offres, routes publiques réelles, langues réelles — et le référencer depuis
  `robots.txt`.
* **Fichiers** : `public/llms.txt`, `src/server.ts`
* **Priorité** : **P1**

---

### P2-11 · `manifest.webmanifest` désaligné

* **Sévérité** : basse
* **Impact SEO** : `"lang": "fr"` contredit `SSR_LANG = "en"` ;
  `theme_color: "#060810"` contredit le `<meta name="theme-color">` du root
  (`#0a0b0d`, la valeur graphite actuelle) ; la description est en français.
* **Impact business** : couleur de barre d'adresse incohérente à l'installation
  de la PWA.
* **Solution** : aligner sur les valeurs réelles.
* **Fichier** : `public/manifest.webmanifest`
* **Priorité** : **P2**

---

### P2-12 · Aucun fil d'Ariane sur les pages légales

* **Sévérité** : basse
* **Impact SEO** : `/privacy`, `/terms`, `/cgu` et `/contact` n'ont ni
  `BreadcrumbList`, ni lien de retour visible vers l'accueil dans le corps de
  page. Le SERP affiche l'URL brute plutôt qu'un chemin.
* **Solution** : `BreadcrumbList` sur les quatre pages publiques secondaires.
* **Fichiers** : `src/shared/seo.ts`, les quatre routes
* **Priorité** : **P2**

---

### P2-13 · `user-scalable=no` — signalé, non corrigé

* **Sévérité** : basse (SEO) / moyenne (accessibilité)
* **Impact SEO** : `maximum-scale=1, user-scalable=no` est un échec
  d'accessibilité relevé par Lighthouse, et l'accessibilité est un signal de
  qualité faible mais réel.
* **Solution** : le retirer.
* **⚠️ NON APPLIQUÉ.** C'est une décision produit assumée et implémentée
  (`src/shared/lock-zoom.ts`) : l'application se comporte comme une application
  native et le zoom pincé y casse les mises en page à colonnes fixes. Le brief
  interdit de supprimer une fonctionnalité existante pour simplifier le SEO.
  Signalé pour que le compromis soit conscient, pas corrigé.
* **Priorité** : **P2**

---

### P2-14 · Aucun lien d'ancrage réel dans la navigation

* **Sévérité** : basse
* **Impact SEO** : `MegaNav` navigue par `onClick` + défilement programmé. Les
  sections portent bien des `id` (`#problem`, `#ai`, `#features`, `#pricing`,
  `#faq`) mais aucun `<a href>` ne les vise, donc aucun ancrage n'est
  découvrable — ni les *jump links* que Google affiche parfois sous un résultat.
* **Solution** : les ancres du footer (P0-2) couvrent ce besoin sans toucher à
  la navigation.
* **Priorité** : **P2**

---

### P2-15 · Volume de contenu

* **Sévérité** : moyenne à long terme
* **Impact SEO** : cinq URL indexables, dont quatre légales. Il n'existe
  **aucune page de contenu**. Un site sans contenu ne se positionne que sur son
  nom de marque.
* **Solution** : voir `CONTENT_ROADMAP.md`. Le brief interdit — à raison — de
  « créer artificiellement des centaines de pages » : la feuille de route
  propose un petit nombre de pages à forte intention, écrites une par une.
* **Priorité** : **P2** (structurel, pas immédiat)

---

## Ce qui a été délibérément écarté

* **Aucune donnée inventée.** Pas de `AggregateRating`, pas de `Review`, pas de
  nombre d'utilisateurs, pas de témoignage, pas de chiffre de performance.
  Le site n'affiche aucune de ces choses ; les données structurées doivent
  refléter exactement le contenu visible.
* **`sameAs` reste quasi vide.** Un seul profil externe existe réellement
  (Trustpilot). Les cinq icônes sociales du footer ne correspondent à aucun
  compte : elles sont retirées, pas déclarées.
* **Aucune promesse de position.** Aucun élément de ce rapport ne garantit un
  classement. Le SEO technique retire des obstacles ; il n'achète pas de rang.
* **Aucune page-satellite.** Pas de doorway pages, pas de déclinaisons
  automatiques par ville ou par mot-clé.

---

## Rappel de méthode

Les corrections ci-dessous sont appliquées dans cet ordre, et chacune est
couverte par un test d'invariant dans `tests/seo.test.ts` — parce que la
plupart de ces défauts sont **silencieux** : rien ne casse, rien ne lève, la
page s'affiche. C'est exactement pourquoi ils ont pu s'installer.
