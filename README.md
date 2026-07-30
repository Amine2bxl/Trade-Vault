# TradeVault

> **AI Trading Operating System** — le système d'exploitation quotidien du
> trader particulier sérieux. Pas un journal de trading de plus : un coach IA
> (**Jarvis**) qui connaît chacun de tes trades, chiffre les schémas qui te
> coûtent de l'argent, et t'impose la discipline que tu n'arrives pas à
> t'imposer seul.

**Philosophie : la discipline avant le profit.** Le produit ne promet pas de
gagner plus ; il promet de te faire perdre moins par indiscipline. Tout ce qui
est mesuré, affiché ou dit par l'IA sert ce seul objectif.

---

## 1. Documentation — la carte

Cette documentation est la **source de vérité unique** du projet. Chaque
document a **un seul propriétaire de sujet** : si une information vit ici, elle
ne se duplique nulle part ailleurs — les autres documents y renvoient.

**Hiérarchie d'autorité en cas de conflit** :
[`docs/CLAUDE.md`](docs/CLAUDE.md) (charte d'équipe, prime sur tout) → ce README (carte) →
le document propriétaire du sujet.

| Document | Sujet dont il est propriétaire | Quand l'ouvrir |
| --- | --- | --- |
| [`docs/CLAUDE.md`](docs/CLAUDE.md) | Charte : axes de décision, go/no-go, garde-fous | **Toujours, en premier** |
| [`docs/product/PRODUCT.md`](docs/product/PRODUCT.md) | Vision, positionnement, philosophie, ICP, valeur, concurrents, pricing, **user journey** | Décision produit / marketing |
| [`docs/planning/ROADMAP.md`](docs/planning/ROADMAP.md) | Priorités P0→P3, lots, **V1 → V2**, dette technique | « Quoi faire ensuite » |
| [`docs/product/FEATURES_STATUS.md`](docs/product/FEATURES_STATUS.md) | État vivant de chaque fonctionnalité (✅ / 🟡 / ⚪) | « Qu'est-ce qui est vraiment livré » |
| [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) | Structure des dossiers, couches, **frontend**, flux de données, automatisations, standards de développement | Toucher au code |
| [`docs/development/BACKEND.md`](docs/development/BACKEND.md) | Frontière serveur, server functions, crons, paiement, e-mails, push, secrets | Toucher au serveur |
| [`docs/development/DATABASE.md`](docs/development/DATABASE.md) | Tables Supabase, colonnes, RLS, index, fonctions SQL, Storage, migrations | Toucher aux données |
| [`docs/architecture/AI_ARCHITECTURE.md`](docs/architecture/AI_ARCHITECTURE.md) | Plateforme IA, providers, contexte, outils, **futurs agents**, coûts, sécurité IA | Toucher à l'IA |
| [`docs/product/JARVIS.md`](docs/product/JARVIS.md) | Rôle, identité, persona, surfaces, grounding et **voix** de Jarvis | Toucher au coach |
| [`docs/development/DESIGN_SYSTEM.md`](docs/development/DESIGN_SYSTEM.md) | Tokens, primitives `shared/ui`, typographie, couleur, densité, motion | Toucher au style |
| [`docs/development/UX_RULES.md`](docs/development/UX_RULES.md) | Standards UX/UI, **navigation**, **structure des pages**, états, onboarding, notifications | Toucher à une page |

**Parcours de lecture recommandé (≈ 45 min pour être opérationnel)** :
`docs/CLAUDE.md` → ce README → `docs/architecture/ARCHITECTURE.md` → le document du domaine touché.

> **Note de vérification.** L'état décrit dans cette documentation a été
> re-vérifié **ligne à ligne contre le code** le 2026-07-28 (base `ce7fde6`).
> Les écarts entre l'intention documentée et le code réel sont signalés
> explicitement, jamais lissés — voir [`docs/planning/ROADMAP.md` §6](docs/planning/ROADMAP.md) (dette).

---

## 2. Le produit en une minute

Un trader logge ses trades (ou les importe en CSV). L'application :

1. **Calcule** — moteurs purs et déterministes : statistiques quant
   (win rate, profit factor, expectancy, drawdown, Sharpe/Sortino), score de
   qualité par trade, erreurs récurrentes chiffrées, signaux comportementaux
   (dérive de taille après une perte, coût de l'overtrading, edge par jour /
   session / symbole).
2. **Interprète** — **Jarvis**, l'IA unique du produit, lit ces chiffres et les
   traduit en diagnostic + plan d'action. Il ne recalcule **jamais** un nombre,
   n'invente **jamais** une donnée, ne prédit **jamais** le marché.
3. **Discipline** — checklist pré-market, plan de trading, règles personnelles
   vérifiées à chaque trade enregistré, objectifs, Edge Score, notifications.

Trois piliers de valeur : **Comprendre · Se souvenir & alerter · Discipliner**
(détail : [`docs/product/PRODUCT.md`](docs/product/PRODUCT.md)).

---

## 3. Stack

| Domaine | Choix |
| --- | --- |
| Framework | **TanStack Start** (routing fichier + `createServerFn`) |
| UI | **React 19**, **TypeScript strict** |
| Styles | **Tailwind v4** + tokens CSS `--tv-*`, `lucide-react` |
| Charts | **Recharts** (via `shared/ui/Chart.tsx`) |
| Données | **Supabase** — Postgres + **RLS owner-only** + Auth + Storage + Realtime |
| Cache client | **TanStack Query** (React Query) |
| Build / runtime | **Vite**, **Bun**, Nitro → **Vercel** |
| IA | Plateforme provider-agnostique : **Gemini** (défaut) · **Anthropic** · **OpenAI-compatible** — sélection par `AI_PROVIDER` |
| Voix | Web Speech API (local, défaut) + **ElevenLabs** optionnel côté serveur |
| Paiement | Stripe + Coinbase Commerce (infra en place, **dormante**) |
| E-mails | Resend, via crons Vercel |

Aucune dépendance UI lourde : ni Radix, ni shadcn runtime, ni bibliothèque de
composants tierce — les primitives sont maison (`src/shared/ui`).

---

## 4. Démarrer

```bash
bun install          # dépendances
bun run dev          # serveur de développement (Vite)
bun run build        # build de production
bun run lint         # ESLint type-aware (0 erreur exigée)
bun run format       # Prettier
bun test             # tests unitaires bun:test — 76 tests / 10 fichiers
npx tsc --noEmit     # typecheck strict
```

Copier `.env.example` → `.env` et renseigner au minimum les variables Supabase.
L'IA est optionnelle en local : sans clé de provider, Jarvis répond par son
**coach déterministe de secours** (voir [`docs/product/JARVIS.md` §6](docs/product/JARVIS.md)).

**Portes de vérification avant tout push** (charte [`docs/CLAUDE.md`](docs/CLAUDE.md)) :
`npx tsc --noEmit` · `bun run lint` · `bun run build` · `bun test` — les quatre
verts, sans exception.

---

## 5. Structure du dépôt

```
Trade-Vault/
├── README.md                # CE FICHIER — carte de la doc + démarrage
├── docs/
│   ├── CLAUDE.md            # Charte d'équipe — prime sur tout
│   ├── architecture/
│   │   ├── ARCHITECTURE.md
│   │   └── AI_ARCHITECTURE.md
│   ├── development/
│   │   ├── BACKEND.md
│   │   ├── DATABASE.md
│   │   ├── DESIGN_SYSTEM.md
│   │   └── UX_RULES.md
│       ├── product/
│   │   ├── PRODUCT.md
│   │   ├── FEATURES_STATUS.md
│   │   └── JARVIS.md
│   └── planning/
│       ├── ROADMAP.md
│       ├── ROADMAP_EXECUTION.md
│       └── MASTER_PLAN_TRADEVAULT.md
├── src/
│   ├── routes/              # Routing fichier TanStack (le seul routeur d'URL)
│   ├── app/                 # Couche présentation React (pages, composants, state, i18n)
│   ├── modules/             # Moteurs métier purs (sans React, sans IO direct)
│   ├── backend/             # Frontière serveur (server functions, crons, secrets)
│   ├── integrations/        # Client Supabase typé + middlewares d'auth
│   ├── shared/              # Helpers neutres + `shared/ui` (Design System)
│   ├── assets/              # Ressources statiques importées par le bundle (logo)
│   ├── router.tsx           # Fabrique du routeur TanStack + défauts React Query
│   ├── start.ts             # Entrée serveur TanStack Start
│   ├── server.ts            # Entrée serveur : endpoints HTTP bruts + crons
│   └── styles.css           # Tokens `--tv-*`, glass, animations
├── supabase/                # Migrations SQL (additives) + edge function
├── tests/                   # bun:test — moteurs purs uniquement
├── scripts/ public/         # Preview local · assets PWA
└── vercel.json              # Crons + en-têtes de sécurité (CSP, HSTS…)
```

Détail des responsabilités et du sens des dépendances :
[`docs/architecture/ARCHITECTURE.md` §2–3](docs/architecture/ARCHITECTURE.md).

---

## 6. Les cinq règles qu'on ne discute pas

1. **`src/app/` importe `src/modules/` — jamais l'inverse.** Aucune logique
   métier dans un composant React.
2. **Déterministe avant IA.** Les moteurs produisent les chiffres ; l'IA les
   interprète et ne les recalcule jamais.
3. **RLS owner-only** sur toute table utilisateur ; les secrets ne franchissent
   jamais la frontière `src/backend/`.
4. **Migrations additives** uniquement — on ne casse ni table ni donnée.
5. **Extension par plug-in** : une nouvelle capacité = un nouvel événement + un
   nouveau listener / step / provider / outil. On n'édite pas un moteur
   existant pour en brancher un autre.

**Zone gelée** : tout ce qui touche Trustpilot (`TrustpilotWidget`,
`TrustpilotPrompt`, `TRUSTPILOT_REVIEW_URL`, la couleur `#00b67a`) — de vrais
avis clients sont en cours d'arrivée. **Ne rien y toucher.**

---

## 7. État du produit en une ligne

**Beta gratuite.** `AI_REQUIRE_PRO=false` : tout utilisateur authentifié a accès
complet à l'IA, protégé par un rate-limit anti-abus (60 requêtes/h par défaut),
pas par un paywall. L'infrastructure de paiement existe et est testée mais
**dormante** — la bascule commerciale est **une variable d'environnement**.

Ce qui est livré, ce qui est partiel, ce qui reste :
[`docs/product/FEATURES_STATUS.md`](docs/product/FEATURES_STATUS.md). Ce qu'on construit ensuite :
[`docs/planning/ROADMAP.md`](docs/planning/ROADMAP.md).
