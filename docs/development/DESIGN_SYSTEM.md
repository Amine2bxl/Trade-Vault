# TradeVault — Design System

> **Document propriétaire du système visuel** : tokens, primitives
> `src/shared/ui`, typographie, couleur, densité, rayon, motion, gouvernance et
> dette mesurée.
>
> Les règles d'usage (navigation, structure de page, états, accessibilité)
> sont dans [`UX_RULES.md`](UX_RULES.md).
>
> Dernière mesure sur le code : **2026-07-28** (chiffres **mesurés**, pas
> estimés).

---

## 1. Principe

> **Le thème de la landing est l'âme et le squelette visuel du produit.**

Fond deep-navy `#060d16`, glassmorphism, dégradés cyan → teal, polices
**Manrope** (corps) / **Sora** (display), easing signature
`cubic-bezier(0.16, 1, 0.3, 1)`. `src/shared/ui` centralise ce thème.

**Deux règles de gouvernance :**

1. **Une seule source de vérité visuelle** : `src/styles.css` (variables CSS +
   classes utilitaires). `shared/ui/tokens.ts` **pointe vers** ce CSS — il ne
   redéfinit aucune valeur. Conséquence : adopter une primitive ne change
   **aucun pixel**.
2. **Toute nouvelle UI se construit sur `tokens` + les primitives.** On étend le
   système, on ne le contourne pas. Jamais de bouton, d'input, de modale ou de
   carte re-créé à la main.

**Invariant de dépendance** : `shared/ui` n'importe **jamais** `app/` — ce sont
des primitives feuilles, le sens `app → shared` est préservé. Le serveur
n'importe pas ce dossier.

---

## 2. Tokens (`src/shared/ui/tokens.ts`)

### 2.1 Typographie

| Token | Valeur |
| --- | --- |
| `font.body` | Manrope → Inter → système (appliqué à `body`) |
| `font.display` | Sora → Manrope → Inter (via la classe `font-display`) |
| `font.tabularClass` | `tabular-nums` — **obligatoire** pour prix, R, statistiques |

**Échelle à 6 rôles** (`type.*`) — remplace les tailles arbitraires :

| Rôle | Classe | Usage |
| --- | --- | --- |
| `h1` | `text-2xl md:text-[28px] font-bold` | Titre de page |
| `h2` | `text-sm md:text-base font-bold` | Titre de section |
| `h3` | `text-sm font-semibold` | Titre de carte |
| `body` | `text-sm` | Texte courant |
| `caption` | `text-xs` | Légendes, méta |
| `label` | `text-[11px] uppercase tracking-wider font-semibold` | Étiquette compacte — **le plancher** |

**Plancher assumé à 11 px** : TradeVault est un outil de travail dense
(esprit TradingView / Linear), pas un site marketing aéré. 11 px est le
compromis retenu entre densité professionnelle et lisibilité. En dessous
(9 px, 8 px), c'est de la dette — voir §5.

### 2.2 Couleur

Un **seul** système de tokens : les variables TradeVault `--tv-*` (59
occurrences dans `styles.css`) + le bloc `@theme`.

| Token sémantique | Valeur | Rôle |
| --- | --- | --- |
| `color.brand` / `color.brandAlt` | rampes `cyan` / `teal` (régénérées depuis `--tv-primary-*`) | Accent de marque, **themeable à chaud** |
| `color.profit` | `emerald-500` / `--color-profit: #10b981` | Gagné |
| `color.loss` | `red-500` / `--color-loss: #ef4444` | Perdu |
| `color.warning` | `amber-500` | Alerte / tilt |
| `accentVar.accent` / `accentAlt` / `highlight` | `var(--tv-accent)` etc. | Accents pilotés au runtime par le `ThemeProvider` |
| `--color-surface{,-light,-lighter}` | `#0c1222` / `#111827` / `#1e293b` | Fonds |

> **Point d'histoire réglé** : les anciens tokens shadcn en `oklch`
> (`--primary`, `--card`, `--sidebar-*`) hérités du scaffold étaient **morts**
> (zéro usage) et ont été **supprimés**. Il n'existe plus qu'un système de
> tokens — l'ambiguïté « quel token utiliser ? » n'existe plus.

**Sémantique P&L** : profit = emerald, perte = red, warning = amber — via
`Badge` / `Metric` / les tokens. Pas de nouvelle nuance ad hoc.

**Exception légitime** : `#00b67a` (vert Trustpilot) — **zone gelée**.

### 2.3 Surfaces

| Token | Classe / valeur | Usage |
| --- | --- | --- |
| `surface.base` | `#060d16` | Fond de page (html + body) — pas de flash blanc à l'overscroll |
| `surface.glassClass` | `.glass` | Panneau translucide |
| `surface.glassStrongClass` | `.glass-strong` | Opaque (modales, menus) |
| `surface.cardPremiumClass` | `.card-premium` | Carte avec lift au survol |

### 2.4 Rayon

Échelle **redéfinie pour un rendu « terminal de performance »** dans le bloc
`@theme inline` de `styles.css` — resserrer ces trois valeurs retinte toutes les
cartes/héros/boutons **sans toucher un composant** :

`sm 6px` · `md 8px` · `lg 9px` · `xl 10px` · `2xl 12px` · `3xl 16px` · `4xl 20px`

`rounded-xl` (contrôles), `2xl` (cartes) et `3xl` (panneaux) dominent l'usage.

### 2.5 Densité

Contrat d'espacement (`density.*`) — **les seuls pas de padding qu'un écran doit
utiliser**. `Card`, `PageContainer` et `PageHeader` les consomment, donc la
densité évolue en un seul endroit.

| Token | Valeur |
| --- | --- |
| `cardPad` | `p-4 md:p-5` |
| `cardPadTight` | `p-3.5` (lignes de liste, tuiles compactes) |
| `cardPadLoose` | `p-5 md:p-6` (surfaces héros) |
| `pagePad` | `p-4 md:p-6` |
| `sectionGap` | `mb-4 md:mb-5` |
| `gridGap` | `gap-4` |

### 2.6 Motion

| Token | Usage |
| --- | --- |
| `motion.easing` | `cubic-bezier(0.16, 1, 0.3, 1)` — **l'easing signature**, pour tout ce qui est inline/JS |
| `motion.fadeInUp` / `fadeIn` | Entrée de page et de bloc |
| `motion.slideIn` | Entrée de modale / menu (scale-in) |
| `motion.slideUp` | Bottom-sheet mobile |
| `motion.glow` | Accent animé |

`prefers-reduced-motion` est respecté (`CursorGlow`, orbes d'ambiance) — **règle
à conserver systématiquement**.

---

## 3. Primitives (`src/shared/ui`)

Import unique : `import { Button, Card, Modal, … } from "@/shared/ui";`

| Catégorie | Exports | Ce qu'elle encapsule |
| --- | --- | --- |
| **Typographie** | `Display`, `Heading` (niveaux 1–3), `Text`, `Label` | L'échelle à rôles ; `as` change l'élément sans perdre le rôle |
| **Boutons** | `Button` (`variant`: primary/ghost/subtle/danger · `size`: md/sm) | `primary`/`ghost` réutilisent **verbatim** `.btn-primary`/`.btn-ghost` (rendu identique) ; `subtle`/`danger` nomment des patterns inline récurrents |
| **Formulaires** | `Input`, `Textarea`, `Select`, `Field`, `FIELD_BASE` | La chaîne `fieldBase` canonique, dédupliquée de 4 fichiers |
| **Surfaces** | `Card` (glass / glass-strong / plain · `hover` · `pad`), `CardHeader`, `CardTitle`, `CardBody` | `.glass`, `.glass-strong`, `.card-premium` + l'échelle de densité |
| **Tables** | `Table`, `THead`, `TBody`, `TR`, `TH`, `TD`, `TableScroll` | Le pattern Journal/Analytics, avec conteneur scrollable |
| **Modales** | `Modal` (`open`, `onClose`, `size`, `labelledBy`) | Bottom-sheet mobile → centrée desktop, backdrop flouté, panneau `glass-strong` — **plus `Esc`, scroll-lock, `role="dialog"` + `aria-modal`**, que les copies hand-rolled oubliaient |
| **Badges & chips** | `Badge` (neutral/profit/loss/warning/accent), `Chip`, `RemovableChip` | Teintes sémantiques déjà en usage |
| **Structure de page** | `PageContainer`, `PageHeader` (title/subtitle/eyebrow/icon/actions), `SectionHeader` | Le h1 dégradé + sous-titre dupliqué sur ~15 pages |
| **États vides** | `EmptyState` (icon/title/description/action) | Le bloc `glass rounded-2xl p-10 text-center` |
| **KPI** | `Metric` (label / grand chiffre tabulaire / sous-titre · `trend` · `visual` radial ou sparkline · `footer`) | La tuile KPI unique du produit |
| **Charts** | `ChartContainer` + re-exports Recharts | Thème dans `app/utils/chartTheme.ts` |
| **Utilitaire** | `cn` (clsx + tailwind-merge) | `className` de l'appelant fusionné **en dernier** → l'override gagne toujours |

**Aucune dépendance UI tierce** : ni Radix, ni shadcn runtime. Les primitives
sont maison, ce qui garantit qu'elles reflètent exactement le CSS du produit.

---

## 4. Adoption — état mesuré

| Indicateur | Mesure (2026-07-28) |
| --- | --- |
| Fichiers de `src/app` important `@/shared/ui` | **28 / 56 fichiers `.tsx`** |
| Pages adoptées | Analytics, Appearance, CalendarPage, Checklist, ChecklistWizard, Dashboard, EconomicNews, Goals, Jarvis, Journal, LotSizeCalculator, MissedOpportunities, Mistakes, Profile, Reports, Seasonality, Settings, Subscription, TradingPlan |
| Composants adoptés | AccountSwitcher, ErrorScreen, ImportCsvModal, MissedSetupDetailModal, PageErrorBoundary, PushOnboardingBanner, SubscriptionSection, TradeModal, TradingRulesSection |
| Non adoptés | `Landing` (thème propre, `.landing-root`), `Sidebar`, `MobileNav`, `CommandPalette`, `AiAssistant`, `TradeDetailModal`, `EquityChart`, `Onboarding`, `Skeleton`, Trustpilot (**gelé**) |

> ⚠️ Le `README.md` de `src/shared/ui` affirmait que les primitives n'étaient
> « adoptées nulle part » : **c'est faux depuis plusieurs lots**. Corrigé dans
> cette passe.

---

## 5. Dette mesurée

| Dette | Mesure | Gravité | Décision |
| --- | --- | --- | --- |
| **Tailles de police arbitraires** | **413** occurrences `text-[Npx]` : 178× `10px`, 172× `11px`, 32× `13px`, 14× `9px`, 7× `12px`, 5× `8px`, 5× `15px` | 🔴 | Migrer vers les rôles `type.*`. **Priorité absolue aux 19 occurrences sous 10 px** (9/8 px = illisible mobile) |
| **Couleur P&L en dur** | **216** `emerald-*` + **228** `red-*` en direct dans le JSX | 🟠 | Router progressivement via `Badge`/`Metric`/tokens. Mécanique, faible risque |
| **Hex en dur dans le JSX** | 17× `#ef4444`, 17× `#475569`, 14× `#f59e0b`, 12× `#22d3ee`, 11× `#10b981`, 10× `#64748b`, 10× `#0a0f1e`, 6× `#060d16`… | 🟠 | Remplacer par les tokens correspondants (exception : `#00b67a` Trustpilot, gelé) |
| **Adoption partielle** | 28/56 fichiers | 🟡 | Par lots, à l'occasion des écrans touchés — jamais de big-bang |
| **`.landing-root` parallèle** | Surcharge locale de `font-display` et du thème | 🟡 | Assumé : la landing est une surface marketing distincte. À surveiller pour éviter la divergence de titrage |

**Résolu depuis le diagnostic initial** : les tokens shadcn `oklch` morts ont été
supprimés ; le doublon `.btn-ghost` a été dédupliqué ; les primitives `Modal`,
`Button`, `Field`, `PageHeader`, `EmptyState`, `Metric` existent et sont
adoptées ; `cn` est dédupliqué.

---

## 6. Règles de contribution

**Definition of done d'une UI** — une nouvelle vue n'utilise que :

1. les **rôles typographiques** (`type.*` ou les composants `Typography`) ;
2. les **tokens sémantiques** (couleur, surface, densité, motion) ;
3. les **primitives** `shared/ui`.

**Interdits** (à faire respecter en revue, à terme par lint) :

- une couleur hex en dur dans le JSX ;
- une taille `text-[Npx]` arbitraire ;
- une modale sans la primitive `Modal` ;
- un bouton, un input ou une carte re-créé à la main ;
- une valeur de padding hors de l'échelle `density`.

**Ajouter un token** : suivre le commentaire d'en-tête de `styles.css`
(`:root` + `@theme` / `@theme inline`) — le patron est propre, le conserver.

**Migration de l'existant** : **par lots, non destructifs, byte-identical
d'abord**. Un lot = un build vert + une vérification visuelle. Aucun changement
de comportement produit, jamais.

**Zone gelée** : ne pas router les composants Trustpilot via ces primitives, ne
pas toucher `#00b67a` — de vrais avis clients sont en production.
