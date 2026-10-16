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
| L1 | **Crons Vercel** | `src/server.ts` n'accepte les crons qu'en `POST` alors que Vercel Cron appelle en `GET` : vérifier dans les logs que rapports, e-mails, calendrier et détection de motifs tournent |
| L2 | **Parcours d'achat réel** (mode test Stripe) | Mensuel, annuel, 3DS, échec de paiement (`past_due`), rejeu de webhook (`deduped`), résiliation via portail, retour à Free, changement mensuel → annuel, pas de client Stripe en double, signature invalide et horodatage périmé → 400 |
| L3 | **Tâches du propriétaire (dashboard)** | Endpoint webhook Stripe (test puis live) + `STRIPE_WEBHOOK_SECRET` ; produits Pro et Elite (mensuel/annuel) et leurs `STRIPE_PRICE_*` ; CGU et confidentialité déclarées dans Stripe ; Stripe Tax + OSS (TVA UE, puis `automatic_tax` au checkout) ; `ADMIN_EMAILS` ; branding du checkout |
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
| Séance de trading | `features/session/SessionPanel` complet mais monté nulle part (`tests/reachability.test.ts`) ; `trading_sessions` donc peu alimentée |
| Simulateur de probabilités | `features/simulator/Simulator.tsx` non monté |
| Moteur d'insights | `features/jarvis/insights/` testé mais non branché (hors `suggestions.ts`) |
| Fondations IA | Routeur d'intentions (`modules/ai/router`), RAG (`ai_embeddings`), `ai_jobs`, catalogue `backend/ai.functions.ts` : sans consommateur — brancher ou retirer |
| Scale | Statistiques calculées côté client ; agrégats SQL/RPC + pagination à prévoir avant que le volume ne pèse |
| Traductions | `fr` et `en` complets (~1 750 clés) ; les dix autres langues ~300 clés (repli anglais) |

**Pistes produit (non engagées)**, dans l'ordre recommandé : moteur d'edge
personnel avec paliers de confiance → garde-fou comportemental et mode
récupération → Monte Carlo × discipline → playbook personnel et frise de
mémoire → comportemental avancé (« what
changed », contrefactuel). Rétention : bloc « Aujourd'hui », série de
discipline, rappels pré-market, « Share my week ».

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
| Gros fichiers (à découper dans une mission dédiée) | `Checklist.tsx` 2 244 l · `MonteCarlo.tsx` 2 113 · `TradeModal.tsx` 1 537 · `Analytics.tsx` 1 320 · `Landing.tsx` 1 237 |
| Couche | `modules/patterns` → `app/trading/mistakeClusters` (libellés via les traductions de l'app) |
| Design | 422 tailles `text-[Npx]` arbitraires, 61 couleurs hex dans le JSX, 33 keyframes pour 8 autorisées |
| Types | 31 `as any` / `@ts-ignore` ; `no-unused-vars` et `no-explicit-any` en `warn` |
| Build | Preset `@lovable.dev/vite-tanstack-config` opaque ; verrou lié à un registre npm privé |
| Accessibilité | Zoom verrouillé (`shared/lock-zoom.ts`) : choix produit assumé, contraire à WCAG 1.4.4 |
