# MOTION_AND_PERF.md

Spec for Claude Code. Written against `main` on 2026-08-12, from measurements
taken in a browser on the live site.

## Measured baseline — do not re-derive, compare against this

Cold load of `https://tradevault.be/?nocache=1`:

| Metric | Value | Verdict |
|---|---|---|
| TTFB | 493 ms | good |
| DOMContentLoaded | 664 ms | good |
| Load | 796 ms | good |
| JS chunks | 34 | code splitting works |
| JS decoded | 1 569 KB | too much |
| CSS decoded | 211 KB | too much |
| Requests | 60 | acceptable |

Largest chunks: `index` 587 KB · `chartTheme` 370 KB · `Landing` 274 KB ·
`translations` 58 KB.

Largest sources: `Checklist.tsx` **88 KB** · `Landing.tsx` 68 KB ·
`Analytics.tsx` 53 KB.

The delivery architecture is already good. The problem is payload and animation
sprawl, not the pipeline. **Do not migrate frameworks. Do not add Framer Motion.**

## Part A — Motion consolidation

### The problem

**37 keyframes.** Five do the same fade (`fadeIn`, `fadeInUp`, `fadeSlideUp`,
`drawFadeIn`, `fade-up`). Seven are purely decorative (`glow`, `glowPulse`,
`shine`, `scan-move`, `orb-float`, `floatA`, `floatB`). Durations run to
**0.7 s**, and `transition-property: all` is used broadly.

Perceived polish comes from *fewer, repeated* animations — not from more of them.

### Target: 8 keyframes

| Name | Use |
|---|---|
| `fade-in` | opacity only |
| `fade-in-up` | opacity + `translateY(6px)` — the one entrance |
| `scale-in` | `scale(0.97) → 1` + opacity — modals, popovers |
| `slide-in-right` | drawers, mobile panels |
| `shimmer` | skeletons |
| `spin` | loaders |
| `pulse` | live/recording indicators |
| `draw` | chart line reveal, `stroke-dashoffset` |

Everything else is deleted and its call sites remapped. Decorative ambient
animations (`orb-float`, `floatA/B`, `scan-move`, `shine`, `glowPulse`) are
removed from the **app**; `Landing.tsx` may keep at most two, since a marketing
page has different rules than a tool.

### Token scale

```css
@theme {
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --duration-micro: 100ms;   /* hover, press */
  --duration-base: 150ms;    /* default — everything unless stated */
  --duration-panel: 250ms;   /* modals, drawers */
}
```

**Hard cap: 300 ms inside the app.** Above that the user waits for the animation
instead of ignoring it. The only exception is `Landing.tsx`.

Exits run at ~70 % of entrance duration. A modal that takes as long to leave as
to arrive feels heavy.

### Replace `transition-property: all`

`all` transitions `box-shadow`, `background-color`, `border-color` and layout
properties simultaneously, causing needless repaints and unintended transitions
whenever a class changes. Cite properties explicitly:

```css
transition-property: color, background-color, border-color, opacity, transform;
```

**Animate only `transform` and `opacity`.** These composite on the GPU. Never
animate `height`, `width`, `top`. For accordions use
`grid-template-rows: 0fr → 1fr`.

### Keep

`prefers-reduced-motion` handling already exists and is correct. Preserve it,
and extend it to every new animation.

## Part B — Payload

### B1. Lazy-load charts

`chartTheme` is **370 KB** and Recharts is only needed on Analyse, Dashboard
charts and Reports. Load it via `React.lazy` behind a skeleton of the exact final
height, so nothing shifts when it arrives.

Expected: the largest single win in this spec.

### B2. Split the three large pages

Do this by **extracting real components**, not by mechanically cutting files.

- `Checklist.tsx` (88 KB) — separate the wizard, the item editor, the runtime
  view. `checklistDefaults.ts` (31 KB of data) should be loaded on demand, not
  bundled into the page chunk.
- `Analytics.tsx` (53 KB) — one component per chart block, each independently
  lazy.
- `Landing.tsx` (68 KB) — below-the-fold sections lazy; hero stays eager. The
  landing page is the SSR fallback for unauthenticated visitors, so its
  above-the-fold cost is the first-impression cost.

Constraint: **no behaviour change**. This is a pure refactor and must be
reviewable as one.

### B3. Translations

`translations` is 58 KB and `fr` is a further 63 KB. Load only the active locale
at runtime; do not bundle twelve locales into one chunk.

Related, product-level: `GO-LIVE.md` §2.10 records ten locales at 26 %
coverage. Not this PR's problem, but flag it to the owner again — shipping a
language selector that yields a 74 %-English UI is worse than offering two
languages.

### B4. CSS

211 KB is high for Tailwind 4, which tree-shakes. Likely causes: `landing.css`
(15 KB) and `checklist.css` loaded globally rather than per-route, plus the dead
keyframes removed in Part A. Verify with a coverage report before and after.

**Measured on production, 2026-08-13 — the hypothesis above was wrong, and the
apparent regression is not one.** Route stylesheets are already split per route;
`landing.css` and `checklist.css` are *not* loaded globally.

| asset | bytes | loaded on |
| --- | --- | --- |
| `styles-*.css` (Tailwind output) | 207 101 | every route |
| `landing-*.css` | 9 427 | `/` only |

- `/journal`: **1 file, 202 KiB** — the Tailwind bundle alone.
- `/`: **2 files, 211 KiB** — the same bundle plus `landing.css`.

The two numbers were taken on two different routes. 207 101 B = 202.2 KiB (read
as "201 KB"); + 9 427 B = 211.5 KiB. Nothing was added and nothing grew: the
second stylesheet is `landing.css`, which only `/` pulls, because only
`routes/index.tsx` reaches `pages/Landing.tsx`.

So the single remaining question for B4 is the 202 KiB Tailwind output itself —
utility CSS emitted once for the whole app. That needs a browser coverage report
to attribute, and splitting Tailwind's emission per route is a build change, not
a cleanup.

## Part C — Perceived speed

### C1. Preload on hover

Covered in `NAVIGATION_REFACTOR.md`. If that PR has not landed, do it there, not
here.

### C2. Skeletons matching final geometry

Skeletons already exist (`skeletonShimmer`) and are visible on the dashboard —
good. Audit every one for **exact height match** with its loaded content. A
skeleton that resizes on arrival creates layout shift, which cancels the benefit
it was meant to provide.

### C3. Query cache — already satisfied, with one deliberate exception

TanStack Query is already a dependency. Set a `staleTime` per query type (trades
30 s, static config 5 min) and persist the cache so a returning user sees their
last state immediately instead of a skeleton.

**État au 2026-08-12, vérifié dans le code.** C'est déjà fait : `useTrades`
porte `staleTime: 30_000`, le défaut global est 60 s avec `gcTime` 5 min et
`refetchOnWindowFocus: false`, et le calendrier économique a le sien. Il n'y a
que trois `useQuery` dans le produit ; la configuration statique ne passe pas
par React Query.

**La persistance reste dans `sessionStorage`, et c'est un choix, pas un oubli.**
`localStorage` ferait gagner un clignotement de squelette au retour sur le
produit. Il ferait aussi rester l'historique complet de P&L d'un trader sur le
disque, indéfiniment, en survivant à la déconnexion, lisible sur une machine
partagée ou empruntée. Pour un produit dont tout le contenu est la performance
financière de quelqu'un, l'échange ne vaut pas la peine par défaut.

Si cela devient un jour une option, elle est **opt-in**, avec effacement
explicite à la déconnexion — décision produit, pas refactorisation.

## Acceptance criteria — measured, not asserted

Report before/after numbers for each. "Looks faster" is not a result.

- [ ] Keyframe count ≤ 8 in the app (`Landing.tsx` counted separately)
- [ ] No `transition-property: all` outside `Landing.tsx`
- [ ] No animation > 300 ms in the app
- [ ] No animation on `height`, `width`, `top`, `left`
- [ ] Recharts absent from the initial chunk graph (verify in the network tab)
- [ ] Only the active locale is downloaded
- [ ] Total decoded JS on cold load **< 900 KB** (from 1 569 KB)
- [ ] CSS **< 120 KB** (from 211 KB)
- [ ] TTFB and Load not regressed vs the baseline table above
- [ ] Zero layout shift when skeletons resolve (CLS ≈ 0)
- [ ] `prefers-reduced-motion` still disables movement, keeps fades
- [ ] No visual or behavioural regression on any of the 21 screens
