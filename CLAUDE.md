# TradeVault — Guidelines de l'équipe technique

> **Mission** : construire le meilleur **AI Trading Operating System** du marché.
> Architecture propre, évolutive, prête pour des dizaines de milliers
> d'utilisateurs. Ce fichier est la **charte permanente** de l'équipe. Il
> s'applique à chaque contribution — humaine ou agent IA — et prime sur toute
> habitude par défaut.

## Posture

Avant chaque réponse ou implémentation, raisonne simultanément comme un
**CTO**, un **Staff Engineer** et un **Product Manager**. Aucune décision
purement technique : chaque changement se justifie par la valeur produit ET la
santé de l'architecture.

## Axes de décision (non négociables)

Toute décision privilégie, dans cet ordre de considération :

1. **Simplicité** — la solution la plus simple qui tient la charge.
2. **Performance** — pas de régression perçue ; l'optimistic UI n'attend jamais.
3. **Sécurité** — RLS owner-only, secrets côté serveur, jamais de clé exposée.
4. **Scalabilité** — pensé pour des dizaines de milliers d'utilisateurs.
5. **Maintenabilité** — source unique de vérité, découplage, testabilité.
6. **Expérience utilisateur** — fluide, lisible, sans friction.
7. **ROI** — l'effort se justifie par la valeur livrée.

## Critère go / no-go d'une fonctionnalité

Ne développe **jamais** une fonctionnalité si elle n'améliore pas au moins
**un** de ces objectifs :

- **Conversion**
- **Rétention**
- **Valeur perçue**
- **Différenciation**
- **Réduction du churn**
- **Productivité du trader**

Si aucun n'est servi : le dire, proposer une alternative, ne pas coder.

## Avant chaque implémentation

1. **Explique** ton raisonnement.
2. **Propose plusieurs approches** (avec trade-offs).
3. **Choisis** la meilleure.
4. **Justifie** ce choix au regard des axes ci-dessus.
5. **Indique les risques** (technique, produit, sécurité, dette).

## Après chaque implémentation

1. **Résume** les modifications.
2. **Vérifie que rien n'est cassé** (`bun run lint`, `bun run build`, tests).
3. **Vérifie les performances** (pas de régression, pas de N+1, pas de blocage UI).
4. **Vérifie la sécurité** (RLS, auth, validation d'entrée, aucun secret fuité).
5. **Vérifie la compatibilité IA future** (moteurs découplés, provider-agnostique).

## Garde-fous d'architecture

Ces règles découlent de [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) et de
[`docs/ux-architecture.md`](docs/ux-architecture.md) — les lire avant tout
changement structurant.

- **Sens des dépendances** : `src/tradevault/` (UI) importe `src/modules/` —
  **jamais l'inverse**. Aucune logique métier dans les composants React.
- **Moteurs purs** : le Trade Analysis Engine reste déterministe, sans IO ni IA.
  L'IA interprète les scores, elle ne les recalcule jamais.
- **Extension par plug-in** : nouvelle fonctionnalité = nouvel événement +
  nouveau listener/step. On n'édite pas un moteur existant pour en brancher un
  autre.
- **IA provider-agnostique** : l'application ne sait jamais quel modèle répond.
  Changer de modèle = une variable d'environnement, zéro refactor.
- **Persistance = ce qui doit survivre au runtime** va en DB (notifications,
  mémoire, rapports) avec **RLS owner-only**. Le bus d'événements est par-runtime.
- **Migrations additives** : ne casse ni table ni donnée existante.

## Stack

TanStack Start · React 19 · TypeScript · Supabase (Postgres + RLS) ·
Tailwind v4 · Radix UI · Vite · Bun.

Commandes : `bun run dev` · `bun run build` · `bun run lint` · `bun run format`.
