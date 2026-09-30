# Documentation TradeVault

TradeVault est un journal de trading et un espace de performance : le trader
enregistre (ou importe) ses trades, des moteurs déterministes calculent ses
statistiques et ses schémas de comportement, et **Jarvis**, l'IA unique du
produit, les interprète en diagnostic et en plan d'action. Philosophie : **la
discipline avant le profit** — le produit ne promet jamais de gagner plus.

Stack : React 19 · TanStack Start/Router (SSR, Nitro → Vercel) · Tailwind v4 ·
Supabase (Postgres + RLS + Auth + Storage + Realtime) · Recharts · Bun.

## Où trouver quoi

Un document par sujet ; une information vit à un seul endroit.

| Document | Sujet |
| --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Dossiers, couches, règles de dépendance, frontend, flux de données, règles de placement des fichiers |
| [`FEATURES.md`](FEATURES.md) | **Index des features** : dossier, point d'entrée, dépendances, où modifier — et les métriques |
| [`AI.md`](AI.md) | Jarvis et la plateforme IA : providers, contexte, outils, mémoire, boucle de motifs |
| [`BACKEND.md`](BACKEND.md) | Frontière serveur : server functions, endpoints HTTP, crons, paiement, e-mails, push, OAuth |
| [`DATABASE.md`](DATABASE.md) | Supabase : tables, RLS, fonctions SQL, Storage, migrations |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Thèmes, tokens, surfaces, primitives `shared/ui`, UX, landing |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Installation, commandes, CI, tests, i18n, conventions, livraison |
| [`PRODUCT.md`](PRODUCT.md) | Positionnement, cible, offres, règles d'honnêteté, persona de Jarvis |
| [`SEO.md`](SEO.md) | Surface publique indexable, données structurées, interdits |
| [`ROADMAP.md`](ROADMAP.md) | Ce qui reste à faire, vérifié contre le code |
| [`CHANGELOG.md`](CHANGELOG.md) | Journal des changements structurels |

Les règles pour les agents IA sont dans [`../AGENTS.md`](../AGENTS.md). Les lois
de design détaillées (couleur, typographie, motion, composants, navigation,
copy de la landing) sont des skills dans [`../.claude/skills/`](../.claude/skills).

## Où modifier une grande feature

| Je veux modifier… | J'ouvre |
| --- | --- |
| une page de l'app connectée | `src/app/features/<feature>/` — voir [`FEATURES.md`](FEATURES.md) |
| la navigation, le cadre, la palette ⌘K | `src/app/shell/` (+ `PAGES`/`SECTIONS` dans `src/app/types.ts`) |
| un calcul de statistique | `src/domain/` (pur, partagé client/serveur) |
| un moteur (discipline, motifs, Monte Carlo, notifications…) | `src/modules/<moteur>/` |
| Jarvis (prompt, outils, mémoire) | `src/modules/ai/` + `src/backend/coach.functions.ts` + `src/app/features/jarvis/` |
| la landing, les pages légales, contact, tarifs publics | `src/app/public/` |
| une server function, un cron, le paiement | `src/backend/` + `src/server.ts` |
| le schéma de données | `supabase/migrations/` (additif uniquement) |
| un style, un token, un thème | `src/styles.css` + `src/app/utils/themes.ts` |

## Règles principales

1. **Zéro changement de comportement non voulu** : les portes CI
   (typecheck → lint → build → tests) passent avant tout push.
2. **Une source de vérité par information** — code comme documentation.
3. **Les chiffres viennent des moteurs déterministes ; l'IA ne fait que les
   formuler.** Aucune statistique sans son échantillon `n`.
4. **RLS owner-only**, secrets côté serveur, migrations additives.
5. **Honnêteté** : jamais de promesse de gain, de faux avis ni de chiffre inventé.
