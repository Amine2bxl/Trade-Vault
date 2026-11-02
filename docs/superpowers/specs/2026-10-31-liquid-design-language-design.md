# Langage « Liquid » — verre iOS 27 + matière Revolut

Date : 2026-10-31 · Statut : validé (maquettes v1/v2 + retours du propriétaire, §1.1).

## 1. Intention

Le trader doit ouvrir TradeVault et reconnaître la finition d'une app native
premium : la **couche de navigation en verre** d'iOS 27 (Liquid Glass) et la
**lisibilité financière** de Revolut (gros chiffre héros, actions rondes,
listes de transactions, cartes très arrondies). Objectif produit : valeur
perçue, différenciation, rétention (AGENTS.md, go/no-go).

Décisions prises avec le propriétaire du produit :

| Question | Décision |
| --- | --- |
| Portée | Nouveau langage **par défaut**, app + landing + onboarding. Remplace Lucid plat. |
| Où vit le verre | **Couche de navigation uniquement** (sidebar, barre mobile, en-tête collant, segmented, modales/feuilles, menus, ⌘K, toasts). Les cartes de contenu restent opaques. |
| Fond | **Papier peint d'ambiance sobre**, fixe, sans animation. |
| Accent | **Menthe `#31d68a` conservée**. P&L `#61f8ab` / `#f87171` inchangé. |
| Mode clair | **Non**. Sombre uniquement. |

### 1.1 Retours sur maquette (priment sur le reste du document)

| Point | Décision |
| --- | --- |
| Courbe d'equity | On garde **le tracé actuel** (spline `natural`, aire en dégradé 32 → 8 %, plancher rouge pointillé, points de retournement) et on ajoute une **texture fine** (trame de points) dans l'aire. |
| CTA (« Ajouter un trade », « Enregistrer ») | **Rectangles adoucis pleins** (rayon 12 → 16), menthe, **texte blanc** (ombre de lettre conservée pour la lisibilité). Plus de pilule pour les boutons d'action ; plus d'ombre colorée. |
| Barre mobile | **Solide** (plaque opaque 90 % + flou), 5 places, onglet actif sur tuile sombre avec icône menthe, **« + » central** carré adouci menthe plein. |
| Sidebar | Esprit de la **v1** (panneau de verre, entrées en pilule, pilule active claire avec icône menthe), **pliable** (72 px, icônes seules, infobulles). |
| Journal | **Ordre et structure actuels conservés** ; seule la matière change (rayons, plaques, en-tête). |
| Chiffre héros | **44 px** (`--tv-t-display`). |
| Dashboard (retour 2) | **La maquette v1 remplace le Dashboard** et sert de référence de DA : en-tête Rechercher/cloche/+ Trade, pilule de compte, périodes calendaires, actions Trade/Importer/Checklist/Jarvis, courbe + 4 widgets avec `n`, derniers trades + objectif. Sidebar v1 : réglages et boîte de réception en bas, carte utilisateur en pied. |

Hors périmètre : comportement produit, calculs, données, copy de la landing,
zone Trustpilot (`#00b67a`), moteur neuronal de Jarvis, logique des
sélecteurs (`selection.ts`). Le thème garde l'identifiant `lucid` (préférences
stockées, tests) ; seul son rendu change.

## 2. Principes

1. **Le verre flotte, le contenu se pose.** Toute surface qui navigue ou
   s'ouvre par-dessus est en verre ; toute surface qui porte une donnée est une
   plaque opaque. Aucune carte de contenu ne porte `backdrop-filter`.
2. **Concentricité.** Un rayon intérieur = rayon extérieur − marge. Les
   boutons, onglets et badges sont des pilules ; les cartes 22 px ; les
   feuilles 28–32 px.
3. **Un chiffre héros par écran.** Façon Revolut : une valeur énorme, son
   libellé dessous, le reste à l'échelle normale.
4. **Le mouvement répond au doigt.** Pression = `scale(.97)` ; les états actifs
   glissent sur un ressort ; rien ne boucle.
5. **Toujours interdit** : halo ou ombre colorée, `animate-ping`, dégradé sur
   un texte / bouton / carte, verre sur une carte de contenu, fond animé,
   deuxième accent chromatique.

## 3. Fondations (tokens — `src/styles.css`, `:root` = thème par défaut)

### 3.1 Fond et papier peint

| Token | Valeur |
| --- | --- |
| `--tv-bg` / `--tv-bg-rgb` | `#050607` / `5 6 7` (aussi `background` du thème `lucid` dans `themes.ts`) |

`body::before` = papier peint, `position: fixed`, `z-index: -1` :

```css
radial-gradient(60rem 40rem at 88% -8%, rgb(var(--tv-accent-rgb) / .16), transparent 62%),
radial-gradient(48rem 36rem at -6% 104%, rgb(var(--tv-accent-2-rgb) / .08), transparent 60%),
radial-gradient(40rem 30rem at 50% 45%, rgb(255 255 255 / .025), transparent 70%);
```

`body::after` (grille) est supprimé. Les teintes suivent le thème actif.
Masqué à l'impression.

### 3.2 Matériau verre

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--tv-glass-fill` | `rgb(28 30 34 / .52)` | Verre de navigation |
| `--tv-glass-fill-strong` | `rgb(22 24 27 / .82)` | Menus, modales, feuilles (texte dense) |
| `--tv-glass-blur` | `28px` | |
| `--tv-glass-saturate` | `170%` | |
| `--tv-glass-edge` | `rgb(255 255 255 / .10)` | Liseré |
| `--tv-glass-specular` | `inset 0 1px 0 rgb(255 255 255 / .14), inset 0 -1px 0 rgb(255 255 255 / .03)` | Arête spéculaire (1 px, blanche) |
| `--tv-glass-shadow` | `0 16px 48px -20px rgb(0 0 0 / .75)` | Ombre **noire** d'un objet qui flotte |

Classes :

- `.tv-glass` — verre de navigation (sidebar, barre mobile, en-tête collant,
  capsules d'actions, segmented, toasts).
- `.glass-strong` (existante, réaffectée) — verre fort pour modales, menus,
  `SelectionPanel`, ⌘K.
- `.glass`, `.panel`, `.stat-card*` restent **la plaque de contenu opaque**
  (le nom historique ne change pas : ~200 appels).

Replis obligatoires, dans le même bloc CSS :

- `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`
  → fond `--tv-plate-2` opaque.
- `@media (prefers-reduced-transparency: reduce)` → idem.

Budget : au plus ~5 surfaces floutées visibles simultanément (rail, en-tête,
barre mobile, une modale, un menu).

### 3.3 Plaques de contenu (matière Revolut)

| Token | Valeur | Rôle |
| --- | --- | --- |
| `--tv-plate-0` | `#0c0d0f` | Creux : champ, piste, cellule vide |
| `--tv-plate-1` / `-rgb` | `#141517` / `20 21 23` | Carte |
| `--tv-plate-2` | `#1c1d20` | Élément dans une carte |
| `--tv-plate-3` | `#25272a` | Contrôle au repos |
| `--tv-surface-hover` | `#2a2c30` | Survol de ligne |
| `--tv-border` | `rgb(255 255 255 / .06)` | Liseré de carte |
| `--tv-border-strong` | `rgb(255 255 255 / .11)` | Survol, séparateur qui compte |

Le rail ne lit plus `--tv-rail-*` (conservés pour compatibilité, plus
utilisés par la coque).

### 3.4 Rayons (`@theme inline`)

`sm 10 · md 12 · lg 14 · xl 16 · 2xl 22 · 3xl 28 · 4xl 36 · --tv-shell-radius 32`.
Pilules = `rounded-full`.

### 3.5 Typographie

Pile système conservée (`--font-lucid` = SF Pro sur Apple, la police d'iOS) ;
chiffres Inter 800 inchangés ; vitrine en Inter.

| Token | Avant | Après | Rôle |
| --- | --- | --- | --- |
| `--tv-t-display` | 34 | **44** | Chiffre héros |
| `--tv-t-h1` | 26 | **30** | Grand titre de page (Large Title) |
| `--tv-t-h2` | 18 | **20** | Titre de section |
| `--tv-t-h3` | 14 | **15** | Titre de carte |
| `--tv-t-body` | 14 | 14 | |
| `--tv-t-body-sm` | 13 | 13 | |
| `--tv-t-caption` | 12 | 12 | |
| `--tv-t-micro` | 10 | **11** | Libellé, mention (plancher relevé) |

Grand titre : 700, approche −0.025em, interligne 1.1.

### 3.6 Mouvement

| Token | Valeur |
| --- | --- |
| `--tv-spring` | `linear(0, .06 2.4%, .23 5.2%, .5 9.4%, .75 14%, .9 18.8%, .98 24%, 1.02 30%, 1.025 36%, 1.012 46%, 1.002 60%, 1)` sous `@supports (transition-timing-function: linear(0, 1))`, sinon `var(--tv-ease)` |
| `--tv-dur-spring` | `340ms` |
| `--tv-press` | `scale(.97)` |

Plafond app : 300 ms, **360 ms pour les ressorts et feuilles**. Uniquement
`transform` / `opacity`. Tout se coupe sous `prefers-reduced-motion`. Aucune
nouvelle keyframe : les gestes passent par des transitions.

## 4. Coque (`src/app/shell/`)

### 4.1 Sidebar desktop — `Sidebar.tsx` + `.rail*`

- Panneau `.tv-glass` flottant (marges 12 px), rayon `--tv-shell-radius`,
  largeur 232 px dépliée / 72 px pliée (pli : largeur seule, 260 ms).
- Supprimés : dégradé vert, ombres internes multiples, languette à congés
  (`.rail-tab::before/::after`, `--rail-bridge`).
- Entrée au repos : transparente, texte blanc 72 %. Survol : blanc 6 %.
- Entrée active : **pilule de verre claire** (`rgb(255 255 255 / .10)` +
  arête spéculaire), icône accent, texte blanc. C'est la languette existante
  (mesurée en JS) qui glisse désormais sur `--tv-spring`.

### 4.2 Fenêtre de contenu — `.app-frame`

Plus de plaque ni d'ombre : transparente, le contenu se pose sur le papier
peint. `<main>` reste l'unique zone qui défile (structure inchangée).

### 4.3 En-tête de page — `PageHead.tsx`

- **Grand titre** à gauche (`--tv-t-h1`), dérivé de la navigation : libellé
  de la section (ou de la page si elle est hors section). Source unique :
  `PAGE_META` / `SECTION_META`. Les pages qui posaient leur propre titre
  (`PageHeader title=…`) le retirent pour ne pas le doubler.
- Sous le titre : **segmented control de verre** (`SectionTabs`) quand la
  section a plusieurs pages ; le pouce glisse sur `--tv-spring`.
- Actions de page : capsule `.tv-glass` à droite.
- **Repli au défilement** : une sentinelle (`IntersectionObserver` sur
  `<main>`) bascule `data-collapsed` ; l'en-tête devient une barre
  `.tv-glass` collante avec un titre compact (17 px) qui apparaît en fondu ;
  le grand titre s'efface (opacity + translateY). Hauteur réservée : rien ne
  saute.

### 4.4 Barre mobile — `MobileNav.tsx` + `.bottom-nav*`

- Capsule `.tv-glass` flottante (4 onglets), onglet actif = pilule claire qui
  glisse.
- Bouton **« + »** séparé : disque `.tv-glass` de 56 px à droite (comme le
  bouton recherche d'iOS 26), icône accent, pastille de brouillon conservée.
- Le voile dégradé de bas d'écran disparaît (le verre fait le travail).
- Au défilement vers le bas, la capsule se compacte (libellés masqués, scale
  .92) ; elle revient au défilement vers le haut.
- Les bulles flottantes (sous-comptes, Jarvis) prennent la même matière.

### 4.5 Modales, feuilles, menus, ⌘K, toasts

- `Modal` / `Sheet` : `.glass-strong`, rayon 32 (desktop) ; sur mobile,
  **feuille du bas** pleine largeur, rayon 32 en haut, poignée 36×5, entrée
  translateY sur `--tv-spring` ; desktop : `scale-in` existant.
- `SelectionPanel` (géométrie dans `selection.css`) : `.glass-strong`,
  rayon 20, options 44 px. La logique ne change pas.
- `CommandPalette` : panneau façon Spotlight, `.glass-strong`, rayon 28,
  champ 52 px.
- Toasts (`ToastContext`) : capsule `.tv-glass` centrée en bas (au-dessus de
  la barre mobile).

## 5. Primitives (`src/shared/ui/`)

| Primitive | Changement |
| --- | --- |
| `Button` | Rectangles adoucis pleins (rayon `xl`). `primary` menthe **texte blanc** ; `subtle` = plaque `--tv-plate-3` ; `ghost` transparent ; `accent` teinté ; `danger`. Pression `--tv-press`. Hauteur 40 (md) / 34 (sm). |
| **`ActionButton`** (nouveau) | Disque 52 px `--tv-plate-3` + icône, libellé `caption` dessous ; variante `primary` (disque menthe). Rangée d'actions Revolut. Exporté par `index.ts`. |
| `Card` | Rayon 22, padding 20, `CardHeader` titre `h3` 600 + action « Tout voir » (lien accent). |
| `Metric` / `Kpi` | Widget Revolut : rayon 22, libellé au-dessus, chiffre `tv-figure`, tendance en pastille. Géométrie compacte conservée pour le Dashboard. |
| `SubNav` / `SectionTabs` / `PageToolbar` | Segmented iOS : piste `.tv-glass` pilule, pouce clair qui glisse. |
| `Input` / `Field` / pickers (déclencheurs) | Champ plein `--tv-plate-2`, sans bordure au repos, rayon `lg` (14), hauteur 48 (44 en `tv-compact-form`), anneau de focus accent. |
| `SettingsGroup` / `SettingsRow` | Liste groupée iOS : rayon 22, rangées 52 px, séparateurs en retrait. |
| `Badge` / `Chip` | Pilules. |
| `EmptyState` | Icône dans un disque 56 px, titre `h3`, action `Button`. |
| `Table` | Inchangée sur desktop (densité) ; en-têtes `tv-label`, lignes 48 px, survol `--tv-surface-hover`. |

Contrat inchangé : `shared/ui` n'importe jamais `app/` ; aucune dépendance
nouvelle (ni Framer Motion, ni Radix).

## 6. Patrons de pages

- **Dashboard (accueil Revolut)** : pilule de compte (sélecteur existant) →
  chiffre héros P&L de la période (`--tv-t-display`, couleur P&L) + libellé →
  segmented de période → rangée d'`ActionButton` (Ajouter un trade · Importer
  · Checklist · Jarvis, actions déjà existantes) → courbe d'equity (lecture
  au doigt existante) → grille de widgets `Metric` → carte « Trades récents »
  en liste. Aucun calcul nouveau.
- **Journal mobile** : liste façon transactions — pastille ronde de
  l'instrument (initiales), instrument + date/heure, P&L à droite, regroupée
  par jour avec total du jour. Desktop : tableau existant restylé.
- **Toutes les autres pages** : grand titre + segmented + cartes 22 px, en
  remplaçant les styles locaux (rayons, plaques, boutons faits main) par les
  primitives. Aucun changement de comportement, d'ordre ou de contenu.
- **Landing / public** : barre de nav en capsule `.tv-glass` flottante, CTA en
  pilule, cartes 28 px, même papier peint (`.landing-root` garde son émeraude
  verrouillée). Copy inchangée.
- **Onboarding** : même matière (verre fort pour la carte centrale), ses
  gestes cinématiques existants conservés.

États chargement / vide / erreur : squelettes reprennent les nouveaux rayons ;
aucun état supprimé.

## 7. Règles à réécrire

Mettre à jour, dans le même lot que les fondations :

- `AGENTS.md` (puce **Design**) : langage « Liquid » ; verre réservé à la
  couche de navigation ; papier peint statique autorisé ; arête spéculaire
  autorisée ; interdits du §2.5.
- `docs/DESIGN_SYSTEM.md` : §1 (langage), §2 (tokens), §3 (échelle), §4
  (ressort, 360 ms), §5 (`ActionButton`), §6 (en-tête, barre mobile).
- Skills `.claude/skills/theme`, `ui-design`, `motion`, `typography` : mêmes
  lois, mêmes valeurs.
- `docs/CHANGELOG.md` : une entrée par lot.

## 8. Livraison par lots

Une branche (`claude/youthful-ritchie-c7wig6`), une PR draft, un commit (ou
plus) par lot. Chaque lot : `typecheck → lint → build → test` verts,
`TZ=America/New_York bun test` et `TZ=Pacific/Auckland bun test`, plus
contrôle visuel `/dev/ui` (360 px et 1440 px).

| Lot | Contenu |
| --- | --- |
| L1 | Fondations : tokens, papier peint, matériau verre + replis, rayons, échelle typo, ressort ; règles réécrites (§7) |
| L2 | Coque : Sidebar, fenêtre, PageHead (grand titre + repli), SectionTabs, MobileNav + « + », modales/feuilles, SelectionPanel, ⌘K, toasts |
| L3 | Primitives : Button, ActionButton, Card, Metric/Kpi, Input/Field, SettingsGroup, Badge/Chip, EmptyState, Table, SubNav |
| L4 | Dashboard (accueil Revolut) |
| L5 | Journal (+ liste mobile), Calendrier, Setups manqués, TradeModal / TradeDetailSheet |
| L6 | Analyse : Analytics, Erreurs, Rapports, Saisonnalité, Monte Carlo |
| L7 | Préparation : Plan, Objectifs, Actualités, Calculateur, Checklist, Simulateur |
| L8 | Jarvis, Inbox, Réglages/Apparence/Profil, Abonnement, Brokers |
| L9 | Landing, pages publiques, onboarding |

## 9. Tests

- Les tests existants qui lisent les sources (`themeCoverage`, `staticCards`,
  `stackingOrder`, `prixAnime`, `fullScreenPages`, `eagerBundle`,
  `publicSurface`) restent verts **sans affaiblir d'assertion**.
- Nouveau test `tests/liquidGlass.test.ts` (lecture de source) :
  - `:root` contient les tokens verre et le thème `lucid` a le même fond ;
  - chaque règle `backdrop-filter` de `styles.css` est couverte par le repli
    `@supports not` et `prefers-reduced-transparency` ;
  - aucune classe de carte (`.glass`, `.panel`, `.stat-card*`) ne porte
    `backdrop-filter` ;
  - aucune `box-shadow` colorée par l'accent (`--tv-accent-rgb` dans une
    ombre) ;
  - `ActionButton` est exporté par `shared/ui/index.ts`.
- `tests/themeCoverage.test.ts` : étendu si de nouvelles couleurs de marque
  apparaissent (aucune n'est prévue).

## 10. Risques

| Risque | Parade |
| --- | --- |
| Coût GPU du flou sur machines faibles | Verre limité à la coque (~5 surfaces), aucune animation du fond, replis opaques |
| Lisibilité du texte sur verre | Verre fort à 82 % pour menus/modales ; texte dense jamais sur verre léger |
| Mise en page qui saute (titres plus grands, rayons) | Hauteurs réservées, contrôle 360 → 1920 px à chaque lot |
| Tests qui lisent les sources | Suite complète à chaque lot, jamais d'assertion affaiblie |
| Captures produit de la landing (`src/assets/product/`) montrent l'ancien design | Signalé ; à reprendre après L8 (hors code) |
| `backdrop-filter` + `position: sticky` sur Safari ancien | `-webkit-backdrop-filter` systématique, repli opaque |
