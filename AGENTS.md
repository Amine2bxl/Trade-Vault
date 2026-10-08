# AGENTS.md

Instructions pour tout agent IA (et tout contributeur) sur TradeVault — journal
de trading et espace de performance, avec Jarvis comme coach IA. React 19 +
TanStack Start/Router (SSR via Nitro, Vercel), Tailwind v4, Supabase
(REST + RLS), Recharts, Bun.

**Commencer par [`docs/README.md`](docs/README.md)** (carte de la doc et « où
modifier quoi »), puis [`docs/FEATURES.md`](docs/FEATURES.md) pour localiser une
feature. Architecture et règles de placement : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Où intervenir

- Écran de l'app connectée → `src/app/features/<feature>/`
- Cadre, navigation, ⌘K → `src/app/shell/` ; liste des écrans : `PAGES` /
  `SECTIONS` dans `src/app/types.ts`
- Landing et pages publiques → `src/app/public/`
- Code trading partagé côté client → `src/app/trading/`
- Calcul pur (partagé avec le serveur) → `src/domain/`
- Moteurs (discipline, motifs, Monte Carlo, notifications, IA…) → `src/modules/`
- Serveur, crons, paiement → `src/backend/` + `src/server.ts`
- Schéma → `supabase/migrations/` (additif)

Nouveau fichier : le placer selon `docs/ARCHITECTURE.md` §7. Supprimer un
fichier : uniquement avec la preuve qu'il n'est ni importé (statique,
dynamique, `lazyPage`, `import.meta.glob`) ni lu en chaîne par un test, un
script ou la config.

## Commandes et portes

`bun install` · `bun run dev` (:8080) · `bun run preview` (:4173) ·
`bun run typecheck` · `bun run lint` · `bun run build` · `bun test`.
**Avant tout push : typecheck → lint → build → test**, tous verts. La CI relance
les tests sous `TZ=America/New_York` et `TZ=Pacific/Auckland` : pour une date
métier, `todayLocalDate()` / `localDateOf()` (`src/shared/calendar-date.ts`),
jamais `toISOString().slice(0, 10)`. Détail : [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

Plusieurs tests **lisent les sources** (chemins et contenus) : lancer toute la
suite ; ne jamais affaiblir une assertion pour passer.

## Règles non négociables

- **Chiffres** : calculés par les moteurs déterministes (`domain/`, `modules/`) ;
  Jarvis ne fait que les formuler. Toute statistique affiche son `n` ; aucune
  formulation causale ; aucun chiffre sous l'échantillon minimum.
- **Jarvis n'écrit rien directement** : outils en lecture seule ; seule voie
  d'écriture = une proposition acceptée par le trader. Voir [`docs/AI.md`](docs/AI.md).
- **Données** : RLS owner-only, secrets uniquement côté serveur, migrations
  additives. L'app de dev parle à la base Supabase **réelle** : jamais de SQL
  destructif ; comptes de test `tv*@test.dev` supprimés après usage.
- **i18n** : trois systèmes à ne pas mélanger (app `useT()`, landing
  `useLandingT()`, `SSR_LANG`). Anglais par défaut, changement de langue
  uniquement par choix explicite. Toute clé ajoutée dans `translations.ts` et
  `fr`. Aucune chaîne visible codée en dur.
- **Design** : thème par défaut **`lucid`** (accent menthe `#31d68a`, le vert
  relevé sur Lucid) ; l'app connectée écrit dans la pile système de Lucid
  (`--font-lucid`), la vitrine garde Inter ; le
  `:root` de `src/styles.css` reste identique au thème par défaut. Rien ne
  rayonne (ni ombre, ni halo, ni dégradé, ni `animate-ping`) ; le P&L garde ses
  couleurs fixes. Primitives `src/shared/ui`. Charger les skills de
  `.claude/skills/` avant tout travail d'interface. Voir [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).
- **Honnêteté** : jamais de promesse de gain, de faux avis, de chiffre ou de
  logo inventé. Voir [`docs/PRODUCT.md`](docs/PRODUCT.md).
- **Surface publique** : toute route indexable dans `PUBLIC_ROUTES`
  (`src/server.ts`) ; jamais de `public/robots.txt` ni `public/sitemap.xml`.
  Voir [`docs/SEO.md`](docs/SEO.md).
- **Généré** : `src/routeTree.gen.ts` (committer après `bun run build`) et
  `src/integrations/supabase/types.ts` ne s'éditent pas à la main.

## Manière de travailler

- Une feature ne se construit que si elle sert au moins un de : conversion,
  rétention, valeur perçue, différenciation, réduction du churn, productivité
  du trader.
- Avant d'implémenter : raisonner (produit + architecture), choisir, dire les
  risques. Après : résumer, vérifier que rien n'est cassé, ni performance
  (pas de N+1, UI optimiste), ni sécurité (RLS, validation, secrets).
- Étendre par plug-in (événement, listener, step, outil, provider) plutôt que
  modifier un moteur existant. Une seule source de vérité par information :
  réutiliser avant de recréer.
- Commentaires en **français** ; commits descriptifs en français ; travail sur
  branche, PR, CI verte.
- Mettre à jour le document propriétaire du sujet dans `docs/` quand un
  changement le rend faux. Ne pas créer de nouveau document sans nécessité.
- Réponses concises : aller au fait, recommander plutôt qu'énumérer.
