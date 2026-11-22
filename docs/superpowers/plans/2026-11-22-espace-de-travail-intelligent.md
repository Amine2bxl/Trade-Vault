# Plan — TradeVault, espace de travail intelligent

Date : 2026-11-22 · Statut : **proposé, en attente de validation** · Rien n'est
implémenté. Base : `main` @ `58164db` (historique complet, 1 051 commits, relu).

Principe directeur : le trader décide, TradeVault administre. Chaque lot doit
retirer des gestes ou fiabiliser une donnée ; sinon il ne se fait pas.

---

## 0. En dix lignes

1. La checklist d'origine est **retrouvée** : port d'une page « Pre-Trade OS »
   (juillet 2026) + un HUD « J.A.R.V.I.S » importé d'un autre projet. Sa voix,
   ses sons et ses 78 clips pré-rendus existent encore ; le code d'interface,
   lui, a été retiré le 31/10.
2. Le **moteur actuel** (Plan → Séance → Bilan, `sessionPlan.ts`, 52 tests) est
   meilleur que l'ancienne liste à cocher : on garde ce cerveau, on lui rend
   son identité (Mode Terminal, voix, sons). On ne restaure pas l'ancien code.
3. Beaucoup existe déjà : verdicts PASS/FAIL/UNKNOWN, `measuredR`, provenance
   par trade, import idempotent, annonces par trade, voix à trois étages,
   propositions Jarvis.
4. Le vrai manque : **le plan n'est pas comparé à l'exécution**. L'intention
   d'un trade n'a ni entrée, ni stop, ni cible prévus, et son risque prévu est
   **écrasé** à chaque enregistrement (défaut confirmé).
5. Priorité 0 : capturer plan vs exécution (lot A), puis noter l'exécution
   indépendamment du P&L (lot B).
6. Priorité 1 : états de séance et interruptions (C), Mode Terminal (D),
   encodage rapide (E), setups manqués en quelques secondes (F), performance
   comportementale visible partout (G).
7. Priorité 2 : note → champs par IA avec preuve (H), revues générées (I),
   modèles d'import (J).
8. Reporté : MAE/MFE automatiques (aucune donnée intraday, fournisseur
   payant), vision IA sur captures (peu fiable), recherche en langage naturel.
9. Trois migrations additives suffisent pour tout le P0/P1 ; le reste vit dans
   des colonnes `jsonb` et `user_preferences` existantes.
10. Quatre décisions t'appartiennent (§8) avant le premier lot.

---

## 1. Checklist d'origine — récupération

### Chronologie (vérifiée dans git)

| Date | Commit | Fait |
| --- | --- | --- |
| 2026-07-03 | `c73a748` | Projet extrait de Lovable |
| 2026-07-13 | `d6bec91` | **Import** du dossier `JARVIS/` (HUD « J.A.R.V.I.S — Capture & Tri », serveur Node ElevenLabs + Notion) et **port** de la page « Pre-Trade OS » : `Checklist.tsx` (1 959 l.) + `checklist.css` (1 124 l., portée `.jchk`) |
| 2026-07-13 | `4ded526` | Voix de la checklist (Web Speech, trois tons) |
| 2026-07-18 | `df0c67f` | Dossier `JARVIS/` supprimé (nettoyage) |
| 2026-07-24 | `7a91938` | Voix unique hébergée (`backend/tts.functions.ts`) |
| 2026-07-27 | `cd8f94d`, `6955469` | « Identité holographique », popup vocal premium, « old-OS identity » |
| 2026-07-27 | `1d20ffd` | Réécriture au design system : −2 638 lignes de CSS, canevas et voix gardés |
| 2026-08-01 | `ef4af9f` | Voix clonée : 78 répliques pré-rendues (F5-TTS, référence `modules/voice/Jarvis.mp3`) |
| 2026-10-18 | `8393a38` | Voix hébergée → ElevenLabs « Daniel » (`onwK4e9ZLuTAKqWW03F9`) |
| 2026-10-31 | `54cfb0c` | **Refonte Plan → Séance → Bilan** ; retirés : voix, sons, motivations, états FOMO, compte à rebours, assistant de configuration |

Dernière version immersive complète : `git show 54cfb0c^:src/app/features/checklist/Checklist.tsx` (2 189 l.).

### Ce qui est récupérable

| Élément | Où | État |
| --- | --- | --- |
| Grammaire visuelle d'origine : fond `#030b14`, cyan `#22d3ee`, sarcelle `#2dd4bf`, ambre, rouge `#ff5566` ; Rajdhani / Orbitron / JetBrains Mono ; grille holographique fixe ; 23 keyframes (réacteur, balayage, verrouillage, frappe) | `git show d6bec91:src/tradevault/pages/checklist.css` | Historique seulement |
| HUD d'origine : réacteur à états (écoute, traitement, parole, synchro, hors ligne) | `git show d6bec91:JARVIS/Jarvis.html` | Historique seulement |
| Moteur sonore Web Audio : `blip`, `chime`, `alarm`, `powerUp`, `radioClick`, fond radio, écho + compresseur | `54cfb0c^` (l. 468-720) | Historique ; un moteur proche vit dans `onboarding/onboardingSound.ts` (11 sons, coupable, mémorisé) |
| Catalogue des répliques (11 situations × 4-8 variantes, EN + FR, tons `calm`/`firm`/`alert`) | `features/checklist/voice.ts` | **Présent**, lu seulement par `scripts/voices/generate.ts` |
| 78 clips MP3 (voix clonée, **anglais seulement**) + manifeste | `public/voices/` (1,5 Mo) | Présents ; 71 ne sont plus joués depuis le 31/10 (un sert à l'onboarding) |
| Chaîne vocale : ElevenLabs (si clé) → clip → voix du navigateur ; FR local (Thomas, Amélie) | `jarvis/jarvisVoice.ts`, `modules/voice/` | **Présente et partagée** (Jarvis, onboarding) |
| Cœur animé autorisé (8 formes : respire, écoute, analyse, parle…) | `shared/ui/JarvisNeural.tsx` | Présent, exception de design documentée |

### Ce qui manque

- Aucun clip français ; les répliques fixes sont anglaises par règle (`AI.md`, invariant 6).
- La voix des clips (voix clonée d'origine) n'est pas celle du serveur (« Daniel ») ; avec la clé ElevenLabs, chaque réplique fixe est facturée une fois par session.
- Aucun réglage de volume, de vitesse, de langue de voix ni de coupure globale.
- Les deux pages `JARVIS/*.html` n'existent plus que dans l'historique.

### Recommandation

Garder le moteur `sessionPlan` (il remplace un cochage réflexe par des
valeurs écrites, gelées et confrontées aux trades — la raison du 31/10 reste
juste). Rendre l'identité d'origine **par-dessus** : un **Mode Terminal**
plein écran (lot D) qui reprend la mise en scène (HUD, cœur qui réagit à
l'état, sons d'origine, voix posée, cérémonie de verrouillage), traduite dans
la loi Liquid actuelle : rien ne rayonne hors des exceptions déjà admises,
`transform`/`opacity`, chiffres tabulaires Inter, libellés en pile mono système
(aucune police à télécharger).

---

## 2. Audit — état réel

| Module | Existe | Partiel | Absent |
| --- | --- | --- | --- |
| Checklist | Plan gelé, scénario B, R:R des niveaux, porte d'entrée oui/non, blocages (fenêtre, trades max, pertes d'affilée), bilan pré-rempli, `trading_sessions`, handoff trade/setup manqué | Journée par utilisateur et par date (pas par compte) ; risque par défaut = dernier saisi | Limite de perte du jour en $, journal des dérogations, voix et sons |
| Journal (`TradeModal`, 1 677 l.) | Brouillon autosauvé, R et P&L calculés, contrats depuis le stop, annonces du jour, intention + réflexion | Défauts fixes (Scalping, 09:30, qualité 3, confiance 70) | Choix du compte, entrée/stop/cible prévus, stop et cible en prix, phases de captures, saisie en masse, modèles |
| Tags | Confluences configurables (profil) ; erreurs en 4 familles | Symboles déjà utilisés en tête | Stratégies reliées aux setups du plan, favoris, récents |
| Calculs | `measuredR` (seule définition), durée, session NY, win rate, PF nul sans perte | — | R prévu vs réalisé, MAE/MFE depuis les prix (saisis à la main) |
| Import CSV | Auto-mapping EN/FR, 4 formats, clé d'occurrence, doublons certains/probables, reconstruction TradingView, lignes cassées récupérées | — | Modèles de mappage mémorisés, reconnaissance du compte, préréglage Tradovate CSV |
| Provenance | `source`, `risk_source`, fuseau, instants UTC, `raw_ingest_events` immuables | Par champ : seul le risque | Origine IA / externe par champ |
| Règles | 6 types, verdicts PASS/FAIL/UNKNOWN, adhérence 30 j | Alerte « limite atteinte » émise, jamais bloquante | Règle « bloque / avertit », dérogation motivée, état de séance |
| Missed | Table, captures, compte | — | Raisons fermées, classes (valide, volontaire…), R calculé, issue |
| Dashboard / Calendrier | P&L, KPI avec `n`, setups manqués au calendrier, mois par sous-compte | Tuile « discipline » = Edge Score | Panneau comportemental, jours sans trade ou verrouillés |
| Objectifs | 5 objectifs financiers | « discipline » = taux de notes | Objectifs de conformité (séries de risque respecté, sans revenge) |
| Jarvis | 11 outils en lecture, contexte en 15 blocs, propositions acceptées seule voie d'écriture, dictée Web Speech | Revue quotidienne/hebdo côté serveur **sans interface** | Extraction note → champs, vision |
| Données de marché | Calendrier économique, saisonnalité | Clôtures **mensuelles** seulement | Intraday (MAE/MFE impossibles aujourd'hui) |

## 3. Défauts relevés pendant l'audit (déjà présents)

| # | Défaut | Preuve | Effet | Lot |
| --- | --- | --- | --- | --- |
| D1 | Le risque **prévu** de l'intention est réécrit à chaque enregistrement | `store/tradeIntel.ts:146-153` (upsert `planned_risk = trade.riskAmount`) | Tout « prévu vs réalisé » serait faux | A |
| D2 | Violations calculées puis jamais lues | `modules/automation/engine.ts:116` | Une règle franchie ne change rien | C |
| D3 | « Discipline » désigne trois grandeurs | Dashboard = Edge Score ; Objectifs = taux de notes (`goalPlan.ts:18`) ; Erreurs = `computeBehavioral` | Lecture trompeuse | G |
| D4 | Le débrief mensuel IA contourne le registre et le quota | `backend/monthly-reports.server.ts:59-101` | Coût non plafonné | I |
| D5 | Les types générés ne connaissent pas `checklist_config` | `integrations/supabase/types.ts` | À régénérer après la prochaine migration | A |

---

## 4. Matrice d'opportunités (par valeur réelle)

Gains = **estimations** tirées du nombre de gestes retirés, pas des mesures.

| # | Fonction | Aujourd'hui | Proposé | Gain estimé | Qualité des données | Complexité | Dépend de | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Intention figée | Écrasée (D1) | Figée à la création ; + sens, entrée, stop, cible, scénario prévus | — | **Élevée** : base de tout l'écart | S | — | P0 |
| 2 | Plan → trade | Sens, risque, symbole et stratégie du dernier trade | + compte, setup du plan, prix prévus, scénario ; trade ouvert depuis la séance en 3 gestes | 4-6 champs, ~30 s / trade | Élevée | S | 1 | P0 |
| 3 | Qualité d'exécution | Absente au trade (seul « plan respecté ? » déclaré) | Moteur pur : A+ ou hors plan × issue → bonne/mauvaise exécution ; séance sans trade → bonne discipline ; modifiable, origine gardée | Le bilan pré-rempli remplace l'analyse | **Élevée** | M | 1 | P0 |
| 4 | Écarts plan / exécution | Sens, trade en trop, journée d'observation | + entrée hors zone, sur-risque, stop déplacé, sortie avant cible ou invalidation, scénario contredit ; INCONNU sans donnée ; question d'un geste pour le psychologique | 7 cases → pré-cochées | Élevée | M | 1 | P0 |
| 5 | États de séance + interruptions | 4 phases ; 3 blocages ; rien n'est journalisé | PRÉPARATION / PRÊT / ACTIVE / PAUSE / TERMINÉE / VERROUILLÉE ; chaque règle « bloque » ou « avertit » ; perte du jour en $ ; dérogation motivée, horodatée | Évite la décision impulsive | Élevée (dérogations comptées) | M | — | P1 |
| 6 | Mode Terminal + voix + sons | Retirés le 31/10 | Même moteur, vue plein écran, cœur réactif, sons d'origine, voix FR/EN réglable, sous-titres | Guidage sans lecture | Faible ; rituel et rétention forts | M | 5 | P1 |
| 7 | Setups manqués express | 5 champs libres, R tapé et toujours sommé | Raisons fermées, 4 classes, R hypothétique calculé, issue déclarée ; seul « valide + issue connue » compte | ~5 champs → 2-3 gestes | **Élevée** (« R laissé » honnête) | M | — | P1 |
| 8 | Défauts par compte | Compte non choisissable ; défauts fixes | Compte dans le formulaire ; derniers symbole, setup, risque **par compte** ; risque issu du plan | ~3 champs / trade | Moyenne | S | — | P1 |
| 9 | Tags rapides | Stratégie = liste figée | Stratégies = setups du plan ; confluences favorites et récentes ; bibliothèque ICT optionnelle | 2-4 gestes | Moyenne (vocabulaire stable) | S | — | P1 |
| 10 | Calcul depuis les prix | R depuis le risque en $ | Stop et cible en prix → risque en points/ticks, taille, R prévu vs réalisé | Plus de calcul mental | Élevée | S | 1 | P1 |
| 11 | Psychologie légère | 6 humeurs au plan | Énergie et stress 1-5 (facultatif) ; après trade : intensité + envie de reprendre (1 geste) ; fin de séance : défi, meilleure décision, une amélioration | 3 gestes | Moyenne (déclaratif, étiqueté) | S | 3 | P1 |
| 12 | Panneau comportemental | Collision D3 | Financier et comportemental côte à côte, jamais fusionnés, chacun avec son `n` | — | Lisibilité | M | 3 | P1 |
| 13 | Calendrier et objectifs comportementaux | P&L, setups manqués | Jours sans trade avec plan, verrouillés ; séries « risque respecté », « sans revenge », « pré-market complet » | — | Moyenne | S | 3, 5 | P2 |
| 14 | Note → champs (IA) + dictée | Absent | JSON à vocabulaire fermé ; chaque champ cite son extrait, sinon rejeté ; suggestion, jamais d'écrasement | ~5 champs, ~40 s | Moyenne (risque contenu) | M | 9 | P2 |
| 15 | Revues générées | Catalogue serveur sans interface | Faits calculés + formulation Jarvis, au Bilan et dans Rapports ; lecture vocale possible | 5-10 min / séance | Moyenne | M | 3, 5 | P2 |
| 16 | Modèles d'import | Mappage refait à chaque fichier | Empreinte d'en-têtes → mappage et compte mémorisés | ~1 min / import | Moyenne | S | — | P2 |
| 17 | Saisie en masse | Absente | Sélection + étiquetage du passé | Rattrapage d'historique | Moyenne | M | 9 | P3 |
| 18 | Captures par phase | 3 max, ordre seul | Étiquette de phase facultative | — | Faible | M (schéma) | — | P3 |
| 19 | MAE/MFE automatiques | Saisis à la main | Seulement avec données intraday (clé Databento posée, lue par aucun code, **payante**) ; sinon « indisponible » | — | Élevée si source fiable | L + coût | décision | P3 |
| 20 | Vision IA sur captures | Absente | Reportée : annotations peu fiables ; réévaluer après le taux d'acceptation du #14 | — | Risque | L | 14 | P3 |

---

## 5. Décisions d'architecture proposées

- **Un cerveau, deux peaux.** `sessionPlan.ts` reste la seule logique de séance ; le Mode Terminal est une vue, pas un second moteur.
- **Le calculé ne se stocke pas.** R prévu, écarts, qualité d'exécution, état de séance sont dérivés à la lecture par des fonctions pures (`domain/`, `modules/`). On stocke seulement ce que le trader saisit, ce qu'il corrige (avec l'origine `manual`) et ce que l'IA suggère (avec son statut).
- **Origine par valeur** : `MANUAL`, `IMPORTED`, `CALCULATED`, `AI_SUGGESTED` (+ statut `pending/confirmed/rejected`), `EXTERNAL`. Les colonnes existantes (`source`, `risk_source`) restent la vérité pour ce qu'elles couvrent.
- **Tri-état partout** : PASS / FAIL / UNKNOWN (réutilise `evaluateTradeRule`). Une donnée manquante donne INCONNU, jamais une déduction.
- **Psychologique = déclaré.** Jamais « détecté » ; affiché comme « déclaré » ; une seule question d'un geste quand les prix ne suffisent pas.
- **Préférences** (voix, sons, défauts par compte, récents, modèles d'import) : `user_preferences` via `utils/userPrefs` — synchronisées, aucune migration.
- **Le journal n'est jamais bloqué.** VERROUILLÉE ferme la porte d'entrée de la checklist, affiche l'état partout, journalise toute dérogation ; enregistrer un trade réellement pris reste possible. Aucun ordre broker, jamais (synchro en lecture seule).
- **Migrations additives** uniquement, RLS owner-only, appliquées à la base réelle seulement avec ton accord.

---

## 6. Lots

Chaque lot : AUDIT → PLAN → CODE → TESTS → REVUE → CORRECTIONS → TESTS → VALIDATION ;
portes typecheck → lint → build → test (TZ New York et Auckland) ; captures
1440 et 390 pour toute interface ; un commit par étape, sur branche, PR en brouillon.

### Lot A — Plan ↔ exécution : la fondation (P0)

- **But** : chaque trade porte ce qui était prévu, figé.
- **Périmètre** : corriger D1 (les champs prévus ne s'écrivent qu'à la création) ; le handoff de la séance fige sens, entrée, stop (invalidation), cible, risque et scénario dans l'intention ; stop et cible réels en prix sur le trade ; moteur pur `domain/executionPlan.ts` (R prévu, R réalisé, risque en points/ticks via `domain/futuresContracts`).
- **Fichiers** : `store/tradeIntel.ts`, `features/checklist/sessionHandoff.ts`, `features/journal/TradeModal.tsx` (une section extraite, pas de refonte), `domain/executionPlan.ts` (+ test), `domain/trade.ts`.
- **Base** : `trade_intent` + `planned_direction`, `planned_entry`, `planned_stop`, `planned_target`, `planned_scenario` ; `trades` + `stop_price`, `target_price` (numeric, nullable). Types régénérés (D5).
- **Risques** : `TradeModal` volumineux → nouvelle section en composant séparé ; anciens trades sans prévu → INCONNU, jamais 0.
- **Acceptation** : réenregistrer un trade ne change plus son prévu ; un trade issu de la séance arrive avec ses prix prévus ; R prévu `null` dès qu'un prix manque.
- **Tests** : moteur (prix manquants, short/long, ticks), intention figée, handoff, RLS de la migration.

### Lot B — Qualité d'exécution, séparée du P&L (P0)

- **But** : une perte bien exécutée se lit « bonne exécution » ; un gain hors plan, « mauvaise exécution ».
- **Périmètre** : `modules/discipline/execution.ts` (pur) : entrées = conformité au plan (`tradeBreaches`), règles (`evaluateTradeRule`), écarts du lot A, réflexion ; sortie = `good_execution` / `bad_execution` / `good_discipline` (séance sans trade, ou setup manqué sans revenge) / `unknown`, avec ses raisons. Le P&L n'est **pas** une entrée (test qui le prouve). Écarts automatiques : entrée hors zone, sur-risque, stop déplacé (si stop réel ≠ prévu), sortie avant cible ou invalidation, trade en trop, sens contraire. Bilan : chaque trade affiche son verdict et ses raisons, corrigeable en un geste (origine `manual`) ; questions d'un geste (intensité, envie de reprendre).
- **Fichiers** : nouveau module + test, `features/checklist/ReviewCard.tsx`, `features/journal/TradeDetailParts.tsx`, `store/tradeIntel.ts`, `i18n` (en + fr).
- **Base** : `trade_reflection` + `execution_override` (check), `override_note`, `intensity` (1-5), `reentry_urge` (bool). Le verdict calculé n'est pas stocké.
- **Risques** : sur-interprétation → chaque écart cite sa donnée ; aucun écart sans donnée.
- **Acceptation** : les 6 cas du tableau du brief donnent le verdict attendu ; changer le P&L ne change jamais le verdict ; une correction manuelle survit au recalcul.
- **Tests** : table des 6 cas, inconnus, surcharge, `noCausalLanguage` étendu aux nouvelles clés.

### Lot C — États de séance et interruptions (P1)

- **But** : la séance dit où en est le trader et s'arrête quand les règles le demandent.
- **Périmètre** : `modules/discipline/sessionState.ts` (pur) dérive PRÉPARATION / PRÊT / ACTIVE / PAUSE / TERMINÉE / VERROUILLÉE depuis la phase, les règles, les trades et l'heure ; chaque règle reçoit `enforcement: "block" | "warn"` ; nouveau type `max_daily_loss` en montant (le % reste INCONNU sans solde vérifié, c'est exact) ; dérogation = motif écrit + délai (même mécanique que `PlanChange`), journalisée dans l'instantané de séance ; D2 corrigé (les violations nourrissent l'état) ; bandeau d'état dans le cadre de l'app.
- **Fichiers** : nouveau module + test, `domain/ruleCheck.ts`, `features/trading-plan/TradingRulesSection.tsx`, `features/checklist/{Checklist,LiveCard,EntryGate}.tsx`, `modules/automation/engine.ts`, `shell/`.
- **Base** : aucune (`profiles.trading_rules` et `trading_sessions.checklist_snapshot` sont en `jsonb`).
- **Risques** : friction → « avertit » par défaut, le trader choisit ce qui bloque ; validation des propositions Jarvis `create_rule` à étendre au nouveau type.
- **Acceptation** : perte du jour atteinte → VERROUILLÉE et porte d'entrée fermée ; toute dérogation a un motif et une heure ; un trade réel reste enregistrable.
- **Tests** : transitions, minuit, DST, égalité de minute (INCONNU), dérogation.

### Lot D — Mode Terminal : l'identité retrouvée (P1)

- **But** : la checklist redevient un terminal de préparation, sans redevenir une liste à cocher.
- **Périmètre** : vue plein écran du même moteur (bascule sur la page, `Échap` pour sortir) ; HUD : état de séance, heure NY, compte à rebours de la fenêtre, niveaux du plan en chiffres tabulaires ; `JarvisNeural` réagit à l'état (respire en préparation, écoute en séance, parle quand il parle) ; sous-titres de chaque réplique ; cérémonie de verrouillage (son + réplique) ; sons d'origine portés dans un moteur partagé issu de `onboardingSound.ts` ; voix : clips d'abord pour les répliques fixes, hébergée pour le texte variable, navigateur en secours ; réglages voix/sons : on/off, volume, vitesse, langue. Jamais pendant la saisie d'un trade ; une réplique s'interrompt au premier geste. Utilisable sans son, au clavier, sous `prefers-reduced-motion`.
- **Fichiers** : `features/checklist/TerminalMode.tsx` (nouveau), `voice.ts` (répliques des nouveaux événements, EN + FR), `shared/sound/` (moteur déplacé, l'onboarding le réimporte), `jarvis/jarvisVoice.ts` (options de lecture), `features/settings/`, `docs/DESIGN_SYSTEM.md` (exception documentée), `docs/AI.md` (invariant 6 si voix FR).
- **Base** : aucune.
- **Risques** : loi Liquid (« rien ne rayonne », 8 keyframes, 300 ms) → exception écrite et bornée comme l'onboarding ; coût ElevenLabs → répliques fixes jouées depuis les clips ; voix des clips ≠ « Daniel » → décision §8-1.
- **Acceptation** : tout le parcours Plan → Séance → Bilan se fait en Mode Terminal, au clavier, son coupé ; aucune réplique ne chevauche une action ; préférences retrouvées sur un autre appareil.
- **Tests** : file de parole (interruption, coupure), préférences, contrat sonore (jamais avant un geste), captures 1440/390, console vide.

### Lot E — Encodage rapide (P1)

- **But** : un trade issu de la séance s'enregistre en trois gestes : ouvrir (pré-rempli), saisir le résultat (R ou prix de sortie), enregistrer.
- **Périmètre** : compte choisissable dans le formulaire ; derniers symbole, setup et risque **par compte** ; risque par défaut issu du plan de trading ; stratégies = setups du plan (repli sur la liste actuelle) ; confluences favorites et récentes ; bibliothèque ICT proposée si `onboarding_uses_ict` ; calculs du lot A affichés en direct.
- **Fichiers** : `features/journal/TradeModal.tsx` (sections extraites), `trading/tradingPlan.ts`, `utils/userPrefs.ts` (clés), `store/profile.ts`.
- **Base** : aucune.
- **Risques** : un défaut faux passe inaperçu → les champs pré-remplis sont marqués comme tels jusqu'à l'enregistrement.
- **Acceptation** : chaque compte retrouve ses propres défauts ; aucun champ saisi n'est écrasé par un défaut ; brouillon et récupération intacts.
- **Tests** : défauts par compte, brouillon, sous-comptes, régression du formulaire existant.

### Lot F — Setups manqués en quelques secondes (P1)

- **Périmètre** : action rapide (séance, ⌘K, Missed) pré-remplie par la séance ; raisons fermées (hésitation, peur, setup non reconnu, confirmation absente, hors fenêtre, contrainte de risque, limite du jour atteinte, choix délibéré) ; classes : valide, invalide, ignoré volontairement, manqué par hésitation ; R hypothétique calculé depuis entrée/stop/cible ; issue déclarée (cible, stop, inconnue) ; « R laissé sur la table » ne compte que les valides à issue connue, avec leur `n`.
- **Fichiers** : `features/missed/*`, `store/missed.ts`, `features/checklist/sessionHandoff.ts`, `domain/` (calcul pur + test).
- **Base** : `missed_opportunities` + `direction`, `entry_price`, `stop_price`, `target_price`, `reason_code`, `classification`, `outcome` (checks fermés). Anciennes lignes : classe inconnue, comptées à part.
- **Acceptation** : un setup manqué se note en ≤ 3 gestes depuis la séance ; un setup invalide ou volontaire ne compte jamais comme argent perdu.

### Lot G — La performance comportementale partout (P1/P2)

- **Périmètre** : panneau comportemental au Dashboard à côté du financier (conformité, qualité d'exécution, violations, dérogations, fin de séance respectée), jamais un score fusionné ; D3 corrigé par des noms distincts ; Analytics → Exécution : conforme vs non conforme, R prévu vs réalisé, effet des sorties anticipées et des BE (sous `MIN_BUCKET_SAMPLE` : rien) ; Calendrier : jours tradés, sans trade avec plan, verrouillés, setups manqués ; Objectifs : séries comportementales.
- **Base** : aucune (`goal_plans` est en `jsonb` ; `six_month_goals` n'a plus de lecteur).
- **Acceptation** : chaque chiffre affiche son `n` ; aucune formulation causale ; « discipline » ne désigne plus qu'une grandeur.

### Lot H — Note → champs par IA, et dictée (P2)

- **Périmètre** : fonction serveur derrière `requireJarvisSideAccess` (quota) via le registre de fournisseurs ; sortie JSON à vocabulaire fermé (confluences, erreurs, type et raison de sortie, émotion, écart probable) ; **chaque champ cite son extrait exact de la note, sinon il est rejeté** (contrôle déterministe) ; suggestions en puces `AI_SUGGESTED`, acceptées ou rejetées en un geste ; ne remplit jamais un champ déjà saisi ; dictée par le reconnaisseur Web Speech existant.
- **Base** : `trades.field_provenance jsonb default '{}'`.
- **Acceptation** : la note d'exemple du brief donne ses champs avec citations ; aucun fait absent de la note n'apparaît ; mesure du taux d'acceptation (décide du lot vision).

### Lot I — Revues générées depuis les données (P2)

- **Périmètre** : brancher la revue quotidienne et hebdomadaire existantes (`backend/ai.functions.ts`) sur des faits calculés (plan, trades, écarts, verdicts, état de séance) ; affichage au Bilan et dans Rapports ; lecture vocale facultative ; D4 corrigé (registre + quota) ; blocs `session` et `get_day` de Jarvis enrichis des écarts et verdicts.
- **Acceptation** : chaque phrase chiffrée renvoie à un chiffre du moteur ; rien sous l'échantillon minimum ; coût borné par le quota.

### Lot J — Import qui se souvient (P2)

- **Périmètre** : empreinte des en-têtes → mappage, fuseau et compte mémorisés (`user_preferences`) ; reconnaissance du compte par la colonne de compte du fichier ; préréglage Tradovate CSV, puis préréglages G1 de la roadmap.
- **Acceptation** : un second fichier du même broker s'importe sans aucun réglage ; doublons et idempotence inchangés (tests existants verts).

### Points de contrôle

- Après A + B : revue avec toi — le trade de la séance arrive pré-rempli et son bilan sépare exécution et résultat.
- Après C + D : revue — séance complète en Mode Terminal, verrouillage éprouvé.
- Après E + F + G : revue — mesure des gestes réels par trade sur téléphone et bureau.

---

## 7. Volontairement hors périmètre

| Idée | Pourquoi pas maintenant |
| --- | --- |
| MAE/MFE automatiques | Aucune donnée intraday (clôtures mensuelles seulement) ; un fournisseur fiable est payant → ton accord |
| Vision IA sur les captures | Lecture d'annotations peu fiable, coût par image ; d'abord prouver l'extraction texte (H) |
| Notes vocales enregistrées | Stockage et confidentialité ; la dictée transcrite couvre le besoin |
| Intensité émotionnelle avant/pendant/après chaque trade | Trois questions par trade = le formulaire long qu'on veut supprimer ; une question après, une au plan |
| Recherche en langage naturel | RAG présent mais non branché ; après H et I |
| Score unique « performance globale » | Interdit par le brief et par la règle des deux systèmes |

## 8. Décisions à prendre

1. **Voix** — (a) clips FR + EN pré-rendus une fois avec « Daniel » (ElevenLabs, multilingue : quelques crédits, **payant**) ; (b) clips générés gratuitement par F5-TTS sur ta machine depuis `Jarvis.mp3` (voix d'origine, FR moins naturel) ; (c) voix du navigateur seulement (gratuit, inégal selon l'OS). Recommandé : (a) pour l'identité, (c) en secours.
2. **Couleur du Mode Terminal** — jetons du thème actif (menthe `#31d68a` par défaut, suit le thème du trader) ou cyan d'origine `#22d3ee` réservé au terminal. Recommandé : jetons du thème.
3. **Verrouillage** — VERROUILLÉE ferme la porte d'entrée de la checklist et s'affiche partout, sans jamais empêcher d'enregistrer un trade réel. Recommandé : oui (le journal reflète la réalité).
4. **Ordre** — A → B → C → D (fondation d'abord) ou D en premier (identité d'abord, sur les phases actuelles). Recommandé : A → B → C → D.
