# Design system

Le système visuel existant, tel qu'il est dans le code. Les **lois détaillées**
(à charger avant d'écrire une couleur, une taille, une animation, un
composant, une navigation ou un texte de landing) sont les skills de
[`../.claude/skills/`](../.claude/skills) : `theme`, `typography`, `motion`,
`ui-design`, `ux-navigation`, `landing-copy`, et l'orchestrateur `ship-ui`.

## 1. Le langage Liquid — verre iOS 27 + matière Revolut

Depuis le 31 octobre 2026 (spec :
[`superpowers/specs/2026-10-31-liquid-design-language-design.md`](superpowers/specs/2026-10-31-liquid-design-language-design.md)),
le produit parle **Liquid** :

- **Le verre flotte, le contenu se pose.** La couche de navigation (rail,
  barre mobile, barre compacte d'en-tête, menus, panneaux de sélection,
  feuilles, palette, toasts) est en verre : translucide, flouté, arête
  spéculaire d'1 px, ombre noire. Les cartes de contenu restent des plaques
  opaques — un chiffre ne se lit jamais à travers un flou.
- **Papier peint d'ambiance** : trois nappes très floues dans la teinte du
  thème, fixes (`body::before`), sous tout le produit. Aucune animation.
- **Matière Revolut** : cartes à grand rayon (22), un chiffre héros par écran,
  actions rondes (`ActionButton`), listes à pastilles.
- **Rayons concentriques** : contrôles 12–14, cartes 22, feuilles 28, coque 32.
  Les boutons d'action sont des **rectangles adoucis pleins, texte blanc** ;
  les pilules restent aux sélecteurs (compte, puces, entrées du rail).
- **Grand titre** (Large Title) sur chaque page, dérivé de la navigation, et
  barre compacte de verre au défilement.

Ce qui suit (grammaire Lucid, deux verts, plaques) reste vrai pour le
**contenu** ; la coque et les surfaces flottantes suivent Liquid.

### Héritage : le langage Lucid — le calendrier comme référence

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

`PageContainer` porte les marges communes (`px-3 py-2 md:px-5 md:py-3`) et la
largeur unique `PAGE_WIDTH` (1400 px, `shared/ui/tokens.ts`), partagée par l'en-tête et les squelettes — plus d'écart entre deux pages d'une même section, y compris pour les pages à hauteur mesurée (ref transmise
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
`animate-ping`, ni dégradé sur un texte, un bouton ou une carte ; la seule
lumière permise est le papier peint fixe et l'arête spéculaire blanche d'1 px
du verre) — la profondeur vient de la valeur des surfaces, d'un liseré quasi
invisible et, pour ce qui flotte, d'une ombre noire ; le verre n'est jamais
posé sur une carte de contenu (`tests/liquidGlass.test.ts`) ; chiffres tabulaires partout ;
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
- Palette `lucid` (Liquid) : fond `#050607` · carte `--tv-plate-1` `#141517` ·
  tuile `--tv-plate-2` `#1c1d20` · creux `--tv-plate-0` `#0c0d0f` · accent `#31d68a`
  (foncé `#1fb574`, clair `#6be3a8`) · P&L `--tv-chart-green` `#61f8ab` /
  `--tv-chart-red` `#f87171`. La vitrine garde son émeraude verrouillée
  (`#22e08a`, `.landing-root`) · texte `#f2f4f5` · liseré
  `rgb(255 255 255 / .05)`.

**Grammaire de surface** : `.glass`, `.panel`, `.stat-card*` rendent la
**même** plaque opaque de contenu (le nom historique `.glass` ne veut plus dire
« verre »). Le verre, lui :

| Classe | Matériau | Usage |
| --- | --- | --- |
| `.tv-glass` / `.tv-glass-solid` | `--tv-glass-fill` (52 %) / `-solid` (90 %), flou sur `::before` | Coque : capsules, barres |
| `.rail`, `.bottom-nav-shell`, `.page-compact-bar` | idem, réglés pièce par pièce | Rail, barre mobile, barre compacte |
| `.glass-strong`, `.tv-dialog`, `.tv-pop`, `.section-menu` | `--tv-glass-fill-strong` (94 %) | Modales, feuilles, menus, sélecteurs |

Le flou d'une pièce qui contient des éléments `fixed` se pose sur `::before`
(un `backdrop-filter` ferait de son porteur leur bloc conteneur). Tout flou a
son repli opaque : `@supports not (backdrop-filter…)` et
`prefers-reduced-transparency`.

## 3. Typographie

**Deux voix, une par surface.** L'app connectée écrit dans la police de Lucid
— la **pile système** `--font-lucid` (SF Pro sur Apple, Segoe UI sous Windows,
Roboto sous Android), relevée sur leurs captures, sans police web à charger ;
`body.tv-app-type` (posé par `shell/App.tsx`) l'applique, modales comprises.
La vitrine, les pages légales et la démo gardent **Inter** pour les lettres.
Tous les chiffres utilisent **Inter ExtraBold (800)**. Le sous-ensemble local
`public/fonts/tradevault-numerals-800.v1.woff` fixe le même dessin sur toutes
les surfaces, sans dépendre de Google Fonts ni de la police système.
`TradeVault Numerals` précède chaque pile (corps, titres, monospace, landing)
et ne remplace que les chiffres et les signes monétaires. `TradeVault Figures`
réutilise le même fichier avec ses séparateurs dans `--font-figure`.
Les deux faces couvrent les graisses 100–900 avec les mêmes contours 800 :
un chiffre inclus dans une phrase légère ne devient pas plus fin. Les lettres
conservent leur police et leur graisse. Le fichier est dérivé d’Inter, version
4.001, limité aux chiffres, monnaies et séparateurs. Les glyphes tabulaires sont
fixés dans le fichier : une option OpenType héritée ne peut pas changer le
dessin du « 1 ». La police est renommée et livrée avec
`public/fonts/OFL-Inter.txt` (licence SIL OFL).

`--tv-numeric-weight: 800` règle les valeurs balisées ; `tv-num` et
`tv-figure-secondary` restent des alias compatibles, sans poids distinct.
Ne jamais augmenter une taille pour renforcer un chiffre ; conserver sa
couleur sémantique et `tabular-nums` pour les colonnes, montants et axes.
`numericText` reste utile pour les nombres inclus dans le Markdown et les
notifications ; la couverture des chiffres ne dépend plus de ce balisage.
Échelle à rôles `--tv-t-*` : `display` (44, chiffre héros), `h1` (30, grand
titre `.tv-large-title`), `h2` (20), `h3` (15), `body`, `body-sm`, `caption`,
`micro` (11, plancher). Chiffres : `.tv-figure`
(tabulaires). Libellés : `.tv-label` (petites capitales espacées). Détail :
skill `typography`.

## 4. Motion

**Ressort Liquid** : `--tv-spring` (courbe `linear()` à peine amortie, repli
sur `--tv-ease`) et `--tv-dur-spring` (340 ms) portent les états qui glissent —
pilule active du rail, montée d'une feuille sur téléphone. Pression :
`--tv-press` (`scale(.97)`). Plafond : 300 ms, 360 ms pour un ressort ou une
feuille.

La loi (skill `motion`) autorise huit keyframes — `styles.css` en contient
encore davantage (dette à résorber, sans en ajouter) —, **300 ms maximum dans l'app**, uniquement
`transform` et `opacity`, jamais `transition-property: all`. Pas de Framer
Motion. Reveal au scroll réservé à la landing (GSAP, contenu visible par
défaut). Recharts reste hors du chunk initial (chargé paresseusement).
Les graphiques utilisent `useChartAnimation` : 260 ms, arrêt immédiat des
animations en préférence réduite (y compris lors d’un changement du réglage système).
Effet compteur de Lucid : `RollingFigure` (`shared/ui`) fait rouler un chiffre
qui change — tuiles `Metric`/`Kpi`, P&L du tableau de bord — avec les
keyframes du prix animé (`prix-entre`/`prix-sort`), aucune nouvelle keyframe.
Le rail se plie en 260 ms : seule sa largeur s'anime, les icônes ne bougent
pas, les libellés s'effacent en fondu. Détail : skill `motion`.

**Exception : le cœur neuronal de Jarvis** (`shared/ui/JarvisNeural.tsx`,
moteur `shared/ui/neural/`). Comme `JarvisOrb`, il est décoratif par
décision produit : on doit VOIR l'agent respirer, écouter, comprendre,
analyser, réfléchir, réviser, rédiger, parler — huit formes de particules et
des morphings de ~850 ms entre elles. Il ne vit que sur les surfaces de
Jarvis (accueil de la conversation, présence compacte de 40 px posée sur le
champ de saisie, scène vocale « live »), un seul à la fois. Le petit cœur de
la présence ne gèle pas au repos (`keepAlive`) : figé, il se lirait comme un
Jarvis éteint, et à 40 px il ne coûte presque rien. Son halo vient du mélange additif de
points sur un canevas : aucune ombre, aucun `filter`, aucun bloom. Garde-fous
non négociables : WebGL sans dépendance, calcul sur la carte graphique, rien
par particule côté JavaScript, arrêt hors écran / onglet caché / repos
prolongé, 30 images/s pour respirer, densité adaptée à l'appareil et réduite
en direct si les images arrivent en retard, image fixe sous
`prefers-reduced-motion`, repli sur `JarvisOrb` sans WebGL.

**Changement de page** : un seul mouvement. L'enveloppe (`.page-in`) fond en
180 ms sans se déplacer ; seules les cartes portent `fade-in-up` (6 px). Deux
glissements superposés se lisaient comme un « zoom en deux temps ». Les pages
plein écran mesurent leur hauteur AVANT la peinture (`useAvailableHeight` :
effet de mise en page, `offsetTop` insensible aux `transform`,
`ResizeObserver` synchrone) et la barre de tête se remplit avant la peinture
(`usePageActions`/`usePageLead`) : la première image est la bonne.

**Exception : l'onboarding** (`features/onboarding/`). C'est la seule surface
connectée autorisée à être cinématique — on y passe une fois, et c'est là que
le trader décide si TradeVault est fait pour lui. Elle peut dépasser 300 ms
(entrées jusqu'à ~600 ms, allumage ~1,2 s) et porte ses propres keyframes
`onb-*`, mais garde le reste de la loi : `transform`/`opacity` (plus le tracé
`stroke-dashoffset`), aucune boucle décorative, rien ne rayonne, tout se
réduit à un fondu sous `prefers-reduced-motion`. Elle a aussi le seul **son**
du produit, synthétisé en Web Audio (`onboardingSound.ts`) : jamais avant un
geste, coupable et mémorisé, silencieux en cas d'échec. Le thème choisi à
l'écran « apparence » s'applique à chaud à la séquence elle-même.
Sa sortie est une **métamorphose**, pas une coupure : la carte finale se vide
(`.onb-morphing`), puis le shell s'ouvre depuis son rectangle jusqu'au plein
écran (`.tv-morph-in`, `clip-path`, 760 ms en entrée-sortie, coupée sous mouvement réduit).

## 5. Primitives (`src/shared/ui`)

Import unique : `import { … } from "@/shared/ui"`. `shared/ui` n'importe jamais
`app/`.

| Catégorie | Exports |
| --- | --- |
| Typographie | `Display`, `Heading`, `Text`, `Label` |
| Actions | `Button`, `ActionButton` (disque 52 px + libellé, rangée d'actions façon Revolut), `Chip`, `RemovableChip` |
| Saisie | `Input`, `Textarea`, `RichTextarea` / `RichTextView`, `Select`, `Field`, `DateField`, `TimeField`, `SelectPicker`, `MultiPicker`, `RangePicker`, `ColorPicker`, `ChoiceGroup`, `Disclosure`, `FormSection` / `FormLabel` (sections numérotées qui se cochent, pastille obligatoire ou de catégorie) |
| Pages de paramètres | `SettingsGroup` (un cadre, des rangées à filets), `SettingsRow` (nom + aide à gauche, commande à droite), `SettingsAction` (rangée cliquable), `Toggle` (`role="switch"`) — jamais de carte dans une carte |
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
  Stratégie (+ Réglages). Le rail est un panneau de verre flottant, pliable
  (72 px) ; ses entrées sont des pilules transparentes, l'active une pilule de
  verre clair qui glisse sur le ressort. Chaque page porte un **grand titre**
  (`PageHead`, dérivé de `SECTION_META` / `PAGE_META`) au-dessus de la rangée
  d'origine onglets/actions ; une barre compacte de verre le reprend au
  défilement. Barre mobile **solide** : onglet actif sur tuile, « + » central
  plein. Sur téléphone, une modale monte du bas (feuille).
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

Le laboratoire Monte Carlo privilégie un graphe, quatre chiffres et un éditeur
compact (modal sur mobile). Les vues Capital / Drawdown / Objectif partagent
la même simulation. Médiane linéaire, bandes centrales 50 % / 90 %, nuage de
densité des 10 000 trajectoires et lecture clavier/tactile ; aucune courbe
lissée qui inventerait des valeurs. Une comparaison garde le même axe.
La provenance et le nombre de trades restent visibles ; explications détaillées
et méthode sont repliées. Les bandes sont des quantiles par instant, pas un
intervalle de confiance sur l'edge. Les trajectoires extrêmes hors cadre ne
sont pas retirées des calculs ; la méthode l'explicite.

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
- **Logos de services tiers** (broker, plateforme) : uniquement le fichier
  officiel, dans `src/assets/brands/`, affiché tel quel — ni redessiné, ni
  retinté, ni posé sur un aplat d'accent. C'est sa couleur qui le fait
  reconnaître (Tradovate : onboarding et page Brokers). Sans fichier officiel,
  le nom en texte.

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
| Texte, nombre, note | `Field` + `Input` / `Textarea` ; `SignedNumberInput` pour un nombre signé (bouton +/− tactile, virgule décimale acceptée) |
| Note mise en forme (gras, italique, souligné) | `RichTextarea` (même peau que `Textarea`, mini-barre sur la sélection, ⌘/Ctrl+B/I/U) + `RichTextView` à l’affichage ; stockage en texte à marques (`shared/richText.ts`) |
| Un choix, plusieurs choix, période | `SelectPicker`, `MultiPicker`, `RangePicker` |
| Date civile, heure civile | `DateField`, `TimeField` |
| Choix courts visibles | `ChoiceGroup` (radio, clavier, état neutre) |
| Options avancées | `Disclosure` (titre, commande 44 px, corps espacé) |
| Filtres d’une page | `FilterControls` + `FilterSection`, choix inline, résumé actif et pied fixe |
| Commandes secondaires | `PageControls` (menu d’actions partagé) |
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

**Filtres de page :** `FilterControls.tsx` est le point d’assemblage commun au
Journal, à Analytics, aux actualités économiques, à la saisonnalité et à
l’Inbox. Le déclencheur affiche le résumé actif (nom complet accessible, texte
tronqué si nécessaire) et son nombre. Chaque `FilterSection` garde sa valeur
visible lorsqu’elle est repliée ; l’accordéon natif ne développe qu’un groupe
à la fois. Les options sont **inline**, jamais un second popover pour un jour,
un résultat, une devise ou un setup. Les listes longues montrent d’abord six
choix et les sélections ; la suite et la recherche se demandent explicitement.
Le pied reste fixe : réinitialiser, mention « mise à jour immédiate », terminer.
Les changements s’appliquent immédiatement ; seule une période personnalisée
attend « appliquer la période » après choix de ses deux bornes. La date reste
le seul panneau imbriqué, géré par la pile commune. Le défilement de secours
existe sur un petit écran ou avec clavier ouvert, mais les critères usuels
restent visibles sans scroll. Aucune requête réseau par choix de filtre.

**En-têtes légers :** `app/shell/PageHead.tsx` porte une seule barre principale
dans le flux. Les filtres remontent dans `usePageActions` ; le Journal garde
sa recherche et son accès aux filtres sur une seule ligne. Les vues, mois de
rapport, périodes d’equity et autres sélecteurs courts utilisent les mêmes
primitives `Picker` / `SelectionPanel`. Ne pas ajouter de rangées de pastilles
ni de bloc permanent de personnalisation au-dessus du contenu. `SectionTabs`,
`SubNav` et `PageToolbar` gardent un cadre fin et une plaque neutre : un seul
contour par groupe, sans double cadre ni retour des onglets à la ligne.

**Jarvis :** cœur central persistant, hors du fil défilant, et bulles de phases
indicatives pendant l’attente (aucune coche ni progression inventée). Le noyau
clair et les particules sont rendus dans le même canevas, sans post-traitement.
Conversation bornée à 760 px pour la lecture, questions sur plaque 3,
réponses sur plaque 1, données dans les primitives KPI et tableaux denses qui
se replient. Les actions de réponse vivent dans `ResponseActions` ; la copie
utilise `responseTextOf` et n’emploie jamais le résumé tronqué envoyé à l’IA.
Le scroll ne suit une génération que si le lecteur est déjà en bas ; « dernier
message » y ramène explicitement. Le rendu progressif est court et peut être
terminé au clavier, depuis une commande fixe près du compositeur ; `prefers-reduced-motion` affiche immédiatement la réponse.
Les anciens blocs et leur Markdown sont mémoïsés pour ne pas être reparcourus
à chaque frappe. Les anciens tours bénéficient de `content-visibility`, sans retirer de message
du DOM ou de l’historique. Identité, focus et indicateurs utilisent l’accent du
thème ; aucun fond animé ni halo d’ambiance. Les moteurs, mémoire, quotas,
propositions et requêtes en cours restent indépendants de cette présentation.

**Notifications :** une seule anatomie de ligne, groupée par période ; les
avertissements/erreurs non lus passent dans « à traiter ». Le point et le poids
du titre indiquent le non lu, le liseré indique l’urgence. Sujet et date vivent
sur une ligne secondaire ; corps limité à deux lignes, détail et plan conservés
dans le détail existant. Ouverture, lecture et navigation sont des boutons
séparés. Catégories multiples et non-lues se combinent dans `FilterControls`.
Le chargement reprend la géométrie des lignes ; échec et réessai sont explicites.
Aucune notification de démonstration n’est ajoutée dans le produit.

**Saisie d’un trade :** panneau de 576 px maximum, hauteur ajustée au contenu (plafond 680 px / 86dvh). La première vue présente instrument, date, direction et risque/R ; le résultat calculé porte l’accent visuel dans le pied, avec une seule action d’enregistrement. Entrée soumet le formulaire valide. Les horaires restent résumés sur une ligne dépliable. Stratégie, notes et analyse restent facultatives, à la demande, sans onglets. Le détail broker et les métriques avancées restent accessibles sans concurrencer la saisie essentielle. Les nombres importants gagnent un cran typographique, Long/Short/BE gardent leurs signes et états sémantiques. Le bouton de saisie utilise `Button variant="entry"` (cadre court, angles `lg`, hauteur 36 px / 44 px tactile). Les setups manqués gardent le même langage de champs et une palette neutre.

**Dashboard (maquette Liquid v1, référence de la DA) :** en-tête titre + date du jour à gauche, Rechercher (⌘K, événement `tv:open-palette`), cloche et « + Trade » à droite ; héros centré — pilule du compte (`AccountSwitcher variant="pill"`), P&L de la période en chiffre héros, « P&L net · période · n trades », périodes CALENDAIRES Jour · Semaine · Mois · Année · Tout, puis quatre `ActionButton` (Trade, Importer, Checklist, Jarvis). Dessous : courbe d'equity (deux tiers) et quatre widgets `Metric` à jauge `track` qui affichent leur échantillon (taux de réussite, profit factor, R moyen, discipline) ; derniers trades en liste à pastilles et objectif du mois (progression, drawdown du mois, jours ouvrés restants — jamais de « drawdown restant » sans règle de compte). Sur ordinateur la page **tient en un écran** : le héros garde sa hauteur, les deux rangées se partagent le reste en pixels (`useAvailableHeight`), resserrées sous ~260 px, héros réduit sous 700 px disponibles ; trop court pour rester lisible, elle défile. Le copilote Jarvis et la série de checklist ont quitté le Dashboard (Jarvis à un appui, série sur la page Checklist). Pages à vue unique : titre + sous-titre à gauche, actions à droite, même ligne. Les réglages Comptes présentent une liste unique, principal en premier ; nom, type et capital restent visibles. La sélection se fait par la ligne, les actions ponctuelles vivent dans son menu, l’ajout et le transfert existent une seule fois. Les modales, droits et calculs existants sont réutilisés.

**Calendrier économique (façon Forex Factory) :** un TABLEAU, une ligne par publication — heure (écrite une fois pour les publications simultanées), devise, impact en barres (3 rouge, 2 orange, 1 jaune), événement, réel, prévu, précédent — groupé par jour, trié par heure. La provenance est dans l'en-tête (« Vérifié · Forex Factory » + fraîcheur, ou « Horaires indicatifs » en repli). Les filtres (impact, devises, période) vivent dans les préférences du compte (`news.filters.v1`, `userPrefs`) : ils survivent à la fermeture du site et suivent le trader d'un appareil à l'autre.

**Pages contenues :** cadre unique `PAGE_WIDTH` (1400 px), graphiques moins hauts ;
Analytics organise tous ses blocs en Synthèse, Exécution et Timing, un groupe
à la fois. Le calendrier partage le même cadre que les autres pages.

**Icônes :** `src/shared/ui/icons.tsx` reste le point d’entrée commun. Il réexporte les pictogrammes Lucide familiers : livre pour le journal, calendrier, graphique pour les statistiques, cible pour les objectifs, engrenage pour les réglages. Un symbole doit être compréhensible avant d’être original. Garder le nom de page à côté dans la navigation, le trait 1,6 et `currentColor` ; pas de glyphe métier abstrait ni de variante locale.
