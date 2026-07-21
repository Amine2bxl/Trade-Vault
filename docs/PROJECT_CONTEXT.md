# TradeVault — PROJECT_CONTEXT.md

> **Mémoire permanente du projet.** Ce document permet à n'importe quelle IA
> (ou n'importe quel humain) de comprendre TradeVault **sans aucun historique de
> conversation**. Il synthétise et pointe vers les documents de référence
> détaillés. En cas de conflit : `CLAUDE.md` (charte) > ce document > le reste.
>
> Documents détaillés : [`ARCHITECTURE.md`](ARCHITECTURE.md) ·
> [`PRODUCT.md`](PRODUCT.md) · [`AI.md`](AI.md) ·
> [`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md) ·
> [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) · [`ROADMAP.md`](ROADMAP.md) ·
> [`ux-architecture.md`](ux-architecture.md) ·
> [`agents/ai-coach.md`](agents/ai-coach.md)

Dernière mise à jour : 2026-07-21 (post AI Coach V1, PR #59 mergée).

---

## 1. Vision

**TradeVault est un AI Trading Operating System** : le système d'exploitation
quotidien du trader particulier sérieux. Pas un journal de trading de plus —
un **coach IA qui connaît chacun de tes trades**, détecte tes schémas
destructeurs, se souvient de toi, et t'impose la discipline que tu n'arrives
pas à t'imposer seul.

Trois piliers de valeur (voir `PRODUCT.md`) :

1. **Comprendre** — journal + analytics + moteur d'analyse déterministe
   (scores de qualité, erreurs récurrentes chiffrées, patterns).
2. **Se souvenir & alerter** — mémoire IA long terme, insights proactifs,
   rapports, notifications.
3. **Discipliner** — checklist pré-market, plan de trading, objectifs, règles,
   moteur de discipline.

**En une phrase** : la coque (journal/analytics/checklist) est la meilleure du
marché mais non différenciante ; **l'âme du produit est le coach IA + la
discipline** — c'est là que tout l'effort produit doit aller.

---

## 2. Positionnement

- **Catégorie** : "AI Trading Coach" — au-dessus des journaux de trading
  classiques (qui documentent le passé) : TradeVault interprète, se souvient
  et intervient.
- **Concurrents** : Tradezella (~24–33 $/mois), TraderSync, Edgewonk (~169 $ à
  vie), Tradervue, et le duo Notion/Excel. Tous couvrent le journal + stats ;
  **aucun n'a un coach qui se souvient du trader**.
- **Différenciation défendable** : (a) coach IA avec mémoire et données réelles
  du trader, (b) moteur de discipline (checklist, règles, streaks), (c) UX
  premium mobile-first, (d) coût IA maîtrisé par une plateforme
  provider-agnostique.
- **Anti-positionnement** : TradeVault ne prédit **jamais** le marché, ne donne
  **jamais** de conseil financier, ne passe **jamais** d'ordres. L'IA analyse
  uniquement le passé du trader.

---

## 3. ICP (Ideal Customer Profile)

- **Cœur de cible** : trader particulier actif (futures, forex, crypto,
  actions), souvent en challenge **prop-firm** (FTMO, Apex, Topstep…), 20–40
  ans, mobile-first, francophone et anglophone (l'app est i18n FR/EN).
- **Douleur n°1** : il sait *quoi* faire mais ne le fait pas — overtrading,
  revenge trading, non-respect du plan. Il perd de l'argent à cause de sa
  psychologie, pas de sa stratégie.
- **Douleur n°2** : ses données sont éparpillées (screenshots, Excel, mémoire)
  et il ne voit pas ses patterns.
- **Signal d'achat** : a déjà cramé au moins un compte / un challenge prop-firm
  à cause de la discipline.
- **Proxy produit** : l'onboarding capture style, expérience, faiblesse
  principale ("pain"), objectif mensuel, usage des concepts ICT — ce profil
  nourrit la mémoire du coach.

---

## 4. Architecture (résumé exécutable)

Détails complets : `ARCHITECTURE.md`. Règles inviolables : `CLAUDE.md`.

### 4.1 Couches et sens des dépendances

```
src/routes/    →  fichiers de routes TanStack Start (fins, zéro logique)
src/app/       →  UI React (pages, composants, hooks, contexts, i18n, store)
src/modules/   →  moteurs métier PURS (déterministes, sans IO, sans React)
src/backend/   →  server functions (secrets, IA, emails, billing, crons)
src/shared/    →  helpers neutres + shared/ui (primitives Design System)
```

- **`src/app/` importe `src/modules/` — JAMAIS l'inverse.** Aucune logique
  métier dans les composants React.
- `src/shared/` n'importe jamais `src/app/`. Exception encadrée :
  `src/shared/ui/` peut utiliser React (primitives feuilles) mais n'importe
  jamais l'app.
- **Moteurs purs** : le Trade Analysis Engine (`modules/trading/analysis`) est
  déterministe, sans IO ni IA. **L'IA interprète les scores, elle ne les
  recalcule jamais.**
- **Extension par plug-in** : nouvelle fonctionnalité = nouvel événement sur le
  bus (`modules/events`) + nouveau listener/step. On n'édite pas un moteur
  existant pour en brancher un autre.
- **Persistance** : ce qui doit survivre au runtime va en DB Supabase avec
  **RLS owner-only** ; le bus d'événements est par-runtime (in-memory).
- **Migrations additives uniquement** : ne jamais casser table ou donnée.

### 4.2 Flux de données type (cycle de vie d'un trade)

1. L'UI (TradeModal) crée/édite un trade → **optimistic update** immédiat dans
   le state local (l'UI n'attend jamais le réseau).
2. Persistance Supabase (Postgres, RLS owner-only) en arrière-plan.
3. `computeStats(trades)` (`app/utils/tradeCalcs`) recalcule les stats
   dérivées ; le moteur d'analyse produit scores et `mistakeStats`.
4. Événements émis sur le bus → listeners (notifications, discipline,
   automation) réagissent sans couplage.
5. Les surfaces IA reçoivent des **payloads dérivés** (jamais la DB en direct
   côté client) via les server functions.

---

## 5. Stack

| Domaine | Choix |
| --- | --- |
| Framework | **TanStack Start** (file-based routing, server functions) |
| UI | **React 19**, **TypeScript strict** |
| Styles | **Tailwind v4** (+ tokens CSS `--tv-*`), Radix UI, lucide-react |
| Charts | Recharts (via `shared/ui/Chart.tsx`) |
| Backend/DB | **Supabase** : Postgres + **RLS owner-only** + Auth + Storage |
| Build/Runtime | Vite, **Bun** (dev + tests `bun:test`), Nitro → **Vercel** |
| IA | Plateforme provider-agnostique : **Gemini** (défaut) / **Anthropic** / **OpenAI-compatible**, sélection par env `AI_PROVIDER` |
| Emails/Crons | Server functions + `vercel.json` crons (rapports mensuels `0 6 1 * *`, lifecycle emails `0 8 * * *`) |

Commandes : `bun run dev` · `bun run build` · `bun run lint` ·
`bun run format` · `bun test`. Gates de vérification avant tout push :
`npx tsc --noEmit` (exit 0) + `npx vite build` + `bun test` (46 tests, 4
fichiers).

Production : Vercel, ref Supabase `tjikygsipblatubyzbrt`, URL publique
`https://tradevaultt.vercel.app`. CSP headers dans `vercel.json`.

---

## 6. Structure du repo

```
Trade-Vault/
├── CLAUDE.md                  # Charte permanente de l'équipe (PRIME SUR TOUT)
├── docs/
│   ├── PROJECT_CONTEXT.md     # CE FICHIER — mémoire permanente
│   ├── ARCHITECTURE.md        # Guide onboarding dev (< 30 min)
│   ├── PRODUCT.md             # Référence produit officielle
│   ├── AI.md                  # Stratégie IA 24 mois
│   ├── AI-ARCHITECTURE.md     # Blueprint AI Platform (8 sous-systèmes)
│   ├── DESIGN-SYSTEM.md       # Diagnostic + plan Design System
│   ├── ROADMAP.md             # Source de vérité audits + priorités P0→P3
│   ├── ux-architecture.md     # Principes UX structurants
│   └── agents/ai-coach.md     # Spec complète de l'agent AI Coach
├── src/
│   ├── routes/                # __root, index, privacy, terms, reset-password
│   ├── app/
│   │   ├── App.tsx            # Shell applicatif (auth, navigation, layout)
│   │   ├── pages/             # Dashboard, Journal, Analytics, Insights,
│   │   │                      # CalendarPage, Goals, Mistakes, Checklist(+Wizard),
│   │   │                      # TradingPlan, Reports, Seasonality, EconomicNews,
│   │   │                      # MissedOpportunities, LotSizeCalculator, Landing,
│   │   │                      # Profile, Settings, Subscription, Appearance…
│   │   ├── components/        # TradeModal, TradeDetailModal, AiAssistant,
│   │   │                      # Sidebar, MobileNav, CommandPalette, EquityChart,
│   │   │                      # ImportCsvModal, Trustpilot* (⚠️ ZONE GELÉE)…
│   │   ├── contexts/ hooks/ i18n/ onboarding/ store(.ts) utils/ types.ts
│   ├── modules/
│   │   ├── trading/analysis/  # Trade Analysis Engine (pur, déterministe)
│   │   ├── ai/                # AI Platform : infra.ts (barrel), router/,
│   │   │                      # provider-service, context-builder, context,
│   │   │                      # prompt-builder, tools/, response-formatter,
│   │   │                      # memory, telemetry, agents/ (coach.agent.ts),
│   │   │                      # jobs/, rag/, mcp/
│   │   ├── ai-provider/       # types, registry, gemini, anthropic, openai
│   │   ├── events/            # bus in-memory typé (par-runtime)
│   │   ├── discipline/        # moteur discipline (règles, streaks)
│   │   ├── notifications/     # moteur + store notifications
│   │   └── automation/        # moteur d'automatisations
│   ├── backend/               # createServerFn : ai.functions, coach.functions,
│   │                          # require-pro (auth+rate-limit), billing,
│   │                          # crypto-pay, push, reports, monthly-reports,
│   │                          # lifecycle-emails, goal-reminders, email-templates
│   ├── shared/
│   │   ├── ui/                # DESIGN SYSTEM : Button, Input, Card, Badge,
│   │   │                      # Table, Modal, Chart, Typography, cn, tokens
│   │   └── error-*.ts, lock-zoom.ts
│   └── styles.css             # Tokens --tv-*, glass, animations, .btn-*
├── tests/                     # bun:test — aiInfra, coach, etc. (46 tests)
├── vercel.json                # crons + CSP
└── .env.example               # Toutes les env vars documentées
```

---

## 7. Conventions

### Code

- **TypeScript strict** partout ; pas de `any` gratuit (typages minimaux
  documentés quand une API DOM manque, cf. Web Speech dans `AiAssistant`).
- Composants React : `PascalCase.tsx`, un composant par fichier, props typées
  par `interface XxxProps`.
- Hooks : `useXxx` dans `app/hooks/`. Utils : `camelCase.ts` dans `app/utils/`.
- Moteurs : `modules/<domaine>/{types.ts, engine.ts, index.ts}` — fonctions
  pures exportées, testables sans mock.
- Server functions : `src/backend/<domaine>.functions.ts`, toujours
  `createServerFn` + **validation Zod avec caps de taille** + middleware
  `requireProAccess` (auth + rate-limit) pour l'IA.
- Imports alias : `@/` = `src/`.
- Commentaires : uniquement pour les contraintes que le code ne montre pas.
- i18n : aucune chaîne UI en dur — tout passe par `useT()` (`t("ns.key")`),
  FR + EN.

### Git / livraison

- Branche de travail : `claude/tradevault-tech-guidelines-10l4y0`. **Jamais**
  de push sur une autre branche sans permission explicite.
- Cycle : dev sur la branche → gates verts → push → **PR draft** → ready →
  **squash merge** → re-baser la branche sur `origin/main`
  (`git checkout -B <branche> origin/main`).
- Messages de commit clairs, en français, orientés valeur produit.
- Migrations DB : **additives uniquement**.

### Vérifications systématiques (après chaque implémentation)

1. `bun run lint`, `npx tsc --noEmit`, `npx vite build`, `bun test`.
2. Performance : pas de N+1, pas de blocage UI, l'optimistic UI n'attend jamais.
3. Sécurité : RLS, auth, validation d'entrée, **aucun secret côté client**.
4. Compatibilité IA future : moteurs découplés, provider-agnostique.

---

## 8. Fonctionnalités existantes (livrées)

### Cœur trading

- **Journal de trades** complet : CRUD, screenshots (Supabase Storage),
  stratégies, confluences, erreurs (mistakes), qualité de setup, notes,
  R-multiple ; import CSV.
- **Dashboard** : stats clés, equity curve, streaks, optimistic UI.
- **Analytics** : win rate, profit factor, drawdown, par symbole / jour /
  stratégie ; **Seasonality** ; **CalendarPage** (vue calendrier P&L).
- **Mistakes** : erreurs récurrentes chiffrées (count + P&L total) issues du
  moteur déterministe.
- **Missed Opportunities** : journal des setups manqués.
- **Goals** : objectifs (win rate, P&L…) avec cible/actuel + rappels
  (goal-reminders cron).
- **Checklist pré-market** (+ Wizard) : discipline quotidienne, peut ouvrir le
  coach avec un prompt prérempli (event `tv:ask-coach`).
- **Trading Plan**, **Lot Size Calculator**, **Economic News**.
- **Reports** : rapports mensuels générés + envoyés par cron.

### IA (état réel)

- **AI Platform infra livrée** (`modules/ai` + `modules/ai-provider`) :
  Router (`createRouter`/`defaultRouter`), Provider Service (`generate`,
  `runWithTools` avec retry + télémétrie), Context Builder (fluent, caps :
  500 trades / 40 mistakes / 10 goals / 20 tours), Prompt Builder, Tool System
  (`toProviderTools`, `executeToolCalls` — refuse les side-effects non
  autorisés), Response Formatter (Zod optionnel, ne throw jamais).
  Providers : Gemini (défaut), Anthropic (tool-calling), OpenAI-compatible
  (tool-calling). Changer de modèle = une variable d'environnement.
- **AI Coach V1 en production** (`agents/coach.agent.ts` +
  `backend/coach.functions.ts` + surfaces `AiAssistant` (widget flottant,
  multi-tours, voix, persistance locale par user) et page `Insights` (quick
  prompts)). Capacités : lire stats, trades, erreurs, objectifs, répondre.
  **Règle absolue `ANTI_HALLUCINATION`** : le coach ne cite que les blocs de
  données fournis, dit quand la donnée manque, n'invente jamais, ne prédit
  jamais le marché. Payload construit côté client par `buildCoachV1Payload`
  (synchrone, zéro lecture DB). V1 = **pas** de mémoire longue durée, **pas**
  de proactivité, **pas** d'agents secondaires.
- Mémoire IA (`ai_memory`, seed du profil onboarding via `seedProfileMemory`)
  existe en fondation mais n'est **pas** injectée dans le Coach V1 (scope V2).

### Plateforme / growth

- Auth Supabase, onboarding profilé, i18n FR/EN, PWA + push notifications,
  Command Palette, thèmes (Appearance), abonnement (Stripe billing +
  crypto-pay), emails lifecycle, page légale (privacy/terms), landing
  marketing premium, **widget Trustpilot (⚠️ GELÉ — vrais avis en cours, ne
  jamais toucher)**.

### Design System (`src/shared/ui`)

Primitives centralisées : `Button` (primary/ghost/subtle/danger), `Input`/
`Textarea`/`Select`/`Field` (chaîne `FIELD_BASE` exacte), `Card`
(glass/glass-strong/plain), `Badge` (neutral/profit/loss/warning/accent),
`Table`, `Modal` (composable : Esc, scroll-lock, aria, tailles), `Chart`
(ChartContainer + re-exports Recharts), `Typography`
(Display/Heading/Text/Label), `cn`, `tokens.ts`. Les tokens **pointent** vers
le CSS existant (thème de la landing = âme visuelle) — zéro nouvelle valeur,
zéro changement de rendu. Adoption progressive en cours (Modals + Inputs
migrés) ; le reste par lots avec build vert à chaque lot.

---

## 9. Fonctionnalités prévues (roadmap)

Source de vérité : `ROADMAP.md` (P0→P3) et `AI.md` (24 mois). Résumé :

- **P0 — combler l'écart promesse/produit ("l'âme")** :
  1. Coach avec **mémoire long terme** réellement branchée (V2) : le coach se
     souvient du profil, des faiblesses, des conversations passées.
  2. **Insights proactifs** : le produit vient au trader (détection de pattern
     → notification), pas l'inverse.
  3. **Daily Brief** (avant session) et **Weekly Review** (bilan hebdo
     automatique).
- **P1** : agents secondaires (Risk Analyst, Journal Assistant), rapport de
  valeur chiffrée ("la checklist t'a évité X €"), amélioration rétention
  (streaks, emails comportementaux).
- **P2** : tool-calling en production pour le coach (requêtes à la demande),
  RAG sur les notes de journal, import brokers automatique.
- **P3** : fond/dette — adoption Design System complète (Cards/Badges,
  landing), suite des migrations modals, télémétrie coûts IA en DB.

Critère go/no-go pour TOUTE fonctionnalité (cf. `CLAUDE.md`) : elle doit
servir **au moins un** de : conversion, rétention, valeur perçue,
différenciation, réduction du churn, productivité du trader. Sinon : ne pas
coder, proposer une alternative.

---

## 10. Stratégie IA

Détails : `AI.md` (stratégie) et `AI-ARCHITECTURE.md` (blueprint technique).

- **Principe fondateur** : une **AI Platform**, pas un chatbot. 8
  sous-systèmes : Router, Memory, Context Builder, Prompt Builder, Tool
  Calling, Agent System, Providers, Services.
- **Provider-agnostique absolu** : l'application ne sait jamais quel modèle
  répond. `AI_PROVIDER` + clés (`GEMINI_API_KEY` défaut, `ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`OPENAI_MODEL`). Changer de modèle =
  une env var, zéro refactor.
- **Déterminisme d'abord** : tous les chiffres (stats, scores, mistakes)
  viennent des moteurs purs. L'IA **interprète**, ne calcule jamais. C'est la
  défense n°1 contre l'hallucination et le coût.
- **Grounding strict** : chaque agent reçoit des blocs de contexte plafonnés
  (caps de `CONTEXT_CAPS`) + la règle `ANTI_HALLUCINATION`. Un agent qui n'a
  pas la donnée le dit.
- **Sécurité IA** : secrets uniquement côté serveur (server functions), Zod
  avec tailles max sur toute entrée, `requireProAccess` (auth + rate-limit),
  RLS owner-only sur toute persistance IA (`ai_memory`, futurs
  `ai_insights`/`ai_reports`).
- **Coûts** : payloads compacts (stats scalaires, trades résumés), caps
  stricts, retry unique sur erreur transitoire, hook `onUsage` pour la
  télémétrie ; le défaut Gemini = coût faible ; montée en gamme par env var.
- **Extension** : nouvel agent = nouveau fichier dans `modules/ai/agents/` +
  server function dédiée + spec dans `docs/agents/`. On ne modifie pas le
  coach pour créer autre chose.
- **Beta actuelle** : tout est **GRATUIT** — `AI_REQUIRE_PRO=false`. Ne pas
  réactiver le paywall sans décision explicite du fondateur.

---

## 11. Principes UX

Détails : `ux-architecture.md`.

- **Mobile-first réel** : bottom nav mobile, sidebar desktop, widget coach
  flottant, gestes (swipe sur TradeDetailModal).
- **L'optimistic UI n'attend jamais** : toute action utilisateur répond
  instantanément ; le réseau rattrape en arrière-plan.
- **Zéro friction de saisie** : le journal doit être plus rapide qu'Excel —
  quick prompts, valeurs par défaut, import CSV, voix (Web Speech) sur le
  coach.
- **Le produit vient au trader** (cible) : notifications, rappels d'objectifs,
  briefs — l'utilisateur ne doit pas avoir à chercher sa valeur.
- **Continuité** : conversations et brouillons du coach persistés par
  utilisateur (localStorage namespacé `nsKey(userId, …)`) ; pages découplées
  qui parlent au coach via l'événement `tv:ask-coach`.
- **i18n natif** : FR/EN partout, la langue de l'UI pilote la langue des
  réponses IA.
- **États toujours gérés** : loading (skeletons/spinners), vide (empty states
  pédagogiques), erreur (messages doux, jamais de stack trace).

---

## 12. Principes design

Détails : `DESIGN-SYSTEM.md`.

- **Le thème de la landing est l'âme et le squelette visuel** du produit :
  fond `#060d16`, glassmorphism (`glass`, `glass-strong`), dégradés
  cyan→teal (marque), polices **Manrope** (corps) / **Sora** (display,
  `font-display`), easing signature `cubic-bezier(0.16, 1, 0.3, 1)`,
  animations `animate-slide-up` / `animate-slide-in` / `animate-fade-in-up`.
- **Source unique** : `src/shared/ui` + `tokens.ts`. Les tokens pointent vers
  le CSS existant (`--tv-*`) — on ne crée pas de deuxième système. Les tokens
  ne servent **pas** à construire des classes Tailwind dynamiques (le JIT ne
  les verrait pas).
- **Sémantique P&L** : profit = emerald-500, perte = red-500, warning =
  amber-500 — via `Badge`/tokens, pas de nouvelles nuances ad hoc.
- **Dette connue (à résorber, jamais en urgence)** : ~300 tailles de police
  arbitraires (`text-[10px]`/`text-[11px]`…), anciens tokens shadcn oklch
  morts, quelques modals non migrées. Résorption **progressive, byte-identical
  d'abord**, build vert à chaque lot.
- **Toute nouvelle UI** utilise `shared/ui` d'office ; on ne re-crée jamais un
  bouton/input/modal à la main.

---

## 13. Règles produit (non négociables)

1. **Charte `CLAUDE.md` d'abord** : raisonner CTO + Staff Engineer + PM ;
   axes de décision dans l'ordre — simplicité, performance, sécurité,
   scalabilité, maintenabilité, UX, ROI.
2. **Go/no-go** : aucune fonctionnalité sans impact sur conversion, rétention,
   valeur perçue, différenciation, churn ou productivité du trader.
3. **Aucune régression, jamais** : gates verts obligatoires ; en cas de doute,
   l'option conservatrice gagne.
4. **Zone gelée Trustpilot** : `TrustpilotWidget`/`TrustpilotPrompt` et tout
   ce qui touche aux avis — **ne pas modifier** (vrais avis clients en cours).
5. **Beta gratuite** : `AI_REQUIRE_PRO=false` ; pricing cible (Free / Pro
   24,99 €/mois / Annuel 239 €) documenté dans `PRODUCT.md` mais non activé.
6. **L'IA n'invente jamais** : données réelles du trader uniquement, jamais de
   prédiction de marché, jamais de conseil financier.
7. **Sécurité** : RLS owner-only sur toute table utilisateur ; secrets
   exclusivement côté serveur ; validation Zod plafonnée sur toute entrée ;
   jamais de clé dans le client, les commits ou les docs.
8. **Migrations additives** ; le bus d'événements reste par-runtime ; ce qui
   doit survivre va en DB.
9. **Scalabilité cible** : des dizaines de milliers d'utilisateurs — pas de
   N+1, payloads plafonnés, coûts IA bornés.
10. **Langue** : produit bilingue FR/EN ; docs internes en français.

---

## 14. Comment démarrer (pour une IA ou un dev sans contexte)

1. Lire `CLAUDE.md` (5 min) — la charte prime sur tout.
2. Lire ce fichier (10 min) — la carte du territoire.
3. Selon la tâche : `ARCHITECTURE.md` (code), `PRODUCT.md`/`ROADMAP.md`
   (produit), `AI.md`/`AI-ARCHITECTURE.md`/`agents/ai-coach.md` (IA),
   `DESIGN-SYSTEM.md`/`ux-architecture.md` (UI/UX).
4. Vérifier l'état : `git log --oneline -5`, `bun test`, `npx tsc --noEmit`.
5. Travailler sur la branche désignée, gates verts, PR draft, squash merge.

> **Maintenance de ce fichier** : mettre à jour la section concernée à chaque
> livraison structurante (nouvelle capacité IA, nouveau moteur, changement de
> positionnement ou de pricing). Un PROJECT_CONTEXT périmé est pire qu'absent.
