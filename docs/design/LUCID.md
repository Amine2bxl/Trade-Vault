# Le langage Lucid — référence visuelle de TradeVault

> Ce document est la **source de vérité esthétique** du produit connecté.
> Il est tiré de captures réelles de Lucid Trading (`docs/design/lucid/`), que
> TradeVault prend pour référence assumée.
>
> Il ne remplace pas [`DESIGN_SYSTEM.md`](../development/DESIGN_SYSTEM.md)
> (tokens, primitives, gouvernance) ni [`UX_RULES.md`](../development/UX_RULES.md)
> (navigation, états). Il dit **à quoi le produit doit ressembler** ; les deux
> autres disent **comment on le construit**.

---

## 1. Ce qu'on copie, et ce qu'on ne copie pas

**On copie la GRAMMAIRE** : le noir profond, le vert menthe unique, les cartes
plates à grand rayon, les libellés en petites capitales espacées, les chiffres
énormes, les segmented controls, le calendrier teinté, la barre flottante.

**On ne copie pas** : le logo, la marque, les textes, les illustrations, le
certificat de payout. Rien de ce qui appartient à Lucid en propre.

**Et surtout, on n'importe pas leur produit.** Lucid est un tableau de bord de
prop firm : il affiche un compte que la firme surveille. TradeVault est le
journal du trader : il affiche ce que le trader a fait et ce que ça lui coûte.
La forme est empruntée, le fond reste le nôtre — la discipline avant le profit.

---

## 2. Le renversement de l'accent

C'est le changement structurant, et il annule une règle qui tenait jusqu'ici.

**Avant** : l'accent du produit était le graphite (`#94a3b8`), neutre, et
`DESIGN.md` posait que « la couleur est rare ». Le vert appartenait à la
**donnée** seule (un gain), jamais au **chrome**.

**Maintenant** : le vert menthe EST l'accent. Bouton principal, onglet actif,
pastille d'état, bouton `+`, anneau de focus. C'est ce qui donne à Lucid sa
signature, et c'est ce qu'on veut.

### La difficulté que cela crée, et comment on la tient

Si le vert dit à la fois « ceci est un gain » et « ceci est un bouton », il ne
dit plus rien. Trois règles rendent les deux verts distinguables :

1. **La donnée n'est jamais un aplat.** Un gain est du TEXTE vert sur fond
   sombre, ou une surface à ~10 % d'opacité. Une action est un **aplat plein**
   avec du texte quasi noir dessus. Plein = ça agit ; texte = ça se lit.
2. **Les deux verts ne sont pas le même vert.** L'accent est plus clair et plus
   saturé (`--tv-accent`) que le vert de la donnée (`--tv-chart-green`). Côte à
   côte, l'écart se voit.
3. **Le P&L ne suit AUCUN thème.** `--tv-chart-green` / `--tv-chart-red` sont
   fixes. Changer de thème repeint l'interface, jamais les chiffres.

---

## 3. La palette

| Rôle | Valeur | Où |
| --- | --- | --- |
| Fond de page | `#07080a` | Le canvas, presque noir |
| Carte | `#131416` | La surface par défaut, **sans liseré visible** |
| Tuile dans une carte | `#1a1c1e` | Les cases de statistiques, les cellules |
| Creux | `#0d0e10` | Piste de barre, champ, cellule vide |
| Accent (action) | `#22e08a` | Bouton, onglet actif, `+`, focus |
| Accent foncé | `#12b981` | Pressé, fin de rampe |
| Accent clair | `#5bf0ab` | Pointe, mot accentué d'un titre |
| Texte principal | `#f2f4f5` | Titres, chiffres |
| Libellé | `#8a9096` | Petites capitales espacées |
| Gain (donnée) | `#34d399` | P&L positif — **ne bouge jamais** |
| Perte (donnée) | `#f87171` | P&L négatif — **ne bouge jamais** |
| Plancher / minimum | `#e8896f` | La ligne en pointillés du graphe |

Le liseré de carte est **quasi invisible** (`rgb(255 255 255 / .05)`), voire
absent : chez Lucid, les cartes se détachent par leur VALEUR, pas par un trait.
C'est plus doux que notre hairline actuel, et c'est ce qu'il faut suivre.

---

## 4. Les pièces

### La tuile de statistique

```
┌─────────────────────────┐
│ ACCOUNT BALANCE         │   ← 11px · 600 · +0.08em · capitales · #8a9096
│ $54,936                 │   ← 24–26px · 800 · tabulaire · blanc (ou vert si P&L)
└─────────────────────────┘
     carte #131416 · rayon 16px · padding 16px
```

Deux par ligne sur téléphone. Le libellé au-dessus, toujours ; jamais à côté.

### La carte de graphe

Légende en haut, **centrée**, avec une pastille ronde par série
(`● Balance ● Minimum`). Axe des valeurs à **droite**. Dates en dessous.
Grille horizontale seulement, à peine visible.

### Le segmented control

Piste `#1a1c1e`, rayon plein. Segment actif : **aplat vert, texte quasi noir**
quand il porte une action (`PNL | Events`), ou plaque `#2a2d30` + texte blanc
quand il ne fait que filtrer (`Active | Breached | All`).

### La cellule de calendrier

```
profit :  fond rgb(vert / .10)   liseré rgb(vert / .35)   chiffre vert
perte  :  fond rgb(rouge / .08)  liseré rgb(rouge / .40)  chiffre rouge
vide   :  fond #131416           aucun liseré             chiffre gris
```

Numéro du jour en haut, montant au centre, pourcentage en dessous en gris.

### La barre de navigation flottante

Une carte détachée du bas de l'écran (`#131416`, rayon 20px), icône + libellé
par onglet, et l'action principale au centre dans un **carré vert à coins
arrondis**. Elle flotte : elle ne touche pas les bords.

---

## 5. Ce qui ne change pas

- **Rien ne rayonne.** Pas d'ombre colorée, pas de halo, pas de dégradé de
  marque. La profondeur reste une affaire de valeur.
- **Les chiffres sont tabulaires**, partout.
- **Le plancher de lisibilité reste 10px**, et 12px pour du texte à lire.
- **`prefers-reduced-motion`** est respecté.
- **Zone gelée Trustpilot** (`#00b67a`) : on n'y touche pas.
