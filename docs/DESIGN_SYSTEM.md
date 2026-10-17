# Design system

Le système visuel existant, tel qu'il est dans le code. Les **lois détaillées**
(à charger avant d'écrire une couleur, une taille, une animation, un
composant, une navigation ou un texte de landing) sont les skills de
[`../.claude/skills/`](../.claude/skills) : `theme`, `typography`, `motion`,
`ui-design`, `ux-navigation`, `landing-copy`, et l'orchestrateur `ship-ui`.

## 1. Le langage Lucid — le calendrier comme référence

Référence esthétique assumée : captures de Lucid Trading
([`assets/lucid/`](assets/lucid)). **On copie la grammaire** — noir profond,
un seul vert menthe, cartes plates à grand rayon, libellés en petites capitales
espacées, chiffres énormes et tabulaires, segmented controls, calendrier
teinté, barre mobile flottante — **jamais** le logo, la marque, les textes ni
le produit de Lucid.

La page Calendrier (`features/calendar/CalendarPage.tsx`) est la référence de
composition de **toute l'app connectée** : plaques plates, cases compactes,
liserés discrets, titres de panneau à 14 px, chiffres tabulaires. Les anciens
jetons `--tv-relief-*` restent compatibles mais ne peignent plus de relief.
L'élévation est réservée aux modales et menus ; une carte de graphique ou de
statistique ne change plus de fond au survol.

`PageContainer` porte les marges communes (`px-3 py-2 md:px-5 md:py-3`) et le
maximum de 1200 px (1400 px pour le calendrier), y compris pour les pages à hauteur mesurée (ref transmise
directement). Une page de lecture ou de réglages peut garder une largeur plus
étroite. La disposition reste propre à l'usage : courbe dominante au Dashboard,
tableau sur ordinateur et cartes à deux rangées sur mobile dans le Journal
(instrument et P&L au-dessus, contexte et actions dessous), colonnes de saisie
dans le Calculateur, conversation
plein cadre dans Jarvis. Les navigations segmentées et barres d'outils partagent
les angles adoucis du calendrier. La checklist utilise le même fond calme,
sans champ de particules ni flash plein écran.

**Deux verts qui ne se confondent pas :**
1. L'**accent** (`--tv-accent` `#31d68a`, relevé pixel par pixel sur le
   tableau de bord Lucid) = une action : aplat plein (bouton,
   onglet actif, `+`, focus) avec texte quasi noir.
2. La **donnée** (`--tv-chart-green` `#61f8ab` / `--tv-chart-red`) = un résultat : texte
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
  `--tv-plate-2` `#1a1c1e` · creux `--tv-plate-0` `#0d0e10` · accent `#31d68a`
  (foncé `#1fb574`, clair `#6be3a8`) · P&L `--tv-chart-green` `#61f8ab` /
  `--tv-chart-red` `#f87171`. La vitrine garde son émeraude verrouillée
  (`#22e08a`, `.landing-root`) · texte `#f2f4f5` · liseré
  `rgb(255 255 255 / .05)`.

**Grammaire de surface** : `.glass`, `.glass-strong`, `.panel`, `.stat-card*`
rendent la **même** plaque ; seule la valeur change.

## 3. Typographie

**Deux voix, une par surface.** L'app connectée écrit dans la police de Lucid
— la **pile système** `--font-lucid` (SF Pro sur Apple, Segoe UI sous Windows,
Roboto sous Android), relevée sur leurs captures, sans police web à charger ;
`body.tv-app-type` (posé par `shell/App.tsx`) l'applique, modales comprises.
La vitrine, les pages légales et la démo gardent **Inter**. `.tv-figure`
(chiffres, P&L) et `.tv-label` (petites capitales grasses espacées) portent
**Inter ExtraBold** via `--font-figure`, conformément à la référence fournie et
de façon identique sur tous les appareils. Échelle à rôles `--tv-t-*` : `display`, `h1`, `h2`,
`h3`, `body`, `body-sm`, `caption`, `micro`. Chiffres : `.tv-figure`
(tabulaires). Libellés : `.tv-label` (petites capitales espacées). Détail :
skill `typography`.

## 4. Motion

La loi (skill `motion`) autorise huit keyframes — `styles.css` en contient
encore davantage (dette à résorber, sans en ajouter) —, **300 ms maximum dans l'app**, uniquement
`transform` et `opacity`, jamais `transition-property: all`. Pas de Framer
Motion. Reveal au scroll réservé à la landing (GSAP, contenu visible par
défaut). Recharts reste hors du chunk initial (chargé paresseusement).
Effet compteur de Lucid : `RollingFigure` (`shared/ui`) fait rouler un chiffre
qui change — tuiles `Metric`/`Kpi`, P&L du tableau de bord — avec les
keyframes du prix animé (`prix-entre`/`prix-sort`), aucune nouvelle keyframe.
Le rail se plie en 260 ms : seule sa largeur s'anime, les icônes ne bougent
pas, les libellés s'effacent en fondu. Détail : skill `motion`.

## 5. Primitives (`src/shared/ui`)

Import unique : `import { … } from "@/shared/ui"`. `shared/ui` n'importe jamais
`app/`.

| Catégorie | Exports |
| --- | --- |
| Typographie | `Display`, `Heading`, `Text`, `Label` |
| Actions | `Button`, `Chip`, `RemovableChip` |
| Saisie | `Input`, `Textarea`, `Select`, `Field`, `DateField`, `TimeField`, `SelectPicker`, `MultiPicker`, `RangePicker`, `ColorPicker`, `ChoiceGroup`, `Disclosure` |
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
  Stratégie (+ Réglages). Les entrées du rail sont des **carrés** aux angles
  adoucis (`--radius-lg`), comme chez Lucid — plus de pilules.
- **Pages à hauteur mesurée** (Calendar, Inbox, Jarvis, Journal, Monte Carlo) :
  `hooks/useAvailableHeight`. Calendrier et Monte Carlo utilisent un minimum
  de hauteur et peuvent défiler si leur contenu dépasse ; Journal, Inbox et
  Jarvis conservent leur défilement interne.
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

## 8. Vérification visuelle

`/dev/ui` (développement uniquement) monte les vrais composants de toutes les
pages, avec les fournisseurs de l'app et sa typographie. `?screen=calendar`,
`?screen=journal`, `?screen=dashboard`, etc. choisissent une page ; `&empty=1`
retire les trades de démonstration pour vérifier les états vides. `screen=trade`,
`screen=controls` et `screen=icons` exposent les bancs dédiés au formulaire,
aux sélecteurs et au catalogue d’icônes. `screen=missedform` couvre la saisie d’un setup manqué. Les actions de page y sont montées comme dans le shell. La route ne
rend rien dans un build de production. Les pages qui chargent leurs propres
données demandent une session locale de test ou des réponses simulées.

## 9. Champs, filtres et icônes : contrat unique

Point d'entrée des règles : `src/shared/ui/selection.ts`. La géométrie est
implémentée dans `src/shared/ui/selection.css`, importé par `src/styles.css` ;
`SelectionPanel.tsx` est le seul moteur de panneau flottant. `Picker.tsx`
compose ce moteur, sans le recopier. Les dates, heures et couleurs passent
par le même moteur, y compris dans une modale ou un filtre de période.

| Besoin | Primitive à utiliser |
| --- | --- |
| Texte, nombre, note | `Field` + `Input` / `Textarea` |
| Un choix, plusieurs choix, période | `SelectPicker`, `MultiPicker`, `RangePicker` |
| Date civile, heure civile | `DateField`, `TimeField` |
| Choix courts visibles | `ChoiceGroup` (radio, clavier, état neutre) |
| Options avancées | `Disclosure` (titre, commande 44 px, corps espacé) |
| Filtres ou commandes secondaires d’une page | `PageControls` (déclencheur unique + panneau partagé) |
| Nouveau type de filtre | `SelectionPanel` + contrôle tiré de `selection.ts` |

**Géométrie :** champ de 44 px ; dans `tv-compact-form` (trades et setups manqués), 36 px sur pointeur fin et 44 px sur écran tactile, rayon `lg`. Texte `body-sm` (13 px), libellé
`tv-label`, séparation 12 px. Les nombres suivent `tv-figure`. Les sélections
restent neutres ; l'accent désigne l'action principale et le focus. Le P&L
et les erreurs gardent leurs couleurs sémantiques. Une page n'impose pas sa
propre hauteur, couleur de champ, animation ou logique de positionnement.

**Comportement commun :** portail hors des zones qui rognent ; placement
contre le déclencheur sur bureau, panneau centré sur mobile ; adaptation à la
fenêtre et au clavier virtuel ; recherche des longues listes ; clavier et
retour du focus. Une pile de panneaux fait fermer seulement le dernier par
Échap ou un clic extérieur : fermer une date dans une période ne ferme pas
le formulaire de trade situé dessous. Aucune temporisation ne retarde un choix.

`TimeField` accepte la saisie `HH:MM` ou quatre chiffres, et propose deux
listes à défilement **natif**. Faire défiler parcourt les options ; cliquer ou
utiliser les flèches sélectionne immédiatement. Le défilement ne réécrit pas
la valeur. Les minutes importées hors du pas restent disponibles. Pas de
`preventDefault` sur la molette, de `scroll-snap` obligatoire, ni de boucle
`scroll → setTimeout → état → smooth scroll`.

**Ajouter ou modifier un filtre :**
1. Choisir la primitive dans la table ; fournir la donnée, les libellés
   traduits, la valeur et `onChange` depuis la feature.
2. Ajuster une règle commune dans `selection.ts`, `SelectionPanel.tsx` ou le
   fichier `selection.css`, puis contrôler au moins une autre feature.
3. Vérifier ouverture en bas de fenêtre, mobile 360 px, clavier, Échap
   imbriqué, focus et absence de débordement. Un champ `TimeField` doit
   accepter `09:47` sans arrondi ni attente.

**En-têtes légers :** `app/shell/PageHead.tsx` porte une seule barre principale dans le flux, sans marge négative ni chevauchement. Les filtres secondaires sont regroupés dans `PageControls` ; un compteur indique les critères actifs et Échap ferme le panneau en conservant les valeurs. Analytics et la saisonnalité remontent un unique `PageControls` dans `usePageActions` ; la vue, la période, les jours ou les actifs se choisissent dans ce panneau. Le banc visuel monte le vrai `PageHead`, avec `SectionTabs` et `MobileActions`, pour contrôler leur largeur ensemble. Ne pas ajouter de rangées de pastilles ni de bloc permanent de personnalisation au-dessus du contenu. `SectionTabs`, `SubNav` et `PageToolbar` gardent un cadre fin et une plaque neutre : le groupe reste identifiable. Un seul contour par groupe, sans double cadre ; les onglets ne passent pas sur une deuxième ligne.

**Saisie d’un trade :** panneau de 576 px maximum, hauteur ajustée au contenu (plafond 680 px / 86dvh). La première vue présente instrument, date, direction et risque/R ; le résultat calculé porte l’accent visuel dans le pied, avec une seule action d’enregistrement. Entrée soumet le formulaire valide. Les horaires restent résumés sur une ligne dépliable. Stratégie, notes et analyse restent facultatives, à la demande, sans onglets. Le détail broker et les métriques avancées restent accessibles sans concurrencer la saisie essentielle. Les nombres importants gagnent un cran typographique, Long/Short/BE gardent leurs signes et états sémantiques. Le bouton de saisie utilise `Button variant="entry"` (cadre court, angles `lg`, hauteur 36 px / 44 px tactile). Les setups manqués gardent le même langage de champs et une palette neutre.

**Dashboard et comptes :** les quatre métriques utilisent `Metric compact` (marge verticale 10 px, chiffres de 18 px, jauge de 32 px). Les réglages Comptes présentent une liste unique, principal en premier ; nom, type et capital restent visibles. La sélection se fait par la ligne, les actions ponctuelles vivent dans son menu, l’ajout et le transfert existent une seule fois. Les modales, droits et calculs existants sont réutilisés.

**Pages contenues :** cadre standard de 1200 px, graphiques moins hauts ;
Analytics organise tous ses blocs en Synthèse, Exécution et Timing, un groupe
à la fois. Le calendrier conserve son cadre de référence de 1400 px.

**Icônes :** `src/shared/ui/icons.tsx` reste le point d’entrée commun. Il réexporte les pictogrammes Lucide familiers : livre pour le journal, calendrier, graphique pour les statistiques, cible pour les objectifs, engrenage pour les réglages. Un symbole doit être compréhensible avant d’être original. Garder le nom de page à côté dans la navigation, le trait 1,6 et `currentColor` ; pas de glyphe métier abstrait ni de variante locale.
