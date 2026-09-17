---
name: ui-design
description: Construire une interface TradeVault — primitives `src/shared/ui`, grammaire de surfaces, densité et espacement, anatomie d'une carte/KPI/tableau/modale, composition d'une section marketing. À charger avant de créer ou restyler un composant, une carte, un bouton, un formulaire, une modale, une grille ou une section de page. Se déclenche sur : composant, carte, bouton, modale, formulaire, grille, layout, espacement, padding, design, UI, refonte visuelle, bento, section.
---

# UI — on étend le système, on ne le contourne pas

Compagnons obligatoires : **theme** (couleur/surface) et **typography**
(texte/chiffre). Cette skill traite de la **forme et de l'assemblage**.

## Règle n°1 : rien ne se recrée à la main

`src/shared/ui` existe et est adopté par ~28 fichiers. Import unique :

```tsx
import { Button, Card, Modal, Metric, Field, Badge, EmptyState } from "@/shared/ui";
```

| Besoin | Primitive | Ne jamais |
| --- | --- | --- |
| Bouton | `Button` (`primary`/`ghost`/`subtle`/`danger` · `md`/`sm`) | Écrire un `<button className="bg-…">` |
| Carte | `Card` + `CardHeader`/`CardTitle`/`CardBody` | Recomposer `glass rounded-2xl p-5` |
| Modale | `Modal` (`Esc`, scroll-lock, `role="dialog"`, `aria-modal`) | Une `div` en `fixed inset-0` |
| Champ | `Field` + `Input`/`Textarea`/`Select` | Recopier la chaîne `fieldBase` |
| KPI | `Metric` (label · chiffre tabulaire · trend · visual · footer) | Rebâtir une tuile |
| Tableau | `Table`/`THead`/`TBody`/`TR`/`TH`/`TD`/`TableScroll` | Une grille CSS à la main |
| État vide | `EmptyState` (icon/title/description/action) | Un « Aucune donnée » nu |
| Titre de page | `PageContainer` + `PageHeader` | Un `<h1>` local |

Il manque une primitive ? On l'**ajoute** à `shared/ui` (feuille : elle
n'importe jamais `app/`), on ne fabrique pas une variante locale.

## Grammaire de surface

Une seule plaque, trois usages. La profondeur = **valeur + liseré** (voir
skill `theme`).

```css
.lp-card   { border: 1px solid var(--tv-border); border-radius: 12px; background: var(--tv-plate-1); }
.lp-panel  { border: 1px solid var(--tv-border); border-radius: 16px; background: var(--tv-plate-1); }
.lp-card-inset { border: 1px solid var(--tv-border); border-radius: 8px; background: var(--tv-plate-2); }
```

Au survol d'une carte cliquable : **le liseré passe à `--tv-border-strong`**.
Pas de `translateY`, pas de `scale`, pas d'ombre qui grandit.

## Densité — les seuls pas autorisés

| Token | Valeur | Usage |
| --- | --- | --- |
| `cardPad` | `p-4 md:p-5` | Carte standard |
| `cardPadTight` | `p-3.5` | Ligne de liste, tuile compacte |
| `cardPadLoose` | `p-5 md:p-6` | Surface héros |
| `pagePad` | `p-4 md:p-6` | Page |
| `sectionGap` | `mb-4 md:mb-5` | Entre deux blocs |
| `gridGap` | `gap-4` | Grille |

Marketing (landing) : section `py-14 lg:py-20` (`lg:py-24` pour une section
majeure), conteneur `max-w-1200px` + `px-5 lg:px-8`, gouttière de grille
`gap-4` pour des cartes, `gap-12 lg:gap-16` pour un duo texte/visuel.

Un padding hors de ces échelles doit se justifier en revue.

## Anatomie d'une carte qui marche

```
[ vignette d'icône 40–44px : .feat-icon, plaque sourde + liseré, icône accent ]
[ titre — 14–16px / 700 / blanc ]
[ description — 13px / 1.6 / slate-400, 2 lignes max ]
[ (option) la PREUVE : un chiffre, une barre, une mini-courbe ]
```

La preuve est ce qui sépare une carte de fonctionnalité d'une carte de
brochure. Une carte qui n'affiche que du texte a rarement sa place.

## Anatomie d'une section marketing

```
1. Titre — deux temps, dont un accentué (.text-accent ou text-slate-500)
2. Sous-titre — une phrase, max-w-2xl, centré si le titre l'est
3. La PREUVE — capture produit, panneau de données, ou grille de cartes
4. (option) un CTA, et seulement s'il ajoute quelque chose
```

`SectionHead` fait 1+2. Ne pas remettre d'estampille (« eyebrow ») au-dessus
d'un titre : elle a été retirée du produit, le titre porte seul.

**Le visuel produit est le protagoniste.** Une capture réelle passe toujours
devant une illustration (`ShotOuVisuel` bascule automatiquement dès que le
fichier est déposé dans `src/assets/product/`). À défaut, un panneau de données
vraisemblable — jamais une image d'illustration générique.

## Responsive

- Grilles : `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` — 3 → 2 → 1.
- Duo texte/visuel : `lg:grid-cols-2`, et sur mobile on **ordonne** avec
  `order-1 / order-2` pour que le texte arrive avant son panneau.
- Bento : `lg:grid-cols-6` avec des `col-span-3 / col-span-2`, et
  `col-span-full` en dessous de `sm`.
- Cible tactile ≥ 44px. Un lien de 13px dans un pied de page porte
  `-my-2 inline-flex min-h-[36px] items-center`.
- Tester à 360px de large. Une comparaison à 4 colonnes doit **rester** une
  comparaison à 360px (réduire la taille, pas masquer les colonnes).

## Interdits (à faire respecter en revue)

- Une couleur hex dans le JSX.
- Une taille `text-[Npx]` arbitraire hors landing.
- Une modale, un bouton, un input ou une carte re-créés à la main.
- Un padding hors de l'échelle de densité.
- Une ombre portée sur une carte, un dégradé de marque, un halo.
- Une dépendance UI tierce (ni Radix, ni shadcn runtime).

## Checklist avant de livrer un écran

- [ ] Les primitives existantes sont utilisées ; aucune n'est dupliquée.
- [ ] Trois niveaux de hiérarchie visibles, pas cinq.
- [ ] Chaque carte porte une preuve, pas seulement une promesse.
- [ ] États couverts : chargement (skeleton de la hauteur finale), vide, erreur.
- [ ] 360px vérifié, 44px de cible tactile, focus visible partout.
- [ ] `bun run typecheck && bun run lint && bun run build && bun test` au vert.
