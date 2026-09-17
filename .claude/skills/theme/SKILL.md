---
name: theme
description: Loi de la couleur et des surfaces de TradeVault — tokens `--tv-*`, fond, plaques, liserés, accent rare, sémantique P&L, moteur de thème oklch. À charger avant d'écrire une couleur, un fond, une bordure, une ombre ou un état actif, avant d'ajouter un token, et avant toute modification de `src/styles.css` ou de `src/app/utils/themes.ts`. Se déclenche sur : couleur, fond, background, bordure, hex, accent, thème, dark mode, surface, carte, plaque, contraste.
---

# Thème — la couleur est rare

## La règle qui explique toutes les autres

> **« Rien ne rayonne. La profondeur vient de la VALEUR et du LISERÉ, jamais de
> la lumière. »**

Sur fond `#07090a`, une lueur est un défaut de rendu. Une carte n'est pas « au
dessus » parce qu'elle brille : elle est plus claire d'un cran et porte un
liseré d'un pixel. C'est tout le vocabulaire de profondeur du produit.

**Interdits absolus** : `box-shadow` coloré, `blur` décoratif, halo, `glow`,
`animate-ping`, dégradé de marque, deuxième accent chromatique.

## Les tokens (source unique : `src/styles.css`)

Aucune valeur ci-dessous ne se recopie dans le JSX. On écrit
`var(--tv-plate-1)`, jamais `#16191c`.

### Fond et plaques — l'échelle de profondeur

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--tv-bg` | `#07090a` | Fond de page (html + body) |
| `--tv-plate-0` | `#0c0e10` | Creux : champ, piste de barre, cellule vide |
| `--tv-plate-1` | `#16191c` | **La carte par défaut** |
| `--tv-plate-2` | `#1d2125` | Élément posé DANS une carte, carte mise en avant |
| `--tv-plate-3` | `#23282d` | Troisième niveau — rare, à justifier |
| `--tv-surface-hover` | `#282d33` | Survol d'une ligne cliquable |

On ne saute pas un cran. Une plaque 2 vit dans une plaque 1, pas sur le fond.

### Liserés

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--tv-border` | `rgb(255 255 255 / .08)` | Le liseré par défaut |
| `--tv-border-strong` | `rgb(255 255 255 / .14)` | Survol, séparateur qui compte |
| `--tv-border-accent` | `rgb(var(--tv-accent-rgb) / .35)` | Élément sélectionné/actif |

### Texte

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--tv-text-primary` | `#f4f5f6` | Titre, chiffre, ce qu'on lit |
| `--tv-text-secondary` | `#9ba1a6` | Corps de texte secondaire |
| `--tv-text-muted` | `#8f959b` | Mention, méta, placeholder |

La rampe `slate-*` de Tailwind a été **neutralisée et remontée** dans
`styles.css` pour tenir 4.5:1 sur le fond produit. `text-slate-400/500/600`
sont donc légitimes et contrastés — ne pas les « corriger » vers des valeurs
Tailwind d'origine.

### Accent — la couleur qui agit

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--tv-accent` | `#94a3b8` (graphite par défaut) | Accent de marque, themeable à chaud |
| `--tv-highlight` | `#cbd5e1` | Le cran clair : mot accentué d'un titre, icône active |
| `--tv-cta` / `-hover` / `-active` | oklch dérivé | **La seule surface pleinement colorée** |
| `.tv-accent-fill` | `--tv-cta` + texte blanc | Bouton primaire, pastille active, vignette d'icône qui compte |

L'accent ne remplit **jamais** un fond de section ni une carte. Il vit sur :
la marque, le CTA primaire, l'anneau de focus, le lien, l'état actif. Si un
écran a trois accents visibles, deux sont de trop.

### Sémantique — la donnée garde sa couleur

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--tv-chart-green` | `#34d399` | Gagné — **ne bouge avec aucun thème** |
| `--tv-chart-red` | `#f87171` | Perdu — idem |
| `--tv-success` / `--tv-warning` / `--tv-danger` | `#10b981` / `#f59e0b` / `#ef4444` | États d'interface |

`text-emerald-400` et `text-red-400` sont **branchés sur ces deux tokens** dans
`@theme` : ils ne peuvent plus diverger. Les utiliser est correct.

Le vert P&L (donnée) et le vert CTA (action) sont deux choses différentes.
Ne jamais peindre un P&L avec `--tv-cta`, ni un bouton avec `--tv-chart-green`.

### Rayon

`sm 8` · `md 10` · `lg 12` · `xl 14` · `2xl 18` · `3xl 24` · `4xl 32` ·
`--tv-shell-radius 28`

`rounded-xl` (contrôles) · `rounded-2xl` (cartes) · `rounded-3xl` (panneaux)
dominent. Élargir ces trois crans réarrondit tout le produit sans toucher un
composant — c'est voulu, ne pas court-circuiter avec `rounded-[13px]`.

### Élévation

`--tv-elev-1: none`. Oui, `none`. `elev-2` et `elev-3` sont des ombres
**noires et larges** réservées aux éléments qui flottent réellement (modale,
menu). Une carte ne porte aucune ombre.

## Le moteur de thème

`src/app/utils/themes.ts` — `DEFAULT_THEME_ID = "graphite"`. Le thème actif
réécrit `--tv-primary-h/-c` (teinte/chroma oklch) et les rampes en dérivent.
Conséquences pratiques :

- Une couleur **codée en dur** dans le JSX ignore le thème de l'utilisateur.
  C'est le bug de couleur le plus fréquent du produit.
- Le `:root` de `styles.css` est le **repli SSR/no-JS** : il doit rester
  synchrone avec graphite. Changer le thème par défaut = changer les deux.
- Stockage par appareil : `tv-themes-v2` + `tv-theme-vars-v2`, purgés à la
  déconnexion (`session-purge.ts`).

## Zone gelée

Trustpilot : `#00b67a` et ses composants. De vrais avis sont en production.
**Ne pas toucher, ne pas router via les primitives, ne pas retinter.**

## Checklist avant de livrer une couleur

- [ ] Zéro hex dans le JSX — un `var(--tv-*)` ou un utilitaire Tailwind mappé.
- [ ] La profondeur vient d'un cran de plaque + un liseré, pas d'une ombre.
- [ ] L'accent n'apparaît que sur action / focus / état actif / marque.
- [ ] Le P&L est vert/rouge données, indépendant du thème.
- [ ] Testé sur au moins deux thèmes (graphite + un coloré) : rien ne « sort ».
- [ ] Contraste du texte réel ≥ 4.5:1 sur sa plaque.
