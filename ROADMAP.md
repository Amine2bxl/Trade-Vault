# TradeVault — Roadmap

> **Document propriétaire de l'exécution** : décisions tranchées, priorités
> P0→P3, séquencement en lots, **trajectoire V1 → V2**, et **dette technique**.
>
> C'est **la** référence des priorités : aucune autre page ne les duplique.
> L'état par fonctionnalité est dans [`FEATURES_STATUS.md`](FEATURES_STATUS.md) ;
> le *pourquoi* produit dans [`PRODUCT.md`](PRODUCT.md).
>
> Dernière vérification contre le code : **2026-07-28**.

---

## 1. Verdict

**Le socle est sain, la coque est excellente, l'âme est incomplète.**

Le journal, l'analytics, la checklist, l'onboarding et la landing sont de niveau
commercial. Le différenciateur vendu — « un coach IA 24 h/24 qui détecte tes
patterns et t'alerte » — est **partiellement tenu** :

- ✅ Jarvis existe, avec une identité unique, un grounding strict, des signaux
  comportementaux déterministes et un fallback qui ne tombe jamais en panne.
- ❌ Il **n'a pas de mémoire longue durée branchée** (la table existe, elle est
  semée, elle n'est pas lue par le coach).
- ❌ Il est **100 % réactif** : aucun brief, aucune review automatique, aucune
  alerte de pattern. Le produit attend l'utilisateur au lieu d'aller à lui.

**En une phrase.** Il manque le rendez-vous et la preuve chiffrée. Un coach qui
se souvient, un produit qui vient à toi, une valeur démontrée en euros — et
19,99 €/mois cesse d'être une question.

---

## 2. Décisions tranchées (ne pas rouvrir sans décision explicite)

| Sujet | Décision |
| --- | --- |
| **Monétisation** | Infra payante conservée, `AI_REQUIRE_PRO=false`. Au lancement : un Free qui *fait goûter* l'IA (quota), **jamais** un Free sans IA. Pas de paywall tant que la valeur n'est pas prouvée |
| **Sécurité du gating** | `fail-open` pendant la beta (un incident infra ne verrouille personne), **`fail-closed` au passage payant** |
| **Priorité de construction** | L'IA d'abord (c'est la différenciation). Le refactoring est du fond, au fil de l'eau, **jamais un préalable bloquant** |
| **Analytics** | Ne plus ajouter de métriques. Ajouter des **verdicts en langage clair** sur les métriques existantes |
| **Preuve sociale** | Pas de faux avis. Trustpilot **conservé en l'état** — zone gelée, vrais avis en cours |
| **Identité IA** | **Une seule** : Jarvis. Plus jamais de « AI Coach » / « Assistant » / « Insights » en parallèle |
| **Voix** | Une seule voix, toujours en anglais ; locale par défaut, hébergée en option |
| **Documentation** | 11 documents à la racine, **un propriétaire par sujet**, zéro duplication |

---

## 3. Grille de priorité

| Niveau | Sens |
| --- | --- |
| **P0** | Bloque la crédibilité ou le lancement. Maintenant |
| **P1** | Fort ROI, juste après le P0. Ce trimestre |
| **P2** | Important, non urgent. Quand le cœur tient |
| **P3** | Fond, dette, opportuniste |

---

## 4. Trajectoire V1 → V2

### V1 — livrée (l'état actuel)

Le trader a un journal complet, des analytics quant, une checklist de discipline,
un plan, des objectifs, des rapports mensuels automatiques, et **un coach IA
ancré qui répond**. Le produit est **utilisable et défendable**, mais **« pull »** :
c'est l'utilisateur qui vient chercher la valeur.

Caractéristiques assumées de V1 :
- Coach **read-only**, sans mémoire longue durée, sans outils, sans proactivité.
- Conversation persistée **localement, par appareil**.
- Statistiques calculées **côté client**, en mémoire.
- Paiement **dormant**, tout gratuit.

### V2 — la cible (« le rendez-vous et la preuve »)

Le produit **vient au trader** et **prouve sa valeur en euros**.

| Axe | Ce qui change entre V1 et V2 |
| --- | --- |
| **Mémoire** | `ai_memory` réellement injectée dans le coach + **écriture active** (extraction des engagements et leçons) + fil de conversation **en DB, cross-device** |
| **Proactivité** | Détection de pattern → notification ; **Daily Brief** avant session et **Weekly Review** hebdomadaire, automatiques (in-app + e-mail) |
| **Preuve** | « Le coût de tes erreurs » chiffré et mensuel ; un **verdict en clair** sur chaque métrique analytics |
| **Rétention** | Streak de discipline, bloc « Aujourd'hui », déclencheurs push pré-market |
| **Activation** | Import CSV blindé avec fallback démo systématique ; écran « ton plan personnalisé » en fin d'onboarding |
| **Commercial** | Free à quota IA, `fail-closed`, ICP resserré prop-firm / discipline |
| **Plateforme IA** | Tool Calling read-only branché, Router en production, télémétrie `ai_agent_runs`, puis agents spécialisés |
| **Scale** | Agrégats analytics en SQL/RPC + pagination |

**Le fil conducteur de V2** : chaque brique est un **ajout** par plug-in
(événement, listener, outil, agent, job). Aucune réécriture de Jarvis ni d'un
moteur existant.

---

## 5. Liste unique des actions P0 → P3

### P0 — bloquant crédibilité / lancement

| # | Action | Domaine | Dépendances prêtes |
| --- | --- | --- | --- |
| 1 | **Mémoire longue durée branchée** dans le coach (lecture `ai_memory` + écriture active des leçons/engagements) | IA | `ai_memory` ✅, `buildCoachContext` ✅ (écrit, non branché) |
| 2 | **Insights proactifs** : détection de pattern → notification (canal `ai_message`) | IA | Moteurs ✅, Notification Engine ✅, `ai_jobs` ⚪ |
| 3 | **Daily Brief + Weekly Review automatiques** (in-app + e-mail) | Rétention | Crons ✅, e-mails ✅, `ai_reports` ✅ |
| 4 | **Déclencheurs de retour push** (pré-market, rappel de review, protection de streak) | Rétention | Web-push ✅, checklist ✅ |
| 5 | **Import CSV blindé + fallback démo systématique** | Activation | Import ✅, trades de démo ✅ |

### P1 — fort ROI

| # | Action | Domaine |
| --- | --- | --- |
| 6 | « Coût de mes erreurs » chiffré et mensuel | IA / preuve |
| 7 | Verdicts IA en clair sur chaque métrique analytics | IA |
| 8 | Bloc « Aujourd'hui » en tête de Dashboard | Rétention |
| 9 | Streak de discipline + checklist quotidienne poussée | Rétention |
| 10 | Sync broker / import récurrent automatique | Rétention |
| 11 | Réduction de la navigation à 6–7 destinations (fusions Réglages / Discipline / Outils) | UX |
| 12 | Écran « ton plan personnalisé » en fin d'onboarding | Activation |
| 13 | ICP resserré (message prop-firm / discipline) | Conversion |
| 14 | Free qui fait goûter l'IA (quota) + bascule `fail-closed` | Conversion |
| 15 | Agrégats analytics en SQL/RPC + pagination | Perf / scale |
| 16 | **Internationaliser la landing** (aujourd'hui français codé en dur) | Conversion |

### P2 — important, non urgent

| # | Action | Domaine |
| --- | --- | --- |
| 17 | Objectif visible partout + micro-célébrations | Rétention |
| 18 | Rapport mensuel e-mail + carte de performance partageable | Acquisition |
| 19 | Micro-feedback de discipline à l'enregistrement d'un trade | UX |
| 20 | Empty states guidés (Dashboard, Journal) | UX |
| 21 | Jarvis contextuel à la page (suggestions selon l'écran) | IA |
| 22 | Démo sans compte depuis la landing | Conversion |
| 23 | Bandeau « statut beta » honnête sur la page tarifs | Conversion |
| 24 | Perf secondaire : polices, images, vendor chunks, prefetch | Perf |

### P3 — fond et opportuniste

| # | Action | Domaine |
| --- | --- | --- |
| 25 | Trancher la dette IA : `ai.functions.ts` orphelin + façade `modules/ai/index.ts` (voir §6) | Tech |
| 26 | Extraire un noyau `src/domain/` (rompre `modules → app`) | Tech |
| 27 | Résorption typographique (413 `text-[Npx]`) et couleur sémantique | Design |
| 28 | ESLint `warn → error` progressif (`no-unused-vars`, `no-explicit-any`) | Tech |
| 29 | Activer Leaked Password Protection (dashboard Supabase, manuel) | Sécu |
| 30 | RAG (embeddings) + application de la migration `ai_os_foundation` | IA |
| 31 | Agents secondaires : Performance Analyst, Risk Manager, Pattern Finder, Psychologist | IA |
| 32 | MCP — outils externes | IA |
| 33 | Pruning des dépendances (bloqué par l'egress du registre privé) | Tech |

---

## 6. Dette technique — inventaire vérifié

Chaque ligne a été **constatée dans le code**, pas héritée d'un audit ancien.

### 6.1 Dette IA

| # | Dette | Constat | Décision proposée |
| --- | --- | --- | --- |
| D1 | **`backend/ai.functions.ts` orphelin** | Six server functions (`aiChat`, `aiGenerateDailyBrief`, `aiGenerateWeeklyReview`, `aiAnalyzeTrade`, `aiDetectPatterns`, `aiGenerateLessons`) compilent, sont validées et gatées — **aucune surface UI ne les appelle** | Les réécrire sur `coach.agent.ts` au moment de livrer P0 #3, ou les retirer. **Ne pas les laisser diverger** |
| D2 | **Deux identités de prompt** | `coachIdentity()` (en prod, `coach.agent.ts`) et `COACH_IDENTITY` (non branché, `ai.functions.ts`) décrivent la même IA avec des textes différents | Une seule persona, dans `coach.agent.ts`. Résolu par D1 |
| D3 | **Façade `modules/ai/index.ts`** | Exporte `AI.*` depuis `ai.functions.ts` ; **importée par personne** | Retirer ou réaligner sur `askCoach` |
| D4 | **Mémoire semée mais non lue** | `seedProfileMemory()` écrit dans `ai_memory` ; `buildCoachV1Payload` ne la lit pas ; `buildCoachContext()` (qui la lit) n'est appelée nulle part | = P0 #1 |
| D5 | **Registres vides au runtime** | Agent registry, tool registry, router : contrats testés, **rien d'enregistré**. `runWithTools` n'est jamais exécuté en production | Assumé (fondation). À brancher dans l'ordre de valeur ([`AI_ARCHITECTURE.md` §7](AI_ARCHITECTURE.md)) |
| D6 | **Migration `ai_os_foundation` non appliquée** | `ai_embeddings`, `ai_jobs`, `ai_agent_runs` absentes des types générés | Appliquer **au moment** où les jobs/RAG sont construits, pas avant |

### 6.2 Dette d'architecture

| # | Dette | Constat | Décision |
| --- | --- | --- | --- |
| D7 | **`modules → app`** | Plusieurs moteurs importent `@/app/types` (`Trade`), `generateId` (`app/store`) et `checkTradeAgainstRules` (`app/utils/tradingRules`) | Extraire un noyau `src/domain/`. P3 #26 — documenté, non bloquant |
| D8 | **Analytics calculé côté client** | Tous les agrégats sont recalculés en mémoire à chaque rendu mémoïsé | Bascule SQL/RPC **avant** que le volume ne morde. P1 #15 |
| D9 | **Pas d'URL par page** | La navigation interne est un état React | Assumé pour l'instant ; à rouvrir si le partage de lien devient un besoin produit |
| D10 | **Aucun test serveur ni composant** | 76 tests, exclusivement sur des fonctions pures | Choix de ROI. À rouvrir si une régression serveur survient |

### 6.3 Dette UI / design

| # | Dette | Mesure | Décision |
| --- | --- | --- | --- |
| D11 | **Tailles arbitraires** | **413** `text-[Npx]` (dont **19** sous 10 px) | Migrer vers `type.*`. **Traiter d'abord les 8–9 px** (accessibilité) |
| D12 | **Couleur P&L en dur** | 216 `emerald-*`, 228 `red-*`, ~90 hex dans le JSX | Router via tokens/`Badge`/`Metric`, par lots mécaniques |
| D13 | **Adoption partielle du DS** | 28/56 fichiers `.tsx` de `app/` | Par lots, à l'occasion des écrans touchés |
| D14 | **Landing non internationalisée** | Zéro `useT()` dans `Landing.tsx`, français en dur | = P1 #16 |

### 6.4 Dette d'outillage

| # | Dette | Constat | Décision |
| --- | --- | --- | --- |
| D15 | **ESLint permissif** | `no-unused-vars` et `no-explicit-any` en `warn` assumé | Durcissement progressif. P3 #28 |
| D16 | **`bun install` bloqué** | Le registre npm privé configuré renvoie 403 sur plusieurs paquets → impossible d'installer les dépendances dans certains environnements ; `bun test` passe quand même 75/76 (le seul test échouant importe `@supabase/supabase-js`) | Débloquer l'egress registre, puis reprendre le pruning des dépendances. P3 #33 |
| D17 | **`.env.example` incomplet** | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_*`, `GEMINI_MODEL`, `TTS_PROVIDER` étaient utilisés sans être documentés | **Corrigé** dans cette passe de documentation |

---

## 7. Séquencement recommandé (lots)

| Lot | Contenu | Sortie attendue |
| --- | --- | --- |
| **Lot 1 — Le cœur** *(en cours)* | Mémoire branchée (P0 #1) + dégraissage de la navigation (P1 #11) | Jarvis se souvient ; le produit se lit en 6–7 destinations |
| **Lot 2 — Le rendez-vous** | Insights proactifs, Daily Brief, Weekly Review, push de retour, streak, bloc « Aujourd'hui » (P0 #2–4, P1 #8–9) | Le produit vient au trader |
| **Lot 3 — La preuve** | Coût des erreurs chiffré, verdicts analytics, plan personnalisé (P1 #6, #7, #12) | La valeur est démontrée en euros |
| **Lot 4 — Le go-to-market** | Free à quota, `fail-closed`, ICP resserré, landing i18n, import blindé, démo sans compte (P0 #5, P1 #13–14, #16, P2 #22) | On peut facturer sans rougir |
| **Lot 5 — Le fond & les systèmes IA suivants** | Analytics SQL/RPC, noyau `domain/`, dette IA tranchée, RAG, agents spécialisés, MCP (P1 #15, P3) | Le produit tient à l'échelle |

**Principe directeur** : construire **l'IA d'abord** (c'est la différenciation) ;
le reste au fil de l'eau, jamais comme préalable technique bloquant.

---

## 8. Quick wins (fort impact, faible effort)

- Écran « plan personnalisé » — réutilise un profil **déjà collecté**.
- Bloc « Aujourd'hui » — assemble des données **déjà calculées** (Edge Score,
  règle du jour, checklist, objectif).
- Verdicts en clair sur analytics — les moteurs fournissent **déjà** les chiffres.
- Fallback démo à l'échec d'import — l'option démo existe **déjà**.
- Empty states guidés — pur front.
- Streak de discipline — l'événement `DISCIPLINE_SUCCESS` existe **déjà**.

## 9. Chantiers lourds mais incontournables

Mémoire + écriture active (P0 #1) · moteur d'insights proactifs (P0 #2) ·
Weekly Review / Daily Brief automatiques (P0 #3) · sync broker (P1 #10) ·
analytics en SQL/RPC (P1 #15) · bascule commerciale (P1 #14).

---

## 10. Fusions et rétrogradations prévues

**À fusionner**
- Apparence + Réglages + Profil → **Réglages**
- Erreurs + Setups manqués → **Discipline & erreurs**
- Saisonnalité + Calculateur + Actualités → **Outils**
- Daily Brief + Weekly Review + notifications IA → un système **coach push** unifié
- `monthly_reports` + `ai_reports` → **une seule chaîne de génération de rapports**

**À rétrograder ou supprimer**
- Toute métrique analytics purement décorative (sans verdict)
- Les chiffres maquettés présentés comme réels dans un hero

**Jamais touché** : Trustpilot (zone gelée).

---

## 11. Maintenance de ce document

Ce fichier se met à jour **à chaque livraison structurante** : déplacer la ligne,
dater l'en-tête, refléter le changement dans
[`FEATURES_STATUS.md`](FEATURES_STATUS.md) **et** dans le document propriétaire du
sujet. Une roadmap périmée est pire qu'absente.
