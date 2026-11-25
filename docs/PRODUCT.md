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

| Offre | Prix | Esprit |
| --- | --- | --- |
| Gratuit | 0 € | « Log your trades. Forever. » — 10 trades par mois, 1 compte |
| **Mensuel** | **9 € / mois** | Tout TradeVault, sans engagement, résiliable en un clic (portail Stripe) |
| **Licence à vie** | **49 €, une fois** | Le même accès, payé une fois — moins de 6 mois de mensuel |

Deux façons de payer **le même produit** (novembre 2026) : plan `elite_monthly`
(Stripe Checkout en mode `subscription`) et plan `lifetime` (mode `payment`),
qui ouvrent tous deux le palier le plus haut (`effective_tier` → `elite`). Le
rapport entre les deux est voulu : la licence coûte moins de six mensualités
(`lifetimeBreakEvenMonths`), et la grille le dit en chiffres. Les prix Stripe
se retrouvent par leur `lookup_key`, dérivée du montant du catalogue
(`BACKEND.md`) : prix affiché et prix facturé ne peuvent pas diverger.

Une licence ne se rétrograde jamais (`apply_subscription_event`), seul le
remboursement de son paiement la retire (`revoke_lifetime_license`). Acheter
la licence pendant un mensuel coupe le renouvellement du mensuel. Les anciens
abonnés Pro/Elite (d'avant la licence) restent convertis en licence à vie ;
un mensuel vendu depuis la relance porte `metadata.offer` et n'est jamais
converti. Coût de Jarvis : modèle non tranché — aucune promesse « illimité »
n'est écrite ; la licence à vie inclut Jarvis, ce coût récurrent est à
surveiller.

Pas d'essai gratuit. Limites appliquées **en base** (`enforce_trade_quota`,
`enforce_account_quota`). Ancrage de prix : pas les journaux à 20–30 $/mois,
mais **le coût d'un challenge raté**.

## Stratégie commerciale (revue du 2026-11-15)

**Positionnement prix.** On ne se compare pas aux journaux, on se compare au
coût d'un reset de challenge (200–600 $). 9 € par mois, c'est moins qu'un
seul contrat mal dimensionné ; 49 € une fois, c'est moins de six mois de
mensuel. Deux formules, **le même produit** : on ne vend pas des paliers, on
vend une façon de payer.

**Pas de plan annuel** (décision du propriétaire, 2026-11-15) : à 9 €/mois,
un annuel « 3 mois offerts » vaudrait 81 € — plus cher que la licence à
49 €, donc invendable. Si un annuel revient un jour, la licence doit d'abord
coûter plus de deux ans de mensuel.

**Risque assumé de la licence** : Jarvis est inclus et coûte à chaque
requête. Garde-fou à décider : un plafond « usage raisonnable » technique
sur `LIMITS.elite.jarvisPerDay` (aujourd'hui illimité), écrit dans les CGU,
avant que le coût par utilisateur (`ai_agent_runs`) ne dépasse la marge.

### La frontière gratuit / payant

Principe : **le gratuit installe l'habitude, le payant donne le diagnostic.**
Gratuit = noter et VOIR ce qu'on fait (journal, calendrier, **Analyses**
depuis le 2026-11-15, checklist, plan, calculateur, 10 trades/mois, 1
compte, Jarvis 3/jour). Payant = comprendre POURQUOI on perd (Erreurs,
Setups manqués, Monte-Carlo, Saisonnalité, Rapports, Jarvis complet,
synchro, multi-comptes).

Recommandations, par ordre de valeur :

1. **Montrer le diagnostic avant le mur.** Le mur d'aperçu (`PreviewWall`)
   montre déjà la vraie page floutée. Étape suivante : une seule « fuite »
   réelle par mois offerte au gratuit (la plus coûteuse, avec son `n`), pour
   que le gratuit vive le « aha » avant de payer.
2. **Le calendrier économique en gratuit** (`news`, aujourd'hui payant) :
   c'est l'écran qu'on ouvre CHAQUE matin, il ne coûte qu'un cron, et il fait
   revenir les gratuits — donc il fait convertir. À trancher.
3. **Le mur au bon moment** : relance douce à 8/10 trades, puis la modale à
   deux offres à 10/10 — avec le compteur réel (déjà sur la page
   Abonnement).
4. Garder 10 trades/mois tant qu'aucune mesure ne dit le contraire ; tester
   20 si l'activation (1er trade le jour 0) est bonne mais la conversion
   faible.

### Réductions — la politique

- **Jamais de remise permanente sur la grille.** Le prix affiché est le
  prix. Les réductions sont datées ou nominatives.
- **Codes partenaires** (influenceurs, prop firms, communautés) : l'outil
  existe (`promo_codes`). Les coupons de réduction sont en `duration=forever`
  (`promo.server.ts`) : sur le mensuel, ça fait une remise À VIE. Pour le
  mensuel, préférer « 3 premiers mois » (`duration=repeating`).
- **Parrainage** (à construire) : un mois offert aux deux (crédit sur le
  solde client Stripe) — le canal le moins cher pour une cible qui vit en
  communautés Discord.
- **Rétention** : coupon de rétention au moment de la résiliation (option
  du portail client Stripe) ou bascule proposée vers la licence.
- **Événements** : une opération par an au plus (Black Friday), sinon le
  prix perd sa crédibilité.

### Les leviers dans le produit (fait le 2026-11-15)

Page Abonnement refaite : compteur du mois réel, grille gratuit / mensuel /
licence, passage mensuel → licence, ce que chaque page payante apporte,
comparatif tiré de `LIMITS`, questions de facturation, erreurs de paiement
traduites. Modale d'achat à deux offres, mur d'aperçu au tarif vendu,
vitrine et `/pricing` alignées.

### À mesurer avant de toucher aux prix

Aucun outil d'analytics produit n'est branché (`ROADMAP.md`, L8). Les
chiffres qui décident : activation (1er trade le jour 0), part de gratuits
qui atteignent 10/10, conversion gratuit → payant, part mensuel / licence,
résiliation du mensuel à M1 et M3, coût IA par utilisateur payant. Outil
recommandé : PostHog (hébergement UE) ou Plausible.

### E-mails de cycle de vie

Les e-mails « fin d'essai » et « relance après essai » ne partent plus : il
n'y a plus d'essai. Et `RESEND_API_KEY` n'est pas posée dans Vercel :
**aucun** e-mail ne part aujourd'hui, pas même la bienvenue. À remplacer par
une séquence gratuite : J+1 (premier trade), J+7 (ta semaine), quota 8/10,
mensuel résilié → proposition de licence.

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

## Le résultat, jamais le processus (règle universelle)

Décidée le 2026-11-25 par le propriétaire, valable sur tout le site.

- Le trader voit le **résultat** : la valeur, son unité, son `n`, ce qu'il doit
  faire. Le travail qui l'a produit reste invisible.
- Jamais à l'écran : nom de modèle ou de fournisseur IA, « appel IA », cache,
  étapes de réflexion de Jarvis, outils consultés, méthode ou formule de calcul,
  nombre de simulations, niveau de confiance, origine d'une valeur (lue sur une
  capture, calculée, estimée, apprise).
- Une valeur incertaine porte **une seule** marque d'action : « à vérifier ».
  C'est un résultat (il y a quelque chose à regarder), pas une explication.
- Une attente est neutre : un indicateur, sans décrire ce qui se calcule.
- L'honnêteté ne recule pas : rien d'inventé, le `n` reste affiché, une
  donnée absente reste « manquante ».
- Les diagnostics (provenance, modèle, coûts) vivent dans `/dev/*` et en base,
  jamais dans l'app du trader.

## Jarvis

- **Une seule IA, partout** : page, widget, voix. Jamais « AI Coach »,
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
| Monétisation | Mensuel 9 € ou licence à vie 49 € + preuve (avant/après) | Conversion |

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
