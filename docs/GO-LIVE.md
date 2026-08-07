# TradeVault — Checklist Go-Live

> **Verdict au 2026-08-07 : PAS PRÊT.** Deux bloquants restants — la chaîne de
> migrations est débloquée. Aucun n'est insurmontable, et **aucun des deux ne
> dépend du code** : ce sont une validation humaine et un parcours d'achat réel.
>
> **Règle d'écriture** : chaque ligne a été vérifiée dans le code, dans la base
> réelle ou en CI. Ce qui n'a pas pu l'être est marqué **[NON VÉRIFIÉ]** — c'est
> l'information la plus importante de ce document, car une checklist qui présente
> des suppositions comme des faits est pire que pas de checklist.

---

## 1. Bloquants — le lancement est impossible tant qu'ils tiennent

### ~~1.1 Chaîne de migrations non vérifiable~~ ✅ **RÉSOLU le 2026-08-07**

Le propriétaire a réactivé l'intégration de branching : la branche Supabase est
passée en `FUNCTIONS_DEPLOYED`. Le check `Supabase Preview` n'est plus `skipped`.
Historique conservé ci-dessous parce que la cause racine mérite d'être retenue.

<details><summary>Diagnostic d'origine</summary>


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

</details>

### 1.2 Aucune validation visuelle ⛔ **[NON VÉRIFIÉ]**

Tout ce qui a été livré est validé par le typage, les tests et la CI. **Rien n'a
été observé dans un navigateur.** Un défaut de rendu, de responsive ou de
contraste passerait intact.

À parcourir sur la preview, mobile ET desktop : Dashboard · Journal · Checklist ·
Analytics · Jarvis · Inbox · Goals · Settings.

**Points chauds du 2026-08-07**, tous livrés sans aucune observation navigateur :

| Livré | À vérifier en priorité |
|---|---|
| URLs propres (#152) | bouton retour Android · un ancien lien `?p=` · rechargement direct sur `/settings` |
| Édition des sous-comptes (#153) | ouvrir un compte au capital non nul : le champ doit afficher ce capital, **pas 0** |
| Studio de thèmes (#154) | changer fond et texte : lisibilité conservée sur toutes les pages |
| Rapports historiques (#155) | « Tout générer » sur plusieurs mois |
| Import CSV (#156) | un vrai export broker · un **réimport du même fichier** (doit annoncer 100 % de doublons et n'écrire aucune ligne) |
| Navigation instantanée (#157) | Journal → Dashboard → Journal : filtres et défilement **conservés** · onglet Réseau : le chunk doit partir **au survol**, avant le clic |

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
| ~~2.1~~ | ~~**Purge de `ai_agent_runs`**~~ — **FAIT** : rétention 90 jours, greffée sur le tick quotidien existant (`/api/cron/lifecycle-emails`), best-effort. Ni `pg_cron` (extension non installée, l'activer serait une opération sur la production) ni cron dédié. **Non observée en conditions réelles** : le premier passage aura lieu au prochain déclenchement quotidien | ✅ |
| 2.2 | **Activation de l'extraction mémoire** — codée, testée, `AI_MEMORY_EXTRACTION` éteint. Activer d'abord en préproduction et mesurer le **taux de rejet** | À faire |
| 2.3 | **Synchronisation serveur des conversations** — l'historique est persistant mais LOCAL : changer d'appareil le perd | À faire |
| 2.4 | **Analytics par écran** — désormais possible (chaque écran a son propre chemin depuis #152), mais aucun outil n'est branché | À faire |
| 2.5 | **Monitoring d'erreurs** — la COUTURE est en place : `reportAppError` est l'entonnoir unique (error boundaries React, échec de préchargement de chunk, et depuis le 2026-08-06 les erreurs non capturées du navigateur + promesses rejetées). La destination reste la console : **un plantage en production est toujours invisible**. Brancher un fournisseur = une clé + cette seule fonction | **Clé requise** |
| 2.6 | **Politique de mots de passe / rate-limit auth** | **[NON VÉRIFIÉ]** |
| 2.7 | **RGPD** — export et suppression de compte | **[NON VÉRIFIÉ]** |
| 2.8 | **Emails transactionnels** — Resend câblé, délivrabilité non éprouvée | **[NON VÉRIFIÉ]** |
| 2.9 | **Quatre pages d'analyse jamais auditées** — Analytics, Seasonality, Reports (revue le 2026-08-07 côté génération et rendu, **pas** côté justesse des chiffres), Calendar : ~3 000 lignes et la majorité des chiffres affichés. Huit défauts « chiffre juste, interprétation fausse » ont été trouvés sur les pages auditées ; rien n'indique que celles-ci en soient exemptes | À faire |
| 2.10 | **12 langues proposées, 2 réellement traduites** — `fr` et `en` comptent 1 127 clés ; les **dix autres en comptent 293**, soit **26 %**. Le reste retombe sur l'anglais : un utilisateur qui choisit « Deutsch » obtient une interface à ~74 % en anglais. Vérifié par comptage, et par sondage : la navigation et les titres de page sont traduits, mais ni les statistiques (`quant.*`), ni la checklist, ni Jarvis, ni Goals. **Décision produit requise** : réduire le sélecteur aux langues complètes, ou compléter les traductions | **À arbitrer** |

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
- **CI verte** sur les trente derniers commits (un seul échec dans la journée,
  corrigé).
- **Deux « fonctionnalités » qui n'en étaient pas, trouvées le 2026-08-07** et
  corrigées : le préchargement des pages appelait `import(mod)` sur une variable
  de chaîne — Vite ne peut pas résoudre un tel spécificateur, l'import échouait
  et le `.catch()` avalait l'échec, donc il n'a **jamais** rien préchargé ; et le
  formulaire d'édition de compte pré-remplissait le capital par une condition
  inversée, si bien que **chaque édition écrasait le capital**, dénominateur de
  la variation de période, de l'Edge Score et des objectifs. Leçon : du code qui
  a l'air de faire quelque chose n'est pas du code qui le fait.
- **L'import CSV ne ment plus** : contrôle du fichier avant lecture, écriture par
  lots séquentiels (elle ouvrait une requête par trade, toutes en parallèle),
  confirmation chiffrée avant écriture et comptage honnête des échecs.
- **RTL** : `document.documentElement.dir` bascule en `rtl` pour l'arabe, et les
  pages publiques le gèrent aussi. L'arabe est incomplet (cf. 2.10) mais **pas
  cassé**.
- **Les textes analytiques n'existent qu'en `fr` et `en`.** Conséquence utile :
  les treize défauts « chiffre juste, interprétation fausse » corrigés le
  2026-08-06 ne peuvent pas subsister dans les autres locales — elles ne
  contiennent aucun texte de ce type.

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
