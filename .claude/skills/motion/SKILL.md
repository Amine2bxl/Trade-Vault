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
`scan`, pas de `glow`.

La landing a droit à **deux** effets d'ambiance maximum. Aujourd'hui :

1. **Le reveal au scroll** — et le **tracé de la ligne** (`DrawnLine`) en fait
   partie : même déclencheur (`.reveal` → `.reveal-visible`), même easing,
   même famille. C'est le reveal appliqué à un tracé, pas un effet de plus.
   Une seule ligne tracée dans toute la page ; la rareté est ce qui la fait
   remarquer.
2. **L'orbe du curseur** (`CursorOrb`) — demandée explicitement. Elle ne monte
   que pour un pointeur fin, s'arrête au repos, et n'existe pas sous
   `prefers-reduced-motion`.

L'ancien tracé de la courbe du héros (`.chart-line`) ne compte plus : il vit
dans `HeroProductVisual`, qui n'est que le **repli** affiché tant qu'aucune
capture n'est déposée. Depuis que `dashboard.webp` existe, il ne s'affiche
jamais.

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
après. GSAP le pose et le retire lui-même sur ce qu'il anime : ne pas le
doubler en CSS.

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

Tout vit dans `src/app/pages/landing/motion.tsx`, et **nulle part ailleurs** :
plus une seule règle CSS ne masque `.reveal`. Le patron en place :

1. Le contenu est **visible par défaut**. Seul GSAP le masque, et seulement
   si le visiteur n'a pas demandé moins de mouvement. Sans JS, la page est
   lisible — c'est aussi ce que voit un robot d'indexation.
2. `ScrollTrigger.batch`, `start: "top 86%"`, `once: true` : les blocs qui
   entrent ensemble partent en cascade, et chaque déclencheur se tue après
   son passage. Un `MutationObserver` enrôle les sections chargées en
   différé, qui n'existent pas au montage.
3. **Trois gestes, pas un**, choisis d'après ce que le bloc contient — c'est
   ce qui évite la sensation générique d'un fondu unique posé partout :

   | Geste | Déclencheur | Course | Durée |
   | --- | --- | --- | --- |
   | `SCENE` | contient `.shot-frame` / `<picture>` | 32px + `scale(.985)` | 950 ms |
   | `CHAPITRE` | contient un `h1`/`h2`/`h3` | 22px | 800 ms |
   | `LIGNE` | tout le reste | 14px | 620 ms |

   Viser `img` ou `svg` pour la scène ferait basculer la moindre carte à
   icône : le vocabulaire redeviendrait uniforme.
4. Dans un bloc, les enfants directs (entre 2 et 6) montent **aussi**, de
   10px, décalés de 90 ms après leur parent. Les deux translations
   s'additionnent : c'est cet écart qui se lit comme de la profondeur.
5. `.reveal-visible` reste posée sur chaque bloc entré — le tracé de
   `.tv-draw-path` s'y accroche.
6. `ease: "expo.out"`, l'équivalent GSAP de `--tv-ease`.

**Un moment, pas un par carte.** On pose `.reveal` sur la grille, pas sur
chacune de ses cellules. Le décalage entre blocs sœurs est plafonné à 4 crans
(0,075 s) : au-delà, l'escalier se voit et le lecteur attend.

## Le défilement doux (landing)

Lenis est monté **dans** `Landing`, jamais au-dessus : il meurt avec la
vitrine et le produit garde son défilement natif, ligne à ligne. Une seule
boucle — `autoRaf: false`, le ticker de GSAP fait avancer Lenis, et chaque
défilement de Lenis prévient `ScrollTrigger`.

- `lerp: 0.08` (défaut 0.1) : la page continue de filer un peu après l'arrêt
  de la molette. Plus bas, on patine.
- `wheelMultiplier: 0.85` : un cran pousse moins loin, donc le défilement est
  continu au lieu d'être une suite de sauts que le lissage doit rattraper.
- **Les ancres de la barre passent par `allerVers`**, pas par
  `lenis.scrollTo` nu. Le défaut de Lenis est une exponentielle sortante —
  vitesse maximale dès la première image, ce qui se lit comme un décollage.
  `allerVers` impose une courbe symétrique (`easeInOutCubic`) et une durée
  proportionnelle à la distance (0,7 s à 2 s), et rend cette durée pour que
  le verrou du scrollspy ne soit pas une constante devinée.
- `lerp: 0` est obligatoire dans un `scrollTo` : Lenis ignore `duration` et
  `easing` tant qu'un `lerp` est posé (`if (this.lerp)`).

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
