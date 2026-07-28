# TradeVault — Produit

> **Document propriétaire du « pourquoi / pour qui / quoi / combien ».**
> Vision, positionnement, philosophie, ICP, proposition de valeur,
> différenciation, concurrence, **user journey**, pricing et leviers de revenu.
>
> Il ne contient **aucune priorité d'exécution** (→ [`ROADMAP.md`](ROADMAP.md))
> ni aucun statut de fonctionnalité (→ [`FEATURES_STATUS.md`](FEATURES_STATUS.md)).
>
> Dernière vérification contre le code : **2026-07-28**.

---

## 1. Vision

> **Construire le meilleur AI Trading Operating System du marché** — le premier
> outil qui ne se contente pas d'**enregistrer** les trades, mais qui
> **comprend** le trader et l'aide à devenir discipliné.

Un journal **archive le passé**. Un operating system **agit sur le présent** :
il analyse chaque trade, chiffre les schémas répétés qui coûtent de l'argent, et
rappelle au trader sa règle du jour **avant** qu'il ne la brise.

**North Star.** Le jour où la majorité des utilisateurs actifs peut dire :

> _« Chaque dimanche je reçois un bilan qui me dit quelle erreur me coûte le
> plus, et chaque matin mon coach me rappelle ma règle du jour — depuis, je
> respecte mon plan. »_

…le produit a gagné.

**Promesse publique (landing en production).**
> _« Deviens le trader discipliné. Ton coach IA de trading personnel — pas un
> simple journal, un coach IA disponible 24 h/24 qui analyse tes trades. »_

**Ambition d'échelle.** Architecture pensée pour des dizaines de milliers
d'utilisateurs : IA provider-agnostique (changer de modèle = une variable
d'environnement), isolation RLS owner-only, payloads plafonnés, coûts IA bornés.

---

## 2. Philosophie — la discipline avant le profit

C'est le principe qui tranche **tous** les arbitrages produit.

| On mesure et on met en avant | On ne met **jamais** en avant |
| --- | --- |
| Le respect du plan, des règles, de la checklist | Un classement par P&L |
| Le **coût** d'un écart de discipline, en euros | Une promesse de gain |
| La régularité (streaks, jours propres, Edge Score) | Une prédiction de marché |
| Les erreurs récurrentes chiffrées, les setups manqués | Un signal d'achat / de vente |

**Conséquences concrètes, déjà dans le code :**

- **L'Edge Score** (`app/utils/edgeScore.ts`) est un score 0–100 de
  **comportement** — plan respecté, risque tenu, jours propres, routine — dont
  le P&L est **volontairement absent** des composantes.
- **Jarvis n'a pas le droit de prédire.** La règle `ANTI_HALLUCINATION` du
  prompt lui interdit toute donnée hors des blocs fournis, toute prédiction de
  marché et tout conseil financier (→ [`JARVIS.md` §5](JARVIS.md)).
- **Le moteur d'analyse note une perte contenue comme une bonne exécution** :
  une perte ≤ 1R obtient un bon score R:R, parce que le stop a fait son travail
  (`modules/trading/analysis/engine.ts`).
- **Le moteur de discipline émet un événement de succès** quand la journée est
  propre — la discipline tenue est un signal, pas juste une absence d'alerte.

**Anti-positionnement assumé.** TradeVault ne prédit jamais le marché, ne donne
jamais de conseil financier, ne passe jamais d'ordres, ne se connecte à aucun
compte de courtage en écriture. L'IA analyse **uniquement le passé du trader**.

---

## 3. Positionnement

- **Catégorie revendiquée** : *AI Trading Coach* — au-dessus des journaux de
  trading, qui documentent le passé. TradeVault **interprète**, **se souvient**
  et **intervient**.
- **Ce qu'on ne vend pas** : du stockage de trades. Le marché
  « journal + analytics » est saturé et indifférencié.
- **Ce qu'on vend** : un **changement de comportement** mesurable.

**Garde-fou honnête.** Sans l'IA vivante et proactive, TradeVault redevient un
« me-too » de plus. La différenciation **est** le coach — c'est pourquoi elle est
prioritaire dans l'exécution ([`ROADMAP.md`](ROADMAP.md)).

---

## 4. ICP (Ideal Customer Profile)

La cible défendable n'est pas « tout trader » mais **le trader qui a un problème
de discipline, pas un problème de données**.

### Cœur de cible

| Segment | Pourquoi lui | Douleur dominante |
| --- | --- | --- |
| **Trader en challenge prop-firm** (FTMO, Apex, Topstep, MFF…) | Une seule erreur de discipline = challenge perdu = argent réel perdu | Tenir des règles strictes sous pression |
| **Trader retail sérieux et actif** (forex / futures / indices / crypto) | Trade souvent, veut progresser, a déjà un journal qu'il ne tient pas | Overtrading, revenge-trading, sizing qui dérape |
| **Trader en transition vers le temps plein** | Doit prouver une régularité, pas un coup de chance | Constance, suivi objectif de la progression |

### Caractéristiques communes

- Trade **régulièrement** (plusieurs trades par semaine) — assez pour générer
  des patterns exploitables.
- Connaît déjà ses métriques mais **n'agit pas** dessus.
- A déjà essayé Excel / Notion / un journal payant et **a abandonné** (friction).
- Cherche un **antidouleur** (« arrête de me faire perdre par indiscipline »),
  pas une vitamine (« encore un dashboard »).
- 20–40 ans, **mobile-first**, francophone ou anglophone en priorité.

### Hors cible (assumé)

- Investisseur long terme / buy-and-hold (pas de discipline intraday à corriger).
- Trader occasionnel (trop peu de données pour que l'IA soit utile).
- Quant qui veut une API brute (on vend du coaching, pas de la donnée nue).

### Proxy produit

L'onboarding capture exactement ce profil et le rend actionnable :
**style** (scalper / day / swing / position), **expérience** (débutant →
financé), **marchés**, **usage des concepts ICT**, **objectif**
(régularité / challenge prop / discipline / temps plein / revenu complémentaire),
**faiblesse déclarée**, **objectif mensuel en %**. Ce profil est injecté dans
**chaque** appel à Jarvis (`describeProfile()` dans `app/utils/aiContext.ts`),
ce qui interdit structurellement une réponse générique.

> **Chantier ICP identifié** : la landing parle encore « à tous » ; resserrer le
> message sur *prop-firm / discipline* est un levier de conversion
> ([`ROADMAP.md`](ROADMAP.md), P1).

---

## 5. Problèmes utilisateurs

1. **« Je connais mes stats mais je répète les mêmes erreurs. »** Le chiffre ne
   se transforme pas en changement de comportement — il manque le **verdict** et
   le **rappel au bon moment**.
2. **« Je fais du revenge-trading / de l'overtrading après une perte. »**
   Personne ne le lui dit sur le moment, et le coût cumulé reste invisible.
3. **« Je ne tiens pas mon journal. »** Saisie manuelle = friction = abandon.
4. **« Mon plan de trading, je l'oublie dès que le marché bouge. »** Aucune
   discipline imposée avant le trade ; le plan reste un PDF mort.
5. **« Je ne sais pas si je progresse vraiment. »** Aucun rendez-vous régulier
   qui synthétise et objective la progression.
6. **« Les outils existants sont des tableurs déguisés. »** Ils enregistrent,
   ils n'accompagnent pas. Aucun ne *vient à toi*.

**Fil rouge.** Le problème n'est pas le manque de données — c'est le manque de
**discipline** et de **rendez-vous**.

---

## 6. Proposition de valeur

> **TradeVault transforme tes données de trading en discipline.**
> Un coach IA qui connaît chacun de tes trades, chiffre les erreurs qui te
> coûtent le plus, et t'accompagne — avant, pendant et après le marché — pour
> que tu respectes ton plan.

### Les trois piliers

| Pilier | Ce que ça fait | Bénéfice trader |
| --- | --- | --- |
| **Comprendre** | Analyse quant (win rate, profit factor, expectancy, Sharpe, Sortino, drawdown) + signaux comportementaux déterministes, traduits en **verdicts clairs** par Jarvis | « Je sais *quoi* corriger, pas juste *mes chiffres* » |
| **Se souvenir & alerter** | Profil injecté à chaque appel, mémoire IA (`ai_memory`), notifications de règle enfreinte, rapports mensuels | « Le produit vient à moi, il ne m'attend pas » |
| **Discipliner** | Checklist pré-market en 5 étapes, plan de trading, règles vérifiées à chaque trade, Edge Score, objectifs, setups manqués | « J'entre en trade seulement quand mon plan le dit » |

### La preuve de valeur (l'argument qui débloque le prix)

Le **coût chiffré des erreurs**, mensuel et nominatif : montrer en euros ce que
l'overtrading ou la dérive de sizing a coûté. Les données existent déjà
(`mistakeStats`, `computeBehaviorSignals`) ; la narration mensuelle reste à
construire ([`ROADMAP.md`](ROADMAP.md)). **Un seul trade indiscipliné évité
rembourse l'abonnement** — c'est l'argument tarifaire central.

---

## 7. Différenciation

1. **Coach IA à identité unique et à grounding strict** — Jarvis, pas une boîte
   Q&A anonyme. Il reçoit le profil, les règles, les objectifs, les statistiques
   **précalculées** et les signaux comportementaux du trader, et n'a
   structurellement pas le droit d'inventer un chiffre.
2. **Discipline-first** — la valeur est le changement de comportement, pas le
   reporting. Checklist imposée, règles auto-vérifiées, Edge Score, streaks.
3. **Signaux comportementaux déterministes** — dérive de taille après une perte,
   coût d'une journée sur-tradée, edge par jour / session / symbole, fiabilité
   du propre grading du trader. La plupart des concurrents s'arrêtent aux
   agrégats ; presque aucun ne chiffre le *pourquoi*.
4. **Suivi des erreurs *et* des setups manqués** — les concurrents loggent les
   trades pris ; peu quantifient les occasions ratées.
5. **UX de niveau commercial** — landing, onboarding, saisie d'un trade en ~20 s,
   optimistic UI, PWA mobile-first, palette ⌘K, 12 langues dans l'app.
6. **IA provider-agnostique** — la qualité du coach suit l'état de l'art des
   modèles sans refonte produit ; changer de modèle est une variable d'env.

---

## 8. Concurrence

| Concurrent | Positionnement | Pricing indicatif | Faille exploitée |
| --- | --- | --- | --- |
| **Tradezella** | Journal + analytics premium | ~24–33 $/mois | Reporting riche mais **réactif** ; pas de coach à grounding personnel |
| **TraderSync** | Journal + analytics + sync broker | abonnement mensuel | Orienté données ; discipline peu incarnée |
| **Edgewonk** | Journal analytique desktop | ~169 $ one-shot | Puissant mais austère, aucune IA conversationnelle |
| **Tradervue** | Journal historique, partage | freemium / abo | Ancien, peu d'accompagnement comportemental |
| **Notion / Excel** | Bricolage maison | gratuit | Zéro analyse, zéro rappel, abandon rapide |

**Lecture marché.** On ne gagne pas en faisant « le même journal en mieux », mais
en changeant de catégorie : **coach + discipline** au lieu de **archive + stats**.

**Axes de bataille** : coach IA ancré · discipline imposée · erreurs et setups
manqués chiffrés · personnalisation par le profil · UX supérieure.

---

## 9. User journey complet

### 9.1 Acquisition — la landing (`src/app/pages/Landing.tsx`)

Page publique servie en SSR sur `/`, structurée pour la conversion :
**hero** (promesse + CTA + preuve visuelle) → **problème** (miroir de la douleur)
→ **section IA** (le coach, en résultats et non en fonctionnalités) →
**fonctionnalités** → **tarifs** → **FAQ** → **CTA final**. Barre de navigation
avec scrollspy, widget Trustpilot (zone gelée), pages légales `/privacy` et
`/terms`.

> ⚠️ **Écart connu** : la landing est **entièrement en français codé en dur**
> (aucun appel à `useT()`), alors que l'application est traduite en 12 langues.
> Voir [`ROADMAP.md` §6](ROADMAP.md).

### 9.2 Inscription

`AuthModal` (Supabase Auth) ouvert depuis n'importe quel CTA, en carte latérale
desktop / plein écran mobile. Le plan choisi sur la page tarifs est transmis à la
modale. Réinitialisation de mot de passe sur la route dédiée `/reset-password`.

### 9.3 Onboarding — 6 étapes (`src/app/onboarding/`)

Bloquant au premier lancement, la source de vérité étant `profiles.onboarded_at`.

| # | Étape | Ce qui est capté | Pourquoi |
| --- | --- | --- | --- |
| 1 | **Langue** | `language` | L'app parle immédiatement la langue du trader |
| 2 | **Bienvenue** | — | Cadrage de la promesse |
| 3 | **Profil** | marchés, style, ICT, solde de départ | Personnalise l'analyse et les calculs de risque |
| 4 | **Préférences** | objectif, expérience, faiblesse déclarée, objectif mensuel % | **Le carburant du coaching non générique** |
| 5 | **Notifications** | opt-in web-push | Crée le canal « le produit vient à toi » |
| 6 | **Démarrage** | import CSV **ou** trades de démo **ou** saisie manuelle | Le premier « wow » ne doit jamais dépendre d'un fichier |

Le profil est ensuite (a) injecté dans **chaque** appel Jarvis, (b) semé en
mémoire longue durée (`ai_memory`, kind `profile`, idempotent, coût IA nul),
(c) utilisé pour générer une **checklist adaptative** (`ChecklistWizard`).

### 9.4 Boucle quotidienne — le déroulé d'une session

C'est l'ordre exact de la navigation (`src/app/navigation.ts`) :

```
Accueil        Dashboard — Edge Score, règle du jour, KPI, courbe d'équité
   ↓
Préparation    Plan de trading · Objectifs · Actualités éco · Calculateur de position
               · Checklist pré-market (5 étapes, verrouillage, voix Jarvis)
   ↓
Journal        Calendrier P&L · Journal de trades · Setups manqués
   ↓
Analyse        Analytics · Erreurs récurrentes · Rapports · Saisonnalité
   ↓
Jarvis         Briefing du jour · forces/faiblesses · conversation + voix
   ↓
Compte         Réglages · Profil · Apparence · Abonnement
```

**Le trade lui-même** : `TradeModal` → écriture **optimiste** (l'UI n'attend
jamais le réseau) → persistance Supabase → `AutomationEngine` (validation →
analyse déterministe → discipline) → événements → notifications (toast + push +
persistance). Détail : [`ARCHITECTURE.md` §5](ARCHITECTURE.md).

### 9.5 Boucle hebdomadaire et mensuelle

- **Mensuel, automatique** : cron Vercel le 1er du mois à 06:00 UTC → génération
  du rapport mensuel + envoi e-mail + push avec deep-link `/?report=YYYY-MM`.
- **Backfill** : un import CSV multi-mois génère rétroactivement les rapports
  mensuels manquants (in-app seulement, jamais d'e-mail rétroactif).
- **Rappels d'objectifs** : le tick quotidien de 08:00 UTC déclenche, le lundi,
  les rappels de plan à 6 mois.
- ⚪ **Weekly Review et Daily Brief automatiques** : prévus, non livrés — c'est
  le principal manque de rétention ([`ROADMAP.md`](ROADMAP.md)).

### 9.6 Rétention et sortie

Notifications push (règle enfreinte, limite atteinte, rapport prêt), e-mails de
cycle de vie, deep-links `?report=` et `?upgrade=1`, invitation Trustpilot
auto-régulée (jamais pendant un flux actif). Suppression de compte disponible via
l'edge function `delete-account` (RGPD).

---

## 10. Pricing

> **État actuel : early access gratuit.** `AI_REQUIRE_PRO=false` — tout
> utilisateur authentifié a accès complet à l'IA. Ce qui protège le service est
> un **rate-limit anti-abus** (60 requêtes/h par utilisateur, atomique en SQL),
> **pas un paywall**. L'infrastructure de paiement (Stripe + Coinbase Commerce,
> webhooks idempotents) est en place mais **dormante** : la bascule commerciale
> est **une variable d'environnement**, sans refonte.

### Formules affichées

Source unique des montants : `src/app/utils/pricing.ts` — aucun prix n'est écrit
en dur dans une page.

| Formule | Prix | Essai | Rôle |
| --- | --- | --- | --- |
| **Free** | 0 € | — | Faire goûter, installer l'habitude |
| **Pro Mensuel** | **19,99 €/mois** | 14 jours | Engagement souple |
| **Pro Annuel** ⭐ | **199 €/an** (≈ 16,58 €/mois — 2 mois offerts, 40 € économisés) | 14 jours | **L'offre héros** |

**Free** — *pour poser les bases de ta discipline* : journal (30 trades/mois),
checklist pré-market, statistiques de base.

**Pro** — *tout le Free, sans limite, plus* : Jarvis illimité, insights
automatiques, import CSV illimité, analytics quantitatives (20+ métriques),
suivi des erreurs et setups manqués, calculateur de position, rapports mensuels
automatiques, palette de commandes ⌘K, support prioritaire.

### Doctrine de pricing

- **Free = hameçon, jamais mur.** Un Free qui *fait goûter* l'IA (quota
  mensuel), jamais un Free sans IA. On ne facture pas tant que la valeur n'est
  pas prouvée.
- **L'annuel est le produit** — cadré comme l'évidence économique.
- **Ancrage par le ROI** : « se rembourse en un trade », plutôt qu'une
  comparaison de fonctionnalités.
- **Honnêteté beta** : tant que c'est gratuit, l'assumer sur la page tarifs —
  l'incohérence « prix affiché ⇄ produit gratuit » est un chantier ouvert.

---

## 11. Leviers de revenu

1. **Abonnement Pro récurrent (MRR)** — cœur du modèle ; **l'annuel est le
   driver principal** (cash upfront, churn plus faible).
2. **Conversion Free → Pro par le quota IA** — la tension d'upgrade naît *après*
   que la valeur a été ressentie, jamais avant.
3. **Essai 14 jours** sur les deux plans Pro — réduit le risque perçu.
4. **Preuve de ROI chiffrée** — le « coût de tes erreurs » rend l'abonnement
   évidemment rentable ; principal accélérateur de conversion et anti-churn.
5. **Rétention par le rendez-vous** — brief quotidien, weekly review, streak.
6. **Acquisition organique** — rapport mensuel e-mail + carte de performance
   partageable : boucle virale à coût d'acquisition ≈ 0.
7. **Friction de paiement réduite** — Stripe **et** crypto (Coinbase Commerce),
   pour une audience trading internationale.
8. **Optionnalité future** — agents IA spécialisés (Performance Analyst, Risk
   Manager, Psychologist, Pattern Finder) comme paliers de valeur supérieurs
   (→ [`AI_ARCHITECTURE.md` §7](AI_ARCHITECTURE.md)).

**Ce qui bloque encore le revenu, honnêtement** : la preuve et la rétention sont
en construction. Tant qu'elles ne sont pas là, on ne facture pas. Le jour où
elles y sont, 19,99 €/mois cesse d'être une question.

---

## 12. Critère go / no-go (rappel de la charte)

Aucune fonctionnalité n'est développée si elle n'améliore **au moins un** de :
**conversion · rétention · valeur perçue · différenciation · réduction du churn ·
productivité du trader**. Si aucun n'est servi : le dire, proposer une
alternative, ne pas coder.
