# Documentation TradeVault

> **Point d'entrée de la doc.** Cette page dit **quel document lire, pour quoi, et
> dans quel ordre**. Chaque doc a un rôle unique : pas de doublon, chacun renvoie
> aux autres pour ce qui sort de son périmètre.
>
> **Hiérarchie d'autorité** (en cas de conflit) :
> [`CLAUDE.md`](../CLAUDE.md) (charte, prime sur tout) →
> [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) (mémoire permanente) → le reste.

---

## Par où commencer

1. **[`../CLAUDE.md`](../CLAUDE.md)** — la charte de l'équipe (5 min). Axes de
   décision, garde-fous, go/no-go. **Prime sur toute habitude par défaut.**
2. **[`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)** — la mémoire permanente du
   projet (10 min). Comprendre TradeVault **sans aucun historique** : vision,
   stack, structure, conventions, ce qui est livré / prévu. **À lire en second.**
3. Ensuite, selon ta tâche, le tableau ci-dessous.

---

## Carte des documents

| Document | Rôle — répond à | Quand l'ouvrir |
|---|---|---|
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | **Mémoire permanente** : synthèse + pointeurs vers tout le reste | Toujours, en premier |
| [`PRODUCT.md`](PRODUCT.md) | **Produit** : pourquoi / pour qui / quoi / combien (vision, ICP, valeur, concurrents, pricing) | Décision produit, positionnement, tarifs |
| [`ROADMAP.md`](ROADMAP.md) | **Exécution** : source de vérité unique des priorités P0→P3, séquencement en lots | « Quoi faire ensuite », arbitrages |
| [`FEATURES_STATUS.md`](FEATURES_STATUS.md) | **État vivant** des fonctionnalités (✅ / 🟡 / ⚪) — vue statut des items de la ROADMAP | Savoir ce qui est fait / en cours |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | **Code** : structure du dépôt, couches, flux de données, conventions (onboarding dev < 30 min) | Toucher au code |
| [`AI.md`](AI.md) | **Stratégie IA** 24 mois : pourquoi / quoi / garde-fous / dans quel ordre | Vision & roadmap IA |
| [`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md) | **Contrats IA** : blueprint technique de l'AI Platform (8 sous-systèmes, tables, flux) | Construire une brique IA |
| [`agents/ai-coach.md`](agents/ai-coach.md) | **Spec de l'agent Coach (Jarvis)** : contexte, mémoire, outils, garde-fous | Travailler sur Jarvis |
| [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | **Design** : diagnostic de l'UI + plan de migration non destructif (tokens, primitives) | Toucher au style / DS |
| [`ux-architecture.md`](ux-architecture.md) | **UX** : principes structurants (mobile-first, optimistic UI, états gérés) | Décision d'expérience |

---

## Comment les documents se répartissent le travail (zéro doublon)

- **Produit vs exécution** : `PRODUCT.md` = *pourquoi/pour qui/quoi/combien* ;
  `ROADMAP.md` = *comment/quand* (P0→P3). Les priorités ne vivent **que** dans la
  ROADMAP ; les autres docs y renvoient.
- **Roadmap vs statut** : `ROADMAP.md` = la **liste priorisée** unique (#1–#29) ;
  `FEATURES_STATUS.md` = la **vue statut** de ces mêmes items (fait / en cours /
  prévu). Une seule numérotation, deux angles.
- **IA — stratégie vs contrats** : `AI.md` = *pourquoi/quand* ;
  `AI-ARCHITECTURE.md` = *comment c'est construit* ; `agents/ai-coach.md` = le
  premier agent en détail.
- **UI — analyse vs principes** : `DESIGN-SYSTEM.md` = le système visuel ;
  `ux-architecture.md` = les principes d'expérience.

> **Maintenance.** À chaque livraison structurante, mettre à jour le document
> concerné **et** dater son en-tête. Une doc périmée est pire qu'absente.
