# AGENTS.md

TradeVault — an AI trading-journal/performance workspace. React 19 + TanStack Start/Router (SSR via Nitro), Tailwind v4, Supabase (REST + RLS), Recharts. Landing/marketing copy principles and the full design reference live in [`DESIGN.md`](DESIGN.md) — read it before touching the landing page.

## Commands

- Install: `bun install` (Bun, not npm).
- Dev server: `bun run dev` → **http://localhost:8080** (the Lovable vite config pins port 8080).
- Local prod-like preview: `bun run preview` → builds a node bundle and serves **:4173** (`.vercel/output`/`.output`). Good for verifying SSR output without deploying.
- Build: `bun run build` (vite build; nitro preset `vercel`, output `.vercel/output`). Pushing `main` auto-deploys to Vercel.
- `bun run typecheck` = `tsc --noEmit`. `bun run lint` = `eslint .` (slow on this repo; can exceed 5 min). 
- Tests: `bun test` (~1s, ~1060 tests). SQL billing/quota guarantees: `bash scripts/test-sql.sh` (needs a real Postgres 16; CI runs it in a separate job).
- **CI gate (must pass before pushing to main):** `typecheck` → `lint` → `build` → `test`. CI also re-runs tests under `TZ=America/New_York` and `TZ=Pacific/Auckland` — day-boundary bugs (`toISOString().slice(0,10)`) only surface there. Reproduce locally with `TZ=America/New_York bun test`. For business dates use `todayLocalDate()`/`localDateOf()` from `@/shared/calendar-date`, never UTC slicing for user-facing dates.

## Layout & architecture

- File-based routes in `src/routes/`; **`src/routeTree.gen.ts` is generated** — a new route file must be regenerated (a `vite build` does it) and the gen file committed.
- SSR entry is `src/server.ts` (error wrapper). Server-only code lives under `src/backend/`; don't import browser/REST-client-bound modules there. Public indexable routes (`robots.txt`/sitemap) are declared in `PUBLIC_ROUTES` in `src/server.ts` — add new public routes there too.
- The signed-in app is a SPA behind one route (`/`, authed client-render); public pages (`/privacy`, `/terms`, `/cgu`, `/contact`) render SSR-fully and must stay outside the app tree.
- Full-viewport (non-scrolling) pages use `src/app/hooks/useAvailableHeight.ts` (reads real available height, like Jarvis). MonteCarlo, Calendar, Inbox use it — a new full-screen page should too.

## i18n (three systems — don't mix them)

1. **App**: `src/app/i18n/` — `LanguageContext` + `useT()`, dicts in `translations.ts` (en source-of-truth) + `locales/*.ts`. **Default is English; language changes ONLY via explicit user choice in Settings — no browser auto-detect.** New keys must be added in both `translations.ts` and the `fr` locale (tests check coverage).
2. **Landing/marketing**: its OWN provider `LandingLangProvider` + `useLandingT()` + dictionary in `src/app/pages/landing/i18n.tsx` (en/fr per key). Landing has no relation to the app `LanguageContext`.
3. **SSR/SEO language**: `SSR_LANG` in `src/shared/lang.ts` (currently `"en"`). Four places MUST agree — `<html lang>` (`__root.tsx`), the SSR body, the title/description (`routes/index.tsx`), and `og:locale` (`shared/seo.ts` + `__root.tsx`). `tests/publicSurface.test.ts` asserts `SSR_LANG === "en"`.

The landing stores its explicit choice as `tv.landing.lang`; the app as `tv.lang`.

## Theme system & design language

- Default theme = **graphite** via `DEFAULT_THEME_ID` in `src/app/utils/themes.ts`. Per-device storage keys: `tv-themes-v2` (store) + `tv-theme-vars-v2` (resolved CSS vars); both are purged on logout (`session-purge.ts`).
- The `:root` palette in `styles.css` is the SSR/no-JS fallback and must match the default theme — keep `--tv-accent*` in sync with graphite when the default changes.
- Surface grammar (styles.css): `.glass`, `.glass-strong`, `.panel`, `.stat-card*` all render the SAME plate; depth comes from surface VALUE + hairline, **never shadows, halos, blur or `animate-ping`** ("rien ne rayonne, la couleur est rare"). P&L keeps its own green/red (`--tv-chart-green/red`) regardless of theme.
- Shared UI: `src/shared/ui` (`Kpi`, `KpiGrid`, `SubNav`, `Sheet`, `Button`, `PageToolbar`…) — reuse rather than restyle.

## Notifications

- Engine + rules: `src/modules/notifications/` (`engine.ts`, `rules.ts`). Coded rules are deduped once/day via localStorage `tv.notif.coded`. Severity `error` auto-opens the detail popup. Notifications persist in the Supabase `notifications` table. UI: `src/app/pages/Inbox.tsx` (full-screen list) + bell badge in `Sidebar`/`MobileActions`.

## Testing quirks

- Several tests read **source files and assert content** — changing constants/strings can break them: `tests/publicSurface.test.ts` (SEO/language/robots), `tests/envExample.test.ts` (every server env var the code reads must be documented in `.env.example`), `tests/themeCoverage.test.ts`, `tests/staticCards.test.ts`. Run the full `bun test`, don't assume a unit is isolated.

## Data & env

- `.env` (gitignored) holds real Supabase credentials; `.env.example` is the documented contract. The dev app talks to the LIVE Supabase project — never destructive SQL against real tables; throwaway signups (`tv*@test.dev`) are acceptable for E2E and cleaned up after.

## Conventions

- All comments are in **French**; user-facing strings via `t(...)`/landing dict — never hard-coded `fr ? … : …` in components.
- Commits are descriptive French; `main` is the deploy branch. Feature work in `claude/*` branches merged into `main` keeps the linear history (prefer rebase/merge like prior work).

## Landing page (high priority)

See `DESIGN.md` for the full Linear-style design reference and product positioning. Non-negotiables: product screenshots are the hero; single scarce accent (lavender `#5e6ad2` on marketing canvas, never as card fill); no gradients/glow/light-mode; honest English copy — never promise profits or invent social proof; structure Hero → Problem → Journal→Analyze→Understand→Improve → Product → Analytics → Jarvis → Mistakes/use cases → Excel/Notion → Pricing → CTA around real product features only.