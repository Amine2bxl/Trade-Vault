---
name: ship-ui
description: Mode « designer produit » de TradeVault — l'orchestrateur qui enchaîne les skills de design (theme, typography, ui-design, motion, ux-navigation, landing-copy) et impose le rituel avant/après implémentation, jusqu'aux portes CI. À charger au DÉBUT de toute tâche d'interface un peu large : refonte, nouvelle page, nouvelle section, redesign, « rends ça plus beau », « améliore l'UX », travail sur la landing. Se déclenche sur : refonte, redesign, nouvelle page, nouvelle section, améliore le design, rends ça beau, UI/UX, landing, look, finition, polish.
---

# Ship UI — le rituel

Cette skill ne contient **aucune** règle de design. Elle dit dans quel ordre
charger celles qui en contiennent, et ce qu'on vérifie avant de dire « c'est
livré ».

## Les six lois

| Skill | Ce qu'elle tranche | On la charge quand… |
| --- | --- | --- |
| `theme` | couleur, fond, plaque, liseré, accent, sémantique P&L | on écrit une couleur |
| `typography` | famille, échelle, chiffres, libellés, titrage | on écrit du texte |
| `ui-design` | primitives, surfaces, densité, anatomie, responsive | on assemble des éléments |
| `motion` | keyframes, durées, easing, reduced-motion, perf | quelque chose bouge |
| `ux-navigation` | navigation, structure de page, états, a11y | on ajoute/déplace un écran |
| `landing-copy` | positionnement, copy, conversion, honnêteté | on écrit pour la vitrine |

Une tâche d'interface sérieuse en charge **au moins trois**.

## Avant d'écrire une ligne

1. **Lire ce qui existe.** Le composant voisin, le CSS qui le porte, le
   dictionnaire qui l'alimente. Presque tout a déjà un patron dans ce repo ; le
   travail consiste le plus souvent à l'étendre, pas à en inventer un.
2. **Dire le problème en une phrase.** « Le héros promet une courbe qui monte
   alors que le produit vend la discipline » est un problème. « Moderniser le
   design » n'en est pas un.
3. **Vérifier la vérité produit.** `docs/product/FEATURES_STATUS.md` avant de
   promettre quoi que ce soit ; `docs/POSITIONNEMENT.md` avant de choisir un
   angle.
4. **Proposer, puis trancher.** Deux ou trois approches avec leurs compromis,
   une recommandation, les risques. En quelques lignes — pas un rapport.
5. **Vérifier le go/no-go** (`docs/CLAUDE.md`) : le changement sert-il la
   conversion, la rétention, la valeur perçue, la différenciation, la réduction
   du churn ou la productivité du trader ? Sinon : le dire, et ne pas coder.

## Pendant

- Commentaires **en français**, et ils expliquent le **pourquoi**, pas le quoi.
  Le repo documente ses décisions dans le code — c'est sa mémoire.
- Toute chaîne visible passe par un dictionnaire (`t(...)` / `landing/i18n.tsx`).
- Sens des dépendances : `src/app/` importe `src/modules/` et `src/shared/`,
  jamais l'inverse. `shared/ui` n'importe jamais `app/`.
- On étend le système. Une valeur qui ne rentre dans aucune échelle est le
  signe qu'on a pris le mauvais chemin.
- Pas de dépendance nouvelle sans nécessité. **Jamais** de Framer Motion, de
  Radix, de shadcn runtime.

## Après — les portes, dans cet ordre

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint . — lent sur ce repo (peut dépasser 5 min)
bun run build       # vite build
bun test            # ~1060 tests, ~1s
```

Les quatre doivent être vertes avant de pousser. Deux pièges connus :

- **Des tests lisent les sources et vérifient leur contenu** :
  `tests/publicSurface.test.ts` (SEO, langue, robots), `tests/staticCards.test.ts`,
  `tests/themeCoverage.test.ts`, `tests/envExample.test.ts`. Changer une
  constante ou une chaîne peut les casser. Lancer la suite **complète**.
- **La CI rejoue les tests sous `TZ=America/New_York` et `TZ=Pacific/Auckland`**.
  Les bugs de bord de journée n'apparaissent que là :
  `TZ=America/New_York bun test`.

Vérification visuelle : `bun run dev` → http://localhost:8080, ou
`bun run preview` → :4173 pour un rendu SSR proche de la production.

## Le compte rendu

Après implémentation, en quelques lignes :

1. Ce qui a changé, et **pourquoi** (le problème résolu, pas la liste des
   fichiers).
2. L'état des quatre portes.
3. Les risques et la dette assumée.
4. Ce qui reste ouvert.

Pas de préambule, pas de récapitulatif de la demande, pas d'options écartées.

## Git

Branche `claude/<sujet>` → PR en draft vers `main`. Commits descriptifs en
français. `main` déploie sur Vercel : rien n'y arrive sans les quatre portes.

## Ce qu'on ne fait pas

- Un « big bang » visuel. Les migrations se font **par lots**, chacun avec un
  build vert et une vérification visuelle.
- Changer un comportement produit dans un lot présenté comme visuel.
- Toucher à la zone gelée Trustpilot (`#00b67a`).
- Livrer une interface dont les états vide/chargement/erreur n'ont pas été
  écrits.
