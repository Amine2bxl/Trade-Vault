# TradeVault — Audit pré-commercialisation

> Audit fondé sur le code réel (56 834 lignes TS/TSX, 9 routes, 23 pages, 35 composants,
> 64 modules, 17 fonctions serveur). Chaque constat est chiffré et traçable.
> Rien n'est supposé : ce qui n'a pas pu être vérifié est signalé comme tel.

---

## 0. Verdict en une page

TradeVault **n'est pas un produit brouillon**. La couche UI est saine : aucun composant, page
ou hook mort. Le moteur d'analyse est déterministe et testé. L'infrastructure IA est
architecturée avec un vrai sens du long terme (providers abstraits, circuit breaker, fallback).

Ce qui empêche aujourd'hui l'impression « premium » n'est pas un manque de fonctionnalités —
c'est **trois défauts structurels transverses**, présents sur *toutes* les pages :

| # | Défaut | Preuve chiffrée | Gravité |
|---|---|---|---|
| 1 | **L'app entière est une seule route** | 23 pages, 0 URL, 0 usage de l'History API | 🔴 Bloquant |
| 2 | **Typographie hors design system** | 470 tailles arbitraires, dont **34 en 8–9 px** | 🔴 Bloquant |
| 3 | **Accessibilité absente sur l'asynchrone** | `aria-live` : **0 occurrence** dans toute l'app | 🟠 Majeur |

Aucun des trois ne se corrige page par page. Ce sont des chantiers transverses — et c'est une
bonne nouvelle : **trois corrections relèvent le niveau des 23 pages d'un coup.**

---

## 1. Le défaut n°1 — l'application n'a pas d'URL

### Constat

Toute l'application authentifiée vit dans `routes/index.tsx` → `App.tsx`, qui pilote la
navigation avec un `useState<Page>` :

```tsx
const [page, setPage] = useState<Page>(() => {
  const saved = sessionStorage.getItem("tv.page");
  …
});
…
{page === "dashboard" && <Dashboard … />}
{page === "journal"   && <Journal   … />}
```

`grep` sur `pushState|replaceState|popstate` dans tout `app/` : **0 résultat.**

### Conséquences réelles

| Symptôme | Impact |
|---|---|
| Le bouton **retour** du navigateur ne revient pas à la page précédente | Sur Android, un retour **quitte l'application**. Sur iOS, le swipe-back sort du site. |
| Aucune page n'est **partageable ni marquable** | Un trader ne peut pas envoyer « regarde mes stats » ni mettre son journal en favori. |
| Aucune page n'est **traçable en analytics** | Impossible de mesurer quelle page retient. Objectif 8 (analytics, rétention) est **inatteignable en l'état**. |
| Rechargement → `sessionStorage` seulement | Perdu au changement d'onglet ; état non partagé entre onglets. |
| Duplication de la liste des pages | L'union `Page` (`app/types.ts`) **et** un tableau de chaînes en dur dans `App.tsx` — deux sources de vérité qui vont diverger. |

### Pourquoi c'est le défaut premium n°1

Aucun SaaS payant sérieux ne fait naviguer ses utilisateurs sans URL. C'est le genre de détail
que l'utilisateur ne sait pas nommer mais ressent immédiatement : « ça fait appli bricolée ».
Et surtout : **il bloque la mesure**, donc toute la boucle d'amélioration produit.

### Correction proposée

Migrer vers des routes fichiers TanStack Router (`/dashboard`, `/journal`, `/analytics`…).
Le travail est **mécanique, pas risqué** : chaque `{page === "x" && <X/>}` devient une route.
Le canal `tv:navigate` existant est conservé — il pilote `router.navigate` au lieu de `setPage`.
Bénéfice secondaire : code-splitting par route gratuit (aujourd'hui un seul `lazy()` manuel).

---

## 2. Le défaut n°2 — la typographie contredit le positionnement premium

### Constat chiffré

| Taille | Occurrences | Verdict |
|---|---|---|
| `text-[8px]` | 9 | ❌ illisible |
| `text-[9px]` | 25 | ❌ illisible |
| `text-[10px]` | **209** | ⚠️ sous le seuil confortable mobile |
| `text-[11px]` | **174** | ⚠️ limite |
| `text-[12px]` / `13px` / `15px` / `28px` | 53 | incohérent |
| **Total tailles arbitraires** | **470** | — |

**34 occurrences de texte à 8–9 pixels.** C'est plus petit que les mentions légales d'un contrat
d'assurance. Sur un écran de téléphone, ce texte n'est pas « petit » : il est **non lisible** pour
une partie des utilisateurs, et disqualifiant pour un produit vendu comme premium.

À cela s'ajoutent **~105 couleurs hexadécimales écrites en dur** dans le JSX (`#ef4444` ×18,
`#475569` ×17, `#10b981` ×11…), au lieu de tokens sémantiques. Conséquence : impossible de
changer le thème, d'ajuster un contraste ou de décliner une identité sans une passe manuelle
sur 105 points.

### Correction proposée

Une **échelle typographique de 6 crans** (`xs` 12 · `sm` 13 · `base` 14 · `lg` 16 · `xl` 20 · `2xl` 28),
plancher absolu à **12 px**, et des tokens de couleur sémantiques (`--tv-danger`, `--tv-success`,
`--tv-muted`). Migration mécanique et vérifiable par un test de lint interdisant `text-[…px]`.

> ⚠️ **Zone de tension assumée** : tu as délibérément fixé les champs à `h-9` (36 px) sur mobile.
> Je ne la touche pas — c'est ton choix produit. Mais je signale que 36 px reste sous le seuil
> tactile de 44 px, et que le sujet reviendra en test utilisateur.

---

## 3. Le défaut n°3 — accessibilité de l'asynchrone

| Mesure | Valeur | Commentaire |
|---|---|---|
| `aria-label` | 75 | correct |
| `aria-live` | **0** | ❌ **aucune région live dans toute l'application** |
| `role=` | 9 | faible |
| `alt=` | 10 | à vérifier page par page |

Zéro `aria-live` signifie qu'**aucun contenu asynchrone n'est annoncé** : ni les toasts, ni le
chargement des trades, ni les réponses de Jarvis. Pour un lecteur d'écran, une réponse de l'IA
n'existe tout simplement pas. C'est aussi un risque juridique croissant (accessibilité numérique).

---

## 4. Cohérence responsive

| Breakpoint | Occurrences |
|---|---|
| `sm:` (640 px) | 73 |
| `md:` (768 px) | **464** |
| `lg:` (1024 px) | 50 |
| `xl:` | 3 |

La stratégie est **binaire** : mobile → desktop à 768 px, avec presque rien entre les deux.
La bande 640–768 px (grands téléphones en paysage, petites tablettes) n'est quasiment pas traitée.

Pages à ≤ 2 breakpoints — **à vérifier visuellement, pas nécessairement défaillantes** :
`ChecklistWizard` (0), `Inbox` (0), `Jarvis` (1), `Appearance`, `EconomicNews`, `Goals`,
`Profile`, `Settings` (2 chacune).

> Honnêteté méthodologique : un faible nombre de breakpoints n'est pas *en soi* un bug — une
> page simple empilée verticalement peut être parfaite. Ce tableau est une **liste de contrôle
> visuel**, pas un verdict. Je n'ai pas pu exécuter l'application ici (pas de captures possibles).

---

## 5. Dette technique — ce qui est sain, ce qui ne l'est pas

### ✅ Sain

- **Aucun composant, page ou hook mort** — vérifié par analyse des imports sur `app/components`,
  `app/pages`, `app/hooks`.
- Abstraction provider IA propre (swap de modèle = 1 variable d'env).
- Moteurs de calcul déterministes et testés (183 tests).

### ❌ Code mort — concentré dans la couche IA

| Élément | Preuve |
|---|---|
| `buildAIUserContext` | **0 appelant** |
| `buildCoachContext` | **0 appelant** |
| `loadMemory` | appelé **uniquement** par `buildAIUserContext` (mort) → mort par transitivité |
| `forget()` | **0 appelant** — aucun mécanisme d'oubli n'existe |
| Charge mémoire 40 × 2 000 caractères (**≈ 20 000 tokens**) | dans `buildAIUserContext` — **bombe latente** si quelqu'un le ranime |
| `detectIntent` | **dupliqué** : `fallback-coach.ts` et `answerToBlocks.ts` |
| Double calcul `computeBehaviorSignals` / `computeStats` | exécutés dans les memos **et** dans `buildCoachV1Payload` |

### 🟠 Fichiers hypertrophiés

| Fichier | Lignes |
|---|---|
| `Checklist.tsx` | **2 244** |
| `Landing.tsx` | 1 490 |
| `TradeModal.tsx` | 1 171 |
| `Analytics.tsx` | 1 133 |
| `AccountSwitcher.tsx` | 811 |

`Checklist.tsx` à 2 244 lignes est le prochain point de douleur : toute évolution y devient
coûteuse et risquée.

---

## 6. Jarvis — état réel (Objectif 7)

**Correction d'un diagnostic antérieur : la mémoire de Jarvis n'est pas « à 80 % », elle est à ~0 %.**

| Brique | État |
|---|---|
| Table `ai_memory` (4 kinds, RLS complète) | ✅ **déployée en production** |
| `memory.ts` (`loadMemory`/`remember`/`forget`) | ✅ écrit, ❌ **non branché** |
| `context-builder.withMemory()` | ✅ **le point d'injection existe déjà** |
| Migration `_pending_ai_os_foundation.sql` | ⏸️ **écrite, jamais appliquée** — `ai_embeddings`, `ai_jobs`, `ai_agent_runs` |
| `telemetry.ts` | ⚠️ **types seuls** — « no writer yet » |
| `runtime/metrics.ts` | ✅ branché, ❌ **en mémoire, perdu à chaque cold start** |
| Page `/dev/ai` | ✅ **existe** (statut providers + sonde) |
| Streaming | ❌ **0 occurrence** dans tout le dépôt |

Ce qui atteint réellement le LLM aujourd'hui : une **ligne** de profil issue de l'onboarding.
La table mémoire est écrite une fois, puis **jamais relue**.

**Conséquence pour la V1 : il ne faut rien réécrire.** Tout le tuyau existe — il n'est pas raccordé.

---

## 7. Le moat (Objectif 4) — l'analyse honnête

Le code est copiable. Le design est copiable. Les calculs sont copiables.
**Trois choses ne le sont pas :**

### 7.1 La mémoire longitudinale du trader
Un concurrent qui copie le dépôt démarre avec une base vide. Un trader qui utilise TradeVault
depuis 8 mois a un historique comportemental que personne ne peut répliquer. **C'est le seul
moat qui se renforce tout seul avec le temps** — et c'est précisément la brique aujourd'hui
non branchée. C'est, de loin, la priorité produit n°1.

### 7.2 La boucle d'engagement mesurée
Jarvis propose une règle → le trader l'accepte → le système **mesure si elle a été tenue** →
Jarvis revient dessus. Cette boucle transforme un chatbot en coach. Elle nécessite la mémoire
(§7.1) + la télémétrie (§6). Les deux existent à l'état de pièces détachées.

### 7.3 Les modèles de détection calibrés sur données réelles
`behaviorSignals` est déjà un actif différenciant. Sa valeur croît avec le corpus agrégé
(anonymisé) : des seuils calibrés sur 10 000 traders réels ne se copient pas depuis GitHub.

> **Ce qui n'est PAS un moat**, malgré les apparences : l'intégration LLM (tout le monde a la
> même API), le design (copiable en une semaine), les calculs de stats (formules publiques).
> Investir le moat là serait une erreur d'allocation.

---

## 8. Ce que cet audit ne couvre PAS — et pourquoi

Par honnêteté, voici les limites de ce document :

- **Aucune capture d'écran.** L'application n'est pas exécutable dans cet environnement.
  Toutes les analyses UI sont issues de la **lecture du code**, jamais de l'observation.
- **Analyse page par page (Objectifs 1 & 2) non incluse ici.** Elle demande de lire les
  23 pages en profondeur : c'est un livrable à part entière, pas une section.
- **Aucune mesure de performance réelle** (Lighthouse, LCP, taille de bundle) : non exécutable ici.
- **SEO, paiements, emails, juridique** (Objectif 8) : non audités à ce stade.
- **Documentation produit complète** (Objectif 6) : à produire ensuite.

---

## 9. Roadmap priorisée

Ordre choisi selon **impact premium ÷ risque**, pas selon l'ordre des objectifs.

### Lot 0 — Rendre le produit mesurable *(prérequis absolu)*
Appliquer la migration pendante · brancher le `TelemetryRecorder` (les types attendent) ·
étendre `/dev/ai`. **Sans mesure, aucun lot suivant n'est vérifiable** — et la question du budget
de thinking, restée en suspens, se tranche enfin par la donnée.

### Lot 1 — Les URLs
Migration vers des routes réelles. Débloque : navigation, partage, analytics, code-splitting.
**Le plus gros gain de perception premium par unité d'effort.**

### Lot 2 — Le design system
Échelle typographique, plancher 12 px, tokens de couleur, lint bloquant. Relève les 23 pages
simultanément.

### Lot 3 — La mémoire de Jarvis
Brancher ce qui existe + migration additive (dédup par clé, TTL, budget de tokens dur).
**C'est le moat.** Placé après le Lot 0 pour être mesurable.

### Lot 4 — Accessibilité
`aria-live` sur l'asynchrone, revue des boutons-icônes, contrastes.

### Lot 5 — Nettoyage
Supprimer le code mort IA · dédupliquer `detectIntent` et la liste des pages · découper
`Checklist.tsx`.

### Lot 6 — Streaming
En dernier : le plus risqué (nouveau transport HTTP, `createServerFn` incapable de SSE,
ré-implémentation de `requireProAccess`). Bénéficie de la télémétrie du Lot 0 pour être validé.

---

## 10. Décisions requises avant implémentation

1. **Valides-tu cet ordre** (mesure → URLs → design system → mémoire), qui diffère de l'ordre
   des objectifs ?
2. **Une PR par lot** (recommandé : relisable, réversible) ou regroupées ?
3. **Analyse page par page** : je la produis maintenant en document séparé, ou après les
   premiers lots ?
4. **Le `thinkingConfig` de la PR #143** : sortir ou garder ? *(Le Lot 0 permettrait de trancher
   par la mesure.)*
