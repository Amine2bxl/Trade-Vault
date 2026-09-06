# GEO_STRATEGY — être compris par les moteurs de réponse

GEO (*Generative Engine Optimization*) et AEO (*Answer Engine Optimization*) :
faire en sorte que ChatGPT, Claude, Perplexity, Gemini et les AI Overviews de
Google puissent décrire TradeVault **correctement** quand on les interroge.

Le SEO classique optimise pour être **classé**. Le GEO optimise pour être
**cité**. Ce n'est pas la même chose, et la différence est très concrète : un
moteur de réponse ne renvoie pas dix liens, il renvoie une phrase. Soit cette
phrase est juste, soit elle est fausse — et il n'y a pas de deuxième position.

---

## Le principe qui commande tout le reste

**Un moteur de réponse ne peut extraire que ce qui est déjà écrit.**

Il ne déduit pas, il ne devine pas, il ne fait pas l'effort de comprendre une
métaphore. Une accroche comme « Trade better. Understand why. » est excellente
pour un humain et illisible pour lui : elle ne contient aucun fait extractible.
La phrase « TradeVault is a trading journal with a built-in AI coach » en
contient trois.

D'où la règle : **chaque affirmation importante doit exister quelque part sous
forme de phrase simple, complète et vérifiable.** Pas à la place de la belle
écriture — à côté d'elle.

---

## Ce qui est déjà en place

### `llms.txt`

`public/llms.txt` est la fiche d'identité machine du produit. Le réflexe existait
déjà dans ce dépôt — c'est rare et c'est bien — mais le contenu avait dérivé : il
était **en français** alors que le site est servi en anglais, ignorait `/cgu`,
et ne mentionnait ni les tarifs réels ni les langues disponibles. Un agent qui le
lisait décrivait donc un produit légèrement faux.

Il a été réécrit d'après les faits vérifiables du dépôt, et structuré pour
l'extraction :

- une phrase de définition en tête, entre `>` ;
- **ce que le produit fait**, en points, chacun autonome ;
- **ce qu'il n'est pas** — section rare et pourtant décisive : elle empêche un
  moteur d'inventer que TradeVault serait un broker, un copy-trader ou un
  fournisseur de signaux ;
- **les tarifs réels**, chiffrés ;
- **les pages publiques**, avec la mention explicite que tout le reste est privé
  et ne doit pas être présenté comme une page publique.

Il est annoncé depuis `robots.txt` — le seul endroit conventionnel où un agent
va chercher les métadonnées d'un site.

### Rendu serveur

La landing est rendue côté serveur (`<ClientOnly fallback={<Landing />}>`). C'est
la condition d'entrée du GEO, et elle est souvent manquée : la plupart des
robots de moteurs IA **n'exécutent pas JavaScript**. Une application entièrement
cliente est, pour eux, une page blanche.

### `FAQPage`

Les quatre questions/réponses visibles de la landing sont désormais balisées,
**construites depuis le même tableau qui les affiche**. C'est le contenu le plus
directement citable du site, et il est maintenant lisible par une machine dans
les deux langues — `/fr` publie la version française du même balisage.

---

## Ce qui reste à faire

Par ordre d'effet.

### 1. Des réponses extractibles au-dessus de la ligne de flottaison

Chaque page de contenu à venir (`CONTENT_ROADMAP.md`) doit ouvrir sur une
**réponse directe de deux à trois phrases**, avant tout développement. Un moteur
de réponse cite presque toujours le premier paragraphe qui répond à la question
du titre.

Motif : `<h1>` = la question telle qu'elle est posée → réponse immédiate →
puis le détail.

### 2. Étendre la FAQ

Quatre questions, c'est peu. Les objections réelles du produit sont plus
nombreuses, et chacune est une requête :

- « Est-ce que TradeVault se connecte à mon broker ? » → non, jamais.
- « Est-ce que l'IA voit mes données ? » → ce qui est transmis, et ce qui ne
  l'est pas.
- « Quelle différence avec un Excel ? »
- « Est-ce que ça marche pour le prop firm ? »

Chaque ajout est automatiquement balisé — le `FAQPage` se construit à partir du
tableau rendu.

### 3. `HowTo` sur les parcours réels

Le produit a des procédures nettes (enregistrer un trade, importer un CSV, poser
une checklist pré-market). Un balisage `HowTo` les rend citables *à condition*
que les étapes soient réellement affichées sur la page. Pas de `HowTo` sur une
page qui ne montre pas les étapes.

### 4. Chiffres et unités explicites

« En moins d'une minute » est extractible ; « rapide » ne l'est pas. Partout où
le produit tient un fait mesurable et **vrai**, l'écrire en chiffres.

---

## Les interdits — et ils sont fermes

- **Ne jamais fabriquer une statistique.** Pas de « 92 % des traders », pas de
  « 5 000 utilisateurs », pas d'étude inventée, pas de citation attribuée à
  quelqu'un. Un moteur de réponse **propage** ce qu'il lit : une invention ici
  devient une affirmation fausse répétée par plusieurs moteurs, attribuée à la
  marque, et pratiquement impossible à rattraper.
- **Ne jamais promettre un résultat de trading.** Ni dans la page, ni dans
  `llms.txt`, ni dans une donnée structurée. C'est faux, et c'est réglementé.
- **Ne jamais mentir sur un concurrent.** Une comparaison n'est légitime que sur
  des faits publics et vérifiables, à la date où on les vérifie.
- **Ne jamais servir aux robots un contenu différent** de celui des visiteurs.
  Le cloaking est détecté, et la sanction est la désindexation.
- **Ne pas confondre GEO et bourrage.** Répéter « trading journal » quinze fois
  ne rend pas la page plus citable — ça la rend moins lisible, et un moteur de
  réponse préfère toujours la source claire.

---

## Comment savoir si ça marche

Il n'existe pas encore de Search Console pour les moteurs de réponse. La mesure
est donc manuelle, et c'est normal :

1. **Interroger les moteurs directement**, une fois par mois, avec les questions
   que poserait un prospect : « quel est le meilleur journal de trading avec une
   IA ? », « TradeVault, c'est quoi ? », « alternatives à Edgewonk ». Noter si
   le produit est cité, et surtout **si ce qui est dit est exact**.
2. **Surveiller les journaux d'accès** pour les agents connus (`GPTBot`,
   `ClaudeBot`, `PerplexityBot`, `Google-Extended`). Ils ne sont pas bloqués :
   `robots.txt` n'autorise que `Allow: /` et interdit `/api/`.
3. **Corriger `llms.txt` dès qu'une réponse est fausse.** C'est le levier le plus
   direct : c'est le seul document du site écrit pour être lu par une machine.

Une réserve honnête pour finir : rien de tout cela ne garantit une citation.
Les moteurs de réponse pondèrent fortement l'autorité externe, que le code ne
produit pas. Ce qui est fait ici retire les obstacles et supprime les
ambiguïtés — c'est la part qui dépend de nous, et c'est toute la part qui en
dépend.
