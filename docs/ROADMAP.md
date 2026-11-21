# Roadmap

État vérifié contre le code le **2026-09-30**. Consolide les anciennes
roadmaps, master plans, checklists go-live et audits de juillet 2026 : les
points déjà résolus (FK, migration `monthly_reports`, bucket Storage, CI,
rate-limit, validation des server functions, bus d'événements attendu,
pagination des trades, noyau `domain/`, URL par écran, landing
internationalisée, navigation en six sections…) ne sont plus listés. Les
documents d'origine restent consultables dans l'historique git
([`CHANGELOG.md`](CHANGELOG.md)).

## Avant le lancement

Ce qui ne se prouve pas dans le code — validation humaine requise.

| # | Point | Détail |
| --- | --- | --- |
| L2 | **Parcours d'achat réel** (live, petit montant puis remboursement) | Mensuel 9 €, licence 49 €, 3DS, échec de paiement (`past_due`), rejeu de webhook (`deduped`), résiliation via portail, retour à Free, mensuel → licence (renouvellement coupé), 409 sur double achat, signature invalide → 400. Les gestionnaires sont couverts sans réseau par `tests/billingFlow.test.ts` |
| L3 | **Tâches du propriétaire (dashboard)** | Fait le 2026-11-15 : produit « TradeVault » + prix 9 €/mois et 49 € (lookup keys), événements du webhook complétés, résiliation du portail active. Reste : CGU et confidentialité déclarées dans Stripe ; Stripe Tax + OSS (TVA UE, puis `automatic_tax`) ; `RESEND_API_KEY` ; supprimer la clé limitée « Nq » |
| L4 | **Validation visuelle** mobile et desktop des écrans principaux | Dashboard, Journal, Checklist, Analytics, Jarvis, Inbox, Goals, Réglages |
| L5 | **Justesse des chiffres** des pages d'analyse | Analytics, Saisonnalité, Rapports, Calendrier : auditer la classe de défaut « chiffre juste, interprétation fausse » |
| L6 | Auth | Politique de mots de passe, protection des mots de passe divulgués (dashboard Supabase), vérification d'e-mail |
| L7 | RGPD | Suppression de compte en place (`delete-account`) ; export des données à vérifier ; délivrabilité des e-mails Resend |
| L8 | Mesure | Aucun outil d'analytics produit branché ; coût IA par utilisateur à estimer depuis `ai_agent_runs` ; aucun test de charge ni audit d'accessibilité |
| L9 | **Synchro broker** | Poser `BROKER_CREDENTIALS_KEY` (≥ 32 caractères aléatoires) dans Vercel ; demander l'accès partenaire OAuth à Tradovate/NinjaTrader en permissions « Read Only » puis `TRADOVATE_CLIENT_ID` / `TRADOVATE_CLIENT_SECRET` (URL de retour `/brokers`) — sans eux, aucune connexion n'est possible ; tester avec un compte Tradovate démo : redirection, retour animé, import d'un aller-retour, formulaire ouvert, pas de doublon au second passage, reconnexion après expiration ; appliquer la migration `20261008120000_broker_sync.sql` |

## Produit — ouvert

| Sujet | État constaté |
| --- | --- |
| Mémoire de Jarvis | Lecture branchée (`memory-select`) ; **extraction coupée** (`AI_MEMORY_EXTRACTION`) — l'activer en préproduction et mesurer le taux de rejet |
| Conversations | Persistées en `localStorage`, **par appareil** — pas de synchronisation serveur |
| Réponses en streaming | Absent (le transport RPC ne fait pas de SSE) |
| Notifications jamais émises | `goal_completed`, `goal_milestone`, `trade_analyzed`, `daily_brief` : déclarées, sans émetteur (Daily Brief automatique non livré) |
| Simulateur de probabilités | `features/simulator/Simulator.tsx` non monté |
| Moteur d'insights | `features/jarvis/insights/` testé mais non branché (les suggestions ont été retirées le 2026-11-15) |
| Neural Brain | Lot 1 livré (graphe dérivé, 3D, découvertes testées, outil Jarvis) ; phases restantes (multimodal, recherche externe, multi-agents, Trader DNA, automatisation) : [`NEURAL_BRAIN.md`](NEURAL_BRAIN.md) §6 |
| Fondations IA | Routeur d'intentions (`modules/ai/router`), RAG (`ai_embeddings`), `ai_jobs`, catalogue `backend/ai.functions.ts` : sans consommateur — brancher ou retirer |
| Scale | Statistiques calculées côté client ; agrégats SQL/RPC + pagination à prévoir avant que le volume ne pèse |
| Traductions | `fr` et `en` complets (~1 750 clés) ; les dix autres langues ~300 clés (repli anglais) |

**Pistes produit (non engagées)**, dans l'ordre recommandé : moteur d'edge
personnel avec paliers de confiance → garde-fou comportemental et mode
récupération → Monte Carlo × discipline → playbook personnel et frise de
mémoire → comportemental avancé (« what
changed », contrefactuel). Rétention : bloc « Aujourd'hui », série de
discipline, rappels pré-market, « Share my week ».

## Croissance — intégrations et idées (2026-11-15)

Existant : calendrier économique façon Forex Factory, synchro Tradovate en
lecture seule (en attente de l'accès partenaire, L9), saisonnalité de marché
(Yahoo → Stooq → FRED), push web. `DATABENTO_API_KEY` est posée dans Vercel
mais lue par aucun code.

Par ordre impact / effort :

| # | Idée | Pourquoi | Effort |
| --- | --- | --- | --- |
| G1 | **Préréglages CSV par plateforme** : NinjaTrader, Rithmic R\|Trader, ProjectX / TopstepX, MT4/MT5, cTrader, IBKR Flex | La première porte d'entrée de la cible, sans partenariat | Faible |
| G2 | **Règles de prop firms préchargées** (Apex, Topstep, FTMO, The5ers…) : drawdown suiveur, perte du jour, objectif | Branche Monte-Carlo, checklist et alertes sur la VRAIE règle du compte ; parle directement au cœur de cible | Moyen |
| G3 | **Exporteur MetaTrader 4/5** : un EA qui pousse les trades clôturés vers un point d'entrée à jeton personnel, lecture seule | Ouvre les prop firms forex (FTMO, The5ers) sans API courtier | Moyen |
| G4 | **ProjectX (TopstepX)** : synchro par l'API de la plateforme | Topstep est dans le cœur de cible ; même modèle que Tradovate | Moyen |
| G5 | **TradingView** : webhook d'alerte → setup manqué noté ; lien de capture du graphique attaché au trade | Le trader vit dans TradingView ; le setup manqué devient automatique | Moyen |
| G6 | **« Partage ma semaine »** : une carte image (discipline, pas P&L) à poster | Acquisition virale honnête, sans chiffre de gain mis en avant | Faible |
| G7 | **Discord** : webhook de la revue hebdomadaire, puis bot de communauté (classement de DISCIPLINE, opt-in) | La cible vit en Discord ; canal de parrainage | Moyen |
| G8 | **Alertes Telegram** : rappel pré-market, « stop » après N pertes | Prolonge le push existant là où le trader regarde | Faible |
| G9 | **Flux ICS** : annonces économiques et plan de séance dans l'agenda | Rétention quotidienne, coût quasi nul | Faible |
| G10 | **Contexte de marché par trade** : régime de volatilité (VIX, ATR) et rapport COT de la CFTC | « Tu perds les jours de forte volatilité » — un diagnostic de plus, mêmes sources gratuites | Moyen |
| G11 | **Offre communautés et formateurs** : licences en lot pour un Discord ou une école de trading, vue mentor en lecture seule | Nouveau revenu B2B, acquisition par groupes entiers | Élevé |
| G12 | **Affiliation** (Rewardful ou Tolt sur Stripe) + invitations Trustpilot à 30 jours d'usage | Industrialise les codes partenaires et la preuve sociale réelle | Faible |

## Acquisition et SEO

1. **Accroche `<h1>`** : ne contient aucun mot-clé (« You know how to trade. /
   You break your own rules… ») — décision de copy à prendre.
2. Search Console : soumettre `/fr`, vérifier la grappe `hreflang`, valider les
   données structurées, purger les caches d'aperçu social.
3. Pages de contenu, par vagues : `/trading-journal`, `/fr/journal-de-trading`,
   `/ai-trading-coach` ; puis `/trading-journal-template`, `/r-multiple`,
   `/fr/discipline-trading` ; puis segments (`/prop-firm-journal`…).
4. Autorité externe (aucun signal aujourd'hui) et avis réels.
5. Aimant à leads (plan anti-échec de challenge, simulateur de règles derrière
   un e-mail).

## Dette technique

| Sujet | Mesure |
| --- | --- |
| Gros fichiers (à découper dans une mission dédiée) | `TradeModal.tsx` 1 537 · `Analytics.tsx` 1 320 · `Landing.tsx` 1 237 |
| Couche | `modules/patterns` → `app/trading/mistakeClusters` (libellés via les traductions de l'app) |
| Design | 422 tailles `text-[Npx]` arbitraires, 61 couleurs hex dans le JSX, 33 keyframes pour 8 autorisées |
| Types | 31 `as any` / `@ts-ignore` ; `no-unused-vars` et `no-explicit-any` en `warn` |
| Build | Preset `@lovable.dev/vite-tanstack-config` opaque ; verrou lié à un registre npm privé |
| Accessibilité | ~~Zoom verrouillé~~ — rendu au trader au lot 5 (viewport sans `user-scalable=no`, `lock-zoom.ts` retiré) ; le zoom automatique d'iOS sur un champ reste évité par les champs à 16 px sur téléphone |
