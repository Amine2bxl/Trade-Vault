# IA — Jarvis et la plateforme IA

Jarvis est **l'unique identité IA** du produit (page, widget, checklist, voix).
Côté code, l'agent s'appelle `coach` ; côté utilisateur, toujours « Jarvis ».
Rôle produit et persona : [`PRODUCT.md`](PRODUCT.md#jarvis).

## 1. Invariants

1. **Les chiffres viennent des moteurs déterministes ; le modèle ne fait que
   les formuler.** Il ne calcule, n'estime ni n'invente jamais un nombre ; une
   donnée absente se dit absente.
2. **Provider-agnostique** : l'app ne sait jamais quel modèle répond ; changer
   de modèle = une variable d'environnement.
3. **Jarvis n'écrit rien directement.** Tous les outils sont en lecture seule
   (`sideEffect: false`) ; la seule voie d'écriture est l'**acceptation d'une
   proposition** par le trader (`backend/proposals.functions.ts`).
4. **Pas de conseil financier ni de prédiction de marché.**
5. **Aucune affirmation sous l'échantillon minimum, aucune formulation causale,
   toute statistique affiche son `n`** (garde-fous : `modules/patterns/thresholds.ts`,
   `modules/patterns/language.ts`, `modules/coaching/safety.ts`, testés par
   `tests/noCausalLanguage.test.ts`).
6. Réponse **écrite** dans la langue de l'UI. **Voix** : les répliques fixes
   (checklist, salutations) sont en anglais ; une réponse de conversation est
   dite dans la langue où elle est écrite (voix hébergée multilingue, même
   timbre ; en secours, voix locale de cette langue).

## 2. La chaîne en production — question posée à Jarvis

Question → intention → données utiles → calcul déterministe → raisonnement →
réponse vérifiée. Une seule chaîne, `modules/ai/agents/coach.orchestrator.ts` :

```
features/jarvis (page Jarvis.tsx / widget AiAssistant.tsx)
  → workspaces/ConversationWorkspace.tsx
  → aiContext.ts : payload ancré (stats, 25 trades les plus récents, erreurs,
                   signaux behaviorSignals.ts, règles, objectifs du compte actif,
                   Edge Score, échelle, simulation, profil, souvenirs choisis
                   par modules/ai/memory-select)
  → backend/coach.functions.ts  askCoach (Zod + bornes domain/ai-limits,
                                garde requireJarvisAccess : auth, accès, quota)
  → orchestrateCoach
     1. COMPRENDRE  router/route.ts : domaines, niveau 1–4, période, symboles,
                    sessions, jours ; un petit modèle (emplacement « router »)
                    seulement si la question est ambiguë
     2. CHOISIR     context-engine.ts : blocs client gardés, signaux visés,
                    lectures à préparer, outils offerts, profondeur d'historique
     3. LIRE        lectures préparées EN PARALLÈLE (outils backend/ai-tools,
                    sous userId + compte actif, 6 s max chacune)
     4. RAISONNER   agents/coach.agent.ts runCoach avec le modèle du niveau
                    relevé par le profil jarvis_nq (agents/jarvis-nq.ts) et
                    ses outils natifs (runWithTools)
     5. VÉRIFIER    validation.ts : chaque chiffre de la réponse doit figurer
                    dans les données reçues ; sinon une réparation, puis une
                    mention honnête
     6. MESURER     trace sans contenu → ai_agent_runs
  → runtime/router.ts  routeCompletion : chaîne de fournisseurs, circuit
       breaker, délai du niveau, métriques
  → réponse { source: "ai" } ou message honnête
    { source: "unavailable", reason: "busy" | "outage" }
```

**Niveaux de modèle** (`runtime/tiers.ts`) : 1 = rapide (bavardage,
définition, lecture simple), 2 = équilibré (analyse d'un domaine), 3 = puissant
(diagnostic croisé, comparaison, tenue du plan), 4 = profond (revue complète
demandée explicitement sur ses propres données — jamais sur la seule longueur
d'un message). Chaque emplacement (`router`, `fast`, `balanced`, `strong`,
`deep`) a sa politique (réflexion, plafond, délai, tours d'outils) et sa chaîne
`AI_MODEL_<EMPLACEMENT>` ; le petit modèle ne peut jamais ouvrir le niveau 4.

**Relances et questions courtes** : une relance non reconnue (« pourquoi ? »,
« et sur NQ ? ») hérite des domaines et de la période de la question
précédente du trader ; une question personnelle non reconnue est ambiguë quelle
que soit sa longueur et, sans petit modèle, reçoit au moins la performance.

**Budget de temps** : une question dispose de `QUESTION_BUDGET_MS` (240 s, sous
la limite de 300 s de la fonction serveur). Chaque appel modèle reçoit le temps
qui reste, la boucle d'outils s'arrête à temps pour répondre, la réparation des
chiffres est sautée faute de temps — la réponse se termine toujours par une
réponse ou par le message honnête « indisponible », télémétrie écrite.

**Appels d'outils natifs** : Gemini (`functionCall`/`functionResponse`,
signatures de réflexion rejouées), Anthropic (`tool_use`/`tool_result`, blocs
de réflexion rejoués tels quels), OpenAI-compatibles (`tool_calls` + messages
`tool`). Le texte universel reste joint pour tout autre fournisseur ; le modèle
est épinglé pour toute la boucle ; le dernier tour garde les outils déclarés en
mode « none ».

**Le profil `jarvis_nq`** (`agents/jarvis-nq.ts`, nom seul dans
`jarvis-model.ts` pour l'UI) est le cerveau de Jarvis — un nom de modèle, pas
un second personnage. La v1 (court, chiffré) produisait un lecteur de tableau
de bord ; la v2 en fait un interlocuteur :

- **Converser** : répondre à ce qui est dit et voulu, suivre le fil (douze
  tours au moins, `MIN_CONVERSATION_TURNS`), donner un avis argumenté,
  construire sur une idée. Polyvalent : le trading d'abord, mais aucun sujet
  n'est esquivé parce qu'il ne parle pas de statistiques.
- **Les chiffres sont une preuve** : un ou deux, avec leur `n`, quand ils
  changent la réponse — jamais un relevé non demandé. `STRICT DATA RULE` ne
  bride que les affirmations sur les résultats du trader ; connaissance,
  explications, avis et idées sont libres.
- **Autonome** (`jarvisNqTools`) : hors bavardage, toute la boîte de lecture
  (`AUTONOMOUS_TOOLS`) est offerte ; le modèle décide lui-même de lire le
  journal. Le Context Engine ne fait que préparer les lectures évidentes.
- **Réfléchir** (`jarvisNqSlot`) : bavardage → `fast` ; mesure simple →
  `balanced` ; analyse, diagnostic et discussion ouverte → `strong` ; revue
  complète → `deep` (jamais en vocal, où la discussion reste sur `balanced`).
- **Lire chaque lettre** (fautes, dictée, unités, négations ; question
  entière jusqu'à 4 000 caractères) et **savoir le NQ** (`NQ_DESK_KNOWLEDGE`,
  qui compte comme source pour la validation des chiffres).
- Formes (`answerShape`) : des repères de longueur, pas un gabarit ; en
  vocal, une à trois phrases parlées.
- La trace (`ai_agent_runs.route`) porte `profile` et `channel`.

**L'intelligence dépend d'abord du fournisseur** : sans `ANTHROPIC_API_KEY`
ni `OPENAI_API_KEY`, la chaîne tombe sur Gemini 2.5 (Flash pour la plupart
des niveaux, Pro en `strong`/`deep` quand la clé y a accès). Avec une clé
Anthropic et `AI_PROVIDER=anthropic`, les niveaux passent sur Haiku 5.5 /
Sonnet 5.5 / Opus 5.5 (`DEFAULT_SLOT_MODELS`).

**Sources branchées** : le domaine « marché » lit le calendrier économique
(`backend/ai-tools/sources.ts`, branché par `askCoach` via
`registerContextSource`) — lecture préparée du jour et du lendemain à New York,
filtrée sur les devises des symboles cités. La connaissance produit n'a pas
encore de source — le Context Engine le DIT au modèle (`UNAVAILABLE_NOTICE`).

## 3. Carte des fichiers

| Brique | Emplacement |
| --- | --- |
| Providers (Gemini, Anthropic, OpenAI, Groq, OpenRouter) | `modules/ai-provider/` — `registry.ts` : `AI_PROVIDER` si configuré, sinon ordre du registre. Ajouter un provider = un fichier + une ligne |
| Routage d'exécution, circuit breaker, erreurs, métriques, diagnostic `/dev/ai` | `modules/ai/runtime/` |
| Contrat de contexte + blocs ancrés | `modules/ai/context.ts`, `context-builder.ts` (bornes partagées : `domain/ai-limits.ts`) |
| Prompt, formatage | `modules/ai/prompt-builder.ts`, `response-formatter.ts` |
| Agent coach (persona, `ANTI_HALLUCINATION`, `EVIDENCE_RULES`) | `modules/ai/agents/coach.agent.ts` |
| Orchestration (route → plan → lectures → modèle → validation → trace) | `modules/ai/agents/coach.orchestrator.ts` |
| Routeur unifié (domaines, niveau, entités ; source de `intent.ts` et de l'intention mémoire) | `modules/ai/router/route.ts` |
| Context Engine (recettes par domaine, préchargement parallèle, sources branchables) | `modules/ai/context-engine.ts` |
| Validation des chiffres | `modules/ai/validation.ts` |
| Niveaux de modèle, coût estimé | `modules/ai/runtime/tiers.ts`, `runtime/pricing.ts` |
| Outils de Jarvis (`get_trades`, `get_stats`, `get_mistakes`, `get_edge_score`, `search_memory`, `get_profile`, `get_day`) | `backend/ai-tools/` (enregistrés dans `modules/ai/tools`) — historique paginé (pas de plafond PostgREST silencieux), cloisonné `user_id` + compte actif ; plan, règles et objectifs lus sous leur forme jsonb (`profile-data.ts`) |
| Outils marché (`get_contract_math`, `get_economic_calendar`) | `backend/ai-tools/market.ts` — arithmétique des contrats CME (fiche unique `domain/futuresContracts.ts`, partagée avec le calculateur de position) ; calendrier `economic_events` en heure de New York |
| Profil `jarvis_nq` | `modules/ai/agents/jarvis-nq.ts` (identité, lecture, concision, connaissance NQ, formes, emplacement) |
| Mémoire | `modules/ai/memory.ts` (table `ai_memory`), `memory-select.ts` (choix des souvenirs injectés), `memory-extract.ts` + `agents/memory.agent.ts` + `backend/memory.functions.ts` (extraction, **coupée** tant que `AI_MEMORY_EXTRACTION !== "1"`). Écrivains côté trader : l'onboarding (`onb:arena`, `onb:commitments`, `onb:coaching`, source `onboarding`) et l'acceptation d'une règle |
| Validation des charges utiles | `backend/ai-payload.ts` |
| Télémétrie | `modules/ai/telemetry.ts` (contrat), `backend/telemetry.server.ts` (écriture : niveau, emplacement, domaines, outils, lectures, appels modèle, tokens de réflexion et de cache, coût estimé, validation, taille du contexte ; repli sur les colonnes historiques si la migration manque) |
| UI Jarvis | `app/features/jarvis/` : shell, workspaces, blocs typés (`blocks.ts`, `BlockRenderer`), conversations (**localStorage**, par appareil), propositions (`components/ProposalsPanel`, `proposals.ts`), crédits (`aiUsage.ts`) |
| Voix | `modules/voice/` (clips pré-synthétisés `public/voices/`, voix locale par langue, prosodie), `app/features/jarvis/jarvisVoice.ts` + `hostedVoice.ts`, `backend/tts.functions.ts` (ElevenLabs optionnel) |
| Cœur neuronal (modes de fonctionnement : respire, écoute, comprend, analyse, réfléchit, révise, rédige, parle) | `shared/ui/JarvisNeural.tsx` + `shared/ui/neural/` (WebGL, formes dans le shader) ; mode dérivé par `app/features/jarvis/neuralMode.ts` ; présence `components/JarvisPresence.tsx` — compacte (ligne de 44 px sur le champ de saisie) dans le chat, plein écran dans la scène vocale `components/LiveStage.tsx` |
| Conversation vocale | `app/features/jarvis/voiceConversation.ts` (reconnaissance Web Speech, fin de phrase, « stop », deux silences ferment), `components/VoiceBar.tsx`, tour tenu par `ConversationWorkspace` (écoute → question `channel: "voice"` → réponse dite → écoute ; micro jamais ouvert pendant que Jarvis parle, interruption par l'orbe) |

**Attente de réponse.** Le cœur reste visible sur le champ de saisie, hors du
fil défilant, pendant la lecture, la rédaction et l'écoute : une ligne de
44 px, jamais au-dessus de la discussion. Le bouton « afficher la réponse
complète » y prend place pendant la rédaction. Les quatre bulles sont des phases
visuelles **indicatives**, pas une trace du raisonnement privé ou des outils du
serveur : aucun pourcentage ni coche de réussite. Le compteur donne seulement
le temps écoulé réel. Le même composant sert au chat et au mode vocal ; le fil
ne monte aucun cœur graphique supplémentaire pendant que la scène vocale est
active.

**Fondations non branchées** (compilées, testées, appelées par aucune
surface) : `modules/ai/infra.ts` et `router/router.ts` (ancien routeur d'intentions), `rag/types.ts`
(contrat d'embeddings), le catalogue `backend/ai.functions.ts`, et le moteur
d'insights `app/features/jarvis/insights/` hormis `suggestions.ts` (seul utilisé
par l'UI).

## 4. Boucle de motifs et propositions

`Séance → Trades → Erreurs → Cluster → Motif → Proposition → (le trader confirme) → Règle / Objectif / Checklist`

1. **Séances** : table `trading_sessions`, `trades.session_id` (optionnel,
   rattaché au mieux) ; `app/trading/readiness.ts` dérive le score de
   préparation (jamais demandé au trader).
2. **Taxonomie** : chaque erreur de `MISTAKE_OPTIONS` appartient à un cluster
   (`app/trading/mistakeClusters.ts`, tables `mistake_clusters` /
   `mistake_taxonomy`).
3. **Détection déterministe** : cron nocturne `/api/cron/pattern-scan` →
   `backend/pattern-scan.server.ts` → `modules/patterns` (`scan`, `detectors`,
   `thresholds`, `persist`) → table `detected_patterns` (preuve avec `n`
   obligatoire).
4. **Formulation** : `modules/patterns/writer.ts` — le modèle rédige seulement ;
   il ne décide ni qu'un motif existe, ni d'un seuil, ni d'une action.
   `derive.ts` dérive l'action candidate ; `proposalSchemas.ts` la valide (Zod).
5. **Proposition** : table `agent_proposals` (`pending` → `accepted` /
   `dismissed` / `expired` à 14 jours). Budget d'intervention : 3 en attente
   au plus, 1 nouvelle par jour. Acceptation →
   `backend/proposals.functions.ts` crée l'objet et note `applied_ref`.

## 5. Proactivité sans IA

`modules/notifications/rules.ts` : règles codées, pures, dédupliquées une fois
par jour (séries de pertes, erreur la plus coûteuse, inactivité, bilan
hebdomadaire, progrès, règle qui glisse, séance propre) + alertes du
calendrier économique (`modules/notifications/economic.ts`). Seuils hauts
volontairement : un canal bruyant finit désactivé.

Rien n'interrompt le trader, sauf **une** chose (`policy.shouldInterrupt`) :
l'annonce à fort impact, **une heure avant**, sur une devise qu'il trade
vraiment (`domain/instrumentCurrency.currencyFocus` : 60 derniers jours du
journal, devises ≥ 10 % des trades, repli sur les marchés déclarés à
l'onboarding). Annonces simultanées regroupées, heures approximatives du repli
intégré jamais alertées. Pas de toast automatique ; le reste attend dans la
boîte. Les catégories coupées dans les Réglages (`preferences.ts`, stockées
dans `user_preferences.prefs.notifications`) sont appliquées par l'adaptateur
`allow` du moteur.

## 6. Configuration

Variables (liste complète : `.env.example`) : `AI_PROVIDER`, clés
`GEMINI/ANTHROPIC/OPENAI/GROQ/OPENROUTER_API_KEY` (+ `*_MODEL`),
`AI_MODEL_ROUTER` / `AI_MODEL_FAST` / `AI_MODEL_BALANCED` / `AI_MODEL_STRONG` /
`AI_MODEL_DEEP` (chaîne `fournisseur:modèle,…` par niveau ; `AI_MODEL_ROUTER=off`
coupe le routage par petit modèle), `AI_MODEL_PRICES` (prix pour le coût
estimé), `AI_TOOLS` (`off` coupe la boucle d'outils, les lectures préparées
restent), `AI_REQUIRE_PRO`, `AI_RATE_LIMIT_PER_HOUR`, `AI_MEMORY_EXTRACTION`,
`ELEVENLABS_API_KEY`, `TTS_PROVIDER`. Toutes côté serveur.

## 7. Étendre la plateforme

- Nouveau provider → un fichier dans `modules/ai-provider/` + une ligne dans
  `registry.ts`.
- Nouvel outil → `backend/ai-tools/tools.ts`, **lecture seule**, testé
  (`tests/jarvisTools.test.ts`, `tests/jarvisNoDirectWrites.test.ts`,
  cloisonnement : `tests/jarvisDataFixes.test.ts`).
- Nouvelle source de contexte (calendrier, news, connaissance produit) →
  `registerContextSource` dans `modules/ai/context-engine.ts` : ses lectures
  partent avec les autres, son avertissement « non branché » disparaît.
- Nouveau modèle ou nouvel ordre par niveau → `AI_MODEL_<EMPLACEMENT>`, sans
  code ; nouvelle gamme par défaut → `DEFAULT_SLOT_MODELS` (`runtime/tiers.ts`).
- Nouvelle action proposée → un `action_type` + un schéma dans
  `modules/patterns/proposalSchemas.ts` + sa création dans
  `backend/proposals.functions.ts`.
- Nouveau motif → un détecteur dans `modules/patterns/detectors.ts` avec ses
  seuils dans `thresholds.ts`.
