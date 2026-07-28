# TradeVault — Règles UX / UI

> **Document propriétaire des standards d'expérience** : principes, navigation,
> structure des pages, états, formulaires, notifications, voix, onboarding,
> accessibilité, i18n.
>
> Le *style* (tokens, primitives, couleurs, typographie) est dans
> [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). La mécanique de rendu est dans
> [`ARCHITECTURE.md`](ARCHITECTURE.md).
>
> Dernière vérification contre le code : **2026-07-28**.

---

## 1. Les sept principes

1. **L'optimistic UI n'attend jamais.** Toute action utilisateur répond
   instantanément ; le réseau rattrape en arrière-plan. En cas d'échec, on
   **restaure le snapshot précédent** et on le dit — jamais de faux succès
   silencieux.
2. **Mobile-first réel.** Barre de navigation basse, bottom-sheets, FAB, cibles
   tactiles ≥ 44 px (`h-11`), viewport verrouillé (pas de zoom accidentel en
   saisie). Le desktop est l'extension du mobile, pas l'inverse.
3. **Zéro friction de saisie.** Le journal doit être plus rapide qu'Excel :
   valeurs par défaut, brouillons persistés, import CSV, prompts rapides,
   dictée vocale.
4. **Le produit vient au trader** (cible). Notifications, rappels, briefs :
   l'utilisateur ne doit pas avoir à chercher sa valeur. C'est le principal
   chantier de rétention ouvert ([`ROADMAP.md`](ROADMAP.md)).
5. **Continuité.** Conversations Jarvis, brouillons de trade et checklist du
   jour sont persistés **par utilisateur** (`nsKey(userId, …)`), jamais
   globalement — pas de fuite entre comptes sur un appareil partagé.
6. **Densité professionnelle.** TradeVault est un outil de travail scanné
   quotidiennement : surfaces resserrées, chiffres tabulaires, esprit
   TradingView / Linear plutôt que SaaS aéré.
7. **Tous les états sont gérés.** Chargement, vide, erreur — jamais un écran
   blanc, jamais une stack trace.

---

## 2. Navigation

### 2.1 Source unique

`src/app/navigation.ts` définit **tout**. `Sidebar` (desktop), `MobileNav`
(barre basse + feuille « Plus ») et `CommandPalette` (⌘K) en **dérivent**.
Ajouter, retirer ou réordonner une page = **un seul fichier modifié**, et les
trois surfaces ne peuvent pas diverger.

**Règle** : ne jamais coder en dur une entrée de navigation dans un composant.

### 2.2 Les groupes suivent le déroulé d'une session

| Groupe | Pages |
| --- | --- |
| **Accueil** | Dashboard |
| **Préparation** | Plan de trading · Objectifs · Actualités éco · Calculateur · Checklist |
| **Journal** | Calendrier · Journal · Setups manqués |
| **Analyse** | Analytics · Erreurs · Rapports · Saisonnalité |
| **Jarvis** | Jarvis |
| **Compte** | Réglages · Profil · Apparence · Abonnement |

L'ordre raconte une session : on prépare, on trade et on journalise, on analyse,
on se fait coacher. Un nouvel écran doit trouver sa place **dans ce récit** —
s'il n'en a pas, c'est un signal qu'il ne sert peut-être pas.

### 2.3 Surfaces

- **Sidebar desktop** — rail de 260 px, sticky pleine hauteur, groupes
  étiquetés, indicateur actif en filet dégradé cyan → teal.
- **MobileNav** — layout symétrique **2 + FAB + 2** : `MOBILE_BAR`
  (Dashboard · Journal · Analytics) promu, un FAB central « nouveau trade », et
  « Plus » qui ouvre une feuille reprenant **les mêmes groupes** que le desktop.
- **CommandPalette ⌘K** — liste plate (`NAV_ITEMS`) en ordre de workflow +
  actions rapides + recherche de trades.

### 2.4 État actuel et cible

**18 destinations** aujourd'hui, organisées en 6 groupes. Le socle (source
unique, groupement par déroulé) est livré ; la **réduction à 6–7 destinations**
reste à faire : fusionner Apparence + Profil + Réglages → **Réglages**, Erreurs
+ Setups manqués → **Discipline**, Saisonnalité + Calculateur + Actualités →
**Outils**. Voir [`ROADMAP.md`](ROADMAP.md).

### 2.5 URLs et deep-links

La navigation interne est un **état React**, pas une URL
([`ARCHITECTURE.md` §4.1](ARCHITECTURE.md)). Conséquences à assumer en UX :
pas de lien profond par page, pas de retour navigateur par page. Deux
deep-links existent via query params sur `/` : `?report=YYYY-MM` (Rapports) et
`?upgrade=1` (Profil), utilisés par les push et les e-mails.

---

## 3. Structure d'une page

**Squelette canonique** — toute page suit ce gabarit :

```tsx
<PageContainer>
  <PageHeader
    eyebrow={…}        // optionnel : salutation, fil d'Ariane
    icon={…}           // optionnel : identité visuelle de la page
    title={t("…")}     // h1 dégradé blanc → slate
    subtitle={t("…")}  // une phrase : à quoi sert cette page
    actions={…}        // CTA principal, filtres
  />
  {/* Sections : Card / Metric / Table / Chart — jamais de markup ad hoc */}
</PageContainer>
```

**Règles de composition :**

- **Un `PageHeader` par page**, jamais deux `h1`.
- **Une responsabilité par page.** Exemple appliqué : la page Abonnement
  n'affiche que le **statut** (plan · essai · jours restants) — les prix et la
  logique Stripe ont été retirés du Profil.
- **`Metric`** pour tout KPI — pas de tuile de statistique maison.
- **`Card`** pour toute surface — pas de `rounded-2xl border …` inline.
- **`Table` + `TableScroll`** pour toute donnée tabulaire — le débordement
  horizontal scrolle **dans son conteneur**, jamais la page.
- Les sous-composants propres à une page lourde sont **co-localisés**
  (`pages/checklist/`, `pages/dashboard/`, `pages/goals/`, `pages/landing/`).

### 3.1 Rôle de chaque page

| Page | Rôle en une phrase |
| --- | --- |
| **Dashboard** | Copilote du jour : Edge Score, règle du jour, checklist, objectif, KPI, courbe d'équité |
| **Journal** | Enregistrer et retrouver ses trades, avec captures et tags |
| **Calendrier** | P&L quotidien en vue mensuelle |
| **Setups manqués** | Journal des occasions non prises et de la leçon associée |
| **Analytics** | Lecture quant : win rate, profit factor, drawdown, par symbole/jour/stratégie/session |
| **Erreurs** | Erreurs récurrentes chiffrées (occurrences + P&L net) |
| **Rapports** | Rapports mensuels générés (auto + à la demande) |
| **Saisonnalité** | Saisonnalité par instrument et par mois |
| **Checklist** | Rituel de discipline pré-market en 5 étapes, verrouillable |
| **Plan de trading** | Le plan écrit du trader (setups, risque, horaires) |
| **Objectifs** | Objectifs et plan de progression à 6 mois |
| **Calculateur** | Taille de position (futures, forex) |
| **Actualités éco** | Calendrier économique de la semaine |
| **Jarvis** | Centre de coaching : briefing, forces/faiblesses, conversation |
| **Réglages / Profil / Apparence / Abonnement** | Compte, préférences, thème, statut d'abonnement |
| **Landing** | Page publique de conversion (hors app) |

---

## 4. États — chargement, vide, erreur

### 4.1 Chargement

- **Skeletons contextuels** : `SkeletonForPage(page)` imite la **structure
  réelle** de la page cible (grille de graphiques, liste de trades, calendrier…)
  pendant le chargement du chunk. Jamais un spinner générique plein écran pour
  une navigation.
- Un spinner reste acceptable pour une action ponctuelle (envoi, génération).

### 4.2 Vide

Primitive `EmptyState` : icône + titre + description + **action**. Un état vide
doit être **pédagogique** : dire quoi faire ensuite, pas seulement constater
l'absence de données.

> Chantier ouvert : plusieurs états vides sont encore purement descriptifs
> ([`ROADMAP.md`](ROADMAP.md)).

### 4.3 Erreur

- **`PageErrorBoundary` par page** : une page qui plante ne fait pas tomber le
  shell ; l'utilisateur peut naviguer ailleurs.
- **Boundaries racine 404 / 500** (`ErrorScreen`) avec un ton rassurant
  (« tes données sont en sécurité ») et un bouton de reprise.
- **Jamais de stack trace visible.** Les erreurs SSR catastrophiques sont
  interceptées côté serveur et rendues en page HTML propre.
- Erreur d'action utilisateur → **toast** + rollback optimiste.

---

## 5. Formulaires et saisie

- **Primitives obligatoires** : `Field`, `Input`, `Textarea`, `Select` — la
  chaîne `FIELD_BASE` est canonique.
- **Hauteur de contrôle `h-11`** (44 px) : cible tactile confortable.
- **Brouillons persistés** : un trade en cours de saisie survit à une fermeture
  accidentelle (`tradeDraftKey`, `useHasTradeDraft`).
- **Confirmation destructive** : toute suppression passe par `ConfirmContext`
  (`confirm(message, { danger: true })`) — jamais de `window.confirm`, jamais de
  suppression sans confirmation.
- **Compression d'image côté client** avant upload des captures
  (`utils/image.ts`) — la saisie ne doit pas dépendre du réseau.

---

## 6. Notifications

Tout ce qui est dit à l'utilisateur passe par le **Notification Engine**
([`ARCHITECTURE.md` §5.5](ARCHITECTURE.md)). **Aucune page n'appelle `toast()`
pour un événement métier.**

| Canal | Usage | Persistance |
| --- | --- | --- |
| `toast` | Retour immédiat d'une action | Non |
| `dashboard` | Inbox (table `notifications`) | Oui |
| `push` | Hors de l'écran (règle enfreinte, rapport prêt) | Via l'abonnement |
| `email` | Cycle de vie, rapport mensuel | Oui |
| `ai_message` | Message proactif de Jarvis (⚪ prévu) | Oui |

**Règles de politesse :**

- **Anti-spam push** : un `dedupKey` limite à **un push par clé et par jour**
  (le toast et l'entrée d'inbox, eux, se déclenchent toujours). Une règle
  enfreinte trois fois dans la journée ne fait pas vibrer trois fois le
  téléphone.
- **Opt-in explicite** dans l'onboarding (étape dédiée, « Plus tard » toujours
  possible), réglable ensuite dans Réglages. **Pas de bannière de relance sur le
  Dashboard.**
- **Le succès est un signal** : une journée sans écart de discipline produit une
  notification positive (canal dashboard), pas un silence.
- **Rare et pertinent** — c'est la promesse faite à l'utilisateur pendant
  l'onboarding, elle engage le produit.

---

## 7. Voix

- **Optionnelle et jamais imposée** : la lecture vocale d'une réponse Jarvis est
  déclenchée par l'utilisateur (bouton haut-parleur), avec un stop immédiat.
- **Une seule voix** (Jarvis), **toujours en anglais**, alors que le texte écrit
  suit la langue de l'UI. C'est un choix d'identité assumé.
- **Dégradation silencieuse** : sans clé hébergée, la voix locale du navigateur
  prend le relais — l'utilisateur ne voit jamais d'erreur.
- **Le Markdown n'est jamais lu tel quel** : nettoyage des astérisques, titres,
  liens, emoji avant synthèse.
- Détail : [`JARVIS.md` §7](JARVIS.md).

---

## 8. Onboarding

**6 étapes**, bloquant au premier lancement, source de vérité
`profiles.onboarded_at` : **langue → bienvenue → profil → préférences →
notifications → démarrage**.

**Règles :**

- **Chaque question doit avoir un usage produit démontrable.** Le profil collecté
  est injecté dans chaque appel Jarvis et génère une checklist adaptative — on ne
  demande rien « pour la statistique ».
- **Le premier « wow » ne dépend jamais d'un fichier** : l'étape de démarrage
  offre import CSV **ou** trades de démo **ou** saisie manuelle. Les trades de
  démo sont badgés « Exemple » jusqu'à édition (`isExample`).
- **Skippable** : chaque étape optionnelle peut être passée
  (`onboarding_skipped`).
- **Non bloquant en cas d'erreur** : si la vérification d'onboarding échoue,
  l'app s'affiche quand même.
- **Chantier ouvert** : un écran « ton plan personnalisé » en fin d'onboarding,
  pour rendre visible le payoff du profil collecté ([`ROADMAP.md`](ROADMAP.md)).

---

## 9. Accessibilité

| Règle | État |
| --- | --- |
| Cibles tactiles ≥ 44 px | ✅ `h-11` sur les contrôles |
| Modales accessibles | ✅ `Modal` : `Esc`, scroll-lock, `role="dialog"`, `aria-modal`, panneau focusable |
| `prefers-reduced-motion` | ✅ Respecté (curseur lumineux, orbes) |
| Contrastes profit/loss/warning en dark | ✅ Tokens vérifiés |
| Plancher typographique | 🟡 Cible 11 px ; **19 occurrences résiduelles en 8–9 px** à migrer ([`DESIGN_SYSTEM.md` §5](DESIGN_SYSTEM.md)) |
| Micro autorisé, caméra/géoloc interdites | ✅ `Permissions-Policy` dans `vercel.json` |

---

## 10. Internationalisation

- **12 langues** dans l'application ; l'anglais est le jeu de clés source.
- **Aucune chaîne d'UI en dur** : tout passe par `useT()` → `t("ns.key")`.
- **Pas de détection automatique** de la locale navigateur : défaut anglais,
  changement sur choix explicite uniquement (persisté en `localStorage` + profil).
- La langue de l'UI **pilote la langue des réponses écrites de Jarvis**.
- ⚠️ **Exception non conforme** : `Landing.tsx` est en **français codé en dur**.
  À traiter ([`ROADMAP.md`](ROADMAP.md)).

---

## 11. Performance perçue

| Règle | Mise en œuvre |
| --- | --- |
| L'UI ne bloque jamais sur le réseau | Écritures optimistes + rollback |
| Le chunk initial reste léger | Toutes les pages sauf Dashboard en `lazy()` ; `EquityChart`, `AiAssistant`, `CommandPalette`, `ImportCsvModal`, `Onboarding` aussi ; dictionnaires i18n code-split |
| Les statistiques ne provoquent aucune requête | Calcul pur en mémoire, mémoïsé |
| La navigation paraît instantanée | Skeleton contextuel pendant le chargement du chunk |
| Le rail de navigation ne bouge jamais | Shell `h-dvh overflow-hidden`, seul `<main>` scrolle |
| Pas de flash blanc | Fond deep-navy posé sur `html` et `body` |

---

## 12. Checklist avant de livrer un écran

1. Navigation déclarée dans `navigation.ts` (jamais en dur).
2. `PageHeader` unique + primitives `shared/ui` uniquement.
3. Les trois états gérés : skeleton, `EmptyState` actionnable, boundary d'erreur.
4. Toutes les chaînes via `useT()`, clés ajoutées **au moins** en anglais.
5. Actions instantanées (optimiste + rollback) ; aucune attente réseau visible.
6. Cibles tactiles ≥ 44 px ; testé en largeur mobile réelle.
7. Aucun événement métier ne toaste directement — passer par le Notification
   Engine.
8. Aucune valeur brute : rôles typographiques, tokens sémantiques, échelle de
   densité.
