# TradeVault — Documentation produit vivante

> **Document de référence.** À mettre à jour à chaque évolution du produit.
> **Règle d'écriture** : tout ce qui est écrit ici a été vérifié dans le code.
> Ce qui n'a pas pu l'être est signalé comme tel, explicitement.
>
> **Avant tout lancement** : lire [`GO-LIVE.md`](GO-LIVE.md) — checklist des
> bloquants et des points non vérifiés.
>
> Compléments historiques : `AUDIT-PREMIUM.md` (technique) · `AUDIT-PRODUIT.md`
> (produit) · `PRODUCT-BIBLE.md` (vision et moat). **Ce document-ci prime** en cas
> de divergence — les audits contiennent des constats que le code a invalidés
> depuis (ils sont annotés).

---

## 1. Ce que fait TradeVault

Un trader perd rarement par manque de connaissances. Il perd par **écart entre ce
qu'il sait et ce qu'il fait**. Cet écart est comportemental : aucun indicateur ne
le corrige, seule une boucle de rétroaction personnelle et répétée le corrige.

**Le problème que les concurrents n'adressent pas** : journaliser est un effort
immédiat dont la récompense est différée de plusieurs semaines. C'est le pire
schéma de rétention qui existe, et ajouter des graphiques l'aggrave — cela ajoute
de la récompense différée à de la récompense différée.

**La réponse de TradeVault** : rapprocher la récompense de l'effort, via un coach
qui se souvient et qui mesure.

### La boucle centrale du produit

```
Matin    Checklist pré-market (série de jours en cours)
   ↓
         Le trade
   ↓
Soir     Journalisation
   ↓
         Jarvis répond avec : ses erreurs, ses objectifs, la TENUE de ses règles
   ↓
Semaine  « Tu l'as tenue 11 fois sur 12 »
```

État actuel : **tous les maillons existent**. Le dernier livré (tenue des règles)
ferme la boucle côté données ; la restitution visuelle reste partielle.

---

## 2. Architecture

```
routes/          9 routes fichiers (dont /dev/ai, noindex)
app/             UI — 23 pages, 35 composants, 10 hooks
  utils/         Moteurs déterministes (PURS, testés)
modules/         Domaine réutilisable — ai/, ai-provider/, voice/, discipline/
backend/         17 fonctions serveur (createServerFn) + middlewares
integrations/    Client Supabase + types générés
supabase/        31 migrations
```

**Pile** : TanStack Start (SSR) · TanStack Router · TanStack Query · Supabase
(Postgres + RLS + Auth + Storage + Realtime) · Tailwind · Vercel · Bun (tests).

### Principe d'architecture n°1 — la séparation pur / IO

Toute logique métier significative vit dans un **module pur** : aucune dépendance
React, réseau ou stockage, avec les dépendances injectées. C'est ce qui la rend
testable, et c'est ce qui protège les règles produit subtiles (voir §4 bis).

Modules purs testés : `edgeHistory` · `checklistStreak` · `ruleAdherence` ·
`ruleCheck` · `behavioral` · `memory-select` · `signalContext` · `history`.

> **Contre-exemple corrigé** : `checkTradeAgainstRules` vivait dans
> `tradingRules.ts`, qui importe le client Supabase — il était donc impossible à
> tester sans base. La logique pure a été extraite dans `ruleCheck.ts` ;
> `tradingRules.ts` la ré-exporte, aucun appelant n'a changé.

### Principe n°2 — une seule source de vérité par information

| Information | Source unique | Jamais dupliquée dans |
|---|---|---|
| Règles du trader | `profiles.trading_rules` | mémoire IA |
| Objectifs | table `goal_plans` | mémoire IA |
| Habitudes / signaux | recalculés depuis `trades` | mémoire IA |
| Préférences | `profiles` (onboarding) | mémoire IA |
| Liste des pages | `PAGES` (`app/types.ts`) | ~~3 copies dans `App.tsx`~~ |
| Module d'une page (chunk + préchargement) | `pageModules.ts` | ~~`lazy()` dans `App.tsx` + liste de chemins en dur~~ |
| « Quels mois méritent un rapport » | `reportMonths.ts` | ~~backfill CSV en ligne dans `App.tsx`~~ |
| « Violer une règle » | `ruleCheck.checkTradeAgainstRules` | temps réel **et** bilan |
| « Où en est cet objectif » | hook `useGoalProgress` | Goals **et** Jarvis |
| « Où en est l'Edge Score » | hook `useEdgeScore` | Dashboard **et** Jarvis |
| Page courante | l'**URL** (chemin propre : `/settings`) | ~~état React + `sessionStorage`~~ · ~~`?p=`~~ |

**Et une seule DÉFINITION par métrique** — voir le glossaire §4, écrit après que
huit défauts eurent partagé la même cause : plusieurs grandeurs différentes
portant le même nom.

**Ce tableau est la règle la plus importante du projet.** Une donnée dupliquée
diverge ; un chiffre qui diverge entre deux pages détruit la confiance dans un
produit d'analyse.

---

## 3. Jarvis — le coach IA

### Chaîne d'exécution

```
Question
  → buildCoachV1Payload   stats · trades · mistakes · signals · rules
                          · goals · ADHÉRENCE · profil · mémoire sélectionnée
  → askCoach              [server fn, middleware requireProAccess]
  → runCoach              context-builder → prompt-builder → provider-service
  → router                circuit breaker · métriques · fallback déterministe
  → answerToBlocks        [CLIENT] prose → blocs enrichis
  → BlockList
```

**Décision de conception centrale** : l'enrichissement en blocs se fait **côté
client**, à partir de données déjà calculées. Le LLM écrit de la prose ; les
chiffres viennent des moteurs déterministes. *C'est ce qui garantit qu'aucun
chiffre affiché ne peut être halluciné.* À préserver absolument.

### Persistance des conversations

`localStorage`, derrière l'interface `ConversationStore`
(`components/jarvis/conversations.ts`).

> **Défaut corrigé le 2026-08-06.** Les conversations vivaient en
> `sessionStorage` : détruites à la fermeture de l'onglet. Un trader revenait le
> lendemain devant un Jarvis amnésique. Aucune fonctionnalité ne manquait — le
> **stockage démentait la promesse centrale du produit**. On peut construire la
> meilleure mémoire long terme du marché : si l'historique visible s'efface
> chaque soir, le trader ne croira jamais que Jarvis se souvient de lui.
> Corrigé aussi pour la préférence de langue et les brouillons de question.
>
> Reprise transparente de l'ancien emplacement au premier chargement. `remove()`
> purge les **deux** emplacements — n'en nettoyer qu'un laissait les messages
> d'une conversation « supprimée » sur le disque.

**Limite assumée** : le stockage reste LOCAL à l'appareil. La synchronisation
serveur (table + RLS) est le prochain palier.

### Actions exécutables (`JarvisToolKind`)

Deux actions, toutes deux réellement implémentées :

| Action | Effet |
|---|---|
| `createChecklist` | Écrit une vraie `TradingRule` (dédupée) dans `profiles`, diffuse `tv-rules-updated`, et mémorise l'**engagement** (`decision`, confiance 1) |
| `openPage` | Navigue via le canal `tv:navigate` déjà écouté par l'application |

> Le type en déclarait **dix**, dont huit n'étaient émises nulle part ni gérées
> par personne. Un contrat qui promet des capacités inexistantes coûte deux
> fois : il fait croire au lecteur du code que la fonctionnalité existe, et il
> laisse compiler `tool: "createAlert"` — un bouton qui n'exécute rien tout en
> affichant un succès. **Le type suit l'implémentation, jamais l'inverse.**

### Contrat de blocs (9 types)

`markdown` · `stats` · `card` · `checklist` · `alert` · `hero` · `insight` ·
`mission` · `tool`

Une réponse n'est pas du texte, c'est une **structure typée**. Conséquence : le
rendu est découplé du modèle, de nouveaux types s'ajoutent sans casser
l'existant, et le streaming deviendra possible sans réécriture.

### Mémoire (`ai_memory`)

**Principe** : on ne mémorise QUE ce qui n'est pas recalculable.

| Colonne | Rôle |
|---|---|
| `kind` | `profile` · `fact` · `lesson` · `decision` · `preference` · `conversation` |
| `key` | Identité sémantique — dédoublonnage **structurel** (contrainte UNIQUE) |
| `importance` | 1–5, arbitre la sélection quand la récence ne suffit pas |
| `confidence` | 0–1 ; sous **0,3** le souvenir n'atteint plus le LLM sans être détruit |
| `source` | `onboarding` · `rule_accepted` · `conversation` · `detector` — purge sélective |
| `updated_at` | « confirmé quand », distinct de « appris quand » |

**Sélection par intention** (`memory-select.ts`) — trois contraintes indépendantes :
budget de **350 tokens**, plafond de **8 souvenirs**, plancher de pertinence.
Le budget protège du volume ; le plancher protège de la **dilution**.

> Mesuré : sur un corpus d'un an (120 souvenirs), 2 400 tokens → 160. **93 %
> d'économie.** Sur un corpus typique, la sélection retient 4 à 8 souvenirs selon
> la question.

**Écritures déterministes** (zéro coût, zéro hallucination) : profil upserté
depuis l'onboarding · règle acceptée → souvenir `decision` (`confidence: 1`,
l'utilisateur a cliqué).

### Extraction par LLM (PR-2b) — `memory-extract.ts` + `agents/memory.agent.ts`

La seule brique capable de **mentir durablement**. Une hallucination ponctuelle
est un incident ; une hallucination *mémorisée* est renvoyée dans chaque prompt
suivant, indéfiniment. Le coût d'un souvenir manqué est faible (le trader le
redira) ; celui d'un faux souvenir est durable et invisible. D'où le parti pris :
**tout ce qui n'est pas manifestement légitime est rejeté.**

| Garde-fou | Raison |
|---|---|
| Seules `decision` et `preference` | Les seules choses qu'un trader énonce et qu'aucun calcul ne retrouve. `fact`/`lesson` seraient le vecteur d'entrée des hallucinations |
| **Aucun chiffre de performance** | Win rate, P&L, R, comptes ont une source calculée ; les figer créerait un second chiffre divergent |
| Clé **toujours re-dérivée** du contenu | Sinon le modèle écrase n'importe quel souvenir en renvoyant sa clé |
| Confiance plafonnée à **0,5** | Sous le profil déclaré (0,9) et la règle acceptée (1,0) : une phrase interprétée ne pèse jamais autant qu'un clic |
| Importance plafonnée à 4 | Un engagement déduit ne prime pas sur l'identité |
| Rejet des formulations hésitantes | Le modèle signale lui-même qu'il extrapole |
| 3 souvenirs max/conversation | Appliqué **après** dédoublonnage |

**Coupe-circuit** : `AI_MEMORY_EXTRACTION=1` requis. **Éteint par défaut.**

**Maîtrise du coût** : `shouldAttemptExtraction()` filtre sans réseau — on ne
paie un appel que si le trader emploie une tournure d'engagement ou de
préférence. « Pourquoi je perds le vendredi » est une question, pas un
engagement, et ne déclenche rien : c'est le cas majoritaire.

**Une seule voie d'écriture** : la fonction serveur rend des *candidats* et
n'écrit rien ; l'écriture passe par le `remember()` existant.

**Métrique à surveiller** : le **taux de rejet** (via `ai_agent_runs`). Un taux
proche de zéro signifierait que les garde-fous sont trop laxistes — pas que le
modèle est bon.

### Ce que Jarvis sait aujourd'hui

✅ qui est le trader · ses erreurs récurrentes et leur coût · ses signaux
comportementaux · ses règles · **ses objectifs et leur progression** · **la tenue
de ses règles** · ses souvenirs persistants sélectionnés.

❌ Il n'est pas **proactif** (ne parle jamais en premier) · pas de **streaming**
(`askCoach` est un RPC JSON, structurellement incapable de SSE) · pas de
**validation post-réponse** (la prose peut citer un chiffre légèrement différent
de la carte de preuve).

---

## 3 bis. Les 23 pages — rôle, données, constat

Chaque page avec son objectif, les moteurs qu'elle consomme et un constat
d'audit. La colonne « constat » ne contient que ce qui a été **vérifié dans le
code**.

### Quotidien — la boucle centrale

| Page | Objectif | Moteurs consommés | Constat |
|---|---|---|---|
| **Dashboard** (752 l.) | Premier écran de chaque session : état de forme et rappel de discipline | `edgeScore` · `edgeHistory` · `quantStats` · `tradeCalcs` | Consomme désormais `useEdgeScore`, partagé avec Jarvis |
| **Checklist** (2 234 l.) | Rituel pré-market ; verrouiller la journée | `checklistStreak` · `tradingRules` · `jarvisVoice` | **La plus grosse page du produit** : ~1 750 lignes sont un moteur audio/vocal. Découpage volontairement refusé — non testable ici, risque supérieur au gain |
| **Journal** (660 l.) | Saisir et relire ses trades | `tradeCalcs` · `exportCsv` | L'effort le plus pénible du produit ; il alimente tout le reste |
| **Jarvis** (88 l.) | Coach IA — coquille légère, tout vit dans les workspaces | — | Bon découpage : la page ne porte aucune logique |
| **Inbox** (255 l.) | Toutes les notifications, filtrées par catégorie | — (lit `notifications`) | Décrite à tort comme « canal vide » : 116 notifications en production |

### Analyse — récompense différée

| Page | Objectif | Moteurs consommés | Constat |
|---|---|---|---|
| **Analytics** (1 133 l.) | Statistiques approfondies | `quantStats` · `tradeCalcs` | **Non auditée** — ses indicateurs ne figurent pas au glossaire §4 |
| **Mistakes** (650 l.) | Erreurs récurrentes et leur coût | `behavioral` · `ruleAdherence` · `tradeCalcs` | Son score de tête félicitait les traders qui ne journalisent pas — corrigé le 2026-08-06 |
| **Calendar** (591 l.) | P&L jour par jour | — (props) | Aucun moteur importé : tout vient des props |
| **Seasonality** (781 l.) | Performance par période / actif | `assetSeasonality` · `tradeCalcs` | **Non auditée** |
| **Reports** (~600 l.) | Bilans mensuels — génération de **tout** mois clos ayant des trades (`reportMonths`, même définition que le backfill CSV) | `monthlyReport` · `reportMonths` · `tradeCalcs` | **Non auditée** ; table `monthly_reports` |
| **Missed** (798 l.) | Setups vus mais non pris | `image` · `tradeCalcs` | Différenciant réel : aucun concurrent ne journalise l'inaction |

### Cadre — engagement du trader

| Page | Objectif | Moteurs consommés | Constat |
|---|---|---|---|
| **Goals** (234 l.) | Objectifs mesurés | `goalPlan` · `tradeCalcs` | Partage `useGoalProgress` avec Jarvis |
| **TradingPlan** (668 l.) | Règles et gestion du risque | `tradingPlan` | Source de vérité des règles (`profiles.trading_rules`) |
| **Calculator** (562 l.) | Taille de position | `positionCalc` | Outil autonome, sans dépendance à l'historique |
| **EconomicNews** (751 l.) | Calendrier macro | `economicEvents` | Seule donnée EXTERNE du produit (`economic_events`, 203 lignes) |

### Compte et périphérie

| Page | Objectif | Constat |
|---|---|---|
| **Settings** (468 l.) · **Profile** (203 l.) · **Appearance** (29 l.) | Préférences, compte, thème | `Appearance` à 29 lignes occupe une entrée de navigation entière |
| **Subscription** (386 l.) | Offres et paiement | **Parcours jamais éprouvé de bout en bout** — bloquant Go-Live |
| **Landing** (1 490 l.) | Acquisition, SSR, SEO | Seule page réellement indexée ; contient une maquette décorative (source des derniers `text-[8px]`) |
| **Contact** · **Legal** | Pages publiques | RGPD non vérifié |

### Ce que cet inventaire révèle

1. **Quatre pages d'analyse n'ont jamais été auditées** (Analytics, Seasonality,
   Reports, Calendar) — ~3 000 lignes et la majorité des chiffres affichés du
   produit. C'est là que se trouvent statistiquement les prochains défauts de la
   famille « chiffre juste, interprétation fausse ».
2. **`Appearance` (29 lignes) pèse autant qu'Analytics (1 133 lignes) dans la
   navigation.** Coût cognitif sans contrepartie.
3. **Checklist concentre 2 234 lignes**, dont ~78 % de moteur vocal — le seul
   endroit du produit où la logique métier n'est pas isolée en module pur.

---

## 4. Glossaire des métriques — **la section la plus importante de ce document**

Chaque indicateur affiché, sa formule, sa source, et surtout **ce qu'il n'est
pas**. Cette table existe parce que huit défauts corrigés le 2026-08-06
partageaient une seule cause : *plusieurs grandeurs différentes portaient le même
nom*. Aucun n'était détectable par les tests, le typage ou la CI — les valeurs
étaient justes, c'est l'interprétation qui était fausse.

> **Règle absolue.** Avant de nommer une métrique, vérifier **deux** choses :
> (1) que la grandeur n'existe pas déjà ailleurs, (2) que le nom choisi n'est
> **pas déjà pris** dans tout le produit. Omettre le second contrôle a suffi à
> recréer une collision dix minutes après en avoir corrigé une.

### La règle qui a produit douze corrections en une journée

> **Un TOTAL est vrai à n'importe quelle taille d'échantillon.
> Un TAUX et un CLASSEMENT ne le sont pas.**

La somme du P&L de deux trades *est* exactement la somme de deux trades — elle ne
ment jamais. Un taux de réussite sur deux trades ne veut rien dire. Et couronner
« ta meilleure heure » sur deux trades ne veut rien dire non plus, **même si le
total affiché est exact** : c'est le classement qui est l'inférence, pas le
chiffre.

Cette dernière nuance est celle qui échappe le plus longtemps, parce que le
nombre paraît irréprochable.

**Conséquence appliquée dans tout le produit** : `MIN_BUCKET_SAMPLE` (5 trades
décisifs) conditionne l'affichage de tout taux et de tout superlatif ; les totaux
restent affichés sans condition. `MIN_KELLY_SAMPLE` (30) est plus élevé parce que
Kelly ne décrit pas le passé — il **recommande une taille de position**, donc une
erreur y coûte de l'argent et non une appréciation.

| Surface | Garde |
|---|---|
| Graphique horaire (Analytics) | taux masqué sous 5 ; `null` et non `0` → la ligne s'interrompt visiblement |
| Tableau des setups (Analytics) | taux, profit factor et R moyen masqués sous 5 |
| Kelly (Analytics) | masqué sous 30 trades décisifs |
| Sharpe / Sortino (Analytics) | ≥ 10 jours de trading — **hérité, non revu** : annualiser 10 jours par √252 reste une forte extrapolation |
| Superlatifs (Seasonality) | « meilleur mois / jour / heure » exigent 5 trades |
| Meilleurs / pires setups (Reports) | même plancher — un bilan écrit affirme plus fort qu'un graphique |
| Signaux envoyés à Jarvis | protégés par le même `winRateOf` |

**Trois définitions concurrentes du win rate par bucket ont été trouvées et
fusionnées** (Analytics, Reports, `quantStats`). Le motif est toujours le même :
la fonction existante ne prenait pas le bon type d'entrée, quelqu'un a réécrit.
Les sources de vérité ne se multiplient pas par négligence — par commodité.

### Les trois grandeurs qu'on confond

| Métrique | Où | Formule | Ce que c'est | Ce que ce **n'est pas** |
|---|---|---|---|---|
| **`ruleAdherence`** | `ruleAdherence.ts` | par règle activée : trades conformes ÷ trades applicables, fenêtre 30 j, via `checkTradeAgainstRules` | La **discipline réelle**, constatée par le moteur | Pas déclaratif — le trader ne peut pas l'influencer en cochant ou non |
| **`cleanJournalScore`** | `behavioral.ts` → page Mistakes | `100 − (infractions pondérées ÷ trades) × 22` | La **charge d'erreurs auto-cochées** | **Pas la discipline.** Un trader qui ne coche rien obtient 100 |
| **`executionScore`** | `analysis/engine.ts` | dérivé de MAE/MFE | L'**efficacité de sortie** | Aucun rapport avec les règles ni les erreurs |

### Indicateurs du tableau de bord

| Métrique | Formule | Piège |
|---|---|---|
| **`winRate`** | gagnants ÷ (gagnants + perdants) | Les break-even sont **exclus du dénominateur**, au global (`tradeCalcs`) comme par bucket (`quantStats.winRateOf`) — vérifié identique |
| **`cleanTrades`** | trades sans erreur cochée ÷ trades | S'appelait « Respect du plan » et divergeait de `ruleAdherence` sur le même écran |
| **`Edge Score`** | 4 sous-scores pondérés : `cleanTrades` 35 % · `risk` 25 % · `cleanDays` 25 % · `routine` 15 %, fenêtre `EDGE_WINDOW_DAYS` | Le sous-score `cleanTrades` s'appelait `plan` : Jarvis en déduisait « le respect du plan est ton point faible » |
| **`profitFactor`** | gains bruts ÷ pertes brutes | Plafonné à 99 quand il n'y a aucune perte |
| **`currentStreak`** | série de gains/pertes consécutifs (`tradeCalcs`) | **Un résultat, pas une preuve de process.** Jarvis disait « le signe que ton process fonctionne » |
| **`pnlAfterLoss`** | P&L total des trades suivant une perte | **Borne haute**, pas un surcoût imputable : le trader aurait perdu quelque chose même en taille normale |

### Source unique — accès partagés

| Information | Point d'accès unique | Consommateurs |
|---|---|---|
| Progression des objectifs | hook `useGoalProgress` | page Goals · Jarvis |
| Edge Score | hook `useEdgeScore` | Dashboard · Jarvis |
| « Violer une règle » | `ruleCheck.checkTradeAgainstRules` | temps réel · bilan 30 j |
| Page courante | l'**URL** (`?p=`) | toute l'application |

### Ce qu'aucune métrique ne mesure aujourd'hui

- Le **surcoût réel** du sur-dimensionnement après une perte (seule une
  corrélation est disponible).
- La **causalité** entre discipline et performance : l'écart entre trades
  propres et trades marqués est confondu, car on coche plus volontiers une
  erreur sur un perdant.

---

## 4 bis. Moteurs déterministes — et les règles produit qu'ils protègent

C'est ici que vit la valeur non copiable. Chaque moteur porte des décisions
produit subtiles, verrouillées par tests.

### Edge Score (`edgeScore.ts` + `edgeHistory.ts`)

Score de discipline 0–100 sur 10 jours tradés. Quatre sous-scores pondérés
(plan 35 % · risque 25 % · jours propres 25 % · routine 15 %), renormalisés quand
une donnée manque — **le score ne fabrique jamais une composante qu'il ne peut
pas mesurer**.

> **Il récompense le COMPORTEMENT, jamais le P&L.** C'est la décision produit la
> plus importante du fichier : un score qui récompenserait les gains
> récompenserait la chance.

`edgeHistory` conserve 30 jours pour afficher une **trajectoire** (sparkline).
Un score sans historique est un constat ; avec historique, c'est une progression.

### Import CSV (`csvImport.ts`)

Lecture d'un export broker : découpage respectant guillemets et BOM, séparateur
deviné (virgule, point-virgule, tabulation), montants aux formats anglo-saxon et
européen, **parenthèses comptables = négatif**, dates ISO et US avec AM/PM,
correspondance automatique des colonnes (NinjaTrader, TradingView, TopStep,
TradeVault), et signature de doublon `date|symbole|P&L|heure d'entrée`.

> **Une ligne inexploitable est COMPTÉE, jamais devinée.** Un trade faux pollue
> durablement toutes les statistiques ; un trade manquant se voit et se corrige.

Ce code vivait dans le composant React de la modale et n'était donc pas testable.
Extrait le 2026-08-07, 27 tests. Il importe `generateId` depuis `@/domain` et non
depuis la façade du store, qui tirerait le client Supabase et le rendrait à
nouveau intestable hors navigateur.

### Mois de rapport (`reportMonths.ts`)

« Mois clos, avec des trades, sans rapport encore. » Une seule définition,
utilisée par la page Rapports **et** par le backfill après import CSV — la règle
existait auparavant en double.

> **Le mois EN COURS est exclu.** Figer un bilan partiel ferait croire, un mois
> plus tard, que c'est le bilan complet.

### Erreurs récurrentes (`behavioral.ts`)

Fréquence, coût, sévérité, tendance hebdomadaire agrégée, et **tendance par
erreur** sur deux fenêtres de 30 jours.

> **Garde-fou** : les fenêtres s'adossent à la dernière date **journalisée**, pas
> à aujourd'hui. Sinon un trader en pause verrait toutes ses erreurs « reculer »
> — et le produit le féliciterait d'avoir arrêté.
> **Second garde-fou** : pas de tendance sans fenêtre de comparaison. Une erreur
> apparue cette semaine n'a pas de tendance.

### Adhérence aux règles (`ruleAdherence.ts`)

« Tu l'as tenue 11 fois sur 12 » — la mesure qui ferme la boucle.

> **Trois garde-fous** : les règles `custom` sont exclues (un texte libre n'est
> pas vérifiable — afficher « 100 % » serait une flatterie mensongère) · fenêtre
> adossée à la dernière date tradée · une règle jamais éprouvée est **omise**,
> jamais créditée.
>
> **Limite connue** : l'applicabilité est grossière — tout trade compte pour
> toute règle vérifiable. Choix prudent (sous-estime plutôt qu'il ne flatte).

### Série de checklist (`checklistStreak.ts`)

Jours de bourse consécutifs avec checklist verrouillée.

> **Deux règles** : les week-ends ne cassent jamais la série (marchés fermés —
> punir un dimanche découragerait de tenir en semaine) · le jour courant
> bénéficie d'un **sursis** (une série qui tombe à zéro à 9 h punirait un jour
> pas encore vécu).

---

## 4 ter. API serveur, tâches planifiées et intégrations

### Fonctions serveur (`src/backend/`)

Aucune n'est une route HTTP publique : ce sont des `createServerFn` TanStack,
appelées comme des fonctions depuis le client. **Conséquence directe : aucun
secret n'atteint jamais le navigateur.**

| Fichier | Rôle | Garde |
|---|---|---|
| `coach.functions.ts` | Réponse de Jarvis | `requireProAccess` (auth + quota) |
| `memory.functions.ts` | Extraction de mémoire → **candidats**, n'écrit rien | `requireProAccess` + `AI_MEMORY_EXTRACTION=1` |
| `ai.functions.ts` | Autres appels IA | `requireProAccess` |
| `tts.functions.ts` | Synthèse vocale (checklist) | `requireProAccess` |
| `reports.functions.ts` | Bilan mensuel à la demande | auth |
| `push.functions.ts` | Notifications push (VAPID) | auth |
| `economic-calendar.functions.ts` | Lecture du calendrier macro | auth |
| `telemetry.server.ts` | Écriture `ai_agent_runs` | **service role** — aucun client ne peut fabriquer de métrique |
| `billing.server.ts` · `crypto-pay.server.ts` | Stripe · Coinbase Commerce | webhooks signés + `processed_webhook_events` (idempotence) |
| `lifecycle-emails.server.ts` · `email-templates.server.ts` | Resend | `CRON_SECRET` |
| `monthly-reports.server.ts` · `goal-reminders.server.ts` | Génération planifiée | `CRON_SECRET` |
| `rate-limit.server.ts` · `require-pro.ts` | Middlewares partagés | — |

### Tâches planifiées (`vercel.json`)

| Chemin | Cadence | Effet |
|---|---|---|
| `/api/cron/monthly-reports` | `0 6 1 * *` — le 1er du mois | Génère les bilans (même builder pur que la version à la demande) |
| `/api/cron/lifecycle-emails` | `0 8 * * *` — quotidien | Emails de cycle de vie |
| `/api/cron/economic-calendar` | `0 5 * * *` — quotidien | Ingère le calendrier macro ; `id` = hash déterministe de la clé métier, donc ré-ingérer MET À JOUR au lieu de dupliquer |

### Intégrations externes

| Service | Usage | Rupture si indisponible |
|---|---|---|
| **Supabase** | Postgres · RLS · Auth · Storage · Realtime | Totale — c'est la base |
| **Gemini** (défaut) / Anthropic / Groq / OpenRouter | LLM de Jarvis | **Aucune** : repli déterministe sur les mêmes données |
| **Stripe** · **Coinbase Commerce** | Paiement carte · crypto | Pas d'abonnement possible |
| **Resend** | Emails transactionnels | Silencieuse — à surveiller |
| **ElevenLabs** | Voix de la checklist | Dégradée, la checklist reste utilisable |
| **Web Push (VAPID)** | Notifications | Les notifications restent dans l'Inbox |
| **Trustpilot** | Widget d'avis | Cosmétique ; seule origine tierce autorisée par la CSP |

**Le provider IA est interchangeable par variable d'environnement** (`AI_PROVIDER`) :
l'application ne sait jamais quel modèle répond.

### Variables d'environnement

`SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` · `SUPABASE_SERVICE_ROLE_KEY` ·
`VITE_SUPABASE_URL` · `VITE_SUPABASE_PUBLISHABLE_KEY` (les deux `VITE_` sont
publiques par construction et n'exposent que la clé anon) ·
`AI_PROVIDER` · `GEMINI_API_KEY` · `GEMINI_MODEL` · `GEMINI_THINKING_BUDGET` ·
`ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` · `AI_RATE_LIMIT_PER_HOUR` ·
`AI_REQUIRE_PRO` · **`AI_MEMORY_EXTRACTION`** (éteint par défaut) ·
`STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_PRO_MONTHLY` ·
`STRIPE_PRICE_PRO_YEARLY` · `COINBASE_COMMERCE_API_KEY` ·
`COINBASE_COMMERCE_WEBHOOK_SECRET` · `RESEND_API_KEY` · `EMAIL_FROM` ·
`VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` ·
`ELEVENLABS_API_KEY` · `TTS_PROVIDER` · `CRON_SECRET` · `PUBLIC_SITE_URL`.

---

## 4 quater. Workflows

### Journée type du trader

```
Matin    Checklist pré-market → verrouillage → série de jours
   ↓     (localStorage `tv-chk-{uid}-{date}`, alimente le sous-score `routine`)
Séance   Trade → Journal → moteur de discipline (temps réel)
   ↓     violation → événement → NotificationEngine → toast + push + Inbox
Soir     Journalisation : erreurs cochées, capture d'écran, notes
   ↓
Après    Jarvis : stats · signaux · règles · ADHÉRENCE · objectifs · mémoire
```

### Écriture d'un trade

`TradeModal` → écriture **optimiste** dans le cache React Query → `upsertTrade`
(Supabase) → recalcul de tous les moteurs (purs, synchrones) → événements de
discipline. L'interface n'attend jamais le réseau.

### Une question posée à Jarvis

1. `buildCoachV1Payload` assemble stats, trades, erreurs, signaux, règles,
   objectifs, adhérence, Edge Score, profil et **mémoire sélectionnée**
   (≤ 350 tokens).
2. `askCoach` (serveur, `requireProAccess`) → `runCoach` → routeur multi-provider
   avec circuit breaker.
3. Échec ou absence de provider → **repli déterministe** sur les mêmes données.
4. `answerToBlocks` enrichit la prose **côté client** avec les chiffres déjà
   calculés — c'est ce qui rend toute hallucination chiffrée impossible.
5. Si le message contient un marqueur d'engagement **et** que
   `AI_MEMORY_EXTRACTION=1` : extraction en arrière-plan, après la réponse.

### Notification

Événement métier → `evaluateNotificationRules` (pur) → `NotificationEngine` →
canaux (toast · push dédupliqué une fois par jour et par clé · Inbox persistée).
La catégorie dérive du `kind` **et de la sévérité** — un progrès n'est pas un
risque.

### Abonnement

Choix de l'offre → Stripe Checkout ou Coinbase Commerce → webhook **signé** →
`processed_webhook_events` garantit l'idempotence → `subscriptions` mise à jour →
`requireProAccess` lit ce statut. **Ce parcours n'a jamais été éprouvé de bout en
bout** (cf. `GO-LIVE.md` §1.3).

---

## 4 quinquies. Notifications — les 14 types et les 7 règles

### Le contrat

Tout ce qui est dit au trader passe par le **Notification Engine** : les pages ne
déclenchent jamais un toast ou un push directement. Un seul entonnoir, donc un
seul endroit où arbitrer le bruit.

**Canaux** : `dashboard` (Inbox, persisté) · `toast` · `push` (VAPID) · `email` ·
`ai_message`.

**Catégorie** : dérivée du `kind` **et de la sévérité** (`categoryOf`). Un
`pattern_detected` en sévérité `success` est un **progrès**, donc rangé avec les
observations de Jarvis ; en `warning` c'est un risque. Les classer tous en
« risque » affichait une félicitation en rouge.

**Anti-spam** : le push est dédupliqué **une fois par jour et par `dedupKey`**.
Toast et persistance ne le sont pas — le canal push est le seul qu'on peut
désactiver définitivement en agaçant l'utilisateur, et le perdre ferait perdre
aussi les alertes de risque.

### Les 14 types

| `kind` | Catégorie | Sens |
|---|---|---|
| `discipline_warning` | discipline | Une règle vient d'être enfreinte, ou glisse dans la durée |
| `discipline_limit` | discipline | Limite du plan atteinte |
| `discipline_success` | discipline | Séance close sans écart |
| `goal_completed` · `goal_milestone` | goals | Objectif atteint · palier franchi |
| `risk_loss_streak` · `risk_max_loss` | risk | Série de pertes · perte maximale |
| `pattern_detected` | risk **ou** jarvis | Motif nuisible détecté **ou en recul** — la sévérité tranche |
| `trade_analyzed` · `daily_brief` · `weekly_review` | jarvis | Sorties du coach |
| `activity_lull` | activity | Inactivité prolongée |
| `economic_event` | economic | Événement macro à fort impact |
| `system` | system | Divers |

### Les 7 règles déterministes (`rules.ts`)

Toutes **pures** : mêmes données → mêmes notifications. **Zéro coût IA, zéro
risque d'hallucination.**

| Règle | Déclenche | Condition |
|---|---|---|
| Série de pertes | `risk_loss_streak` | ≥ 3 pertes consécutives |
| Erreur la plus coûteuse | `risk_max_loss` | une erreur domine le coût cumulé |
| Inactivité | `activity_lull` | ≥ 5 jours sans trade journalisé |
| Bilan hebdomadaire | `weekly_review` | lundi, et ≥ 5 trades sur la période |
| **Progrès** | `pattern_detected` (succès) | une erreur recule de ≥ 30 % avec ≥ 3 occurrences antérieures |
| **Règle qui glisse** | `discipline_warning` | la règle la moins tenue passe sous 60 % sur ≥ 3 trades applicables |
| Séance propre | `discipline_success` | au moins une règle active et aucun écart |

**Les seuils sont volontairement hauts.** Un canal bruyant finit désactivé, et on
perd alors le canal *entier* — alertes de risque comprises. Plusieurs tests
vérifient explicitement que les règles restent **silencieuses** sur signal faible
ou échantillon mince.

> **Cinq types déclarés, jamais émis** : `goal_completed`, `goal_milestone`,
> `trade_analyzed`, `daily_brief`, `economic_event`. Vérifié dans le code
> (aucun émetteur) **et en production** : sur 122 notifications écrites, seuls
> 7 `kind` apparaissent — précisément ceux que produisent les règles ci-dessus,
> plus `discipline_limit`.
>
> **Ils sont conservés délibérément**, contrairement aux huit actions Jarvis
> fictives supprimées le même jour. La différence est réelle : un
> `JarvisToolKind` inexistant permettait de compiler un bouton qui affichait un
> succès sans rien exécuter — un défaut **actif**. Un `kind` de notification
> jamais émis est **inerte** : il ne peut produire aucun comportement faux.
>
> Et ils correspondent à des fonctionnalités qui **existent** et dont les
> notifications restent à câbler : la page Goals et la table `goal_plans` pour
> les deux `goal_*`, la table `economic_events` (203 lignes, cron quotidien)
> pour `economic_event`. Les supprimer serait une réécriture qu'il faudrait
> défaire.
>
> La règle « le type suit l'implémentation » vaut contre les contrats qui
> **mentent**, pas contre ceux qui anticipent une suite identifiée.

---

## 5. Modèle de données

**16 tables déployées** : `profiles` · `accounts` · `trades` · `user_preferences`
· `goal_plans` · `six_month_goals` · `notifications` · `monthly_reports` ·
`subscriptions` · `push_subscriptions` · `processed_webhook_events` ·
`economic_events` · `economic_calendar_sync` · `ai_memory` · `ai_reports` ·
`ai_rate_limits` · `habits`.

**Ajoutées et vérifiées en production le 2026-08-06** : `ai_agent_runs`
(télémétrie IA, RLS lecture-propriétaire, **aucune** politique d'insertion —
les écritures passent uniquement par le service role) et les colonnes V2 de
`ai_memory` (`key`, `importance`, `confidence`, `source`, `updated_at`).

**En attente** (`_pending_ai_os_foundation.sql`, jamais appliquée) :
`ai_embeddings` (pgvector) · `ai_jobs`. Volontairement non reprises : pgvector
n'est pas justifié tant que la sélection lexicale n'a pas montré ses limites,
et `ai_jobs` n'a aucun consommateur.

**Dormante** : `habits` (avec `streak`) n'est utilisée par **aucun code
applicatif** — la série de checklist est calculée depuis `localStorage`, ce qui
évite une table et une migration.

### Migrations

Toute migration doit être **rejouable** : une branche de preview rejoue la chaîne
entière à zéro. Utiliser `if not exists`, `drop … if exists` avant `create`,
`or replace`.

> **Incident réparé** : des migrations recréaient des politiques déjà créées.
> Invisible en production (application incrémentale), mais toute branche de
> preview échouait → statut `MIGRATIONS_FAILED` → check `Supabase Preview`
> « skipped » à chaque PR. Conséquence : **aucune migration n'a jamais été
> vérifiée avant la production** pendant toute la vie du projet.
> Vérifié depuis : rejeu complet à zéro, 0 échec, 19 tables, 53 politiques RLS.

> **Cause racine finale, réparée le 2026-08-06.** L'idempotence n'était que la
> moitié du problème. L'audit de la base réelle a montré que l'historique de
> migrations distant (`supabase_migrations.schema_migrations`) contenait
> **29 versions générées par le dashboard** (`20260703094727`…) ne correspondant
> à **aucun fichier du dépôt**, tandis que les 31 fichiers du dépôt n'y
> figuraient pas. L'intégration GitHub tentait donc de rejouer les 31 fichiers
> contre une base qui les contenait déjà sous d'autres numéros → échec
> systématique.
>
> Conséquence mesurée : **aucune migration postérieure au 2026-07-29 n'était
> parvenue en production**. `ai_memory` y tournait encore en V1 (ni `key`, ni
> `confidence`), ce qui aurait fait échouer tout `remember()` dès la fusion de
> la PR #143 — un blocage de lancement invisible pour TypeScript, les tests, le
> lint, le build et Vercel, tous verts.
>
> Réparation (additive, zéro perte : 4 souvenirs et 92 trades préservés) :
> application des 5 migrations réellement manquantes (`add_direction_check`,
> `add_updated_at_triggers`, `enforce_storage_rls`, `ai_memory_v2`,
> `ai_agent_runs`), puis réalignement de l'historique sur les 31 fichiers du
> dépôt. L'historique d'origine est sauvegardé dans
> `public._migration_history_backup_20260806`.
>
> Durcissement au passage : les politiques du bucket `trade-screenshots`
> étaient correctes mais ouvertes au rôle `public` ; elles sont désormais
> restreintes à `authenticated`.
>
> **Leçon, la même que pour le bug d'upsert** : le seul contrôle qui a détecté
> ces défauts est l'exécution contre la base réelle. Cinq vérifications vertes
> ne disent rien de l'état de la production.

---

## 5 bis. Observabilité

**`ai_agent_runs`** enregistre chaque appel IA : provider, modèle, tokens
**réels**, latence, statut. C'est la seule source qui **survit aux
redéploiements** — `runtime/metrics.ts` est en mémoire et repart à zéro à chaque
cold start serverless.

**Écriture** : serveur uniquement (service role). La table n'a **aucune politique
d'insertion** — un client ne doit pas pouvoir fabriquer de fausses métriques,
puisqu'elles servent à des arbitrages de modèle, de budget et de coût.
Best-effort : perdre une mesure est acceptable, perdre une réponse ne l'est pas.

**Lecture** : `/dev/ai`, restreinte au **compte authentifié**. Il n'existe pas de
rôle admin et cette page n'est protégée que par l'absence de lien vers elle :
des agrégats globaux feraient fuiter l'activité de tous les utilisateurs.
*Pour calibrer un modèle, tester depuis un compte dédié.*

**Statuts** : `ok` · `fallback` (réponse déterministe servie — **distinct d'une
erreur**, le trader a bien eu une réponse fondée) · `error`.

> **Deux choix de mesure** : médiane et p95, **jamais de moyenne** — un seul
> timeout à 10 s fausse une moyenne sur 20 appels. Et les latences absentes sont
> **exclues** : un repli immédiat n'a pas mis 0 ms, le compter maquillerait les
> performances.

**Jamais de contenu de conversation** dans la table : ni prompt, ni réponse, ni
question.

---

## 6. Sécurité

- **RLS partout**, propriétaire uniquement (`auth.uid() = user_id`). Vérifié par
  exécution : lecture et écriture croisées entre deux utilisateurs sont rejetées.
- **`requireProAccess`** — middleware **fail-closed** : refuse en cas d'erreur DB.
- **Défense en profondeur** : le serveur ne fait pas confiance au client. Zod
  re-borne la mémoire (12 × 300 car.), l'adhérence (5), les signaux (12 KB).
- **`ANTI_HALLUCINATION`** : le LLM ne peut citer que les blocs fournis.

**Monétisation** : `AI_REQUIRE_PRO` **désactivé** — accès complet pour tout
utilisateur connecté. `FREE_DAILY_LIMIT = 5` prêt mais dormant. Une variable
d'environnement suffit à basculer.

---

## 7. Ce qui reste à faire

**Vérifié comme manquant**, par ordre de valeur :

1. **URLs par page** — l'app entière est une seule route ; le bouton retour
   quitte l'application sur Android, et **aucune page n'est traçable en
   analytics**. C'est aussi un handicap SEO total.
2. **Synchronisation serveur des conversations** — l'historique est désormais
   persistant, mais LOCAL à l'appareil. Changer de machine le perd.
3. **Activation de l'extraction mémoire** — codée et testée, `AI_MEMORY_EXTRACTION`
   éteint. Le taux de rejet réel reste à mesurer.
4. **Streaming** — nécessite un transport HTTP (le RPC actuel ne peut pas faire
   de SSE).
5. **Design system** — ~470 tailles typographiques arbitraires restantes, ~105
   couleurs en dur. *Plancher réel : 10 px (`type.micro`), plus aucun 8 px dans
   l'UI produit.*
6. **i18n** — deux mécanismes coexistent (dictionnaire + ternaires en ligne).
7. **Purge de `ai_agent_runs`** — la table croît linéairement.
8. **Écart local / CI** — le sandbox n'exécute que 290 des 303 tests (paquets npm
   indisponibles, registre 403). Une régression a échappé à la vérification
   locale pour cette raison : **la CI est la seule vérification qui fasse foi.**

---

## 8. Limites de cette documentation

- **L'application n'a jamais été exécutée** dans l'environnement où ce document
  a été écrit. Les comportements d'interface sont décrits d'après le code, pas
  d'après l'observation.
- **Aucune mesure de latence ni de pertinence LLM** : pas de clé API disponible.
  Les gains de tokens sont calculés, ceux de latence sont raisonnés.
- **Aucune donnée d'usage réelle** : les jugements de valeur produit sont des
  hypothèses argumentées, pas des constats.
