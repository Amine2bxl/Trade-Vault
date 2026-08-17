# Phase 0 — Intelligence Foundation (Claim → Evidence, Deep Links, Intent, Proactive Loop)

> **Statut:** spec d'implémentation — à relire avant tout code.
> **Règle:** ne jamais créer un 2e système quand un existant peut être étendu ; ne jamais créer une 2e définition d'une métrique existante.
> **Question de succès:** « TradeVault comprend-il mieux le trader qu'avant, et cette compréhension produit-elle une action utile ? »

---

## 1. Architecture actuelle (audit précis)

### 1.1 Ce qui existe déjà — et qu'il faut **étendre/reier**, pas recréer

| Brique | Emplacement | Verdict |
|---|---|---|
| Insight type (confidence, sampleSize, evidence, impact, mission) | `src/app/components/jarvis/insights/types.ts` (`JarvisInsight`) | **EXISTE → EXTENDRE** |
| Garde de confiance (`validated` / `learning`) | `jarvis/insights/types.ts` (`JarvisConfidence`) | **EXISTE → EXTENDRE** |
| Détecteurs déterministes (risk-after-loss, overtrading, costliest, discipline-streak, rule-kept) | `jarvis/insights/detectors/*.ts` | **EXISTE → EXTENDRE** |
| Signaux comportementaux agrégés (riskAfterLoss, overtrading…) | `src/app/utils/behaviorSignals.ts` | **EXISTE → EXTENDRE** |
| Garde-fous statistiques (MIN_TRADES=30, MIN_SESSIONS, MIN_GROUP, planchers d'effet, correction multi-comparaison) | `src/modules/patterns/thresholds.ts` | **EXISTE → EXTENDRE (canoniser)** |
| Moteur de patterns (scan, persist, proposals, writer) | `src/modules/patterns/**` | **EXISTE → RELIER** |
| Proposals (agent → trader, accept path) | `agent_proposals` + `src/backend/proposals.functions.ts` | **EXISTE → RELIER** |
| Moteur de probabilité (bootstrap, run/compare/scenario/sensitivity, goals forecast) | `src/modules/probability/**` | **EXISTE → RELIER** |
| Discipline (checkTrade, day summary, events) | `src/modules/discipline/**` | **EXISTE → EXTENDRE** |
| Monte Carlo UI + prop firms (Apex/Topstep) | `src/app/pages/MonteCarlo.tsx`, `utils/propFirms.ts` | **EXISTE → RELIER** |
| Goals + plan 6 mois | `goal_plans`, `src/app/pages/Goals.tsx`, `modules/probability/goals.ts` | **EXISTE → EXTENDRE** |
| Routing par chemin `/analytics`, `/journal`… + `buildPageUrl` qui préserve les query params | `src/app/utils/pageUrl.ts` | **EXISTE → RELIER (deep links)** |
| Mémoire Jarvis (extract/select, RAG) | `src/modules/ai/memory*.ts`, table `ai_memory` | **EXISTE → EXTENDRE** |
| Automation engine (tradeSaved → side effects) | `src/modules/automation` | **EXISTE → RELIER** |
| Sessions | table `trading_sessions` | **EXISTE → RELIER** |

### 1.2 Ce qui n'existe pas et qu'il faut **créer**

| Brique | Verdict |
|---|---|
| Modèle de **filtres unifié** partagé entre pages | **N'EXISTE PAS → CRÉER** |
| **Capture d'intention** avant trade | **N'EXISTE PAS → CRÉER** |
| **Réflexion après trade** (plan respecté + pourquoi) | **N'EXISTE PAS → CRÉER** |
| **Deep-links** pilotés par query params | **MAL CONNECTÉ → RELIER** |
| **Claim → Evidence** complet (claim, comparison, affected_trades, deep_link, status) | **EXISTE PARTIELLEMENT → EXTENDRE** |
| **Edge Engine** unifié avec tiers de confiance | **MAL CONNECTÉ → CRÉER** (au-dessus de l'existant) |

### 1.3 Tables existantes (source unique de vérité)

`trades`, `trading_sessions`, `missed_opportunities`, `goal_plans`, `detected_patterns`, `agent_proposals`, `ai_memory`, `ai_agent_runs`, `simulation_scenarios`, `profiles`, `accounts`, `subscriptions`, `economic_events`.

### 1.4 Flux de données actuel

```
trade (journal) → computeStats / computeQuantStats (analytics)
               → computeBehaviorSignals (signaux)
               → detectors (insights) → Jarvis (chat, réactif)
               → patterns (scan → persist → proposals)
               → DisciplineEngine (checkTrade → events → notifications)
               → AutomationEngine (tradeSaved → side effects)
```

**Problème:** les détecteurs produisent des *chiffres agrégés*, mais **jamais les `trade_id` concernés**. Donc impossible de « voir les 8 trades ». Et il n'y a **aucun filtre partagé** pour qu'un deep-link ouvre une page déjà filtrée.

---

## 2. Le nouveau flux cible (Phase 0)

```
trade (avec intent + reflection) → computeStats / behaviorSignals
   → detectors qui retournent AUSSI les trade_id concernés
   → JarvisInsight enrichi (claim, comparison, affected_trades, deep_link, status)
   → rendu « claim → evidence → [voir les N trades] »
   → deep-link = /analytics?<filtre unifié> (ou /journal, /missed)
   → la page lit le filtre partagé et s'ouvre filtrée
```

Le principe: **les détecteurs sont la source du claim; le filtre unifié est le moyen de le prouver en un clic.**

---

## 3. Spec par bloc

### 3.1 CLAIM → EVIDENCE ENGINE — `EXISTE → EXTENDRE`

**On étend** `JarvisInsight` (pas de nouveau type). Champs ajoutés:

```ts
interface JarvisInsight {
  // existants
  moment, pattern, priority, confidence, sampleSize, evidence, impact, mission;
  // nouveaux
  claim: string;                    // la phrase, en langage naturel, générée depuis le copy
  comparison: { label: string; value: number; baseline: number; deltaPct: number }; // ex "25% vs 54%"
  timeRange: { from: string; to: string };
  affectedTrades: string[];         // trade_id — NOUVEAU, le détecteur doit les retourner
  deepLink: string;                 // construit depuis le filtre unifié
  status: InsightStatus;            // "confirmed" | "insufficient" | "contradicted" | "progressing" | "disappeared"
  recommendedAction: string;        // l'action concrète (déjà présent via mission[], on la structure)
}
```

**Changement clé dans les détecteurs:** `computeBehaviorSignals` (et les détecteurs) doivent **retourner les `trade_id`** du groupe comparé, pas seulement le count. Aujourd'hui `riskAfterLoss` retourne `tradesAfterLoss: number` ; il faut `afterLossTradeIds: string[]`. Idem pour les autres signaux.

**Statut d'un insight** (comparaison dans le temps — déjà faisable car on a l'historique):
- `confirmed` : pattern présent, seuils franchis.
- `insufficient` : sous `MIN_TRADES` (on affiche « il manque N trades », pas une conclusion).
- `contradicted` : le pattern s'est inversé récemment.
- `progressing` / `disappeared` : l'écart se réduit / a disparu (feedback loop → le coach dit « tu progresses »).

**Garde-fous:** réutiliser `patterns/thresholds.ts` comme source canonique (MIN_TRADES, MIN_GROUP, planchers d'effet, `comparisons`). Ne **jamais** afficher un chiffre sans son `n`.

**Verdict:** `EXISTE → EXTENDRE` (`JarvisInsight`, détecteurs, `behaviorSignals`, `thresholds`).

### 3.2 DEEP LINKS — `MAL CONNECTÉ → RELIER`

Le routing existe (`pathForPage`, `buildPageUrl` préservent les query params). Il manque **le modèle de filtre sérialisable**.

**Créer** un schéma de filtre compact, sérialisable en query string:

```ts
// ex: /analytics?f=after_loss|30d  →  filtre after_loss, 30 derniers jours
interface UnifiedFilter {
  period: string;         // all | 7d | 30d | 90d | 1y
  weekday?: number;       // 0..6
  setup?: string;
  session?: string;
  direction?: "long" | "short" | "be";
  result?: "win" | "loss" | "be";
  context?: "after_loss" | "after_win";
  mistake?: string;
  emotion?: string;
  checklist?: "locked" | "not_locked";
  account?: string;
  instrument?: string;
  hour?: string;
  aplus?: boolean;
  ruleRespected?: boolean;
  trades?: string[];       // ids explicites (pour « voir les 8 trades »)
}
```

- `encodeFilter(f) -> string` et `decodeFilter(s) -> UnifiedFilter` (module pur, testé).
- Le deep-link d'un insight = `buildPageUrl(page, encodeFilter(...))`.

**Verdict:** routing `EXISTE → RELIER`; encodeur de filtre `N'EXISTE PAS → CRÉER`.

### 3.3 FILTRES ANALYTICS UNIFIÉS — `N'EXISTE PAS → CRÉER`

Aujourd'hui Journal et Analytics ont chacun leur état local (`searchQuery`, `periodFilter`, `analyticsPeriod`…). On crée **un seul** hook:

```ts
// src/app/hooks/useTradeFilter.ts
useTradeFilter(trades) → { filters, setFilter, filtered, encode, decode }
```

- S'appuie sur `UnifiedFilter`.
- Consommé par Journal, Analytics, Missed, Monte Carlo, Weekly Review.
- **Ne supprime pas** les états locaux d'un coup : chaque page migre vers le hook, puis on retire le local.
- La **canonicalisation** (win rate, PF, expectancy d'un sous-ensemble) réutilise `computeStats(filtered)` — **une seule définition de métrique**.

**Verdict:** `N'EXISTE PAS → CRÉER` (hook partagé + encodeur).

### 3.4 TRADE INTENT — `N'EXISTE PAS → CRÉER` (léger)

Nouvelle table `trade_intent` (ou colonnes JSON sur `trades` — cf. §4). Capture légère, **avant** le trade, en 5 secondes:

```
setup · raisonnement (court) · confiance (0–100, pas "70–80%") · risque prévu · plan · état émotionnel
```

C'est le prérequis de la calibration (§P7) et du « ce que je pensais vs ce qui s'est passé ». On le garde **optionnel** (le trader n'est pas bloqué).

**Verdict:** `N'EXISTE PAS → CRÉER`.

### 3.5 APRÈS TRADE — `N'EXISTE PAS → CRÉER` (léger)

Après chaque trade, une réflexion en 2 clics, reliée au trade:

```
plan respecté ? (oui / partiel / non)
pourquoi ? (FOMO / revenge / entrée trop tôt / trop tard / mauvais setup / mauvais timing / mauvais risk / autre)
note libre (optionnel)
```

**On relie** au trade existant (colonne/table, cf. §4). Cette donnée alimente : détection d'erreur, Risk Guard comportemental, « what changed », weekly review.

**Verdict:** `N'EXISTE PAS → CRÉER`.

### 3.6 BOUCLE PROACTIVE JARVIS V1 — `EXISTE PARTIELLEMENT → RELIER`

`JarvisMoment` a déjà `onboarding | brief | warning | review`. Phase 1 n'a câblé que `onboarding/brief/warning`. On **étend** aux moments manquants en **réutilisant les mêmes détecteurs** (pas de nouvelle IA) :

- `brief` (avant session) : meilleur/ pire jour, setup top, comportement à surveiller, objectif du jour.
- `review` (fin de journée / semaine) : performance, discipline, erreurs, progression, prochaine mission.

Chaque bloc rendu = un `JarvisInsight` enrichi (claim → evidence → deep-link). **Aucun nouveau modèle** : c'est de l'orchestration des détecteurs existants + le rendu evidence.

**Verdict:** `EXISTE PARTIELLEMENT → RELIER` (moments + détecteurs existent, le rendu evidence + le câblage temporel manquent).

### 3.7 PERSONAL EDGE ENGINE — `MAL CONNECTÉ → CRÉER` (au-dessus de l'existant)

Ne pas recréer les métriques. Créer une couche qui **croise** `computeStats` + `computeQuantStats` + les détecteurs par dimensions (setup × instrument × session × jour × heure × direction × contexte), avec :

```
sample size · win rate · expectancy · PF · avg win · avg loss · confidence · baseline · date range
```

- **Tiers de confiance** (remplace LOW/EMERGING/SUPPORTED/STRONG par une échelle liée à `n` + intervalle) :
  `insufficient (n<MIN) → emerging (n<2×MIN) → supported (n≥2×MIN, CI > seuil) → established (n≥3×MIN, effet stable)`.
- Sous `insufficient` → « Données insuffisantes », jamais un % seul.

**Verdict:** calculs `EXISTE → REUTILISER`; la couche de croisement + tiers `N'EXISTE PAS → CRÉER`.

### 3.8 MONTE CARLO × DISCIPLINE — `EXISTE → RELIER`

Le moteur (`modules/probability/engine.ts` `runSimulation`) et les scenarios (`scenario.ts`, `compare.ts`) existent. On **ajoute** un mode comparatif :

- `CURRENT` : dataset = trades réels (bootstrap des R-multiples actuels).
- `DISCIPLINED` : dataset = trades réels **filtrés** (revenge retirés, risque > seuil retirés, setups faibles retirés) + risque normalisé.

`compareScenarios` existe déjà → on l'expose en UI « pass probability current vs disciplined ». C'est la feature signature.

**Verdict:** `EXISTE → RELIER` (pas de nouveau moteur).

### 3.9 RISK GUARD COMPORTEMENTAL — `EXISTE → EXTENDRE`

`DisciplineEngine.checkTrade` est rule-based. On **étend** avec un signal comportemental : comparer la séquence du jour (n pertes consécutives, temps depuis la dernière perte, taille) aux **épisodes passés** identifiés par `patterns` (revenge, after-loss). Résultat : « cette situation ressemble à 7 épisodes précédents » + [voir les 7] + **suggestion** de pause (jamais un blocage).

**Verdict:** `EXISTE → EXTENDRE` (DisciplineEngine + patterns).

### 3.10 GOALS → EVIDENCE — `EXISTE → EXTENDRE`

`goal_plans` + `useGoalProgress` existent. On **relie** chaque objectif à une métrique mesurable (revenge count, risk %, win rate) et on affiche l'évolution (initial → actuel → progression → trades concernés), pas une barre décorative.

**Verdict:** `EXISTE → EXTENDRE`.

### 3.11 WEEKLY EVOLUTION — `N'EXISTE PAS → CRÉER` (léger)

S'appuie sur `computeStats` + `detected_patterns` + `agent_proposals` + la mémoire. Sorties : what improved / got worse / stayed same / cause / prochaine mission. Rendu réutilise le claim→evidence.

**Verdict:** `N'EXISTE PAS → CRÉER`, mais **réutilise** tout.

### 3.12 MEMORY — `EXISTE → EXTENDRE`

`ai_memory` existe. On **expose** une timeline lisible, et surtout **chaque fait important doit pointer vers ses données** (pas de « mémoire vraie parce que l'IA l'a dit »).

**Verdict:** `EXISTE → EXTENDRE`.

---

## 4. Changements DB

| Objet | Type | Détail |
|---|---|---|
| `trade_intent` | **CRÉER** (table) | `id, trade_id (fk nullable), user_id, setup, reasoning, confidence (0-100), planned_risk, plan, emotion, created_at`. Ou JSONB sur `trades` — **décision: table séparée** pour garder `trades` pur et l'historique auditable. |
| `trade_reflection` | **CRÉER** (table) | `id, trade_id (fk), plan_respected, reason (enum), note, created_at`. |
| `trades` | **étendre** | aucune colonne bloquante nécessaire si tables séparées. |
| `detected_patterns` | **vérifier** | contient déjà sample/evidence ? à confirmer ; sinon ajouter `affected_trade_ids jsonb`. |

**Règle de migration:** additive uniquement, sans réécrire les trades existants.

---

## 5. APIs / services

- `src/backend/` : pas de nouveau serverFn majeur en Phase 0, sauf l'écriture de `trade_intent`/`trade_reflection` (reprendre le pattern `store/trades`).
- Les détecteurs et le filtre sont **côté client** (purs), comme aujourd'hui.
- `computeBehaviorSignals` et les détecteurs : signature étendue pour retourner les `trade_id`.

---

## 6. Changements UI

- `JarvisInsight` rendu : bloc « claim → evidence → comparaison → [voir les N trades] ».
- Deep-link : navigation `setPage` + application du filtre (query param ou état partagé).
- Journal/Analytics : lire le filtre unifié à l'ouverture.
- Capture intent/reflection : petits composants légers (TradeModal et/ou après-save).
- AUCUN nouveau skeleton, AUCUNE animation décorative.

---

## 7. Risques

1. **Confiance** : un claim sans `n` ou avec une causalité implicite → garde-fous `thresholds.ts` obligatoires.
2. **Data mining** (Edge Engine) : correction multi-comparaison, planchers d'effet.
3. **Régressions des filtres** : migrer page par page, ne pas casser Journal/Analytics.
4. **Migration additive** : ne jamais altérer les trades existants.
5. **Surtravail d'intention** : garder la capture < 5s, optionnelle.

---

## 8. Tests

- Encodeurs/décodeurs de filtre (round-trip).
- Détecteurs : retournent les bons `trade_id`, respectent les seuils.
- `JarvisInsight.status` (confirmed/insufficient/contradicted/progressing/disappeared).
- `computeStats` sur un sous-ensemble filtré = cohérent avec la page Analytics (une seule définition).
- Monte Carlo current vs disciplined : comparaison cohérente avec `compareScenarios`.

---

## 9. Critères d'acceptation (scénario final)

Un trader avec 100 trades demande « Pourquoi je perds autant ? ». Jarvis répond avec : conclusion + preuves + stats + période + `n` + comparaison + confiance + lien « voir les N trades » + recommandation. Le lien ouvre la bonne page **déjà filtrée**.

---

## 10. Ordre exact d'implémentation

1. **Filtre unifié** (encode/decode + hook) — fondation de tout le reste.
2. **Détecteurs → trade_id** (étendre `behaviorSignals` + détecteurs).
3. **`JarvisInsight` enrichi** (claim, comparison, affected_trades, deep_link, status) + rendu evidence.
4. **Deep-links** (query param + application du filtre à l'ouverture).
5. **Capture intent + reflection** (tables + mini-UI).
6. **Boucle proactive** (brief/review) branchée sur les détecteurs enrichis.
7. **Monte Carlo × Discipline** (current vs disciplined).
8. **Risk Guard comportemental + Goals→Evidence** (extensions).
9. **Edge Engine + tiers de confiance**.
10. **Weekly evolution**.

---

## 11. Auto-challenge

- **Est-ce trop pour une phase ?** Oui si on veut tout finir d'un coup. Je découpe : **Phase 0a** = items 1→4 (claim→evidence + deep-links + filtre) — c'est la boucle de confiance minimale, livrable et testable. **Phase 0b** = items 5→6 (intent + reflection + proactive). **Phase 0c** = 7→10 (Monte Carlo, Risk Guard, Edge, Weekly).
- **Le filtre unifié est-il vraiment nécessaire, ou sur-ingénierie ?** Nécessaire — sans lui, les deep-links n'ont pas de cible, et on retombe sur 5 systèmes de filtres. Mais je limite le périmètre aux dimensions qui existent déjà dans les données (pas de dimensions fictives).
- **`trade_intent` en table séparée vs JSONB ?** Table séparée : plus propre pour l'audit et l'historique, et évite de polluer `trades`. Coût quasi nul.
- **Risque que je n'aie pas vu :** les détecteurs retournent aujourd'hui des agrégats et sont appelés par plusieurs chemins (JarvisHome + chat + fixtures). Étendre leur signature peut casser les fixtures/tests. → prévoir une rétrocompatibilité (champ optionnel) et mettre à jour les fixtures en premier.

---

## 12. Ce que je ne fais PAS en Phase 0

Pas de nouveau chatbot, pas de nouvelle page analytics, pas de nouveau Monte Carlo, pas de « Teach Jarvis », pas de recalibration massive, pas de NLP, pas de refactor massif.
