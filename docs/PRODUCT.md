# Produit

## Promesse

> **TradeVault te montre précisément pourquoi tu perds — et te refait la
> discipline, semaine après semaine.**

Philosophie : **la discipline avant le profit.** Le produit ne promet pas de
gagner plus ; il aide à perdre moins par indiscipline. Tout ce qui est mesuré,
affiché ou dit par Jarvis sert cet objectif.

TradeVault **n'est pas** un fournisseur de signaux, un bot, une promesse de
gain, une plateforme de copy-trading ni un « outil IA magique ». C'est un
journal et un espace de performance qui aide le trader à comprendre **son**
trading : Journal → Analyze → Understand → Improve.

## Cible

- **Cœur** : traders de prop firms futures (FTMO, The5ers, Apex… ; NQ/ES), en
  challenge ou funded. Contrainte de temps, KPI clair (ne pas casser le
  drawdown), habitués à payer (200–600 $ par challenge), et un problème précis :
  **ils se sabotent après une perte** (revenge sizing, overtrading, hors plan).
- **Plus large** : day traders, intraday, ICT, particuliers qui veulent
  comprendre leur process.
- Douleur centrale : *« Je sais trader, mais je n'arrive pas à être discipliné
  quand ça compte. »*

## Différenciateurs prouvables

- **Claim → evidence** : chaque constat de Jarvis montre ses chiffres, sa
  période, son échantillon et un lien vers les trades concernés.
- **Intention → exécution → résultat** : ce que le trader pensait, ce qu'il a
  fait, ce qui s'est passé (`trade_intent`, `trade_reflection`).
- **Motifs déterministes → propositions confirmées par le trader**
  ([`AI.md`](AI.md) §4).
- **Simulateur de règles de prop firm** (Monte Carlo sur son propre historique).
- **Sécurité statistique** : jamais de conclusion sur un échantillon faible,
  jamais de causalité affirmée.

## Offres

Source unique : `src/domain/plans.ts` (partagée par l'app et le serveur).

| Offre | Mensuel | Annuel | Esprit |
| --- | --- | --- | --- |
| Free | 0 € | 0 € | « Log your trades. Forever. » — 10 trades par mois |
| Pro | 15 € | 120 € | Trades illimités, jusqu'à 3 comptes, synchro Tradovate (lecture seule), transfert et recalibrage entre comptes, tout débloqué |
| Elite | 25 € | 200 € | Les mêmes outils, sans aucune limite (Jarvis, comptes) |

Pas d'essai gratuit. Limites appliquées **en base** (`enforce_trade_quota`,
`enforce_account_quota`). Ancrage de prix : pas les journaux à 20–30 $/mois,
mais **le coût d'un challenge raté**.

## Règles d'honnêteté (non négociables)

- Jamais de promesse de résultat de trading, nulle part (page, `llms.txt`,
  données structurées).
- Jamais de faux témoignage, de note, de compteur d'utilisateurs, de logo ou
  de chiffre de revenu inventés. Trustpilot : vrais avis seulement (zone gelée).
- Comparaisons concurrentes : uniquement sur des faits publics vérifiables.
- Une statistique n'apparaît qu'avec son échantillon ; une association n'est
  jamais présentée comme une cause.
- Avant de promettre une fonctionnalité, vérifier qu'elle existe dans le code
  ([`FEATURES.md`](FEATURES.md)).

## Jarvis

- **Une seule IA, partout** : page, widget, checklist, voix. Jamais « AI Coach »,
  « Assistant » ou « Insights » en parallèle.
- Persona : intelligent, calme, professionnel, discrètement charismatique,
  **brutalement honnête et exigeant** — un mentor haute performance, jamais un
  support client ni une pom-pom girl. Ouvre sur le diagnostic, un chiffre par
  affirmation, un plan de 1 à 3 actions mesurables, rattaché aux règles et
  objectifs **nommés** du trader ; court (80–160 mots) sauf demande de rapport.
- Il interprète les chiffres des moteurs ; il ne les calcule, ne les invente et
  ne prédit jamais le marché. Il ne modifie rien sans confirmation du trader.
- **Voix** : une seule, masculine, grave, posée, britannique, **toujours en
  anglais** (le texte écrit suit la langue de l'UI) ; non modifiable.
  Implémentation : [`AI.md`](AI.md).

## Parcours et acquisition

| Étape | Contenu | Objectif |
| --- | --- | --- |
| Découverte | Posts courts « ta fuite chiffrée », règles de prop firm | Atteindre |
| Intérêt | Aimant à leads (plan anti-échec de challenge, simulateur de règles) | E-mail |
| Essai | Offre Free + Jarvis | Activation (1er trade loggé dès la 1re séance) |
| Rétention | Checklist, revue hebdomadaire, Edge Score, série | Habitude (rétention J7) |
| Monétisation | Pro / Elite + preuve (avant/après) | Conversion |

Canaux : X, TikTok, YouTube Shorts (en anglais), communautés prop firm (sans
spam), avis Trustpilot réels. Idées de contenu : [`../content/hooks.md`](../content/hooks.md).
SEO : [`SEO.md`](SEO.md).

## Décisions tranchées

| Sujet | Décision |
| --- | --- |
| Priorité | L'IA et la boucle de coaching d'abord ; le refactoring au fil de l'eau, jamais un préalable |
| Analytics | Ne plus empiler de métriques : ajouter des verdicts clairs sur l'existant |
| Gating | `fail-open` en beta (un incident ne verrouille personne) ; `fail-closed` une fois payant |
| Critère go / no-go | Une feature doit servir au moins un de : conversion, rétention, valeur perçue, différenciation, réduction du churn, productivité du trader |
