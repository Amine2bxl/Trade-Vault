---
name: typography
description: Loi typographique de TradeVault — famille Inter unique, échelle `--tv-t-*` à 8 rôles, chiffres tabulaires `.tv-figure`, libellés `.tv-label`, plancher de lisibilité, titrage marketing vs titrage produit. À charger avant d'écrire une taille de texte, un titre, un libellé, un chiffre ou une graisse. Se déclenche sur : police, font, typo, taille de texte, titre, h1, h2, libellé, label, chiffre, nombre, graisse, tracking, interlignage, lisibilité.
---

# Typographie — une seule voix

## Une famille, pas deux

**Inter** porte tout : corps ET display. `--font-display` existe mais pointe sur
Inter — la hiérarchie vient de la **taille, de la graisse et de l'approche**,
jamais d'une deuxième famille. `Roboto Mono` (`--font-mono`) est réservé aux
rares données techniques (codes, identifiants).

Ne jamais introduire une police d'affichage « pour le caractère ». Le produit
affiche des chiffres : sa personnalité vient de la densité et de l'alignement.

## L'échelle (tokens `--tv-t-*`)

| Token | Taille | Rôle |
| --- | --- | --- |
| `--tv-t-display` | 34px | Le chiffre héros, le titre de page marketing |
| `--tv-t-h1` | 26px | Titre de page |
| `--tv-t-h2` | 18px | Titre de section |
| `--tv-t-h3` | 14px | Titre de carte |
| `--tv-t-body` | 14px | Texte courant |
| `--tv-t-body-sm` | 13px | Texte dense (ligne de tableau) |
| `--tv-t-caption` | 12px | Légende — `.tv-prose` |
| `--tv-t-micro` | 10px | Mention, libellé — `.tv-hint`, `.tv-label` |

**Plancher assumé : 10px**, et uniquement pour un libellé en capitales ou une
mention. Rien sous 10px. Du texte réel à lire : 12px minimum.

> Dette connue : ~413 `text-[Npx]` arbitraires subsistent dans `src/app`. On
> n'en ajoute pas un de plus ; on migre ceux qu'on croise.

## Les trois classes qui font le style du produit

### `.tv-figure` — le chiffre

```
font-variant-numeric: tabular-nums; font-weight: 800; letter-spacing: -0.02em;
```

**Obligatoire** sur tout prix, P&L, R-multiple, pourcentage, statistique. Le
tabulaire donne à chaque chiffre la même largeur : une colonne de montants
reste alignée, et un total qui passe de 999 à 1 000 ne fait plus glisser sa
ligne. La classe ne fixe **pas** de couleur — la teinte porte le signe.

### `.tv-label` — le libellé

```
10px / 600 / uppercase / letter-spacing: .05em
```

Un libellé **nomme la case**, il ne fait pas une phrase. Il doit pouvoir être
ignoré une fois qu'on sait ce qu'il contient. Sourd par défaut (`text-slate-500`),
mais la couleur reste au point d'appel pour laisser passer un état.

`.tv-label-wide` (`.2em`) est la variante posée **sous un grand chiffre** : sous
un nombre de 34px+, un libellé serré se lit comme une rature.

### `.tv-prose` — le paragraphe compact

`12px / 1.6`. Le texte de carte, la réponse de Jarvis, la légende longue.

## Hiérarchie : trois niveaux visibles, pas cinq

Sur un écran, on doit distinguer d'un coup d'œil : **le chiffre**, **son
libellé**, **le reste**. Si un bloc a un titre, un sous-titre, une étiquette,
une valeur et une note, quelque chose doit disparaître.

Graisses utiles : `400` (corps), `600` (titre de carte, libellé), `700`
(titre de section), `800` (chiffre). Pas de `500` décoratif, pas de faux-gras.

## Titrage marketing (landing uniquement)

La landing a le droit à des tailles hors échelle produit, via `clamp()` :

```tsx
// H1
className="font-display text-[clamp(2.6rem,5.2vw,4.4rem)] font-semibold
           leading-[1.04] tracking-[-0.035em]"
// H2 de section
className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold
           leading-[1.1] tracking-[-0.03em]"
```

Deux règles qui ne se négocient pas :

1. **L'approche est négative et proportionnelle à la taille.** ~-3.5% à 70px,
   ~-3% à 40px, 0 au corps. Un gros titre en approche normale fait amateur.
2. **`font-semibold` (600), pas `bold` (700), sur les grandes tailles.** Le 700
   à 70px sur fond noir bave. Le 700 reste pour les titres ≤ 20px.

L'accent d'un titre se fait sur **un fragment**, avec `.text-accent`
(`--tv-highlight`) ou `text-slate-500` pour le contre-temps — jamais sur la
phrase entière.

## Longueur de ligne

- Paragraphe marketing : `max-w-[540px]` sous un H1, `max-w-2xl` centré sous un
  H2. Au-delà de ~70 caractères, l'œil perd la ligne suivante.
- Texte de carte : la carte fait la mesure, mais pas plus de 3 lignes de 13px
  sans respiration.

## Checklist

- [ ] Aucune nouvelle taille arbitraire hors `--tv-t-*` (landing exceptée).
- [ ] Tout chiffre porte `.tv-figure` ou `tabular-nums`.
- [ ] Tout libellé porte `.tv-label`, sourd, sans point final.
- [ ] Rien sous 10px ; pas de texte à lire sous 12px.
- [ ] Grands titres : `600` + approche négative + `leading` serré (1.04–1.1).
- [ ] Paragraphes bornés en largeur.
