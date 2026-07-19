# TradeVault — Source de vérité unique (audit + roadmap)

> **Document unique.** Fusion de tous les audits (technique, sécurité,
> performance, architecture IA, produit/UX). Doublons supprimés, contradictions
> tranchées, une seule liste d'actions P0→P3. C'est **la** référence : toute
> autre note d'audit est caduque.
> Compléments d'architecture (non-décisionnels) : [`ARCHITECTURE.md`](ARCHITECTURE.md),
> [`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md), [`ux-architecture.md`](ux-architecture.md).

---

## 1. Verdict

**Note produit : 7,2/10.** Excellente exécution, promesse en avance sur le
produit. La coque (landing, onboarding, journal, analytics, checklist) est de
niveau commercial. Le différenciateur vendu — le « Coach IA 24 h/24 qui détecte
tes patterns » — n'était qu'une boîte Q&A sans mémoire (corrigé en P0 #1). C'est
le sujet à combler avant de facturer 25 €/mois.

**Tension centrale.** La landing vend un **coach IA** (« un mentor qui connaît
chacun de tes trades », « détecte tes schémas et t'alerte avant que tu les
répètes »). Le journal + analytics + checklist sont solides mais **non
différenciants** : TraderSync, Tradezella, Edgewonk, un simple Notion couvrent
déjà ce terrain. La seule voie défendable est **l'IA coach + la discipline**.

**En une phrase.** Le socle est sain et la coque est la meilleure du marché ; il
manque l'âme. Un coach qui se souvient, un produit qui vient à toi, une valeur
chiffrée et prouvée — et « 25 €/mois » cesse d'être une question.

---

## 2. Grille de priorité

| Niveau | Sens                                               |
| ------ | -------------------------------------------------- |
| **P0** | Bloque la crédibilité ou le lancement. Maintenant. |
| **P1** | Fort ROI, juste après le P0. Ce trimestre.         |
| **P2** | Important, non urgent. Quand le cœur tient.        |
| **P3** | Fond, dette, « nice to have ». Opportuniste.       |

---

## 3. Contradictions entre audits — décisions retenues (tranchées)

- **Monétisation** : infra payante conservée, flag `AI_REQUIRE_PRO=false` (OFF).
  Au lancement, un Free qui _fait goûter_ l'IA (quota), jamais un Free sans IA.
  Pas de paywall tant que la valeur n'est pas prouvée.
- **Sécurité** : fail-open pendant la beta, fail-closed au passage payant.
- **Priorité build** : construire l'IA d'abord (fondation posée) ; refactoring
  restant = fond au fil de l'eau, jamais un préalable bloquant.
- **Analytics** : ne plus ajouter de métriques ; ajouter des verdicts en langage
  clair sur les métriques existantes.
- **Preuve sociale** : pas de faux avis. Trustpilot **conservé en l'état** (vrais
  avis en cours d'arrivée) — ne rien y toucher.

---

## 4. Déjà livré

**Socle technique (sessions de refactoring)**

- Charte d'équipe (`CLAUDE.md`).
- React Query (`useTrades` / `useTradeStats`), découplage UI ↔ modules.
- Sécurité : RLS owner-only, `consume_ai_quota` + rate-limit, idempotence
  webhooks Stripe/Coinbase.
- Performance : index composites (prod), `EquityChart` lazy (−381 KB bundle initial).
- Fondation AI OS (agents/router/tools/rag/jobs/mcp/telemetry) — contrats, zéro
  runtime (PR #13).
- Gating monétisation neutralisé : `AI_REQUIRE_PRO=false` (tout gratuit en beta).

**Restructuration du dépôt**

- Phase 1 — suppression du code mort du scaffold (PR #45).
- Phase 4 — frontière serveur explicite `lib → backend/shared` (PR #50).
- Phase 3 — types Supabase à jour + suppression de l'escape-hatch `db.ts` (PR #51).
- _(Reste : Phase 2 pruning deps — bloqué par l'egress registry privé, issue #46 ;
  Phase 5 UI par features/ — au fil des lots produit, issue #49.)_

**Produit**

- **P0 #1 — Coach IA conversationnel à mémoire** (PR #14) : `aiChat` + `ai_memory`
  branchés, fil multi-tours, seed profil depuis l'onboarding.

---

## 5. Actions — liste unique P0→P3

### P0 — Chantiers bloquants

| #   | Action                                                             | Domaine    | Statut                                                                          |
| --- | ------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------- |
| 1   | Coach IA conversationnel à mémoire (`ai_memory`, fil, engagements) | IA         | ✅ Fait (PR #14) — reste : fil DB cross-device + mémorisation active des leçons |
| 2   | Insights proactifs (détection pattern → notification)              | IA         | À faire                                                                         |
| 3   | Weekly Review + Daily Brief automatiques (in-app + e-mail)         | Rétention  | À faire                                                                         |
| 4   | Déclencheurs de retour « push » (pré-market, review, streak)       | Rétention  | À faire                                                                         |
| 5   | Import CSV blindé + fallback démo systématique                     | Activation | À faire                                                                         |

_(La « preuve sociale honnête » n'est plus une action : décision prise de garder
Trustpilot en l'état, vrais avis en cours.)_

### P1 — Fort ROI

| #   | Action                                               | Domaine    |
| --- | ---------------------------------------------------- | ---------- |
| 6   | « Coût de mes erreurs » chiffré et mensuel           | IA         |
| 7   | Verdicts IA en clair sur chaque métrique analytics   | IA         |
| 8   | Bloc « Aujourd'hui » en tête de dashboard            | Rétention  |
| 9   | Streak de discipline + checklist quotidienne poussée | Rétention  |
| 10  | Sync broker / import récurrent auto                  | Rétention  |
| 11  | Réduction navigation à 6–7 entrées                   | UX         |
| 12  | Écran « Ton plan personnalisé » en fin d'onboarding  | Activation |
| 13  | ICP resserré (message prop-firm / discipline)        | Conversion |
| 14  | Free qui fait goûter l'IA (quota)                    | Conversion |
| 15  | Agrégats analytics en SQL/RPC + pagination           | Perf       |

### P2 — Important, non urgent

| #   | Action                                                                  | Domaine     |
| --- | ----------------------------------------------------------------------- | ----------- |
| 16  | Objectif visible partout + micro-célébrations                           | Rétention   |
| 17  | Rapport mensuel e-mail + carte de perf partageable                      | Acquisition |
| 18  | Micro-feedback discipline à l'enregistrement d'un trade                 | UX          |
| 19  | Empty states guidés (dashboard, journal)                                | UX          |
| 20  | Coach IA omniprésent (assistant flottant contextuel)                    | IA          |
| 21  | Démo sans compte depuis la landing                                      | Conversion  |
| 22  | Bandeau statut beta honnête sur les tarifs                              | Conversion  |
| 23  | Refactoring restant (frontière features/, pruning deps) au fil de l'eau | Tech        |
| 24  | Perf secondaire — fonts, images, vendor chunks, prefetch                | Perf        |

### P3 — Fond & opportuniste

| #   | Action                                                                                   | Domaine |
| --- | ---------------------------------------------------------------------------------------- | ------- |
| 25  | Activer Leaked Password Protection (dashboard Supabase, manuel)                          | Sécu    |
| 26  | ESLint warn → error progressif                                                           | Tech    |
| 27  | Systèmes IA ultérieurs (Performance Analyst, Risk Manager, Psychologist, Pattern Finder) | IA      |
| 28  | RAG (embeddings) + appliquer migration `ai_os_foundation`                                | IA      |
| 29  | MCP (outils externes)                                                                    | IA      |

---

## 6. Lecture transverse

### Quick wins (fort impact / faible effort)

- Écran « plan personnalisé » (réutilise le profil déjà collecté).
- Bloc « Aujourd'hui » (assemble des données existantes).
- Verdicts en clair sur analytics (les moteurs fournissent déjà les chiffres).
- Fallback démo à l'échec d'import (option démo déjà présente).
- Empty states guidés (pur front).
- Streak de discipline.

### Chantiers critiques (lourds, incontournables)

- Coach IA à mémoire + conversationnel (P0 #1) — **fait**.
- Moteur d'insights proactifs (P0 #2).
- Weekly Review / Daily Brief automatiques (P0 #3).
- Sync broker (P1 #10).
- Migration analytics vers SQL/RPC (P1 #15).
- Bascule vers le payant (P1 #14).

### À supprimer / rétrograder

- Chiffres maquettés présentés comme réels dans le hero.
- « Appearance » comme entrée de nav distincte → absorber dans Réglages.
- Seasonality & Calculateur en nav de 1ᵉʳ niveau → rétrograder en « Outils ».
- News / Calendrier éco en top-level → sous-menu.
- Métriques analytics purement décoratives (sans verdict).
- _(Le badge Trustpilot 5★ n'est plus à retirer : conservé, vrais avis en cours.)_

### À fusionner

- Appearance + Settings + Profile → **Réglages**.
- Insights + AiAssistant → une surface **Coach IA**.
- Mistakes + Missed Opportunities → **Discipline & erreurs**.
- Daily Brief + Weekly Review + Notifications IA → système **coach push** unifié.
- Goals → intégré au Dashboard / Trading Plan.
- Reports → alimenté par la Weekly Review (une seule chaîne de génération).

**Principe** : passer de ~20 destinations à 6–7
(Dashboard · Journal · **Coach IA** · Analytics · Discipline · Plan · Réglages).

---

## 7. Séquencement recommandé (lots)

1. **Lot 1 — Le cœur** : Coach IA vivant (mémoire ✅ + fil ✅) + dégraisser la nav.
2. **Lot 2 — Le rendez-vous** : proactivité + rétention (patterns → notifs, Daily
   Brief, Weekly Review, streak, bloc « Aujourd'hui »).
3. **Lot 3 — La preuve** : valeur tangible + confiance (coût des erreurs, verdicts
   analytics, plan personnalisé).
4. **Lot 4 — Le go-to-market** : bascule commerciale (Free hameçon, fail-closed,
   ICP, sync broker, démo sans compte).
5. **Lot 5 — Le fond** : scale & systèmes IA suivants (analytics SQL, refactoring
   restant, RAG, agents).

---

## 8. Audit produit détaillé — problèmes par domaine

> Format : _Problème — impact → Solution._ **Priorité**.

**Proposition de valeur**

- Promesse « coach IA » vs réalité « boîte Q&A » — sur-vente → déception à
  l'activation → faire vivre l'IA (mémoire + proactivité). **P0** — _en cours (P0 #1 fait)_.
- « Pour qui » pas assez tranché — positionnement vitamine, pas antidouleur →
  ICP prop-firm/discipline. **P1**.

**Landing**

- Pas de démo sans compte. **P2**.
- Incohérence prix affiché ⇄ produit gratuit → assumer le statut beta. **P2**.
- _(Preuve sociale : Trustpilot conservé, vrais avis en cours — pas d'action.)_

**Onboarding**

- Le profil collecté ne produit pas de payoff visible → écran « plan
  personnalisé ». **P1**.
- Premier « wow » dépend d'un import CSV fragile → fallback démo systématique. **P0**.

**Navigation**

- Surcharge (20 destinations) → réduire à 6–7. **P1**.
- Coach IA (« Insights ») enterré → promouvoir & rendre omniprésent. **P2**.

**Dashboard**

- Rétroviseur, pas copilote → bloc « Aujourd'hui ». **P1**.
- État vide non exploité → empty state guidé. **P2**.

**Journal**

- Saisie manuelle = friction d'abandon → sync broker, saisie rapide. **P1**.
- Le journal ne « répond » pas à la saisie → micro-feedback discipline. **P2**.

**Analytics**

- Métriques sans verdict → phrase-verdict IA par métrique. **P1**.
- Calcul client à grande échelle → agrégats SQL. **P1** (perf).

**Mistakes**

- Feature à fort potentiel, sous-narrée → « coût des erreurs » chiffré. **P1**.

**Checklist**

- Pas encore un rituel quotidien imposé → notif pré-market + streak. **P0/P1**.

**Coach IA (chantier décisif)**

- Zéro mémoire, zéro conversation → **fait (P0 #1)**.
- 100 % réactif, 0 % proactif → insights proactifs + jobs. **P0**.
- Pas de rapport IA généré tout seul → Weekly Review automatique. **P0**.

**Objectifs**

- Déconnectés du quotidien → progression visible partout + célébrations. **P2**.

**Rapports**

- Non exploités comme canal rétention/acquisition → e-mail + carte partageable. **P2**.

**Rétention (point faible structurel)**

- Aucun mécanisme de rappel / rendez-vous (produit 100 % « pull ») → brief,
  review, streak. **P0**.

**Différenciation**

- Sans l'IA vivante, TradeVault est un « me-too » → tout miser sur le coach
  proactif à mémoire. **P1**.

---

## 9. Paierais-tu 25 €/mois ?

**Aujourd'hui : non. Dans 3 lots produit : oui, sans hésiter.**

Freins actuels : preuve encore en construction, différenciation non tenue, pas de
raison de revenir, coût de switch faible, ROI non démontré.

Manque pour l'évidence : coach à mémoire (fait), alertes proactives, Weekly
Review, coût chiffré des erreurs, preuve sociale réelle (avis en cours).

**Seuil de l'évidence** : quand le trader peut dire « chaque dimanche je reçois un
bilan qui me dit quelle erreur me coûte le plus, et chaque matin mon coach me
rappelle ma règle du jour — depuis, je respecte mon plan », alors 25 €/mois est
dérisoire face à un seul trade indiscipliné évité.

**Concurrents** : Tradezella (~24–33 $/mois), TraderSync, Edgewonk (~169 $
one-shot), Tradervue, Notion/Excel gratuit. Marché encombré côté « journal +
analytics ». Différenciation = IA coach proactif + discipline + suivi
erreurs/setups manqués + personnalisation.
