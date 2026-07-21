# BACKLOG EXÉCUTABLE — TRADEVAULT 90 JOURS

> **Document de référence unique.** Roadmap validée : S1 Fondations → S2 Preuve →
> S3 Rituel du matin → S4 Rituel du dimanche → S5 Monétisation.
> Conventions : estimations en heures pour un dev assisté par IA · tâches
> atomiques (≤ 4h) · gates avant tout push : `npx tsc --noEmit` + `npx vite build`
> + `bun test` · migrations **additives**, RLS owner-only · i18n FR/EN
> obligatoire · l'IA ne calcule jamais (moteurs purs) · zone Trustpilot gelée.
> Toute idée nouvelle pendant les 90 jours → liste « jour 91 » (1ᵉʳ inscrit :
> broker sync).

## SPRINT 1 (S1–S2) — « Mesurer, connaître, récompenser »

Objectif : instrumentation complète · le coach connaît le trader · le streak démarre.

- **US-1.1** Funnel signup → activation → rétention J7/J30 visible (PostHog).
  Événements : `signup`, `onboarding_completed`, `first_trade_logged`,
  `coach_message_sent`, `checklist_completed`, `session_start`. Aucune donnée
  de trading (PnL, symboles) envoyée.
- **US-1.2** Le coach connaît profil, règles, objectifs ; répond en mentor
  (conversationnel par défaut, rapport structuré sur demande de bilan, max 2
  actions, question de relance, faiblesse n°1).
- **US-1.3** Discipline Score v1 (checklist 60 + journal 40, indépendant du
  PnL) + streak (jours ≥ 70 ; jour sans activité = neutre) sur le Dashboard.

Tâches : 1.1 PostHog init → 1.2 événements → 1.3 dashboards (console PostHog,
manuel) → 1.4 réparer seed profil→mémoire → 1.5 CoachInput+Zod → 1.6 payload
V2 (memory/rules/goals, best-effort) → 1.7 persona doctrine → 1.8 format
adaptatif (détection déterministe) → 1.9 tests → 1.10 validation manuelle
FR/EN → 1.11 module score pur → 1.12 table `discipline_days` (RLS) → 1.13
carte Dashboard → 1.14 événements analytics. ≈ 36h.

## SPRINT 2 (S3–S4) — « La preuve »

Objectif : moteur comportemental · coût des erreurs en euros · onboarding qui
se termine dans la valeur.

- **US-2.1** Coût mensuel par erreur récurrente (page Mistakes + coach), tendance M vs M-1.
- **US-2.2** Patterns comportementaux chiffrés (revenge, overtrading, pire
  créneau) cités par le coach — uniquement si significatifs ; jamais calculés par l'IA.
- **US-2.3** Onboarding : question situation (prop-firm/réel/apprentissage),
  écran « plan personnalisé », démo par défaut, import CSV secondaire avec
  fallback démo, premier message coach à l'atterrissage. Complétion > 80%.

Tâches : 2.1 module `modules/trading/behavior/` (types + seuils de
significativité) → 2.2 séquence post-perte → 2.3 overtrading → 2.4 perf
temporelle → 2.5 adhérence aux règles → 2.6 coût des erreurs/mois → 2.7 bloc
BEHAVIORAL PATTERNS dans le contexte coach → 2.8 UI Mistakes → 2.9 persona
(confronter avec le pattern le plus coûteux) → 2.10–2.15 onboarding V2 (purge
copy mort, situation, profil simplifié sans champ %, écran miroir, inversion
démo/import + fallback, premier message coach, événements). ≈ 38h.
Parallélisable : moteur (back pur) ‖ onboarding (front pur).

## SPRINT 3 (S5–S6) — « Le rituel du matin »

Objectif : Daily Brief + push pré-market + engagements en mémoire.

- **US-3.1** Brief quotidien avant la pré-session : streak, hier en 1 phrase,
  LA règle du jour (une seule), jauge objectif, CTA checklist. ≤ 180 mots.
  Fallback déterministe si l'IA échoue — le brief n'échoue jamais.
- **US-3.2** Push : titre = la règle elle-même, deep-link, opt-in motivé.
- **US-3.3** Engagements : proposés par le coach, acceptés en 1 tap, écrits en
  `ai_memory` (kind `commitment`, format structuré vérifiable), vérifiés par le
  moteur, violation citée dans le brief du lendemain.

Tâches : 3.1 migrations (`ai_reports`/`ai_jobs`, heure de pré-session) → 3.2
sélecteur de règle (cascade : engagement violé > pattern coûteux > faiblesse
profil > règle la moins respectée ; anti-usure 3 jours) → 3.3 contrat
d'engagement structuré → 3.4 vérificateur pur → 3.5 job de génération
(idempotent, 1/jour) → 3.6 bloc « Today » Dashboard → 3.7 push → 3.8 flux
engagement → 3.9 cas limites (pas de trade, < 10 trades, week-end) → 3.10
analytics. ≈ 30h.

## SPRINT 4 (S7–S8) — « Le rendez-vous du dimanche »

Objectif : Weekly Review + reddition de comptes + insights proactifs + score enrichi.

- **US-4.1** Review dominicale (17h locale, persistée, archivée) : score
  (lettre + tendance) → semaine en chiffres vs S-1 → verdict (erreur la plus
  chère en €) → reddition de comptes → ce qui a marché → nouvel engagement →
  question de coach (deep-link `tv:ask-coach`).
- **US-4.2** Insights proactifs v1 : 2–3 détecteurs (revenge, overtrading,
  série hors plan), max 1 notification/jour, chiffres cités.
- **US-4.3** Score v2 : 4 composantes (30 checklist / 30 règles / 25
  engagement / 15 journal), streak conservé, changelog visible.

Tâches : 4.1 agrégats hebdo + Weekly Score → 4.2 job dominical → 4.3 page
Review + teaser Dashboard → 4.4 flux engagement + reddition → 4.5 push +
e-mail → 4.6 insights proactifs → 4.7 score v2 → 4.8 fusion rapports mensuels
→ 4.9 nav opportuniste (Today, Review, Coach = Insights+Assistant, Outils en
sous-menu — routes conservées) → 4.10 analytics. ≈ 30h.

## SPRINT 5 (S9–S10) — « La caisse »

Objectif : ICP prop-firm · paywall sur cohorte · boucle d'acquisition.

- **US-5.1** Landing antidouleur prop-firm + bandeau beta honnête (Trustpilot intouché).
- **US-5.2** Free à quota IA sur cohorte de nouveaux inscrits (jamais un Free
  sans IA), fail-closed cohorte uniquement, upgrade ancré ROI (« ton coût
  d'erreurs : X € vs 24,99 € »), essai 14 jours bout en bout.
- **US-5.3** Carte de perf partageable depuis la review (score, lettre,
  winrate, streak — jamais le PnL absolu par défaut).

Tâches : 5.1 landing → 5.2 flag de cohorte → 5.3 quota Free
(`consume_ai_quota` en levier produit) → 5.4 écran upgrade ROI → 5.5 test
paiement bout en bout → 5.6 carte partageable → 5.7 emails d'essai J3/J12 →
5.8 funnel conversion → 5.9 revue sécurité fail-closed → 5.10 go/no-go
d'extension (décision fondateur). ≈ 26h.

## Règles transverses

1. Aucun moteur existant modifié pour en brancher un autre — extension par plug-in.
2. Tout chiffre vient d'un module pur testé ; l'IA rédige, ne calcule jamais.
3. Chaque feature IA a un fallback déterministe — le rendez-vous n'échoue jamais.
4. Nouvelle table = migration additive + RLS owner-only + Zod plafonné serveur.
5. Nouvelle UI = primitives `shared/ui`, i18n FR/EN, états loading/vide/erreur.
