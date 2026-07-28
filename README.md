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
[`CLAUDE.md`](CLAUDE.md) (charte d'équipe, prime sur tout) → ce README (carte) →
le document propriétaire du sujet.

| Document | Sujet dont il est propriétaire | Quand l'ouvrir |
| --- | --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Charte : axes de décision, go/no-go, garde-fous | **Toujours, en premier** |
| [`PRODUCT.md`](PRODUCT.md) | Vision, positionnement, philosophie, ICP, valeur, concurrents, pricing, **user journey** | Décision produit / marketing |
| [`ROADMAP.md`](ROADMAP.md) | Priorités P0→P3, lots, **V1 → V2**, dette technique | « Quoi faire ensuite » |
| [`FEATURES_STATUS.md`](FEATURES_STATUS.md) | État vivant de chaque fonctionnalité (✅ / 🟡 / ⚪) | « Qu'est-ce qui est vraiment livré » |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Structure des dossiers, couches, **frontend**, flux de données, automatisations, standards de développement | Toucher au code |
| [`BACKEND.md`](BACKEND.md) | Frontière serveur, server functions, crons, paiement, e-mails, push, secrets | Toucher au serveur |
| [`DATABASE.md`](DATABASE.md) | Tables Supabase, colonnes, RLS, index, fonctions SQL, Storage, migrations | Toucher aux données |
| [`AI_ARCHITECTURE.md`](AI_ARCHITECTURE.md) | Plateforme IA, providers, contexte, outils, **futurs agents**, coûts, sécurité IA | Toucher à l'IA |
| [`JARVIS.md`](JARVIS.md) | Rôle, identité, persona, surfaces, grounding et **voix** de Jarvis | Toucher au coach |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Tokens, primitives `shared/ui`, typographie, couleur, densité, motion | Toucher au style |
| [`UX_RULES.md`](UX_RULES.md) | Standards UX/UI, **navigation**, **structure des pages**, états, onboarding, notifications | Toucher à une page |

**Parcours de lecture recommandé (≈ 45 min pour être opérationnel)** :
`CLAUDE.md` → ce README → `ARCHITECTURE.md` → le document du domaine touché.

> **Note de vérification.** L'état décrit dans cette documentation a été
> re-vérifié **ligne à ligne contre le code** le 2026-07-28 (base `ce7fde6`).
> Les écarts entre l'intention documentée et le code réel sont signalés
> explicitement, jamais lissés — voir [`ROADMAP.md` §6](ROADMAP.md) (dette).

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
(détail : [`PRODUCT.md`](PRODUCT.md)).

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
**coach déterministe de secours** (voir [`JARVIS.md` §6](JARVIS.md)).

**Portes de vérification avant tout push** (charte `CLAUDE.md`) :
`npx tsc --noEmit` · `bun run lint` · `bun run build` · `bun test` — les quatre
verts, sans exception.

---

## 5. Structure du dépôt

```
Trade-Vault/
├── CLAUDE.md                # Charte d'équipe — prime sur tout
├── README.md                # CE FICHIER — carte de la doc + démarrage
├── PRODUCT.md ROADMAP.md FEATURES_STATUS.md
├── ARCHITECTURE.md BACKEND.md DATABASE.md
├── AI_ARCHITECTURE.md JARVIS.md
├── DESIGN_SYSTEM.md UX_RULES.md
├── src/
│   ├── routes/              # Routing fichier TanStack (le seul routeur d'URL)
│   ├── app/                 # Couche présentation React (pages, composants, state, i18n)
│   ├── modules/             # Moteurs métier purs (sans React, sans IO direct)
│   ├── backend/             # Frontière serveur (server functions, crons, secrets)
│   ├── integrations/        # Client Supabase typé + middlewares d'auth
│   ├── shared/              # Helpers neutres + `shared/ui` (Design System)
│   ├── server.ts            # Entrée serveur : endpoints HTTP bruts + crons
│   └── styles.css           # Tokens `--tv-*`, glass, animations
├── supabase/                # Migrations SQL (additives) + edge function
├── tests/                   # bun:test — moteurs purs uniquement
├── scripts/ public/         # Preview local · assets PWA
└── vercel.json              # Crons + en-têtes de sécurité (CSP, HSTS…)
```

Détail des responsabilités et du sens des dépendances :
[`ARCHITECTURE.md` §2–3](ARCHITECTURE.md).

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
[`FEATURES_STATUS.md`](FEATURES_STATUS.md). Ce qu'on construit ensuite :
[`ROADMAP.md`](ROADMAP.md).
