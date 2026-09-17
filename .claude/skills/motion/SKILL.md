---
name: motion
description: Loi du mouvement de TradeVault — 8 keyframes autorisées, easings et durées, cap à 300 ms dans l'app, reveal au scroll de la landing, `prefers-reduced-motion`, performance (transform/opacity uniquement). À charger avant d'ajouter une animation, une transition, un hover, une apparition, un keyframe ou un effet de scroll. Se déclenche sur : animation, transition, motion, hover, apparition, reveal, scroll, keyframe, easing, durée, fluide, effet.
---

# Motion — peu de gestes, toujours les mêmes

> La sensation de finition vient d'animations **rares et répétées**, pas
> nombreuses. Le produit en comptait 37 ; la cible est 8.

## Les 8 keyframes autorisées

| Nom | Usage |
| --- | --- |
| `fade-in` | opacité seule |
| `fade-in-up` | opacité + `translateY(6px)` — **la** seule entrée |
| `scale-in` | `scale(.97) → 1` + opacité — modale, popover |
| `slide-in-right` | tiroir, panneau mobile |
| `shimmer` | skeleton |
| `spin` | loader |
| `pulse` | indicateur live / enregistrement |
| `draw` | tracé d'une courbe (`stroke-dashoffset`) |

Toute autre animation se remappe sur celles-ci. **Aucune animation
décorative** dans l'app : pas d'orbe, pas de `float`, pas de `shine`, pas de
`scan`, pas de `glow`. La landing a droit à **deux** effets d'ambiance maximum
— aujourd'hui : le tracé de la courbe du héros et le reveal au scroll.

## Durées et easings

```css
--tv-ease:      cubic-bezier(0.16, 1, 0.3, 1);   /* l'easing signature */
--tv-ease-out:  cubic-bezier(0.33, 1, 0.68, 1);  /* tracé, sortie */
--tv-dur-1: 120ms;  /* hover, press */
--tv-dur-2: 180ms;  /* défaut */
--tv-dur-3: 260ms;  /* modale, tiroir */
--tv-dur-4: 400ms;  /* landing uniquement */
```

**Plafond dur : 300 ms dans l'app.** Au-delà, l'utilisateur attend
l'animation au lieu de l'ignorer. Seule la landing dépasse (jusqu'à ~700 ms
sur une entrée de héros).

Une **sortie** dure ~70 % de son entrée. Une modale qui met autant de temps à
partir qu'à arriver donne une impression de lourdeur.

## Performance : deux propriétés, pas trois

**On anime `transform` et `opacity`. Point.** Elles composent sur le GPU.

Jamais `height`, `width`, `top`, `left`, `margin`. Pour un accordéon :
`grid-template-rows: 0fr → 1fr` (c'est exactement ce que fait `.faq-body`).

Jamais `transition: all` : `all` transitionne l'ombre, le fond, la bordure et
la mise en page en même temps, et déclenche des transitions non voulues au
moindre changement de classe. On cite les propriétés :

```css
transition-property: color, background-color, border-color, opacity, transform;
```

`will-change` uniquement sur un élément **sur le point** de bouger, et retiré
après (voir `.js-reveal .reveal:not(.reveal-visible)`).

## `prefers-reduced-motion` — non négociable

Toute nouvelle animation le respecte. Deux patrons en usage :

```css
@media (prefers-reduced-motion: no-preference) { /* l'animation vit ici */ }
@media (prefers-reduced-motion: reduce) { .chart-line { animation: none; stroke-dashoffset: 0; } }
```

En JS, la garde se pose **avant** de créer l'observer :

```ts
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
```

## Le reveal au scroll (landing)

Le patron en place, à réutiliser tel quel :

1. Le contenu est **visible par défaut**. L'état masqué n'existe que si le JS
   tourne (`html.js-reveal`) ET que le visiteur n'a pas demandé moins de
   mouvement. Sans JS, la page est lisible — c'est aussi ce que voit un
   robot d'indexation.
2. `IntersectionObserver`, `threshold: .15`, `rootMargin: "0px 0px -6% 0px"`,
   puis `unobserve` — chaque élément s'anime une fois.
3. Entrée : `opacity 0→1` + `translateY(12px→0)`, 500 ms, `--tv-ease`.

**Un moment, pas un par carte.** On pose `.reveal` sur la grille, pas sur
chacune de ses cellules. Un escalier de 6 cartes qui apparaissent une par une
fait attendre le lecteur.

## Ce qu'une animation a le droit de dire

| Intention | Geste |
| --- | --- |
| « ceci vient d'arriver » | `fade-in-up` 180 ms |
| « ceci est interactif » | liseré qui s'éclaircit, 120 ms |
| « ceci s'ouvre par-dessus » | `scale-in` 260 ms |
| « ceci calcule » | `shimmer` / `spin` |
| « ceci est en direct » | `pulse` sur une pastille de 6px |

Tout le reste est décoratif, donc du bruit.

## Checklist

- [ ] L'animation appartient aux 8 keyframes.
- [ ] `transform`/`opacity` uniquement ; aucune propriété de mise en page.
- [ ] Pas de `transition: all`.
- [ ] ≤ 300 ms (app) ; sortie à 70 % de l'entrée.
- [ ] `prefers-reduced-motion` géré.
- [ ] Le contenu reste lisible si le JS ne tourne pas.
- [ ] Rien ne bouge en boucle à l'écran sans raison fonctionnelle.
