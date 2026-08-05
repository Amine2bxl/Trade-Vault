# TradeVault — Product Bible

> **Statut** : référence officielle du produit. À maintenir à jour à chaque évolution.
> **Méthode** : chaque affirmation est vérifiée dans le code. Ce qui n'a pas pu être vérifié est
> signalé comme tel. Aucune fonctionnalité n'est décrite de mémoire ou par supposition.
> **Compagnons** : `AUDIT-PREMIUM.md` (technique) · `AUDIT-PRODUIT.md` (produit, page par page).
> Ce document ne les duplique pas : il les intègre et les dépasse.

**Volumétrie vérifiée** — 56 834 lignes TS/TSX · 9 routes · 23 pages · 35 composants ·
9 hooks · 64 modules · 17 fonctions serveur · 16 tables déployées + 3 en attente.

---

# SOMMAIRE

1. Vision
2. Utilisateur cible
3. Architecture produit
4. Architecture technique
5. Modèle de données
6. Documentation des fonctionnalités
7. Jarvis — documentation complète
8. Différenciation & moat
9. Boucles de rétention
10. Monétisation
11. Le principe directeur : *tout est construit, rien n'est branché*
12. Roadmap P0 → P3

---

# 1. VISION

## 1.1 Pourquoi TradeVault existe

Un trader perd rarement à cause d'un manque de connaissances. Il perd à cause d'un **écart entre
ce qu'il sait et ce qu'il fait** : il connaît sa taille de position maximale et la dépasse après
deux pertes ; il sait qu'il ne devrait pas trader le vendredi et le fait quand même.

Cet écart est **comportemental**, pas technique. Aucun indicateur ne le corrige. Aucun cours ne
le corrige. Seule une **boucle de rétroaction personnelle et répétée** le corrige.

TradeVault existe pour fermer cet écart.

## 1.2 Le problème réel — et pourquoi les concurrents échouent

Le problème n'est pas « les traders n'ont pas de journal ». Des dizaines existent, gratuits.
Le problème est :

> **Journaliser est un effort immédiat dont la récompense est différée de plusieurs semaines.**

C'est structurellement le pire schéma de rétention possible. C'est pourquoi la grande majorité
des journaux — papier, Notion, Excel, ou SaaS concurrents — sont abandonnés en quelques semaines.

**Ajouter des graphiques n'y change rien** : cela ajoute de la récompense différée à de la
récompense différée. C'est l'erreur que commettent tous les concurrents, et elle est structurelle,
pas cosmétique.

**La seule correction possible est de rapprocher la récompense de l'effort.** Le trader doit
obtenir quelque chose de valeur **le jour même où il journalise**, pas au bout de cinquante trades.

C'est précisément ce qu'un coach IA disposant de mémoire peut faire, et rien d'autre dans le
produit ne le peut.

## 1.3 Philosophie

Cinq principes, tous observables dans le code existant :

**1. Les chiffres sont déterministes ; l'IA les interprète, ne les invente jamais.**
Vérifiable : `ANTI_HALLUCINATION` (`coach.agent.ts`) impose comme sources exclusives les blocs
calculés par les moteurs. `answerToBlocks` ne fabrique aucun chiffre et omet un bloc quand la
donnée est trop mince. *C'est la fondation de la confiance — sans elle, le produit n'a aucune valeur.*

**2. Un coach, pas un assistant.**
Vérifiable : `coachIdentity()` proscrit explicitement « Great question », « Let's dive in », les
formules de politesse et les réponses interchangeables. Il impose un chiffre par affirmation et
80–160 mots. *Un assistant complaisant ne change aucun comportement.*

**3. Une seule IA, partout.**
Jarvis est présent sur la page de coaching, la checklist pré-market et l'accueil, avec une
identité unique. *La cohérence de personnalité est ce qui distingue un produit d'une collection
de fonctions.*

**4. Dire la chose inconfortable.**
Le point 4 de la persona impose de nommer le problème et d'en montrer le coût en argent. *Un
produit qui flatte ne fait pas progresser.*

**5. Dégradation gracieuse, jamais de page blanche.**
Vérifiable : `fallback-coach.ts` produit une réponse déterministe quand aucun provider n'est
disponible ; le circuit breaker isole un provider défaillant. *Le trader obtient toujours une
réponse fondée sur ses données.*

## 1.4 Positionnement

|  | Journaux classiques | ChatGPT + copier-coller | **TradeVault** |
|---|---|---|---|
| Chiffres fiables | ✅ | ❌ (hallucine) | ✅ déterministes |
| Interprétation | ❌ | ✅ | ✅ |
| Connaît le trader | ❌ | ❌ (oublie) | ⏸️ **construit, non branché** |
| Agit avant le trade | ❌ | ❌ | ✅ Checklist |
| Mesure si le conseil est suivi | ❌ | ❌ | ⏸️ **à construire** |

**La case décisive est l'avant-dernière ligne.** C'est la seule qu'un concurrent ne peut pas
cocher en copiant le code — et c'est aujourd'hui la seule non branchée.

---

# 2. UTILISATEUR CIBLE

## 2.1 Qui — déduit de l'onboarding réel

L'onboarding (`app/onboarding/Onboarding.tsx`, 787 L) collecte : prénom, taille de compte,
thème, notifications, et — via `describeProfile` — style, marché, expérience, **faiblesse
déclarée**, objectif, cible mensuelle.

**Ce que ce choix révèle du positionnement** : demander une *faiblesse déclarée* dès l'inscription
n'est pas neutre. Le produit s'adresse à un trader qui **admet déjà avoir un problème de
discipline**. Ce n'est ni le débutant curieux, ni le professionnel outillé : c'est le trader
intermédiaire qui a compris que le blocage est en lui.

## 2.2 Ses problèmes réels

1. Il sait quoi faire, il ne le fait pas systématiquement.
2. Il ne voit pas ses propres motifs (« mes vendredis » n'existe pas sans mesure).
3. Il abandonne son journal avant qu'il ne devienne utile.
4. Il ne sait pas s'il **progresse** — seulement s'il gagne ce mois-ci.

Le point 4 est sous-estimé : c'est le besoin émotionnel le plus fort, et aucune page n'y répond
aujourd'hui (`AUDIT-PRODUIT.md` § Analytics).

## 2.3 Parcours cible

```
Découverte (Landing SSR)
   → Inscription
   → Onboarding (prénom, capital, faiblesse, objectif)
   → Premier trade / import CSV
   → ⚠️ MOMENT CRITIQUE : première valeur perçue
   → Rituel quotidien (Checklist matin · Jarvis soir)
   → Habitude installée (~3 semaines)
   → Conversion payante
```

**Le point de rupture est le « moment critique ».** Entre le premier trade et la valeur perçue,
il y a aujourd'hui un vide : le produit attend d'avoir assez de données pour être utile. C'est
exactement là que les journaux concurrents perdent leurs utilisateurs.

---

# 3. ARCHITECTURE PRODUIT

## 3.1 Les 23 pages par fréquence naturelle

*(Analyse détaillée en 13 dimensions : `AUDIT-PRODUIT.md` Partie II.)*

| Fréquence | Pages | Rôle produit |
|---|---|---|
| **Quotidienne** | Dashboard · Checklist · Jarvis · Inbox | **Le rituel — 80 % de la valeur** |
| Par trade | Journal · LotSizeCalculator · MissedOpportunities | Capture |
| Hebdomadaire | Analytics · Mistakes · Calendar · Goals | Recul |
| Mensuelle | Reports · Seasonality · TradingPlan | Bilan |
| Ponctuelle | Onboarding · ChecklistWizard · Settings · Profile · Subscription · Appearance · Landing · Legal | Configuration |

**Constat structurant : 4 pages sur 23 créent l'habitude.** Le produit souffre de dispersion,
pas de manque de fonctionnalités. *Corollaire directeur : ne pas ajouter de 24ᵉ page.*

## 3.2 Le problème structurel n°1 — l'application n'a pas d'URL

**Vérifié** : toute l'app authentifiée vit dans `routes/index.tsx` → `App.tsx` (698 L), qui
navigue par `useState<Page>` et `{page === "x" && <X/>}`. `grep pushState|replaceState|popstate`
sur `app/` : **0 résultat**.

**Conséquences produit** (pas seulement techniques) :

| Symptôme | Conséquence business |
|---|---|
| Bouton retour inopérant | Sur Android, un retour **quitte l'application** |
| Aucune page partageable | Aucune acquisition organique par partage |
| **Aucune page traçable en analytics** | **Impossible de mesurer la rétention par page** |
| Duplication de la liste des pages | Union `Page` (`app/types.ts`) **et** tableau en dur dans `App.tsx` |

La troisième ligne est la plus grave : **elle rend toute décision produit fondée sur la donnée
impossible.** C'est pourquoi la mesure est P0 et non P2.

## 3.3 Workflows existants — vérifiés

**Ajout de trade** : `TradeModal` (1 171 L) → `useTrades` → cache TanStack Query → `trades` →
recalcul `computeStats` / `computeBehaviorSignals`.

**Question à Jarvis** : `ConversationWorkspace` → `buildCoachV1Payload` (stats, trades, mistakes,
signals, rules, profile) → `askCoach` (server fn, middleware `requireProAccess`) → `runCoach` →
context-builder → prompt-builder → provider-service → router (circuit breaker, métriques,
fallback) → `answerToBlocks` **côté client** → `BlockList`.

**Rapport mensuel** : `monthly-reports.server.ts` → `monthly_reports`.
**Notifications** : `push.functions.ts` + `usePushNotifications` → `notifications` → `Inbox`
(badge via `useUnreadCount`).
**Facturation** : `billing.server.ts` + `crypto-pay.server.ts` → `subscriptions`, idempotence
par `processed_webhook_events`.

---

# 4. ARCHITECTURE TECHNIQUE

## 4.1 Pile

TanStack Start (SSR) + React · TanStack Router (9 routes fichiers) · TanStack Query ·
Supabase (Postgres + RLS + Auth + Storage + Realtime) · Tailwind · Vercel · Bun (tests).

## 4.2 Couches

```
routes/          9 routes fichiers (dont /dev/ai, noindex)
app/             UI — 23 pages, 35 composants, 9 hooks
modules/         Domaine réutilisable — ai/, ai-provider/, voice/
backend/         17 fonctions serveur (createServerFn) + middlewares
integrations/    Client Supabase + types générés
supabase/        Migrations SQL
```

**Qualité observée** : la séparation `modules/` (logique pure, testable) vs `app/` (UI) est
respectée. **Aucun composant, page ou hook mort** — vérifié par analyse des imports. C'est
inhabituel et c'est un actif réel.

## 4.3 Abstraction provider IA — le point fort de l'architecture

`modules/ai-provider/` : `gemini.ts`, `anthropic.ts`, `openai.ts`, `registry.ts`, `types.ts`.
Changer de modèle = une variable d'environnement. Le contrat supporte déjà le *function calling*
de façon additive (`tools`, `toolCalls`), sans casser les appelants existants.

`modules/ai/runtime/` : `circuit.ts` (breaker), `metrics.ts`, `logger.ts`, `probe.ts`, `status.ts`.

*Jugement d'architecte : cette couche est de qualité production et n'a pas besoin d'être retouchée.*

## 4.4 Dettes techniques identifiées

| Dette | Preuve | Gravité |
|---|---|---|
| Pas d'URL par page | 0 usage History API | 🔴 |
| 470 tailles typographiques arbitraires dont **34 en 8–9 px** | grep | 🔴 |
| `aria-live` : **0** dans toute l'app | grep | 🟠 |
| **Deux systèmes i18n** : dictionnaire + ternaires `lang === "fr" ? … : …` | `TradingPlan`, `views`, `ChecklistWizard`, `Appearance` | 🟠 |
| ~105 couleurs hex en dur | grep | 🟠 |
| `Checklist.tsx` 2 244 L | wc | 🟠 |
| Code mort IA (`buildAIUserContext`, `buildCoachContext`, `loadMemory`, `forget`) | 0 appelant | 🟡 |
| `detectIntent` dupliqué | 2 implémentations | 🟡 |
| Double calcul signals/stats | memo + `buildCoachV1Payload` | 🟡 |

> **Précision méthodologique** : les quatre fichiers à « deux systèmes i18n » **sont traduits** —
> via ternaires en ligne, pas via le dictionnaire. Ce n'est pas un défaut de traduction mais une
> duplication de mécanisme. Ajouter une 3ᵉ langue exigerait de modifier des centaines de ternaires.

---

# 5. MODÈLE DE DONNÉES

## 5.1 Tables déployées (16)

| Table | Rôle | État |
|---|---|---|
| `profiles` | Profil utilisateur | ✅ |
| `accounts` | Sous-comptes de trading | ✅ |
| `trades` | **Le registre — cœur du produit** | ✅ |
| `user_preferences` | Préférences, thème, langue | ✅ |
| `goal_plans` | Objectifs et plans | ✅ |
| `notifications` | Centre de notifications → Inbox | ✅ |
| `monthly_reports` | Rapports mensuels | ✅ |
| `subscriptions` | Abonnements (`20260717100000_billing.sql`) | ✅ |
| `push_subscriptions` | Abonnements push navigateur | ✅ |
| `processed_webhook_events` | Idempotence webhooks paiement | ✅ |
| `economic_events` / `economic_calendar_sync` | Calendrier économique | ✅ |
| `ai_memory` | **Mémoire IA** (`profile`/`fact`/`lesson`/`conversation`) | ⚠️ **écrite 1×, jamais relue** |
| `ai_reports` | Rapports IA | ✅ |
| `ai_rate_limits` | Limitation de débit IA | ✅ |
| `habits` | **Habitudes + `streak`** | 🔴 **AUCUN code applicatif** |

## 5.2 Tables en attente (non appliquées)

`_pending_20260718160000_ai_os_foundation.sql` — **écrite, jamais appliquée** :
`ai_embeddings` (pgvector 1536), `ai_jobs` (file de tâches), `ai_agent_runs` (télémétrie :
provider, modèle, tokens, latence, statut).

**`ai_agent_runs` est exactement la table dont dépend toute l'observabilité (P0).**

## 5.3 La découverte la plus importante de cet audit

**La table `habits` contient un champ `streak` et n'est utilisée par aucune ligne de code
applicatif** (seule occurrence : les types générés Supabase).

C'est-à-dire : **le mécanisme de série — le levier de rétention le plus puissant pour un rituel
quotidien — est déjà modélisé en base et dort depuis des mois.** Il ne s'agit pas de le
concevoir, seulement de le brancher.

---

# 6. DOCUMENTATION DES FONCTIONNALITÉS

*Format : rôle · fonctionnement · données · composants · limites · évolution.*

## 6.1 Journalisation des trades
**Rôle** — Capturer chaque trade. Le socle de tout le reste.
**Fonctionnement** — `TradeModal` (1 171 L) → `useTrades` → TanStack Query → `trades`.
Multi-comptes via `accounts` + `AccountSwitcher` (811 L). Captures via `useScreenshotUrls` +
Supabase Storage. Import/export CSV.
**Limites** — Saisie manuelle ; aucune connexion courtier ; temps de saisie non mesuré.
**Évolution** — Mesurer le temps médian de journalisation (**indicateur de santé n°1**), puis
le réduire. Chaque seconde retirée augmente directement la rétention.

## 6.2 Moteurs d'analyse
**Rôle** — Produire des chiffres déterministes et fiables.
**Fonctionnement** — `computeStats` (`tradeCalcs.ts`), `computeBehaviorSignals`
(`behaviorSignals.ts` : jour de semaine, session, dérive de taille après perte, sur-trading,
fiabilité de l'auto-notation), détection d'erreurs récurrentes.
**Où** — Dashboard, Analytics, Mistakes, Calendar, et **payload de Jarvis**.
**Limites** — Recalculés côté client à chaque rendu ; double calcul avec `buildCoachV1Payload`.
**Évolution** — `behaviorSignals` est un actif différenciant : sa valeur croît avec le corpus.

## 6.3 Checklist pré-market
**Rôle** — Le rituel d'avant-séance. **La seule fonctionnalité qui intervient avant le trade,
donc la seule capable de changer un résultat plutôt que de le constater.**
**Fonctionnement** — `Checklist.tsx` (2 244 L) + `ChecklistWizard` + `checklist/voice.ts`
(Jarvis parle pendant la checklist) + `checklist_config` (migration `20260805000001`).
**Limites** — Items statiques ; aucune série ; aucun lien avec les erreurs détectées ni avec ce
que Jarvis a dit la veille.
**Évolution** — Brancher `habits.streak` · injecter la leçon de la veille · générer les items
depuis `behaviorSignals` · mesurer **P&L des jours avec checklist vs sans**.

## 6.4 Voix de Jarvis — *différenciateur sous-exploité*
**Rôle** — Incarner Jarvis vocalement.
**Fonctionnement vérifié** — `modules/voice/` (`localVoice.ts`), `app/utils/jarvisVoice.ts`,
`app/pages/checklist/voice.ts`, `backend/tts.functions.ts`. Hook `useJarvisVoice` → `speak()`,
`speaking`. **Voix clonée**, avec clips pré-rendus pour les phrases fixes et TTS pour le reste.
Utilisé dans `HomeWorkspace`, `FirstSessionWelcome`, Checklist.
Entrée vocale : Web Speech API dans `ConversationWorkspace` (micro).
**Jugement produit** — Une voix clonée cohérente est un **marqueur premium immédiat** et un
signal de sérieux que très peu de concurrents ont. C'est aujourd'hui **sous-exploité dans le
discours produit** : la Landing décrit Jarvis, elle ne le fait pas parler.
**Limites** — Coût TTS par appel ; pas de contrôle de débit ; accessibilité (pas d'alternative
textuelle annoncée).

## 6.5 Notifications & Inbox
**Fonctionnement** — `push.functions.ts`, `push-crypto.server.ts`, `usePushNotifications`,
`notifications`, `Inbox.tsx` (255 L), badge `useUnreadCount`, `goal-reminders.server.ts`,
`lifecycle-emails.server.ts` + `email-templates.server.ts`.
**Limites** — Le canal existe, **le contenu à forte valeur manque**.
**Évolution** — C'est le véhicule de la proactivité de Jarvis. Bien alimenté : 2ᵉ surface
quotidienne. Mal alimenté : **à supprimer** — un onglet vide coûte de la crédibilité.

## 6.6 Facturation
**Fonctionnement** — `billing.server.ts`, `crypto-pay.server.ts` (paiement crypto),
`subscriptions`, idempotence via `processed_webhook_events`, page `Subscription` (386 L).
**Gating** — `requireProAccess` (`backend/require-pro.ts`) : middleware **fail-closed** (refuse
en cas d'erreur DB — bon réflexe sécurité). Activation par `AI_REQUIRE_PRO="true"`, **une seule
variable, zéro changement de code**.
**État actuel vérifié** — `AI_REQUIRE_PRO` non activé : **accès libre pour tout utilisateur
connecté** (« free early access »). `FREE_DAILY_LIMIT = 5` (`aiUsage.ts`) est donc **prêt mais
inactif**.
**Jugement** — L'architecture de monétisation est propre et prête. La question ouverte n'est pas
technique, elle est stratégique : *sur quoi faire payer* (§10).

## 6.7 Calendrier économique · Saisonnalité · Calculateur
`economic-calendar.functions.ts` + `useEconomicCalendar` + `economic_events` ·
`Seasonality.tsx` (781 L, onglets Assets/Journal) · `LotSizeCalculator` (562 L).
**Jugement de différenciation** — Le calendrier et la saisonnalité d'actifs reposent sur des
**données achetées ou publiques : aucun moat**. Leur valeur devient réelle uniquement **croisée
avec les trades** (« tu perds les jours de CPI »). Le calculateur est un excellent **actif
d'acquisition SEO** s'il devient une page publique indexée.

---

# 7. JARVIS — DOCUMENTATION COMPLÈTE

## 7.1 Architecture vérifiée

```
app/components/jarvis/
├── JarvisShell.tsx        Enveloppe, navigation entre workspaces
├── workspaces.ts          Contrat de workspace (openWorkspace)
├── workspaces/
│   ├── HomeWorkspace          Accueil, suggestions, voix
│   ├── ConversationWorkspace  Chat multi-conversations
│   └── SettingsWorkspace      Préférences Jarvis
├── blocks.ts              Contrat de blocs (9 types)
├── BlockRenderer.tsx      Rendu des blocs
├── conversations.ts       ConversationStore (persistance)
├── history.ts             Sérialisation mémoire de conversation
├── context.ts · prefs.ts
└── insights/
    ├── answerToBlocks.ts  Prose LLM → blocs enrichis
    ├── suggestions.ts     Suggestions contextuelles
    └── memory.ts
```

## 7.2 Contrat de blocs — 9 types vérifiés

`markdown` · `stats` · `card` · `checklist` · `alert` · `hero` · `insight` · `mission` · `tool`

**Jugement d'architecte : c'est le meilleur choix de conception de tout le produit.** Une réponse
n'est pas du texte, c'est une **structure typée**. Conséquences : le rendu est découplé du modèle,
le streaming devient possible sans réécriture, et de nouveaux types s'ajoutent sans casser
l'existant. C'est ce qui rend Jarvis extensible vers une V2 sans refonte.

## 7.3 Chaîne d'exécution

```
Question
  → buildCoachV1Payload (stats · trades · mistakes · signals · rules · profile · conversation)
  → askCoach [server fn, middleware requireProAccess]
  → runCoach → context-builder → prompt-builder → provider-service
  → router (circuit breaker · métriques · fallback)
  → réponse markdown
  → answerToBlocks [CLIENT] → blocs enrichis
  → BlockList
```

**Point d'architecture notable** : l'enrichissement en blocs se fait **côté client**, à partir
des données déjà présentes. Le LLM n'a donc pas à produire du JSON structuré — il écrit de la
prose, et les chiffres viennent des moteurs déterministes. *C'est ce qui garantit qu'aucun chiffre
affiché ne peut être halluciné.* Décision de conception excellente, à préserver.

## 7.4 Mémoire — l'état réel

| Brique | État |
|---|---|
| Table `ai_memory` (4 kinds, RLS complète) | ✅ **déployée** |
| `memory.ts` — `loadMemory` / `remember` / `forget` | ✅ écrit |
| `context-builder.withMemory()` | ✅ **point d'injection existant** |
| `loadMemory` appelé par… | ❌ `buildAIUserContext` — **qui a 0 appelant** |
| `remember` appelé par… | ⚠️ **uniquement** le seeding du profil |
| `forget` appelé par… | ❌ **jamais** — aucun oubli n'existe |
| Ce qui atteint réellement le LLM | **Une ligne de profil** (`describeProfile`) |

**Conclusion sans ambiguïté : la mémoire de Jarvis est à ~0 %, pas à 80 %.**
Mais **rien n'est à concevoir ni à réécrire** — la table est déployée, le module est écrit, le
point d'injection existe. *Le tuyau est complet, il n'est pas raccordé.*

**Risque latent identifié** : `buildAIUserContext` chargeait 40 entrées × 2 000 caractères
≈ **20 000 tokens**. Inoffensif car mort — **dangereux si quelqu'un le ranime**. À supprimer,
pas à conserver.

## 7.5 Limites actuelles

1. **Aucune continuité** entre sessions.
2. **Aucune proactivité** — Jarvis ne parle jamais en premier.
3. **Aucun streaming** — 0 occurrence dans tout le dépôt ; `askCoach` est un `createServerFn`
   (RPC JSON) **structurellement incapable de SSE**.
4. **Aucune mesure de suivi** — impossible de savoir si une règle proposée a été tenue.
5. **Aucune validation post-réponse** — la prose peut citer un chiffre légèrement différent de
   la carte de preuve.
6. **Aucun `aria-live`** — les réponses n'existent pas pour un lecteur d'écran.

## 7.6 Vers la V2

Mémoire persistante → proactivité (via Inbox) → boucle règle/tenue/mesure → streaming →
validation numérique automatique → RAG sémantique (`ai_embeddings`, **uniquement si** la
recherche par mots-clés se révèle insuffisante — `ivfflat lists=100` est mal calibré sur un
petit corpus).

---

# 8. DIFFÉRENCIATION & MOAT

## 8.1 Classification de chaque fonctionnalité

### 🔴 Facilement copiable (jours à semaines)
Intégration LLM · design & UI · calculs de stats (formules publiques) · calendrier économique
(donnée achetée) · saisonnalité d'actifs · calculateur de lot · import/export CSV · thèmes.

### 🟠 Difficilement copiable (mois, ou expertise rare)
**Voix clonée cohérente** (production + identité) · contrat de blocs typés (conception) ·
architecture provider + circuit breaker · `behaviorSignals` (conception des détecteurs) ·
setups manqués (**concept original — personne ne journalise ce qu'il n'a pas pris**).

### ⭐ Véritable moat (impossible sans les données)
1. **Mémoire longitudinale du trader** — un concurrent qui clone le dépôt démarre avec une base
   vide. Un trader de 8 mois a un historique irréplicable. **Se renforce chaque jour, seul.**
2. **Boucle règle → tenue → mesure** — transforme un chatbot en coach.
3. **Détecteurs calibrés sur corpus réel** — des seuils issus de 10 000 traders ne se copient pas
   depuis GitHub.
4. **Checklist adaptative** — se réécrit depuis les erreurs réelles.

## 8.2 Comment durcir le copiable

| Fonctionnalité | Aujourd'hui | Durcissement |
|---|---|---|
| Calendrier économique | Commodité | **Croiser avec les trades** : « tu perds les jours de CPI » → devient propriétaire |
| Saisonnalité | Générique | Investir l'onglet *Journal* (saisonnalité **personnelle**), dégraisser *Assets* |
| Calculateur de lot | Isolé | Pré-remplir depuis le risque réel + historique de dérive |
| Analytics | Graphiques | Interprétation IA de chaque graphique |
| Reports | PDF | Comparaison temporelle + envoi automatique + format partageable |

**Principe unificateur** : *une donnée générique devient propriétaire dès qu'on la croise avec
l'historique du trader.* C'est la manière la moins coûteuse de transformer du copiable en moat.

## 8.3 Conclusion stratégique

**Les quatre moats reposent tous sur la même brique : la mémoire persistante.** Ce n'est pas
une fonctionnalité parmi d'autres — c'est **le socle de tout l'avantage concurrentiel**. Et c'est
la seule qui n'est pas branchée.

---

# 9. BOUCLES DE RÉTENTION

## 9.1 La boucle cible

```
Matin : Checklist (avec LA leçon d'hier injectée)
   ↓
Le trade
   ↓
Soir : journalisation (< 30 s)
   ↓
Jarvis réagit LE JOUR MÊME → 1 observation, 1 règle
   ↓
Lendemain : la règle apparaît dans la checklist
   ↓
Semaine suivante : « tenue 4 fois sur 5, +180 € »
   ↓
                (boucle fermée)
```

**Chaque maillon existe. Aucun ne parle au suivant.** C'est le cœur du travail à venir.

## 9.2 Par horizon

**Quotidien** — Checklist (déclencheur : ouverture des marchés) · Dashboard (déclencheur :
briefing génératif, **à créer**) · Inbox (déclencheur : observation de Jarvis, **à créer**).
*Levier le plus puissant et déjà modélisé : `habits.streak`.*

**Hebdomadaire** — Mistakes (**tendance** : « cette erreur recule de 40 % » — à créer) ·
Analytics · Goals (jalons + projection datée).

**Mensuel** — Reports. **Le levier n'est pas la page, c'est la livraison** : un rapport envoyé
par e-mail est lu ; un rapport qu'il faut aller chercher ne l'est pas. `lifecycle-emails.server.ts`
existe déjà.

## 9.3 Le signal de churn le plus fiable

**Le temps depuis la dernière journalisation.** Il n'est aujourd'hui ni calculé ni exposé.
C'est le meilleur déclencheur de réengagement du produit, et son coût d'implémentation est
quasi nul (`trades.created_at`).

---

# 10. MONÉTISATION

## 10.1 État vérifié
`AI_REQUIRE_PRO` inactif → accès complet pour tout utilisateur connecté.
`FREE_DAILY_LIMIT = 5` prêt mais non appliqué. Bascule = une variable d'environnement.

## 10.2 Recommandation — déplacer le mur payant

Le mur prévu (5 questions/jour) présente deux faiblesses structurelles :

1. **Il arrive trop tard.** Un utilisateur qui pose 5 questions par jour est déjà convaincu ;
   celui qui en pose une par semaine ne le heurtera jamais et ne convertira jamais.
2. **Il est quantitatif.** Limiter le *nombre* dit « paie pour plus de la même chose ». Un mur
   premium dit « paie pour ce que tu ne peux obtenir nulle part ailleurs ».

**Recommandation** : rendre l'usage ponctuel gratuit, et réserver au payant **la mémoire et la
continuité** — historique comportemental, suivi des règles dans le temps, rapports mensuels,
checklist adaptative.

**Justification** : cela aligne le mur payant sur le moat (§8). Le gratuit devient une démo
honnête et convaincante ; le payant devient littéralement introuvable ailleurs. C'est aussi le
seul découpage qui **augmente** la valeur perçue avec le temps d'usage.

## 10.3 Argument de rétention le plus fort
Sur la page `Subscription` : **« ce que tu perds en repassant gratuit »**, chiffré sur ses
propres données. Rien n'est plus efficace, et tout existe déjà pour le calculer.

---

# 11. LE PRINCIPE DIRECTEUR

Le fait le plus important de tout cet audit, et qui doit gouverner la roadmap :

> **TradeVault n'a pas un problème de fonctionnalités manquantes. Il a un problème de
> fonctionnalités construites et non branchées.**

| Brique | Construite | Branchée |
|---|---|---|
| Table `ai_memory` + module mémoire | ✅ | ❌ |
| Table `habits` (`streak`) | ✅ | ❌ |
| `ai_agent_runs` (télémétrie) | ✅ (en attente) | ❌ |
| `telemetry.ts` | ✅ types | ❌ pas de writer |
| `context-builder.withMemory()` | ✅ | ❌ |
| Page `/dev/ai` | ✅ | ⚠️ partielle |
| `forget()` | ✅ | ❌ |

**Conséquence sur la stratégie** : la phase qui vient n'est pas une phase de construction, c'est
une phase de **raccordement**. C'est une excellente nouvelle — le risque est bien plus faible, et
le rapport valeur/effort bien meilleur que ne le laisserait croire l'ampleur des objectifs.

---

# 12. ROADMAP

**Critère d'ordonnancement** : impact premium ÷ risque, avec une contrainte dure — *rien ne peut
être validé avant que la mesure existe*.

## P0 — Rendre le produit mesurable et navigable
*Sans ces deux lots, aucune décision produit ultérieure n'est démontrable.*

1. **Observabilité** — appliquer `_pending_ai_os_foundation.sql` · écrire le `TelemetryRecorder`
   (les types attendent) · étendre `/dev/ai` (latence, tokens, coût, modèles, erreurs, fallback).
   *Tranche au passage la question du budget de thinking restée ouverte sur la PR #143.*
2. **URLs** — migration vers routes réelles. Débloque navigation, partage, **analytics par page**,
   code-splitting. Travail mécanique, risque faible, gain de perception premium maximal.

## P1 — Le moat
3. **Mémoire de Jarvis** — brancher l'existant + migration additive (clé de dédup, TTL,
   `importance`, budget de tokens **dur**). Supprimer `buildAIUserContext` et sa bombe à
   20 000 tokens.
4. **Boucle règle → tenue → mesure** — rétention + conversion + moat simultanément.
5. **`habits.streak`** — brancher la table dormante sur la Checklist. *Effort très faible,
   effet rétention élevé.*

## P2 — La perception premium
6. **Design system** — échelle typographique 6 crans, plancher 12 px, tokens de couleur, lint
   bloquant sur `text-[…px]`. Relève les 23 pages d'un coup.
7. **Dashboard → briefing génératif.**
8. **Accessibilité** — `aria-live`, boutons-icônes, contrastes.
9. **Mistakes → tendances** · **Goals → jalons et projection datée**.

## P3 — Extension
10. **Streaming** — en dernier : le plus risqué (nouveau transport HTTP, `createServerFn`
    incapable de SSE, ré-implémentation de `requireProAccess`). Bénéficie de la télémétrie P0.
11. **Nettoyage** — code mort IA · dédup `detectIntent` · découpe `Checklist.tsx` (2 244 L) ·
    unification i18n.
12. **Croisements propriétaires** — news × trades, saisonnalité personnelle.
13. **Calculateur public indexé** — acquisition SEO.

---

# 13. LIMITES DE CE DOCUMENT

Par honnêteté intellectuelle, et parce qu'une bible qui ne distingue pas le vérifié du supposé
est dangereuse :

- **L'application n'a jamais été exécutée** dans cet environnement. Aucune capture, aucun
  parcours réel. **Tous les jugements d'interface sont des hypothèses informées issues de la
  lecture du code**, jamais des observations.
- **Aucune donnée d'usage réelle.** Les recommandations de suppression sont des *méthodes*, pas
  des verdicts.
- **Aucun entretien utilisateur.** Le portrait utilisateur (§2) est **déduit de l'onboarding**,
  ce qui est une inférence solide mais reste une inférence.
- **Aucune mesure de performance** (Lighthouse, LCP, bundle) : non exécutable ici.
- **Volets non audités** : SEO détaillé, sécurité applicative, conformité juridique, support.
- **Les priorités sont un raisonnement**, fondé sur une logique explicite et donc discutable.

**L'action la plus utile après lecture : livrer P0-1 (mesure), puis contredire ce document
avec des chiffres.**
