# DESIGN.md

Ledger is an instrument, not a dashboard. It measures whether AI assistants recommend a
brand, and it proves whether a fix moved the number. Everything below serves that: the
reader must be able to tell measurement from estimate, and fact from generated text, at a
glance and without reading a legend.

The surface is dark by default. Not because dark is fashionable, but because this product
is read the way a trading terminal or a monitoring console is read — numbers and small
marks against a quiet ground, where a single red tick has to be findable in a strip of two
hundred. Light is a supported alternate, not the origin.

The reference points are a monitoring console, a Swiss timetable, and a printed financial
statement. They are not other SaaS products.

---

## Theming

One set of semantic token names, two value sets, swapped by `data-theme` on `<html>`.

**Components never branch on theme.** `ink` means "primary text" in both modes; only its
value changes. A component that reads `text-ink` is correct in dark and light without
knowing which it is in. If you find yourself writing `dark:`, the token set is missing a
name — add the name, don't add the variant.

Dark is the default and ships as the default. An inline script in `<head>` sets the
attribute from `localStorage` before first paint, so there is no flash. If the script fails
or JS is off, the page renders dark, which is the intended state anyway.

---

## Type

Three families, each with one job. No exceptions.

| Role | Family | Loaded as | Used for |
|---|---|---|---|
| Display | Outfit | `--font-display` | Headlines only. Landing hero, page titles, section heads. |
| Prose | Work Sans | `--font-prose` | Answer text. Long-form reading. Body copy. |
| Data | JetBrains Mono | `--font-mono` | Nav labels, table headers, every numeral, prompt text, domains, deltas, timestamps, badges. |

The split is functional, not decorative. **If a value was measured, it is set in mono.** If
it was written by a model or a human, it is set in prose. That is the fact/guess separation
the product requires — the reader learns it in about four seconds and never has to be told.

Sizes are defined once in `@theme inline` and referenced by name. Only these:

```
display-xl   clamp(2.75rem, 6vw, 4.75rem) / 1.02 / -0.035em   landing hero only
display-l    clamp(2rem, 4vw, 3rem)       / 1.08 / -0.03em    section heads
display-m    24px                         / 1.20 / -0.02em    page titles
metric       clamp(3rem, 7vw, 4.25rem)    / 1.00 / -0.04em    the score, mono, tabular-nums
prose        16px / 1.65     body, answer text
prose-s      15px / 1.6      secondary prose
mono         13px / 1.45     table cells, data
mono-s       11px / 1.3 / 0.09em   UPPERCASE labels, nav, headers, badges
```

`mono-s` is always uppercase, via the `.label` utility. Nothing else is ever uppercase —
no uppercase headlines. Buttons are the one deliberate exception: their labels are `.label`,
because a button label is a control, not a sentence.

All numerals use `font-variant-numeric: tabular-nums`, applied in base CSS to anything mono
or metric so it cannot be forgotten. Columns of numbers align on the decimal without any
effort from the reader.

Headings are sentence case. Always. "Share of voice", not "Share Of Voice".

---

## Color

Twelve tokens. If a design needs a colour that is not here, the design is wrong.

```
                dark (default)   light
paper           #070A12          #FBFAF7   page background
card            #0E1424          #FFFFFF   raised surface
wash            #131C30          #F1F2F6   inset fill: code blocks, table headers
rule            #1F2A44          #DFE3EC   hairlines
ink             #F2F5FA          #0F172A   primary text
graphite        #93A4C4          #55617A   secondary text
accent          #5B9DFF          #1D4ED8   brand blue, primary actions
accent-ink      #05080F          #FFFFFF   text on accent
accent-soft     #1A2947          #E5EDFF   accent at low emphasis
signal          #34D399          #15803D   measured up
alert           #FB7185          #BE123C   measured down
amber           #FBBF24          #B45309   in progress, estimated
```

`--glow` carries the accent as bare RGB channels so it can be used inside `rgb(… / α)` for
the hero wash and `.panel-glow`. It is the only colour permitted in a gradient or a shadow.

Rules that are not negotiable:

- **Structure comes from hairlines.** A panel is separated from the page by a 1px `rule`.
  Shadow is permitted only as `.panel-glow`, only in accent, and only to lift a single
  focal element off the page — the hero demo panel and the featured pricing card. It is
  never a generic card elevation.
- `signal` and `alert` carry meaning and are never used decoratively. A green button does
  not exist. `signal` on a number means that number went up.
- `amber` means "not final". Running, pending, estimated, demo. When a value is amber there
  is always mono text next to it saying why.
- **Never encode meaning in colour alone.** A negative delta is `alert` **and** carries a
  minus sign. A hit tick is filled **and** full height. A miss is a stub **and** dimmer.
- `graphite` is the floor for secondary text in both modes and both values clear 4.5:1 on
  their own `paper`. Nothing lighter than `graphite` ever carries words.

Focus is `2px solid accent` at `2px` offset, declared once on `:focus-visible` in base CSS.
**`outline-none` does not appear in this codebase.** It suppresses the keyboard ring along
with the mouse ring, which is the entire accessibility affordance.

---

## Radius

```
panel   14px    sections, cards, tables, the app shell's raised surfaces
card    10px    nested boxes inside a panel
chip    999px   badges, pills, the accent dot
```

This is a reversal of an earlier rule that set all radii to 0. Hard corners read as
severe on a near-black ground in a way they do not on paper — the eye reads a sharp
corner on dark as an artefact rather than an edge. Radii are still one of three values,
never ad hoc.

---

## The presence strip

The signature component. It answers "were we in the answer, over time" in one glance, and it
must read as a **comb** — a row of teeth of differing presence — not as a bar chart.

It takes `("hit" | "miss" | "drop")[]` and renders inline SVG. Not divs. Not a chart
library.

Geometry, exact and not configurable:

```
tick width        3px
pitch             5px          (3px tick + 2px gap)
tooth height     22px
baseline stub     2px
viewBox height   24px          baseline sits at y=22, 2px of air below
```

- **hit** — full tooth, `fill-ink`
- **miss** — a 2px stub on the baseline, `fill-graphite/55`, so absence still occupies its
  slot. The gap is visible as a gap.
- **drop** — full tooth, `fill-alert`, because a drop is a presence that was lost, not an
  absence.
- A 1px baseline at `fill-graphite/25` runs the full width under every tick.

Misses and the baseline are drawn in graphite, **not** in `rule`. On a near-black surface a
`rule`-coloured stub disappears completely and the strip stops reading as a comb with gaps —
it reads as a few bars floating in space, which loses the whole point of showing absence.

The strip scales by adding ticks, never by stretching them. A 30-run strip is 150px wide. A
full-width strip repeats the pitch to fill the container and takes as many buckets as fit.
Ticks never get wider than 3px and never get rounded.

Any legend for the strip uses the strip's own shapes — a full tooth for a hit, a stub for a
miss — not colour chips. A key that doesn't look like the graphic isn't a key.

---

## Motion

Motion exists to show causality — this appeared *because* you scrolled here, this changed
*because* you clicked. It never exists to decorate an entrance.

- Micro-interactions: 200ms. Scroll reveals: 480ms on a `cubic-bezier(0.22, 1, 0.36, 1)`.
  Theme swap: 220ms, and only on `background-color`, `border-color`, `color`.
- Only `opacity` and `transform` are animated. Never `width`, `height`, `top`, or `left`.
- Stagger within a group stays under ~300ms total. Past that it reads as a slow page.
- Hover never changes layout. Colour, border, and shadow only — no `scale` that nudges
  neighbours.
- `prefers-reduced-motion: reduce` collapses every duration to ~0 and renders all revealed
  content in its final state. This is enforced globally in `globals.css` and additionally
  checked in JS before any observer is created.

**Scroll reveal must fail open.** Content is visible by default; the class that hides
un-revealed elements is only added to `<html>` once the reveal component has mounted, and
every element also reveals itself on a 1400ms timer regardless of whether its observer ever
fires. An earlier version hid content up front and relied on a single IntersectionObserver
to bring it back — when that mechanism failed, entire sections of the page stayed
permanently blank. A missing animation is a far cheaper failure than missing content, so
the mechanism is built to degrade in that direction.

---

## Layout

**App shell.** Fixed 220px left sidebar, full height, 1px `rule` on its right edge. No top
bar. No breadcrumbs. No search field in a header. The sidebar holds the logo, the theme
toggle, the workspace name, the brand switcher, and the nav — nav labels in `mono-s`
uppercase, `graphite`, with the active item in `ink` on an `accent-soft` pill and a 2px
`accent` bar in the left gutter.

Content area: 32px padding, max content width 1100px, left aligned. Not centered.

**Vertical rhythm.** 8px base unit. Section gaps are 48px. Within a section, 16px. Nothing
gets 5px or 13px.

**Tables.** The product is mostly tables and they are the main thing to get right.

- Horizontal hairline rules only. No vertical borders, ever.
- No zebra striping.
- Row hover is a `wash/50` fill. (Revised: the old left-gutter hover bar was invisible
  against a dark row and gave no feedback that the row was live.)
- Header row: `mono-s` uppercase `graphite`, `wash` background, 1px `rule` beneath.
- Numeric and prompt-text cells: mono, tabular-nums. Numeric columns right-aligned.
- Row height 44px. Dense, but not cramped.
- Sort indicator is a mono `↓` in the header, not an icon.
- A table wider than its container scrolls inside its own `overflow-x-auto` wrapper. The
  page body never scrolls horizontally.

**Buttons.** Primary is `accent` fill, `accent-ink` text, 36px tall, `mono-s` uppercase
label, 16px horizontal padding. Secondary is a 1px `rule` border on transparent with `ink`
text. There is no third style. Destructive actions use the secondary shell with `alert`
text, never an alert fill. Every clickable element carries `cursor-pointer`, and hit targets
are at least 44px in any touch context.

**Empty states.** Never a spinner and never an illustration. One line of prose saying what
is missing, and one line of mono saying what will fix it. During the first run, show what is
happening and roughly how long it takes — "Running 25 prompts, 3 times each, across 1 model.
About 2 minutes." — with a live count, not a progress bar with a fake percentage.

---

## Language

The product's hardest job is being understood in five seconds by someone who has never
heard the phrase "answer engine optimisation". Copy is held to the same standard as type.

- **Say the thing, don't gesture at it.** "Your competitors are in the answer, you are not"
  was cut for exactly this reason — it requires the reader to already know what "the answer"
  refers to. "When someone asks AI which company to use, does it say your name?" does not.
- **We do the work; the client does nothing.** Every step is written in first person about
  what Ledger does, paired with what the reader is thereby spared: "We write the fix / You
  never guess what to do."
- **No jargon in a headline.** "Schema markup", "structured data", "share of voice" may
  appear in a body sentence that defines them. They may not appear in something the reader
  meets first.
- **Never show raw JSON, code, or a payload to a non-technical reader.** A fix is explained
  as a problem box and a what-we-do box. The code lives behind the approval screen, where
  the person reading it has opted in.
- Every percentage derived from fewer than 100 observations shows its sample size beside it,
  in words: "You were named in 32 of 75 answers."

---

## What this must not look like

Binding. If a change would add anything on this list, the change is wrong. This list exists
because the default output of any AI-assisted build is a purple gradient SaaS page, and the
whole point of Ledger's surface is that it does not look like the eleven tools it competes
with.

**Never:**

1. Mesh gradients, animated blobs, particle fields, or a grid pattern fading out at the
   edges. A single radial accent wash behind the hero is the entire permitted budget, and
   `.text-gradient` may appear once per page at most.
2. Purple or violet anywhere. The accent is one blue and it is in the table above.
3. Generic drop shadows as card elevation. `.panel-glow` on a focal element only.
4. A product screenshot inside a floating browser chrome mockup with a shadow and a tilt.
5. A "Trusted by" strip of greyed-out logos, especially of companies who are not customers.
6. Emoji. In the UI, in the copy, in the email, in commit messages, anywhere.
7. Icon libraries used decoratively. Icons appear only where they label a distinct concept
   the reader must hold — the four steps, the three fix types — and are inline SVG at a
   24×24 viewBox, never an emoji and never a raster.
8. A "Book a demo" button next to the primary call to action in the hero.
9. Numbered steps where the numbering is decorative rather than an actual sequence.
10. A newsletter signup or a row of social icons in the footer.
11. Spinners, skeleton shimmer, or indeterminate progress bars as loading states. A real
    run shows its real stage list and a real count.
12. Stock photography, 3D renders, isometric illustrations, or abstract AI orb imagery.
13. Testimonial cards with a round headshot and a five-star row.
14. Title Case On Headings.
15. A visibility score presented to two decimal places as though it were precise. It is a
    percentage of a small sample and it is rendered as a whole number.
16. A metric on the landing page that is not read live from the database. Every number
    shown as evidence is a real row or it is not shown.

**Deliberately overridden.** These were on the "never" list and were changed on the
product owner's explicit instruction. They are recorded here so nobody "fixes" them back:

- **Three pricing cards with a highlighted middle one.** Now the pricing layout. The badge
  reads "Most chosen", not "Most popular", and the plan is the one actually recommended.
- **A dark surface with light text.** Now the default for the entire product, not a hero
  band sitting above a light page — the inconsistency was the real problem, not the dark.
- **Rounded corners.** See the radius table above.
- **Feature cards in a row with an icon in a rounded square.** Used for the four steps and
  the three fix types, because the alternative was a wall of prose that tested worse.

**Always:**

- One primary action per screen.
- Measured values in mono, generated text in prose, and never the reverse.
- Negative numbers shown exactly as prominently as positive ones.
- Sample size visible next to any percentage derived from fewer than 100 observations.
- Both themes checked before anything ships.
