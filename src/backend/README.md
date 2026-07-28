# `backend/` — Frontière serveur

Tout ce qui s'exécute **côté serveur uniquement** (server functions TanStack,
crons, webhooks, e-mails, paiement). Aucun secret ne franchit cette frontière
vers le client.

> Documentation complète (endpoints, crons, sécurité, variables d'environnement) :
> [`BACKEND.md`](../../BACKEND.md).

## Convention de nommage

| Suffixe | Rôle | Appelable depuis le client ? |
|---|---|---|
| `*.functions.ts` | **Server functions** exposées à l'UI via `createServerFn` (ex. `coach.functions.ts`, `push.functions.ts`, `reports.functions.ts`, `tts.functions.ts`). | Oui — via l'import de la fonction, exécution serveur |
| `*.server.ts` | **Helpers serveur** internes (billing, e-mails, crons, web-push) — jamais importés directement par l'UI. | Non |
| `require-pro.ts` | Middleware de gating (flag `AI_REQUIRE_PRO`). | Non |

## Règles

- L'UI (`src/app/`) importe **uniquement** les `*.functions.ts`.
- Les secrets (clés API, tokens) restent ici, lus via `process.env` côté serveur.
- Les crons/webhooks sont branchés dans `src/server.ts` via imports dynamiques.

> ⚠️ **Dette connue** : `ai.functions.ts` (catalogue historique `aiChat`,
> `aiGenerateDailyBrief`, …) compile et est gaté, mais **aucune surface UI ne
> l'appelle** — le seul endpoint IA en production est `askCoach`
> (`coach.functions.ts`). Voir [`ROADMAP.md` §6.1](../../ROADMAP.md).
