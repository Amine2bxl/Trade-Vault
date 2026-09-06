---
version: alpha
name: Linear-design-analysis
description: "A near-black product-focused marketing canvas built around #010102 (the deepest dark surface of any tool in this collection), light gray text (#f7f8f8), and the signature Linear lavender-blue (#5e6ad2) used as the single chromatic accent. The system reads as software-craft documentation: dense, technical, and quietly luxurious. Display type is set in the Linear custom sans (SF Pro Display fallback) at 500–700 with measured negative tracking. Cards live as charcoal panels (#0f1011) with hairline borders. The accent lavender appears on the brand mark, focus rings, and a few intentional CTAs — never decoratively. Page rhythm leans on product UI screenshots framed in dark panels rather than atmospheric color."
---

# Linear design reference (for the TradeVault landing redesign)

> This file is kept in the repo as the durable design reference for the landing
> page refonte. It is a READ reference, not an app asset. The app/signed-in
> product stays on its own theme system (see `AGENTS.md` — graphite default);
> this palette governs the MARKETING/landing canvas only.

## Colors

| Token | Hex | Use |
|---|---|---|
| `primary` / `primary-hover` / `primary-focus` | `#5e6ad2` / `#828fff` / `#5e69d1` | Sole chromatic accent: brand mark, primary CTA, focus rings, link emphasis. NEVER as a section background or card fill. |
| `ink` / `ink-muted` / `ink-subtle` / `ink-tertiary` | `#f7f8f8` / `#d0d6e0` / `#8a8f98` / `#62666d` | Text ladder: headlines → body → meta → disabled/footnotes. |
| `canvas` | `#010102` | Page background — near-pure black with a faint blue tint. NOT pure `#000000`. |
| `surface-1 → surface-4` | `#0f1011` / `#141516` / `#18191a` / `#191a1b` | Four-step surface ladder; cards/panels lift by value, not shadow. |
| `hairline` / `hairline-strong` / `hairline-tertiary` | `#23252a` / `#34343a` / `#3e3e44` | 1px borders (cards, dividers, input focus rings). |
| `inverse-canvas` / `inverse-surface-1/2` | pure white stack | Inverse CTA pills only. |
| `semantic-success` | `#27a644` | The ONLY semantic color on marketing — status pills / success indicators. |
| `semantic-overlay` | `#000000` | Modal scrim. |

## Typography

- Stack: Linear Display / Linear Text (custom); substitute **Inter** (weights 500–700) — already the product font — plus `ui-monospace` for code/IDs.
- Display weight 600, body weight 400. **Resist 700+ display weights.**
- Display letter-spacing is aggressively negative (‑3.0px @ 80px ≈ 4% of size, scaling to 0 at body). Eyebrows use positive tracking (+0.4px).
- Scale: 80/56/40/28/22/20/18/16/14/12px. Body default 16px/1.50.
- Mono only inside product screenshot mockups, never on marketing chrome.

## Layout

- Base unit 4px; section gap 96px; card padding 24px; testimonials 32px; CTA banner 48px.
- Max content width ~1280px; card grids 3-up → 2-up @1024px → 1-up below 768px.
- Dark canvas IS the whitespace; sections separate by lifting onto `surface-1`, not by white gaps.

## Depth & shape

- Depth = surface ladder + 1px hairline borders. Resist drop shadows on dark.
- Radii: buttons/inputs `8px` (`rounded.md`); feature/pricing/testimonial cards `12px` (`lg`); product screenshot panels `16px` (`xl`); CTA banner `24px`; status pills `pill`.
- Buttons: 8px vertical × 14px horizontal padding; `14px/500` label.
- Small white top-edge highlight on lifted panels (faint "pixel rendered" feel).

## Components (marketing)

- `button-primary` lavender CTA; `button-secondary` charcoal (`surface-1` + hairline); `button-tertiary` text; `button-inverse` white.
- Feature/pricing cards: `surface-1`, 1px hairline, `rounded-lg`, 24px padding. Featured tier = `surface-2`.
- Product screenshot panels (`surface-1`, `rounded-xl`, 24px padding) are the PROTAGONIST of every section.
- Top nav: 56px, canvas bg, wordmark left + links center + secondary "Sign in" + primary CTA right; hamburger below 768px.
- Footer: canvas, `ink-subtle` text, dense link grid.
- Pricing tabs: pill toggle, selected = `surface-2` + ink; input focus = 2px `primary-focus` outline @ 50%.

## Do's / Don'ts

- DO: keep the canvas near-black; use lavender ONLY for brand mark / primary CTA / focus / links; use the surface ladder (don't skip levels); pair display 600 with body 400; apply negative tracking on display; lead EVERY section with a product screenshot; 8px CTA corners.
- DON'T: ship a light marketing page; use lavender as a section fill; introduce a second chromatic accent (orange/green/pink) outside the single success green; add atmospheric gradients / glow / spotlight cards; pill-round CTAs; use pure `#000000` as canvas; combine multiple bright accents in product mockups.

## Responsive

- Display 80px scales toward ~36px on mobile; touch targets ≥40px height (44px on touch); pricing comparison becomes an accordion below 768px.

---

# TradeVault landing brief (product positioning — non-negotiable)

Concept: **JOURNAL → ANALYZE → UNDERSTAND → IMPROVE**.

TradeVault is a trading journal / trading performance **workspace**. It is NOT:
a signal provider, trading bot, profit promise, copy-trading platform, or
"AI magic tool". It helps the trader understand their OWN trading.

- WHO: day / futures / intraday / ICT / retail traders who want to understand
  their process. The value is what happens AFTER logging a trade.
- HERO: "Start for free". Product screenshot as protagonist. No vague
  headlines ("Trade smarter", "Unlock your potential"). Short, concrete,
  result-oriented English.
- Sections (adapt to what really exists): Hero → Problem ("I have all this
  data but I don't know what it tells me") → Core value (Journal → Analyze →
  Understand → Improve) → Product experience → Analytics (equity curve, win
  rate, profit factor, drawdown, risk/reward) → AI/Jarvis (presented as an
  intelligence layer over YOUR data, not a buzzword) → Mistakes/psychology
  (overtrading, setup breakdown, recurring patterns) → Use cases → Excel/Notion
  comparison (verifiable only) → Pricing (honest, real) → Final CTA.
- Copy: natural, short, confident, human, professional English. Forbidden:
  revolutionary / game-changing / next-generation / unleash / supercharge /
  "AI-powered everything". The product must answer, in natural content:
  What is TradeVault? Who is it for? How does it work? Is it a trading bot?
- Trust: NEVER invent testimonials, user counts, logos, revenue or performance
  claims. Use real product screenshots, real pricing, privacy/security, docs.
- GEO/AEO + SEO: real semantic HTML, one H1, keywords "trading journal /
  software / app / analytics / AI trading journal" used naturally; structured
  data must match real content. Keep the page visual and conversion-focused,
  not an SEO article.
- The signed-in app keeps its own theme system (graphite default, `--tv-*`
  tokens, P&L stays green/red). The design above governs the landing only.