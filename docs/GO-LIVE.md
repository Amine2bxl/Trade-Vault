# TradeVault — Checklist Go-Live

> **Verdict au 2026-08-06 : PAS PRÊT.** Trois bloquants, tous identifiés, aucun
> insurmontable.
>
> **Règle d'écriture** : chaque ligne a été vérifiée dans le code, dans la base
> réelle ou en CI. Ce qui n'a pas pu l'être est marqué **[NON VÉRIFIÉ]** — c'est
> l'information la plus importante de ce document, car une checklist qui présente
> des suppositions comme des faits est pire que pas de checklist.

---

## 1. Bloquants — le lancement est impossible tant qu'ils tiennent

### 1.1 Chaîne de migrations non vérifiable ⛔

La branche Supabase `main` est marquée `MIGRATIONS_FAILED`, donc le check
`Supabase Preview` est `skipped` à chaque PR : **aucune migration n'est vérifiée
avant d'atteindre la production.**

- La cause racine est corrigée : l'historique distant contenait 29 versions
  générées par le dashboard ne correspondant à aucun fichier du dépôt. Historique
  réaligné sur les 31 fichiers, migrations manquantes appliquées, données
  intactes (4 souvenirs, 92 trades vérifiés après coup).
- Le statut reste figé (`updated_at` inchangé depuis le 2026-07-28) : c'est un
  enregistrement, pas un diagnostic recalculé.
- **Action requise, côté humain** : désactiver puis réactiver l'intégration de
  branching depuis le dashboard Supabase. `reset_branch` porte ici sur la branche
  **par défaut**, c'est-à-dire la production — à ne pas lancer à l'aveugle.

### 1.2 Aucune validation visuelle ⛔ **[NON VÉRIFIÉ]**

Tout ce qui a été livré est validé par le typage, les tests et la CI. **Rien n'a
été observé dans un navigateur.** Un défaut de rendu, de responsive ou de
contraste passerait intact.

À parcourir sur la preview, mobile ET desktop : Dashboard · Journal · Checklist ·
Analytics · Jarvis · Inbox · Goals · Settings. Vérifier en particulier le bouton
retour Android, qui vient de changer de comportement.

### 1.3 Paiements jamais éprouvés de bout en bout ⛔ **[NON VÉRIFIÉ]**

Stripe et Coinbase Commerce sont câblés (`billing.server.ts`,
`crypto-pay.server.ts`, `processed_webhook_events` existe). **Aucun parcours
d'achat réel n'a été testé dans cette session.**

À éprouver : achat mensuel · achat annuel · webhook reçu et rejoué (idempotence)
· échec de paiement · résiliation · expiration → retour au plan gratuit.

---

## 2. À faire avant le lancement — non bloquant, mais coûteux si omis

| # | Point | État |
|---|---|---|
| 2.1 | **Purge de `ai_agent_runs`** — la table croît linéairement sans rétention | À faire |
| 2.2 | **Activation de l'extraction mémoire** — codée, testée, `AI_MEMORY_EXTRACTION` éteint. Activer d'abord en préproduction et mesurer le **taux de rejet** | À faire |
| 2.3 | **Synchronisation serveur des conversations** — l'historique est persistant mais LOCAL : changer d'appareil le perd | À faire |
| 2.4 | **Analytics par écran** — désormais possible (la page vit dans l'URL), mais aucun outil n'est branché | À faire |
| 2.5 | **Monitoring d'erreurs** — aucun Sentry ni équivalent. Un plantage en production serait invisible | À faire |
| 2.6 | **Politique de mots de passe / rate-limit auth** | **[NON VÉRIFIÉ]** |
| 2.7 | **RGPD** — export et suppression de compte | **[NON VÉRIFIÉ]** |
| 2.8 | **Emails transactionnels** — Resend câblé, délivrabilité non éprouvée | **[NON VÉRIFIÉ]** |

---

## 3. Acquis — vérifié, ne pas refaire

- **RLS owner-only** sur les 20 tables publiques. `ai_agent_runs` n'a **aucune**
  politique d'insertion : les écritures passent par le service role, un client ne
  peut pas fabriquer de fausses métriques.
- **Stockage** : les policies du bucket `trade-screenshots` scopent chaque objet
  au dossier de son propriétaire, et sont restreintes au rôle `authenticated`.
- **Aucun secret côté client** : les clés de providers vivent dans les fonctions
  serveur.
- **Chiffres non hallucinables** : le LLM écrit de la prose, les nombres viennent
  des moteurs déterministes et sont injectés côté client.
- **Repli déterministe** : sans provider configuré ou en cas de panne, le trader
  reçoit une réponse fondée sur ses données, jamais une erreur.
- **Une seule source de vérité par information** (voir `PRODUCT.md` §2). Deux
  violations corrigées le 2026-08-06 : « Respect du plan » désignait deux calculs
  différents ; la page courante vivait à la fois en état React et en
  `sessionStorage`.
- **CI verte** sur les cinq derniers commits.

---

## 4. Ce que ce document ne couvre pas

- **Charge** : aucun test de montée en charge. Le produit est conçu pour des
  dizaines de milliers d'utilisateurs ; rien ne le démontre.
- **Coût unitaire de l'IA** : `ai_agent_runs` vient d'être déployée, il n'existe
  pas encore d'historique pour estimer le coût par utilisateur actif. **C'est la
  donnée qui manque pour fixer un prix.**
- **Accessibilité** : aucun audit clavier ni lecteur d'écran.
- **Écart local / CI** : le sandbox de développement n'exécute que 290 des 303
  tests (paquets npm indisponibles, registre 403). Une régression a échappé à la
  vérification locale pour cette raison — **la CI est la seule vérification qui
  fasse foi.**
