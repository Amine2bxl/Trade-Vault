---
name: ux-navigation
description: Règles UX et navigation de TradeVault — source unique `navigation.ts`, groupes par déroulé de session, structure d'une page, états chargement/vide/erreur, formulaires optimistes, notifications, accessibilité, scrollspy et ancres de la landing. À charger avant d'ajouter ou déplacer une page, une entrée de menu, un onglet, une ancre, un état d'écran ou un formulaire. Se déclenche sur : navigation, menu, sidebar, onglet, route, page, parcours, UX, état vide, chargement, erreur, formulaire, accessibilité, ancre, scrollspy.
---

# UX & navigation — un seul chemin par intention

## Source unique

`src/app/navigation.ts` alimente **Sidebar + MobileNav + palette ⌘K**. On
n'ajoute jamais une destination dans une seule des trois surfaces : on l'ajoute
là, et les trois suivent.

Les groupes suivent **le déroulé d'une session de trading**, pas une taxonomie :

```
Accueil      → Dashboard
Préparation  → Plan · Objectifs · Actualités éco · Calculateur · Checklist
Journal      → Calendrier · Journal · Setups manqués
Analyse      → Analytics · Erreurs · Rapports · Saisonnalité
Jarvis       → Jarvis
Compte       → Réglages · Profil · Apparence · Abonnement
```

Une nouvelle page doit répondre à **« à quel moment de la journée du trader ? »**.
Si la réponse est « n'importe quand », c'est probablement un bloc d'une page
existante, pas une page.

> Dette ouverte : 18 destinations subsistent ; la cible est la fusion
> Réglages / Discipline / Outils. Ajouter une 19ᵉ destination demande une
> justification explicite.

## Structure d'une page

```
PageContainer
  PageHeader   → titre · sous-titre · (icône) · actions à droite
  [ SubNav / SectionTabs si la page a des sous-vues ]
  Contenu      → la réponse à la question de la page, en premier écran
```

**Le rôle d'une page tient en une phrase.** Si on n'arrive pas à l'écrire, la
page n'est pas prête. Le premier écran affiche la réponse, pas les filtres.

Pages publiques (`/privacy`, `/terms`, `/cgu`, `/contact`) : rendues **hors de
l'arbre applicatif**, en SSR complet, et déclarées dans `PUBLIC_ROUTES`
(`src/server.ts`) pour entrer dans `robots.txt` / `sitemap.xml`.

## Les trois états, toujours

| État | Règle |
| --- | --- |
| **Chargement** | Skeleton **à la hauteur finale exacte** — rien ne saute quand la donnée arrive. Jamais de spinner plein écran sur une page déjà structurée. |
| **Vide** | `EmptyState` : ce qui manque, pourquoi, **et l'action qui remplit**. Un vide sans action est un cul-de-sac. |
| **Erreur** | `PageErrorBoundary` par page : ce qui a échoué, ce que l'utilisateur peut faire, un moyen de réessayer. Jamais une trace technique. |

## Formulaires et écritures

- **L'UI n'attend jamais le réseau.** Écriture optimiste + rollback (patron du
  `TradeModal`). Le trader voit son trade avant que Supabase réponde.
- La validation se dit **au moment utile**, pas à chaque frappe : au blur, ou
  à la soumission.
- Un message d'erreur nomme le champ et l'action corrective.
- Toute chaîne passe par `t(...)` / le dictionnaire de la landing. **Jamais**
  de `fr ? … : …` dans un composant.

## Navigation de la landing

- Ancres réelles uniquement. Un lien du pied de page est une **promesse de
  contenu** : on n'annonce pas une page qui n'existe pas (13 liens morts ont
  été supprimés pour cette raison — ne pas les réintroduire).
- Scrollspy : verrou de 1 s après un clic (`scrollLockRef`) pour que la section
  cliquée reste active pendant le défilement fluide.
- Le logo pointe sur `/`, jamais sur `#`.
- Les deux langues ont chacune **une adresse** : `/` (en) et `/fr`. Changer de
  langue **navigue** (rechargement complet) au lieu de basculer un état : le
  document servi — titre, description, canonical, `hreflang`, `<html lang>` —
  doit changer avec.

## Notifications

| Canal | Usage | Persiste |
| --- | --- | --- |
| `toast` | retour immédiat d'une action | non |
| `dashboard` | Inbox (table `notifications`) | oui |
| `push` | hors de l'écran (règle enfreinte, rapport prêt) | via l'abonnement |
| `email` | cycle de vie, rapport mensuel | oui |

Anti-spam par `dedupKey` : une push par clé et par jour. Sévérité `error` ouvre
le détail automatiquement. Le câblage domaine se fait **en un seul endroit**
(`modules/notifications/rules.ts`).

## Accessibilité — le socle acquis

- Cibles tactiles ≥ 44px (`h-11` sur les contrôles).
- `Modal` : `Esc`, scroll-lock, `role="dialog"`, `aria-modal`, panneau focusable.
- Focus visible partout : `outline: 2px solid rgb(var(--tv-accent-rgb)/.7)`,
  `outline-offset: 2px`. **Ne jamais retirer un outline sans le remplacer.**
- `prefers-reduced-motion` respecté (voir skill `motion`).
- Un accordéon porte `aria-expanded` ; un onglet, `role="tab"` + `aria-selected`.
- Le contenu doit rester lisible sans JavaScript.

## Performance perçue

- Toutes les pages sauf le Dashboard en `lazy()` ; idem `EquityChart`,
  `AiAssistant`, `CommandPalette`, `ImportCsvModal`, `Onboarding`.
- Les statistiques ne déclenchent **aucune requête** : calcul pur, mémoïsé.
- Le rail de navigation ne bouge jamais : coque `h-dvh overflow-hidden`, seul
  `<main>` défile.
- Sur la landing : le héros reste eager, les sections sous la ligne de
  flottaison sont candidates au lazy.

## Checklist

- [ ] La destination est déclarée dans `navigation.ts` (une seule fois).
- [ ] Le rôle de la page tient en une phrase.
- [ ] Chargement / vide / erreur sont écrits, pas supposés.
- [ ] L'écriture est optimiste ; aucun écran ne bloque sur le réseau.
- [ ] Aucune chaîne codée en dur hors dictionnaire.
- [ ] Focus, `Esc`, cibles tactiles, `aria-*` vérifiés.
- [ ] Aucun lien mort, aucune ancre inexistante.
