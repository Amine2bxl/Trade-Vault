# Captures du produit pour la landing

Dépose ici les captures d'écran **réelles** du SaaS. Aucun code à modifier :
`src/app/pages/landing/shots.ts` liste le contenu de ce dossier au moment du
build, et chaque section de la landing bascule d'elle-même du dessin
d'illustration vers la vraie capture dès que le fichier correspondant existe.

## Noms attendus

Le nom du fichier, **sans son extension**, est l'identifiant. Formats acceptés :
`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`.

| Fichier            | Où il apparaît                       | Écran à capturer                       |
| ------------------ | ------------------------------------ | -------------------------------------- |
| `dashboard`        | Héros — la première image de la page | Le tableau de bord, sidebar comprise   |
| `monthly-reports`  | Section « Analytics »                | Analyse → Rapports mensuels            |
| `journal`          | Section « Le produit »               | Le journal de trades                   |
| `analytics`        | Section « Analytics »                | La page Analyses                       |
| `jarvis`           | Section « Jarvis »                   | Une conversation Jarvis                |
| `calendar`         | Section « Le produit »               | Le calendrier                          |
| `mistakes`         | Section « Erreurs »                  | Le plan de correction                  |

Une capture absente n'est pas une erreur : la section garde son illustration.

## Ce qu'une bonne capture demande

- **Plein écran, sidebar comprise.** C'est le produit qu'on montre, pas un
  fragment. Largeur d'export ≥ 2400px pour rester net sur un écran Retina.
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
