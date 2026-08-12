# NAVIGATION_REFACTOR.md

Spec for Claude Code. Written against `main` on 2026-08-12.

Goal: collapse 21 flat nav entries into **6 sections**, without changing a single
URL, without deleting a single feature, and without touching the router.

## Why this is cheap

The existing architecture already supports it. `src/app/types.ts` holds `PAGES`
as the single source of truth, and `src/routes/$page.tsx` renders every
authenticated screen through one parameterised route. Grouping is therefore a
**presentation concern only**: a new `SECTIONS` structure sits on top of `PAGES`,
the sidebar renders sections, each section renders a tab bar over its pages.

Every page keeps its own URL. Deep links keep working. Per-screen analytics
(unlocked by #152) keep working. `resolveLocation` keeps handling legacy `?p=`
redirects untouched.

**Do not** introduce nested routes, a `$page.$tab.tsx`, or a splat route. The
gain is zero and it would break the SSR fallback contract in `$page.tsx`.

## The mapping

All 21 pages are assigned. Nothing is orphaned, nothing is removed.

| Section | Label (fr) | Default page | Tabs |
|---|---|---|---|
| `dashboard` | Tableau de bord | `dashboard` | — (no tab bar) |
| `preparation` | Préparation | `tradingplan` | `tradingplan`, `checklist`, `calculator`, `news`, `goals`, `simulator` |
| `journal` | Journal | `journal` | `journal`, `calendar`, `mistakes`, `missed` |
| `analysis` | Analyse | `analytics` | `analytics`, `seasonality`, `reports`, `montecarlo` |
| `coach` | Jarvis | `insights` | — (no tab bar) |
| `settings` | Réglages | `settings` | `settings`, `profile`, `appearance`, `subscription` |

`inbox` leaves the sidebar entirely — it becomes a **bell icon in the header**
with an unread badge. It is a notification surface, not a destination.

### Rationale for the two non-obvious calls

`calendar` sits in **Journal**, not Analyse: it is a chronological view of trades
the user has logged, not a derived statistic. The mental question is "what did I
do on the 12th", which is a journal question.

`simulator` sits in **Préparation**, not Analyse: it is practice before the
market, forward-looking. `montecarlo` sits in Analyse because it projects from
existing results, backward-looking.

## Implementation

### 1. Add the structure — do not duplicate `PAGES`

In `src/app/types.ts`, below `PAGES`. Derive, never recopy — the existing file
comment explains exactly why a hand-copied list rots, and that reasoning applies
here.

```ts
export const SECTIONS = [
  { id: "dashboard",   pages: ["dashboard"] },
  { id: "preparation", pages: ["tradingplan", "checklist", "calculator", "news", "goals", "simulator"] },
  { id: "journal",     pages: ["journal", "calendar", "mistakes", "missed"] },
  { id: "analysis",    pages: ["analytics", "seasonality", "reports", "montecarlo"] },
  { id: "coach",       pages: ["insights"] },
  { id: "settings",    pages: ["settings", "profile", "appearance", "subscription"] },
] as const satisfies readonly { id: string; pages: readonly Page[] }[];

export type SectionId = (typeof SECTIONS)[number]["id"];
```

The default page of a section is `pages[0]`. Do not add a separate `default`
field — two sources for one fact is the violation `PRODUCT.md` §2 already warns
about.

### 2. Add a compile-time exhaustiveness check

Every page except `inbox` must appear in exactly one section. Enforce it in a
test, not a comment, so adding a page to `PAGES` without assigning it fails CI:

```ts
// tests/sections.test.ts
test("every page belongs to exactly one section", () => {
  const assigned = SECTIONS.flatMap(s => s.pages);
  const expected = PAGES.filter(p => p !== "inbox");
  expect([...assigned].sort()).toEqual([...expected].sort());
});
```

### 3. Sidebar

Renders 6 entries. The active section is the one containing the current page.
Clicking a section navigates to its default page.

Keep the existing account switcher, P&L summary and user block. Do not touch
them in this PR.

### 4. Tab bar

New component, rendered by the section shell when `pages.length > 1`. Sits under
the page title, above content.

- Active tab uses `layoutId`-style sliding underline. Since the app has no
  Framer Motion, implement with a single absolutely-positioned element whose
  `transform: translateX()` and `width` are driven by the active tab's offset —
  transform only, no layout properties.
- Duration 150ms, `cubic-bezier(0.4, 0, 0.2, 1)`.
- Horizontally scrollable on mobile with `scroll-snap`, never wrapped to two
  rows. Préparation has 6 tabs; on a 380px viewport they must scroll.
- Tabs are real links (`<a href>`), not buttons — middle-click and "open in new
  tab" must work.

### 5. Preload on hover — verify it actually runs

`GO-LIVE.md` records that the previous preload silently did nothing: it called
`import(mod)` on a string variable, which Vite cannot resolve, and the `.catch()`
swallowed the failure.

Wire preload on tab and section hover using a **static map of literal dynamic
imports**, the only form Vite can analyse:

```ts
const preloaders: Record<Page, () => Promise<unknown>> = {
  analytics: () => import("@/app/pages/Analytics"),
  journal:   () => import("@/app/pages/Journal"),
  // ...one literal entry per page
};
```

**Acceptance test, not a claim:** with the Network tab open, hovering a section
must show its chunk request start *before* the click. Verify this in a browser
and report what you observed. Do not mark it done on the basis of the code
looking correct.

## Mobile

The bottom nav shows the 6 sections (currently it cannot show 21 without
scrolling). Tabs live inside the page, as a scrollable row.

## Non-goals for this PR

Do not split `Checklist.tsx` (88 KB), `Landing.tsx` (68 KB) or `Analytics.tsx`
(53 KB). Do not touch animations beyond the tab underline. Do not rewire data
flow between modules. Those are `MOTION_AND_PERF.md` and `ECOSYSTEM_WIRING.md`.

Keeping this PR to navigation only is what makes it reviewable.

## Acceptance criteria

- [ ] Sidebar shows 6 entries; bottom nav shows 6
- [ ] All 21 legacy URLs resolve to the same screens as before
- [ ] Legacy `?p=` URLs still redirect (regression check on `resolveLocation`)
- [ ] `tests/sections.test.ts` passes and fails when a page is unassigned
- [ ] Direct load of `/seasonality` opens Analyse with the Saisonnalité tab active
- [ ] Journal → Dashboard → Journal preserves filters and scroll (GO-LIVE #157)
- [ ] Preload verified **in a browser**, Network tab, chunk starts on hover
- [ ] Tab row scrolls on a 380px viewport, never wraps
- [ ] `prefers-reduced-motion`: underline jumps without sliding
- [ ] Keyboard: arrow keys move between tabs, focus ring visible
