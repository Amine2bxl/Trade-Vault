# TradeVault — Référence produit

> **Document officiel de référence produit.** Il fixe la vision, la cible, la
> proposition de valeur, la différenciation, le positionnement concurrentiel, le
> pricing et les leviers de revenu. Il prime sur toute note produit antérieure.
>
> **Périmètre.** Ce document répond à « **pourquoi / pour qui / quoi / combien** ».
> Le **« comment / quand »** (exécution priorisée P0→P3, séquencement en lots)
> reste dans [`ROADMAP.md`](ROADMAP.md) — source de vérité unique de l'exécution.
> L'architecture technique est dans [`ARCHITECTURE.md`](ARCHITECTURE.md) et
> [`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md).

---

## 1. Vision

> **Construire le meilleur AI Trading Operating System du marché** — le premier
> outil qui ne se contente pas d'**enregistrer** les trades, mais qui **comprend**
> le trader et l'aide à devenir discipliné.

TradeVault n'est pas un journal de plus. Un journal **archive le passé** ; un
« operating system » **agit sur le présent** : il analyse chaque trade, détecte
les schémas répétés qui coûtent de l'argent, et rappelle au trader sa règle du
jour **avant** qu'il ne la brise.

**North Star.** Un trader peut dire : _« Chaque dimanche je reçois un bilan qui
me dit quelle erreur me coûte le plus, et chaque matin mon coach me rappelle ma
règle du jour — depuis, je respecte mon plan. »_ Le jour où c'est vrai pour la
majorité des utilisateurs actifs, le produit a gagné.

**Promesse en une phrase (landing actuelle).**
> _« Ton coach IA de trading personnel — pas un simple journal, un coach IA
> disponible 24h/24 qui analyse tes trades. »_

**Ambition d'échelle.** Architecture pensée pour des dizaines de milliers
d'utilisateurs, IA provider-agnostique (changer de modèle = une variable d'env),
sécurité RLS owner-only. Cf. `CLAUDE.md`.

---

## 2. ICP (Ideal Customer Profile)

Le marché « journal + analytics » est encombré. La cible défendable de TradeVault
n'est pas « tout trader » mais **le trader qui a un problème de discipline, pas
de données**.

### Cœur de cible (à qui on parle en priorité)

| Segment | Pourquoi lui | Douleur dominante |
|---|---|---|
| **Trader prop-firm / en challenge** (FTMO, MFF, etc.) | Une seule erreur de discipline = challenge perdu = argent réel perdu | Respecter des règles strictes sous pression |
| **Trader retail sérieux, actif** (forex / futures / indices) | Trade souvent, veut progresser, a déjà un journal qu'il ne tient pas | Overtrading, revenge-trading, sizing qui dérape |
| **Trader en transition vers le temps plein** | Doit prouver une régularité, pas un coup de chance | Constance, suivi objectif de la progression |

### Caractéristiques communes

- Trade **régulièrement** (plusieurs trades / semaine) — assez pour générer des patterns.
- Connaît déjà ses métriques mais **n'agit pas** dessus (le chiffre ne change pas le comportement).
- A déjà essayé Excel / Notion / un journal payant et **a abandonné** (friction, ennui).
- Cherche un **antidouleur** (« arrête de me faire perdre par indiscipline »), pas une vitamine (« encore un dashboard »).

### Hors cible (assumé)

- Investisseur long terme / buy-and-hold (pas de discipline intraday à corriger).
- Trader occasionnel (trop peu de données pour que l'IA soit utile).
- Quant qui veut une API brute (on vend du coaching, pas de la donnée nue).

> **Note stratégique** (ROADMAP P1 #13) : le message actuel est encore un peu
> « pour tous ». Resserrer sur **prop-firm / discipline** est un chantier de
> conversion identifié.

---

## 3. Problèmes utilisateurs

Ce que le trader vit vraiment — et que TradeVault attaque :

1. **« Je connais mes stats mais je répète les mêmes erreurs. »**
   Le chiffre (winrate, profit factor) ne se transforme pas en changement de
   comportement. Il manque le **verdict** et le **rappel au bon moment**.
2. **« Je fais du revenge-trading / overtrading après une perte. »**
   Personne ne le lui dit sur le moment, et le coût cumulé reste invisible.
3. **« Je ne tiens pas mon journal. »**
   Saisie manuelle = friction = abandon au bout de deux semaines.
4. **« Mon plan de trading, je l'oublie dès que le marché bouge. »**
   Aucune discipline imposée avant le trade ; le plan reste un PDF mort.
5. **« Je ne sais pas si je progresse vraiment. »**
   Pas de rendez-vous régulier qui synthétise et objective la progression.
6. **« Les outils existants sont des tableurs déguisés. »**
   Ils enregistrent, ils n'accompagnent pas. Aucun ne _vient à toi_.

**Fil rouge.** Le problème n'est pas le **manque de données** — c'est le **manque
de discipline et de rendez-vous**. TradeVault vend la discipline, pas le stockage.

---

## 4. Proposition de valeur

> **TradeVault transforme tes données de trading en discipline.**
> Un coach IA qui connaît chacun de tes trades, détecte les erreurs qui te
> coûtent le plus, et t'accompagne — avant, pendant et après le marché — pour
> que tu respectes ton plan.

### Les 3 piliers de valeur

| Pilier | Ce que ça fait | Bénéfice trader |
|---|---|---|
| **Comprendre** | Analyse quant (Sharpe, Sortino, expectancy, drawdown) traduite en **verdicts clairs** par le coach IA | « Je sais _quoi_ corriger, pas juste _mes chiffres_ » |
| **Se souvenir & alerter** | Coach IA à **mémoire** + insights proactifs (patterns → notifications) | « Le produit vient à moi, il ne m'attend pas » |
| **Discipliner** | Checklist pré-market, suivi des erreurs & setups manqués, streak de discipline | « J'entre en trade seulement quand mon plan le dit » |

### Preuve de valeur (l'argument qui débloque le prix)

Le **« coût de mes erreurs » chiffré et mensuel** (ROADMAP P1 #6) : montrer en
euros ce que l'overtrading / le mauvais sizing a coûté. Un seul trade indiscipliné
évité rembourse l'abonnement — l'argument tarifaire central (« un investissement
qui se rembourse en un trade »).

---

## 5. Différenciation

**Ce qui rend TradeVault non-substituable :**

1. **Coach IA proactif à mémoire** — pas une boîte Q&A anonyme. Il se souvient du
   trader (`ai_memory`), reprend le fil, et **initie** le contact (brief, review,
   alertes patterns). C'est la seule voie défendable face à un marché « me-too ».
2. **Discipline-first** — la valeur est le **changement de comportement**, pas le
   reporting. Checklist imposée, streak, micro-feedback à l'enregistrement.
3. **Suivi des erreurs & setups manqués chiffrés** — la plupart des concurrents
   loggent les trades pris ; peu quantifient les erreurs récurrentes _et_ les
   opportunités ratées.
4. **Le produit vient à toi** — briefs quotidiens, weekly review automatique,
   push contextuels. Rétention par le rendez-vous, pas par la volonté de l'user.
5. **Exécution & UX de niveau commercial** — landing, onboarding, journal en 20 s,
   analytics lisibles : la meilleure coque du marché (constat d'audit).
6. **IA provider-agnostique** — la qualité du coach suit l'état de l'art des
   modèles sans refonte produit.

> **Garde-fou honnête** (ROADMAP §1) : sans l'IA vivante et proactive, TradeVault
> redevient un « me-too ». La différenciation **est** le coach — d'où sa priorité
> P0 dans l'exécution.

---

## 6. Concurrents

| Concurrent | Positionnement | Pricing indicatif | Faille que TradeVault exploite |
|---|---|---|---|
| **Tradezella** | Journal + analytics premium | ~24–33 $/mois | Reporting riche mais **réactif** ; pas de coach proactif à mémoire |
| **TraderSync** | Journal + analytics + sync broker | abonnement mensuel | Orienté données ; discipline peu incarnée |
| **Edgewonk** | Journal analytique (desktop) | ~169 $ one-shot | Puissant mais austère, pas d'IA conversationnelle |
| **Tradervue** | Journal historique, partage | freemium / abo | Ancien, peu d'accompagnement comportemental |
| **Notion / Excel** | Bricolage maison gratuit | gratuit | Zéro analyse, zéro rappel, abandon rapide |

**Lecture marché.** Le terrain « journal + analytics » est **saturé et
indifférencié**. TradeVault ne gagne pas en faisant « le même journal en mieux »,
mais en changeant la catégorie : **coach + discipline**, pas **archive + stats**.

**Axes de bataille** : IA coach proactif · discipline imposée · suivi
erreurs/setups manqués · personnalisation · UX supérieure.

---

## 7. Pricing

> **État actuel : early access gratuit.** Le gating Pro est neutralisé
> (`AI_REQUIRE_PRO=false`) — **tout le monde a accès à l'IA**, protégé par un
> rate-limit anti-abus (pas un paywall). L'infra de paiement (Stripe + crypto)
> est en place mais dormante. Bascule commerciale = **une variable d'env**, zéro
> refonte (ROADMAP Lot 4).

### Formules (telles qu'affichées, activées au go-to-market)

| Formule | Prix | Essai | Cible |
|---|---|---|---|
| **Free** | 0 € | — | Faire goûter, activer l'habitude |
| **Pro Mensuel** | **24,99 €/mois** | 14 jours | Engagement souple |
| **Pro Annuel** ⭐ | **239 €/an** (≈ 19,92 €/mois, **2 mois offerts**) | 14 jours | **L'offre héros** (meilleure valeur) |

### Ce que contient chaque formule

**Free** — _« pour poser les bases de ta discipline »_
- Journal de trading (**30 trades / mois**)
- Checklist pré-market
- Statistiques de base

**Pro** — _tout le Free, sans limite, plus :_
- Assistant IA illimité 24h/24 (coach à mémoire)
- Insights automatiques (détection de patterns)
- Import CSV automatique illimité
- Analytics quantitatives (**20+ métriques**)
- Suivi des erreurs & setups manqués
- Calculateur de position intégré
- Rapports mensuels automatiques
- Palette de commandes ⌘K
- Support prioritaire

### Doctrine de pricing (ROADMAP)

- **Free = hameçon, jamais mur.** Un Free qui _fait goûter_ l'IA (quota mensuel),
  jamais un Free sans IA. On ne facture pas tant que la valeur n'est pas prouvée.
- **L'annuel est le produit** — cadré comme l'évidence économique (2 mois offerts).
- **Ancrage par le ROI** : « se rembourse en un trade » plutôt que comparaison de
  features. Le coût chiffré des erreurs (P1 #6) est le levier de conversion clé.
- **Honnêteté beta** : tant que c'est gratuit, l'assumer clairement sur la page
  tarifs (ROADMAP P2 #22) pour éviter l'incohérence prix affiché ⇄ produit gratuit.

---

## 8. Roadmap

> Vue **produit** synthétique. Le détail actionnable (P0→P3, statut par item) est
> maintenu dans [`ROADMAP.md`](ROADMAP.md) — **ne pas dupliquer les priorités
> ici**, s'y référer.

**Séquencement en 5 lots :**

1. **Lot 1 — Le cœur** _(en cours)_
   Coach IA vivant : mémoire ✅ + fil conversationnel ✅ (P0 #1 livré). Dégraisser
   la navigation (≈20 → 6–7 destinations).
2. **Lot 2 — Le rendez-vous**
   Proactivité & rétention : patterns → notifications, Daily Brief, Weekly Review
   automatiques, streak de discipline, bloc « Aujourd'hui » sur le dashboard.
3. **Lot 3 — La preuve**
   Valeur tangible : **coût des erreurs chiffré**, verdicts IA sur chaque métrique,
   écran « ton plan personnalisé » en fin d'onboarding.
4. **Lot 4 — Le go-to-market**
   Bascule commerciale : Free-hameçon à quota, `fail-closed`, ICP resserré, sync
   broker / import récurrent, démo sans compte depuis la landing.
5. **Lot 5 — Le fond & les systèmes IA suivants**
   Scale (analytics en SQL/RPC), refactoring restant, RAG (embeddings), agents
   spécialisés (Performance Analyst, Risk Manager, Psychologist, Pattern Finder).

**Principe directeur** : construire **l'IA d'abord** (la différenciation), le
reste au fil de l'eau — jamais un préalable technique bloquant.

---

## 9. Fonctionnalités principales

### Déjà en place (la coque commerciale)

| Domaine | Fonctionnalité |
|---|---|
| **Coach IA** | Assistant conversationnel à mémoire, réponses ancrées sur l'historique réel (chat, brief, review, patterns, leçons) |
| **Journal** | Saisie d'un trade en ~20 s, screenshots, MAE/MFE/slippage, sous-comptes |
| **Analytics** | 20+ métriques quant (Sharpe, Sortino, expectancy, profit factor, drawdown, streaks, equity curve, PnL par stratégie / jour) |
| **Discipline** | Checklist pré-market, suivi des erreurs, setups manqués |
| **Import** | Import CSV depuis courtier / ancien journal, structuration auto |
| **Objectifs & Plan** | Objectifs, plans de progression, trading plan |
| **Rapports** | Rapports mensuels (IA) |
| **Calendrier éco** | Actualités / événements économiques |
| **Outils** | Calculateur de position, saisonnalité |
| **Rétention** | Notifications push (web-push), deep-links (rapport, upgrade) |
| **Confort** | Palette de commandes ⌘K, multi-langue (i18n), thèmes |

### En construction (ce qui crée la différenciation)

- **Insights proactifs** : détection de pattern → notification (P0 #2).
- **Daily Brief / Weekly Review automatiques** (in-app + e-mail) (P0 #3).
- **Déclencheurs de retour** : push pré-market, review, streak (P0 #4).
- **Coût des erreurs chiffré** mensuel (P1 #6).
- **Verdicts IA en clair** sur chaque métrique analytics (P1 #7).
- **Sync broker** / import récurrent auto (P1 #10).

---

## 10. Revenue Drivers

Les leviers qui transforment l'usage en revenu récurrent :

1. **Abonnement Pro récurrent (MRR)** — cœur du modèle. Mensuel 24,99 € /
   Annuel 239 €. **L'annuel est le driver principal** (cash upfront, churn plus
   faible, 2 mois offerts comme aimant).
2. **Conversion Free → Pro par le quota IA** — le Free fait goûter le coach ;
   la limite (trades/mois + quota IA) crée la tension d'upgrade **une fois la
   valeur ressentie**, pas avant.
3. **Essai 14 jours** sur les deux plans Pro — réduit le risque perçu, laisse le
   temps au « wow » (coach + première weekly review) d'opérer.
4. **Preuve de ROI chiffrée** — le « coût de tes erreurs » rend l'abonnement
   _évidemment_ rentable ; principal accélérateur de conversion et anti-churn.
5. **Rétention par le rendez-vous** — brief quotidien, weekly review, streak :
   plus l'utilisateur revient, plus il reste abonné (le churn est l'ennemi n°1).
6. **Acquisition organique** — rapport mensuel e-mail + **carte de performance
   partageable** (ROADMAP P2 #17) : boucle virale à coût d'acquisition ≈ 0.
7. **Réduction de friction de paiement** — Stripe **+ crypto** (Coinbase) :
   couvre une audience trading internationale, y compris hors circuits carte.
8. **Optionnalité future** — systèmes IA spécialisés (Risk Manager, Psychologist…)
   comme paliers de valeur / tiers supérieurs quand le cœur tient.

**Ce qui bloque encore le revenu** (honnête, ROADMAP §9) : la preuve et la
rétention sont en construction. Tant qu'elles ne sont pas là, on ne facture pas.
Le jour où elles y sont, **25 €/mois cesse d'être une question**.

---

_Ce document est la référence produit officielle. Toute évolution de vision, de
cible ou de pricing se reflète ici en premier. L'exécution priorisée vit dans
[`ROADMAP.md`](ROADMAP.md)._
