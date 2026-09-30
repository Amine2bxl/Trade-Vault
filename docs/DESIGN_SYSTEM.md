# Design system

Le système visuel existant, tel qu'il est dans le code. Les **lois détaillées**
(à charger avant d'écrire une couleur, une taille, une animation, un
composant, une navigation ou un texte de landing) sont les skills de
[`../.claude/skills/`](../.claude/skills) : `theme`, `typography`, `motion`,
`ui-design`, `ux-navigation`, `landing-copy`, et l'orchestrateur `ship-ui`.

## 1. Le langage Lucid

Référence esthétique assumée : captures de Lucid Trading
([`assets/lucid/`](assets/lucid)). **On copie la grammaire** — noir profond,
un seul vert menthe, cartes plates à grand rayon, libellés en petites capitales
espacées, chiffres énormes et tabulaires, segmented controls, calendrier
teinté, barre mobile flottante — **jamais** le logo, la marque, les textes ni
le produit de Lucid.

**Deux verts qui ne se confondent pas :**
1. L'**accent** (`--tv-accent` `#22e08a`) = une action : aplat plein (bouton,
   onglet actif, `+`, focus) avec texte quasi noir.
2. La **donnée** (`--tv-chart-green` / `--tv-chart-red`) = un résultat : texte
   coloré ou surface à ~10 % d'opacité, jamais un aplat. Le P&L **ne suit aucun
   thème**.
3. Un titre n'est jamais peint en vert (le contre-temps d'une accroche est gris).

**Ce qui ne change jamais** : rien ne rayonne (ni ombre colorée, ni halo, ni
dégradé de marque, ni `animate-ping`) — la profondeur vient de la valeur des
surfaces et d'un liseré quasi invisible ; chiffres tabulaires partout ;
plancher de lisibilité 10 px (12 px pour du texte à lire) ;
`prefers-reduced-motion` respecté ; la zone Trustpilot (`#00b67a`) est gelée.

## 2. Thèmes et tokens

- Thème par défaut : **`lucid`** (`DEFAULT_THEME_ID`, `src/app/utils/themes.ts`).
  Autres thèmes intégrés : `vault`, `graphite`, `steel`, `amber`, `indigo`,
  `jarvis`, plus le studio de thèmes (Réglages → Apparence).
- Le thème actif réécrit la teinte/chroma oklch (`--tv-primary-h/-c`) ; les
  rampes en dérivent. Une couleur **codée en dur** ignore le thème : c'est le
  bug de couleur le plus fréquent (`tests/themeCoverage.test.ts` le traque).
- Le `:root` de `src/styles.css` est le **repli SSR / sans JS** : il doit rester
  identique au thème par défaut. Changer le défaut = changer les deux.
- Stockage par appareil : `tv-themes-v2` (thèmes) et `tv-theme-vars-v2`
  (variables résolues), purgés à la déconnexion.
- Palette `lucid` : fond `#07080a` · carte `--tv-plate-1` `#131416` · tuile
  `--tv-plate-2` `#1a1c1e` · creux `--tv-plate-0` `#0d0e10` · accent `#22e08a`
  (foncé `#12b981`, clair `#5bf0ab`) · texte `#f2f4f5` · liseré
  `rgb(255 255 255 / .05)`.

**Grammaire de surface** : `.glass`, `.glass-strong`, `.panel`, `.stat-card*`
rendent la **même** plaque ; seule la valeur change.

## 3. Typographie

Famille unique **Inter**. Échelle à rôles `--tv-t-*` : `display`, `h1`, `h2`,
`h3`, `body`, `body-sm`, `caption`, `micro`. Chiffres : `.tv-figure`
(tabulaires). Libellés : `.tv-label` (petites capitales espacées). Détail :
skill `typography`.

## 4. Motion

La loi (skill `motion`) autorise huit keyframes — `styles.css` en contient
encore davantage (dette à résorber, sans en ajouter) —, **300 ms maximum dans l'app**, uniquement
`transform` et `opacity`, jamais `transition-property: all`. Pas de Framer
Motion. Reveal au scroll réservé à la landing (GSAP, contenu visible par
défaut). Recharts reste hors du chunk initial (chargé paresseusement).
Détail : skill `motion`.

## 5. Primitives (`src/shared/ui`)

Import unique : `import { … } from "@/shared/ui"`. `shared/ui` n'importe jamais
`app/`.

| Catégorie | Exports |
| --- | --- |
| Typographie | `Display`, `Heading`, `Text`, `Label` |
| Actions | `Button`, `Chip`, `RemovableChip` |
| Saisie | `Input`, `Textarea`, `Select`, `Field`, `DateField`, `TimeField`, `SelectPicker`, `MultiPicker`, `RangePicker`, `ColorPicker` |
| Surfaces | `Card` (+ `CardHeader/Title/Body`), `Modal`, `Sheet`, `PageContainer` |
| Structure de page | `PageHeader`, `SectionHeader`, `SubNav`, `PageToolbar` |
| Données | `Kpi`, `KpiGrid`, `Metric`, `Table` (+ `THead`, `TBody`, `TR`, `TH`, `TD`, `TableScroll`), `Badge`, `EmptyState` |
| Discipline | `StreakCard`, `StreakCalendar` |
| Marque | `BrandWord`, `JarvisMark`, `JarvisOrb`, `CursorOrb` |
| Utilitaires | `cn` (clsx + tailwind-merge), `usePopPlacement` ; jetons dans `tokens.ts` |

Réutiliser avant de restyler. Graphes : `app/trading/chartTheme.ts` +
`EquityChart` ; couleurs P&L via `--tv-chart-green/red`.

## 6. UX

- **Navigation** : source unique `PAGES` / `SECTIONS` (`src/app/types.ts`) →
  `shell/navigation.ts` → Sidebar, barre mobile, palette ⌘K. Six sections dans
  l'ordre d'une séance : Dashboard · Préparation · Journal · Analyse · Coach ·
  Stratégie (+ Réglages).
- **Pages plein écran** (Calendar, Inbox, Jarvis, Journal, Monte Carlo) :
  `hooks/useAvailableHeight`, jamais de défilement de page.
- **États** : chargement par squelette à la géométrie finale ; état vide qui
  guide vers l'action ; erreur honnête (un `PageErrorBoundary` par page).
- **Formulaires** : écriture optimiste, brouillons autosauvegardés
  (`useDraftAutosave`), aucune perte silencieuse.
- **Mobile** : barre flottante, cibles tactiles ≥ 44 px, zéro débordement
  horizontal (vérifié de 360 à 1920 px).

## 7. Landing et marketing

Même langage Lucid que l'app, accent encore plus rare. Structure : Hero →
Problème → Journal → Analyze → Understand → Improve → Produit → Analytics →
Jarvis → Erreurs / cas d'usage → Excel/Notion → Tarifs → CTA.

- **Les captures produit sont le protagoniste** de chaque section
  (« lead every section with a product screenshot »)
  (`src/assets/product/`, règles de nommage dans son README, vérifiées par
  `tests/productShots.test.ts`).
- Pas de dégradé d'ambiance, de halo, de mode clair ; accent jamais en aplat de
  section ni en fond de carte.
- Copy anglaise honnête, courte, concrète ; jamais de promesse de gain, de faux
  témoignage, de logo ou de compteur inventé. Détail : skill `landing-copy` et
  [`PRODUCT.md`](PRODUCT.md).
