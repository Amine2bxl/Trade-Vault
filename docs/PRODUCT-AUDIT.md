# TradeVault — Audit produit & UX

> Audit critique pré-lancement (Product Designer / PM SaaS / UX finance).
> Synthèse ; la priorisation actionnable vit dans [`ROADMAP.md`](ROADMAP.md).

## Verdict

**Note produit : 7,2/10.** Excellente exécution, promesse en avance sur le produit.
La coque (landing, onboarding, journal, analytics) est de niveau commercial.
Le différenciateur vendu — le « Coach IA 24h/24 qui détecte tes patterns » — était
une simple boîte Q&A sans mémoire (corrigé en P0 #1). C'est le sujet à combler
avant de facturer 25 €/mois.

## Tension centrale

La landing vend un **coach IA** (« un mentor qui connaît chacun de tes trades »,
« détecte tes schémas et t'alerte avant que tu les répètes »). Le journal +
analytics + checklist sont solides mais **non différenciants** : TraderSync,
Tradezella, Edgewonk et un simple Notion couvrent déjà ce terrain. La seule voie
défendable est **l'IA coach + la discipline**.

## Problèmes par domaine (Description · Impact · Solution · Priorité)

### Proposition de valeur
- **Promesse « coach IA » vs réalité « boîte Q&A »** — sur-vente de l'IA → déception à l'activation. *Solution* : faire vivre l'IA (mémoire + proactivité). **Critique** — *en cours (P0 #1 fait)*.
- **« Pour qui » pas assez tranché** — positionnement vitamine, pas antidouleur. *Solution* : ICP prop-firm/discipline. **Haute**.

### Landing
- **Preuve sociale absente/artificielle** (5★ Trustpilot « early access », chiffres maquettés). **Haute** — *reporté : avis en cours*.
- **Pas de démo sans compte**. **Moyenne**.
- **Incohérence prix affiché ⇄ produit gratuit**. **Moyenne** — assumer le statut beta.

### Onboarding
- **Le profil collecté ne produit pas de payoff visible**. **Haute** — écran « plan personnalisé ».
- **Premier « wow » dépend d'un import CSV fragile**. **Critique** — fallback démo systématique.

### Navigation
- **Surcharge (20 destinations)**. **Haute** — réduire à 6–7.
- **Coach IA (« Insights ») enterré**. **Moyenne** — promouvoir & rendre omniprésent.

### Dashboard
- **Rétroviseur, pas copilote** (montre le passé, pas l'action du jour). **Haute** — bloc « Aujourd'hui ».
- **État vide non exploité**. **Moyenne** — empty state guidé.

### Journal
- **Saisie manuelle = friction d'abandon**. **Haute** — sync broker, saisie rapide.
- **Le journal ne « répond » pas** à la saisie. **Moyenne** — micro-feedback discipline.

### Analytics
- **Métriques sans verdict**. **Haute** — phrase-verdict IA par métrique.
- **Calcul client à grande échelle**. **Faible** — agrégats SQL.

### Mistakes
- **Feature à fort potentiel, sous-narrée**. **Moyenne** — « coût des erreurs » chiffré.

### Checklist
- **Pas encore un rituel quotidien imposé**. **Haute** — notif pré-market + streak.

### Coach IA (chantier décisif)
- **Zéro mémoire, zéro conversation**. **Critique** — *fait (P0 #1)*.
- **100% réactif, 0% proactif**. **Critique** — insights proactifs + jobs.
- **Pas de rapport IA généré tout seul**. **Haute** — Weekly Review automatique.

### Objectifs
- **Déconnectés du quotidien**. **Moyenne** — progression visible partout + célébrations.

### Rapports
- **Non exploités comme canal rétention/acquisition**. **Moyenne** — e-mail + carte partageable.

### Rétention (point faible structurel)
- **Aucun mécanisme de rappel / rendez-vous** (produit 100% « pull »). **Critique** — brief, review, streak.

### Différenciation
- **Sans l'IA vivante, TradeVault est un « me-too »**. **Haute** — tout miser sur le coach proactif à mémoire.

## Analyse commerciale — paierais-tu 25 €/mois ?

**Aujourd'hui : non. Dans 3 lots produit : oui, sans hésiter.**

Freins : preuve absente, différenciation non tenue, pas de raison de revenir,
coût de switch faible, ROI non démontré.

Manque pour l'évidence : coach à mémoire (fait), alertes proactives, Weekly Review,
coût chiffré des erreurs, preuve sociale réelle.

**Seuil de l'évidence** : quand le trader peut dire « chaque dimanche je reçois un
bilan qui me dit quelle erreur me coûte le plus, et chaque matin mon coach me
rappelle ma règle du jour — depuis, je respecte mon plan », alors 25 €/mois est
dérisoire face à un seul trade indiscipliné évité.

## Concurrents

Tradezella (~24–33 $/mois), TraderSync, Edgewonk (~169 $ one-shot), Tradervue,
Notion/Excel gratuit. Marché encombré côté « journal + analytics ». Différenciation
= IA coach proactif + discipline + suivi erreurs/setups manqués + personnalisation.
