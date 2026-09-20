# Captures du produit pour la landing

Dépose ici les captures d'écran **réelles** du SaaS. Aucun code à modifier :
`src/app/pages/landing/shots.ts` liste le contenu de ce dossier au moment du
build, et chaque section de la landing bascule d'elle-même du dessin
d'illustration vers la vraie capture dès que le fichier correspondant existe.

## Noms attendus

Le nom du fichier, **sans son extension**, est l'identifiant. Formats acceptés :
`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`.

| Fichier      | Où il apparaît                       | Écran à capturer                |
| ------------ | ------------------------------------ | ------------------------------- |
| `dashboard`  | Héros — la première image de la page | Le tableau de bord, plein écran |
| `mistakes`   | Visite du produit, rangée 1          | Journal → Erreurs               |
| `jarvis`     | Visite du produit, rangée 2          | Une conversation Jarvis         |
| `analytics`  | Visite du produit, rangée 3          | La page Analyses                |
| `checklist`  | Visite du produit, rangée 4          | Préparation → Checklist         |
| `montecarlo` | Visite du produit, rangée 5          | Analyse → Monte Carlo           |
| `journal`    | Visite du produit, rangée 6          | Le journal de trades            |

Chaque écran a AUSSI une variante `<nom>-m` : le même écran photographié à
390px de large. La vitrine la sert sous 640px via `<picture>`. Sans elle, le
téléphone reçoit la capture de bureau réduite à l'échelle 0,26 — illisible.

Une capture absente n'est pas une erreur : la section garde son illustration.

**Le glob est `eager`** : tout fichier posé ici part dans le bundle, qu'il soit
référencé ou non. Un `.png` intermédiaire oublié dans ce dossier est donc un
fichier publié — `scripts/capture-product.mjs` les efface pour cette raison.

Pas de `monthly-reports` : la fonctionnalité existe, mais le compte vitrine n'a
jamais généré de rapport, et la capture tombe sur l'état vide (neuf boutons
« Generate »). Voir le commentaire dans `scripts/capture-product.mjs`.

## Ce qu'une bonne capture demande

- **Le héros est plein écran, sidebar comprise** : c'est là qu'on montre le
  produit entier. Les rangées de la visite sont recadrées sur le contenu — le
  rail de navigation répété cinq fois ne dit rien de plus, et vole la largeur
  dont le texte a besoin pour rester lisible.
- **Le recadrage horizontal est MESURÉ, pas écrit en dur.** Le script lit la
  boîte du `<main class="app-main">`. Une constante magique avait déjà coûté
  une capture publiée avec les mots tranchés en deux (« ur correction plan »).
- Largeur d'export ≥ 2400px pour rester net sur un écran Retina.
- **Un compte réaliste**, avec assez de trades pour que les graphes soient
  pleins. Les chiffres affichés seront lus comme de vrais chiffres : ils
  doivent l'être.
- **Thème graphite**, celui par défaut du produit — la landing est accordée
  dessus.
- **Aucune donnée personnelle** : ni e-mail, ni nom de compte réel, ni identité
  de courtier dans la barre de titre.

## Pourquoi pas dans `public/`

Un fichier de `public/` est servi tel quel : son absence ne se voit qu'à
l'exécution, sous la forme d'une image cassée en haut de la page d'accueil.
Ici, le bundler sait ce qui existe **avant** de publier — une capture manquante
ne peut donc pas produire un cadre vide, et une capture présente ne peut pas
être ignorée au profit d'un dessin.
