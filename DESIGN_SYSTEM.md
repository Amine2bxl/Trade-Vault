# DESIGN_SYSTEM.md

Spec for Claude Code. Derived from a structured design interview with the owner
on 2026-08-13. Supersedes the visual parts of `LANDING_AND_DESIGN.md` Part 3 for
the **app**; the landing page keeps its own louder register.

Read `MOTION_AND_PERF.md` first. Its 300 ms cap and transform/opacity rule still
bind and are never overridden here.

## The brief, in one line

**Dark, sober, dense data surfaces with a silent chrome.** The reference points
are Linear, Vercel and Stripe — not FocusPips.

The owner asked for "dense everywhere" and also cited three products famous for
restraint. Both are true at once, and resolving it is the core of this spec:
**the data is dense, everything around it is quiet.** Linear's issue list is
tight and compact; its sidebar, headers and margins are calm. Trade tables,
analytics grids and P&L figures pack in. Chrome, cards and empty space do not
compete.

Do not read "dense" as "add more elements". It means *higher information per
pixel on data surfaces*, achieved with tighter rows and smaller type — not with
more boxes.

## Decisions taken (do not relitigate)

| Question | Decision |
|---|---|
| Theme | **Dark by default.** Light theme kept working, not the priority. |
| Register | Sober, institutional. No playful gradients inside the app. |
| Density | Dense data, quiet chrome (see above). |
| Accent | **Blue only.** Violet is brand-only — logo, landing, marketing. |
| Type | **Inter**, single family, no secondary face. |
| Numbers | Inter with `font-feature-settings: "tnum"`. **No monospace.** |
| Radius | 4–6 px. |
| Separation | 1px border **plus** a slightly lighter surface. |
| Motion | Moderate: fades and page transitions. |
| Navigation | **Keep the 6 sections + tab bar as shipped.** No rework. |
| Trade list | Dense table + **overlay** detail panel. |
| Charts | Visible grid, pro-terminal style. |
| Empty states | Illustration + guiding text. |
| Icons | Phosphor Regular + 5 custom. |
| Landing screen | Dashboard. |
| Mobile | Secondary for now. Must not break; not the priority. |

## Tokens

Dark is the reference theme. Derive light from it afterwards, not in parallel.

```css
@theme {
  /* surfaces — each step is a real, perceptible increment */
  --bg-base:        #0A0B0D;   /* app background */
  --bg-surface:     #121418;   /* cards, panels */
  --bg-raised:      #171A1F;   /* overlay panel, modals, popovers */
  --bg-hover:       #1C2026;

  /* borders — separation is border + surface shift, never shadow */
  --border:         #23272E;
  --border-strong:  #2E333B;   /* focused, active, table header */

  /* text */
  --text-primary:   #E6E8EB;
  --text-secondary: #9BA1A9;
  --text-tertiary:  #6B717A;   /* labels, units, axis ticks */

  /* accent — blue only */
  --accent:         #4D8DFF;   /* on dark; NOT #2563EB, too dark here */
  --accent-hover:   #6BA0FF;
  --accent-subtle:  rgba(77, 141, 255, 0.12);

  /* semantic — one green, one red, varied by opacity only */
  --positive:       #22C55E;
  --negative:       #EF4444;

  /* radius */
  --radius-sm: 4px;   /* inputs, buttons, chips */
  --radius-md: 6px;   /* cards, panels */
  --radius-full: 9999px;
}
```

**No `box-shadow` anywhere in the app.** Depth comes from surface steps plus a
1px border. Shadows on a near-black background produce mud. The one exception is
the overlay detail panel, which may use a backdrop scrim.

`--accent` is deliberately lighter than the brand `#2563EB`: on `#0A0B0D` the
brand blue fails contrast for text and reads dull on buttons. `#2563EB` stays the
Stripe Checkout and landing CTA colour. Verify `--accent` on `--bg-surface`
reaches 4.5:1 for text and report the measured ratio.

## Typography

Inter, one family. Enable tabular figures **globally**, not per component:

```css
body { font-feature-settings: "tnum" 1, "cv05" 1; }
```

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Page title | 20px | 600 | -0.01em |
| Section heading | 15px | 600 | normal |
| Body | 14px | 400 | normal |
| Table cell | 13px | 400 | normal |
| Metric value | 24–28px | 600 | -0.02em |
| Label / axis | 11px | 500 | 0.02em, uppercase |

App headings stay at **600**, not 800. The 800 weight from
`LANDING_AND_DESIGN.md` is for the landing page only. Heavy headings inside a
tool read as marketing.

## Density

Table rows: **32px**, 8px horizontal cell padding, 1px row separator in
`--border`. Sticky header in `--bg-raised`, uppercase 11px labels.

Card padding: 16px. Grid gap: 12px. Section spacing: 24px.

These are tight on purpose. If something feels cramped, reduce what is in it
rather than increasing the padding — that is what "dense" means here.

## Motion

Follows `MOTION_AND_PERF.md` exactly. Moderate means: `fade-in` and
`fade-in-up` on content, a 150 ms cross-fade on page transition, 250 ms for the
overlay panel. No ambient movement, no glow, no float, no shimmer outside
skeletons.

The overlay trade panel slides from the right with `transform: translateX()` at
250 ms, exits at 175 ms, behind a `--bg-base/60` scrim.

## Charts

Visible grid, terminal register:

- Grid lines `--border` at 1px, horizontal only. No vertical grid.
- Axis labels `--text-tertiary` at 11px.
- Series: `--accent` for a single series; equity uses `--positive`/`--negative`
  by sign, not a gradient fill.
- No drop shadows, no rounded line caps, no area gradients.
- Tooltip on `--bg-raised` with a 1px `--border-strong` frame.

## Icons

**Phosphor, Regular weight, 1.5px stroke, 20px in nav, 16px inline.** Chosen
over Lucide because it is less ubiquitous and its stroke terminals are cleaner
at small sizes; chosen over a bespoke set because a recognisable calendar icon
costs the user nothing and an invented one costs a hesitation on every click.

Draw **five custom icons only**, for concepts no library has:

1. Detected pattern
2. Readiness score
3. Trading session
4. Jarvis proposal
5. Mistake cluster

Same 1.5px stroke, same 24px grid, same optical weight as Phosphor. If a custom
icon cannot be read at 16px, it fails — fall back to a Phosphor equivalent
rather than shipping a smudge.

## Empty states

Illustration plus guiding text, one primary action. Illustrations are **line
art in `--border-strong` on transparent**, no colour, no character art — they
must survive both themes and not undercut the sober register.

Every empty state answers: what goes here, why it is empty, what to do next.
"Aucun trade" alone is a dead end. The statistical thresholds from
`ECOSYSTEM_WIRING.md` create several of these — "8 sessions de plus nécessaires"
is an empty state and deserves the same treatment.

## Order of work

1. Tokens + Inter + tabular figures, applied globally. No component changes.
2. Table density and the overlay detail panel.
3. Charts.
4. Icon swap to Phosphor.
5. Empty states.
6. Custom icons, last, and only if 1–5 are done.

Ship 1 alone first and look at it. A token layer applied globally changes the
whole app in one PR, and it is the cheapest point to course-correct if the owner
does not like what he sees.

## Acceptance criteria

- [ ] Zero `box-shadow` in app CSS (landing exempt)
- [ ] Zero violet in the app; violet only in logo, landing, marketing
- [ ] One font family loaded; no monospace anywhere
- [ ] `tnum` active globally — verify P&L columns align vertically
- [ ] `--accent` on `--bg-surface` ≥ 4.5:1, ratio reported
- [ ] Table rows 32px, no row taller than 36px
- [ ] No animation over 300 ms
- [ ] Light theme still renders without broken contrast
- [ ] Mobile does not break, even if unpolished
- [ ] Screenshots of dashboard, journal, analyse posted in the PR
