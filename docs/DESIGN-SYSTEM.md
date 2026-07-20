# TradeVault — Plan de Design System

> **Analyse de l'existant + plan d'un Design System.** Ce document **ne modifie
> rien** : il diagnostique l'interface actuelle (preuves chiffrées à l'appui) et
> propose un système cohérent, puis un plan de migration **non destructif**.
>
> À lire avec [`ux-architecture.md`](ux-architecture.md) (UX) et
> [`ARCHITECTURE.md`](ARCHITECTURE.md) (couche `app/`). Priorités transverses :
> [`ROADMAP.md`](ROADMAP.md).

**Méthode.** Analyse statique de `src/styles.css` (1763 lignes) et des 55 fichiers
`.tsx` de `src/app/` : comptage des tokens, tailles de police, couleurs codées en
dur, structures dupliquées, échelles de rayon/spacing. Les chiffres ci-dessous
sont **mesurés**, pas estimés.

**Verdict.** L'exécution visuelle est de haut niveau (l'atout du produit). Les
fondations de spacing et de rayon sont **saines**. Deux zones concentrent
**90 % de la dette de cohérence** : les **couleurs** (systèmes de tokens
parallèles + valeurs en dur) et la **typographie** (aucune échelle, micro-tailles
partout). Aucun refactor lourd nécessaire — un système de tokens + 5 primitives
suffit.

---

## 1. Diagnostic

### 1.1 Incohérences visuelles — 🔴 majeur

**Deux systèmes de tokens de couleur coexistent** dans `styles.css` :

1. **Tokens shadcn** (`--primary`, `--card`, `--muted`, `--accent`, `--sidebar-*`…)
   en `oklch`, hérités du scaffold Lovable — **quasi inutilisés** par l'UI
   hand-rolled.
2. **Tokens TradeVault** (`--tv-primary-h/c`, rampes `cyan-*`/`teal-*` regénérées,
   `--color-surface`, `--color-profit`, `--color-loss`) — **le vrai système**,
   themeable à chaud.

→ Un nouveau contributeur ne sait pas lequel utiliser. Le bloc shadcn `:root`/`.dark`
est un **faux ami** (il ressemble à la source de vérité, mais ne l'est pas).

**Couleur sémantique profit/perte exprimée de 3 façons différentes :**

| Approche | Occurrences | Statut |
|---|---|---|
| `emerald-*` (profit) direct | **195** | dominant |
| `red-*` (perte) direct | **204** | dominant |
| `#ef4444` / `#10b981` en dur | 12 / 7 | à bannir |
| Tokens dédiés `--color-profit` / `--color-loss` | **0 usage** | **morts** |

→ Le concept métier le plus important du produit (gagné/perdu) **n'a pas de
source unique**. Les tokens prévus pour ça existent mais ne sont jamais utilisés.

**Couleurs codées en dur dans le JSX** (hors tokens) — top : `#475569` ×21,
`#ef4444` ×12, `#f59e0b` ×11, `#0a0f1e` ×9, `#64748b` ×8, `#22d3ee` ×7…
_(exception légitime : `#00b67a` = vert Trustpilot, zone gelée.)_

### 1.2 Composants dupliqués — 🟠 important

**6 modales hand-rolled**, chacune ré-implémentant `fixed inset-0 z-* ` + overlay
+ panneau + fermeture, sans primitive partagée :
`TradeModal` · `TradeDetailModal` · `MissedSetupDetailModal` · `MobileNav` ·
`Landing` · `MissedOpportunities`.
→ La dépendance `@radix-ui/react-dialog` ayant été retirée (Phase B), **aucune
primitive `Dialog`** n'existe : focus-trap, `Esc`, scroll-lock, `aria-modal` sont
réimplémentés (ou oubliés) à chaque fois.

**Boutons** : seuls `.btn-primary` et `.btn-ghost` sont définis en CSS — et
`.btn-ghost` est **déclaré deux fois** (`styles.css:1166` et `:1193`, doublon
littéral). Les autres variantes (danger, secondaire, tailles) sont bricolées
inline au cas par cas → pas de contrat de bouton.

**Cartes** : `.card-premium` existe, mais la majorité des cartes sont des
assemblages inline répétés (`rounded-2xl border border-white/[.06] bg-white/[.015] p-7`…).

### 1.3 Problèmes de hiérarchie — 🟠 important

- **Deux définitions de `.font-display`** : l'app (Sora/Manrope, weight 700) et
  un override `.landing-root .font-display` (Sora) → risque de divergence de
  titrage entre marketing et produit.
- Pas d'échelle de **rôles** typographiques (H1/H2/H3/body/caption/label) : la
  hiérarchie est portée par des tailles arbitraires au pixel, pas par des rôles
  nommés → deux écrans peuvent titrer différemment sans qu'on le voie.
- `StatsCard`/KPI : pas de primitive « stat tile » unique → tailles de chiffre et
  de label variables d'un écran à l'autre.

### 1.4 Problèmes de spacing — 🟢 sain (à formaliser)

**Bonne nouvelle** : le spacing arbitraire au pixel est **quasi inexistant**
(1 seule occurrence `*-[Npx]` sur tout `app/`). L'app utilise l'échelle Tailwind
par défaut (`p-4`, `gap-3`…). Le rayon aussi est sur l'échelle nommée :

| `rounded-*` | xl | 2xl | full | lg | 3xl | md | sm |
|---|---|---|---|---|---|---|---|
| occurrences | 206 | 126 | 110 | 95 | 50 | 14 | 2 |

→ Seule dérive : 3 rayons arbitraires (`rounded-[2px]`, `rounded-[2.5rem]`). À
**documenter en échelle**, rien à corriger en masse.

### 1.5 Problèmes de typographie — 🔴 majeur

**Aucune échelle typographique.** Les tailles sont posées en pixels arbitraires,
dominées par des **micro-tailles** :

| Classe | Occurrences |
|---|---|
| `text-[10px]` | **152** |
| `text-[11px]` | **76** |
| `text-[9px]` | **59** |
| `text-[8px]` | 15 |
| `text-[13px]` | 14 |
| `text-[7px]` | 4 |
| one-off rem (`text-[1.4rem]`, `text-[.95rem]`…) | ~8 |

→ **Deux problèmes** : (1) prolifération de valeurs (≈10 tailles ad-hoc là où 6
rôles suffisent) ; (2) **accessibilité** — du texte à 7–10 px est sous le seuil de
lisibilité mobile et non responsive. C'est la dette #1 du design.

---

## 2. Le Design System cible

Principe : **un jeu de tokens unique** + **une petite bibliothèque de primitives**.
Aligné sur la charte (`CLAUDE.md`) : simplicité d'abord, provider-agnostique du
thème (déjà en place via `--tv-*`), zéro régression perçue.

### 2.1 Tokens — source unique

**Couleur.** Garder **un seul** système : les tokens **TradeVault** (`--tv-*` +
rampes `cyan/teal` + surfaces). Formaliser les tokens sémantiques et **les
utiliser** :

| Token sémantique | Rôle | Remplace |
|---|---|---|
| `--color-profit` / `text-profit` | Vert gagné | `emerald-*` (195×) + `#10b981` |
| `--color-loss` / `text-loss` | Rouge perdu | `red-*` (204×) + `#ef4444` |
| `--color-warning` | Alerte / tilt | `#f59e0b` (11×) |
| `--color-surface{,-light,-lighter}` | Fonds | fonds `#0a0f1e`, `#0b1a2b`… en dur |
| `--color-muted-fg` | Texte secondaire | `#475569`/`#64748b`/`#94a3b8` en dur |
| `brand` / `brand-light` (cyan/teal) | Accent | déjà en place |

→ **Décommissionner** le bloc de tokens shadcn inutilisé (ou le documenter
explicitement comme non-utilisé), pour lever l'ambiguïté « quel token ? ».

**Typographie — échelle à 6 rôles** (fluide, `clamp()` pour le responsive) :

| Rôle | Usage | Cible indicative |
|---|---|---|
| `display` | Hero landing | `clamp(2.6rem, 5.4vw, 4.5rem)` (déjà utilisé) |
| `h1` | Titre de page | ~1.75rem |
| `h2` | Titre de section | ~1.25rem |
| `body` | Texte courant | **1rem (min 14px)** |
| `caption` | Légendes, méta | 0.8125rem (13px) |
| `label` | Étiquettes UI compactes | **0.75rem (12px) plancher** |

→ **Plancher à 12 px** : les `text-[7px]…[11px]` (≈300 occurrences) migrent vers
`caption`/`label`. Gain d'accessibilité + hiérarchie lisible.

**Spacing & rayon.** Déjà sains → **documenter** l'échelle Tailwind comme
canonique et l'échelle de rayon (`sm/md/lg/xl/2xl/3xl/full`). Bannir les
arbitraires (3 cas résiduels).

**Élévation.** Définir 3 niveaux d'ombre nommés (`elevation-1/2/3`) pour
remplacer les `shadow-*` ad-hoc et unifier la profondeur cartes/modales.

### 2.2 Primitives (composants) à extraire

Petite bibliothèque dans `src/app/components/ui/` — **contrats stables**, aucune
logique métier :

| Primitive | Remplace | Priorité |
|---|---|---|
| **`Dialog`** (overlay + focus-trap + `Esc` + scroll-lock + `aria-modal`) | les **6 modales** hand-rolled | **P0** |
| **`Button`** (`variant`: primary/ghost/danger/subtle · `size`) | `.btn-*` + boutons inline, dédoublonne `.btn-ghost` | **P0** |
| **`Card`** (+ `CardHeader/Body`) | `.card-premium` + cartes inline | P1 |
| **`StatTile`** (chiffre + label + tendance profit/loss) | KPI dispersés (`StatsCard` & co.) | P1 |
| **`Badge`** (neutral/profit/loss/warning) | pastilles inline | P2 |
| **`Field`** (label + input + erreur, cohérent) | inputs de formulaire ad-hoc | P2 |

> Ces primitives sont du **pur front** (aucun impact `modules/`/`backend/`). Elles
> respectent le sens des dépendances et sont testables isolément.

### 2.3 Accessibilité (transversal)

Plancher de taille de police (12 px), contrastes vérifiés sur les tokens profit/
loss/warning en dark, `Dialog` accessible (focus, clavier), `prefers-reduced-motion`
déjà respecté (`CursorGlow`, orbs) — à conserver comme règle.

---

## 3. Plan de migration — non destructif, par lots

> **Règle absolue** (charte) : ne rien casser, aucun changement de comportement
> produit. Chaque lot est mécanique, vérifiable (`tsc`/`build`/preview) et mergé
> séparément. **Zone Trustpilot gelée** (ne pas toucher `#00b67a`, widgets avis).

| Lot | Contenu | Risque | Priorité |
|---|---|---|---|
| **DS-1 — Tokens** | Documenter le système unique ; activer `--color-profit/loss/warning/surface/muted-fg` ; décommissionner/annoter les tokens shadcn morts | Faible (additif) | **P0** |
| **DS-2 — Primitives critiques** | Extraire `Dialog` + `Button` ; dédoublonner `.btn-ghost` ; migrer les 6 modales vers `Dialog` | Moyen (UX modale) | **P0** |
| **DS-3 — Typographie** | Introduire l'échelle à 6 rôles ; codemod `text-[Npx]` → rôle le plus proche (plancher 12 px) | Moyen (visuel diffus) | **P1** |
| **DS-4 — Couleur sémantique** | Codemod `emerald-*`/`red-*`/hex profit-perte → `profit`/`loss` ; retirer les hex en dur | Faible (mécanique) | **P1** |
| **DS-5 — Cartes & stats** | `Card` + `StatTile` ; migrer KPI/écrans | Faible | **P2** |
| **DS-6 — Badge/Field + élévation** | Primitives restantes + échelle d'ombre | Faible | **P2** |

**Séquencement conseillé** : DS-1 → DS-2 (fondations), puis DS-3/DS-4 (le gros de
la cohérence, en codemods vérifiables), puis DS-5/DS-6 au fil des lots produit.

---

## 4. Gouvernance (pour que ça tienne)

- **Source unique documentée** : cette page devient la référence design ;
  `styles.css` ne porte qu'**un** système de tokens.
- **Interdits** (à terme, via lint/revue) : couleur hex en dur dans le JSX,
  `text-[Npx]` arbitraire, nouvelle modale sans `Dialog`.
- **Ajout d'un token** : suivre le commentaire d'en-tête de `styles.css`
  (`:root` + `.dark` + `@theme inline`) — patron déjà propre, à conserver.
- **Definition of done UI** : toute nouvelle vue n'utilise que rôles typo + tokens
  sémantiques + primitives ; aucune valeur brute.

---

## 5. Résumé exécutif

| Catégorie | État | Action phare |
|---|---|---|
| Incohérences visuelles | 🔴 | Un seul système de tokens ; profit/loss sémantiques |
| Composants dupliqués | 🟠 | Primitives `Dialog` + `Button` (6 modales, `.btn-ghost` ×2) |
| Hiérarchie | 🟠 | Échelle typo à rôles ; unifier `font-display` |
| Spacing | 🟢 | Sain — documenter l'échelle |
| Typographie | 🔴 | Échelle + plancher 12 px (≈300 micro-tailles à migrer) |

**En une phrase.** La coque est belle mais son système est **implicite et
dédoublé** ; le rendre **explicite et unique** (tokens + 6 rôles typo + 5
primitives), sans changer un pixel de comportement produit, verrouille la
cohérence pour les 24 prochains mois.

_Document d'analyse et de plan — aucune modification de code effectuée._
