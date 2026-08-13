# DESIGN.md

Ledger is an instrument, not a dashboard. It measures whether AI assistants recommend a
brand, and it proves whether a fix moved the number. Everything below serves that: the
reader must be able to tell measurement from estimate, and fact from generated text, at a
glance and without reading a legend.

The reference points are a lab notebook, a Swiss timetable, and a printed financial
statement. They are not other SaaS products.

---

## Type

Three families, each with one job. No exceptions.

| Role | Family | Loaded as | Used for |
|---|---|---|---|
| Display | Bricolage Grotesque | `--font-display` | Headlines only. Landing hero, page titles, section heads. |
| Prose | Newsreader | `--font-prose` | Answer text. Long-form reading. Landing body copy. |
| Data | JetBrains Mono | `--font-mono` | Nav labels, table headers, every numeral, prompt text, domains, deltas, timestamps, badges. |

The split is functional, not decorative. **If a value was measured, it is set in mono.** If
it was written by a model or a human, it is set in prose. That is the fact/guess separation
the product requires — the reader learns it in about four seconds and never has to be told.

Sizes. Only these.

```
display-xl   72px / 0.95 / -0.03em   Bricolage 500   landing hero only
display-l    40px / 1.05 / -0.02em   Bricolage 500   section heads
display-m    24px / 1.15 / -0.01em   Bricolage 500   page titles
metric       56px / 1.00 / -0.02em   Mono 500        the visibility score, tabular-nums
prose        16px / 1.6              Newsreader 400  answer text, paragraphs
prose-s      14px / 1.55             Newsreader 400  secondary prose
mono         13px / 1.4              Mono 400        table cells, data
mono-s       11px / 1.3 / 0.08em     Mono 500        UPPERCASE labels, nav, headers, badges
```

`mono-s` is always uppercase. Nothing else is ever uppercase — no uppercase headlines,
no uppercase buttons.

All numerals use `font-variant-numeric: tabular-nums`. Columns of numbers must align on the
decimal without any effort from the reader.

Headings are sentence case. Always. "Share of voice", not "Share Of Voice".

---

## Color

Eight tokens. There is no ninth. If a design needs a color that is not here, the design is
wrong.

```
paper     #FBFAF7   page background. warm off-white, never #FFF, never a gradient
card      #FFFFFF   raised surface. used sparingly, separated by rule not shadow
wash      #F2F0EA   inset fill: strip backgrounds, code blocks, table header row
rule      #E3E0D8   hairlines. 1px. the only structural device in the product
ink       #16150F   primary text, filled ticks, buttons
graphite  #6B6862   secondary text, competitor names, timestamps, axis labels
signal    #14713B   brand present, positive delta, approved
alert     #A8321E   brand absent where it was present, negative delta, over limit
amber     #B4740E   in progress, pending verification, estimated values
```

Rules that are not negotiable:

- **Structure comes from hairlines, never from shadows.** `box-shadow` does not appear in
  this codebase. Not on cards, not on buttons, not on dropdowns, not on modals. A panel is
  separated from the page by a 1px `rule`, or by whitespace, or it does not need separating.
- **Border radius is 0.** Buttons, inputs, badges, cards, panels — all hard corners. The
  single exception is the SVG tick, which has none anyway.
- `signal` and `alert` carry meaning and are never used decoratively. A green button does
  not exist. `signal` on a number means that number went up.
- `amber` means "not final". Running, pending, estimated. When a value is amber, there is
  always mono text next to it saying why.
- Never encode meaning in color alone. A negative delta is `alert` **and** carries a minus
  sign. A hit tick is filled **and** full height.

Focus is `2px solid ink` with a `2px` offset. Visible on every interactive element, never
removed.

---

## The presence strip

The signature component. It answers "were we in the answer, over time" in one glance, and it
must read as a **comb** — a row of teeth of differing presence — not as a bar chart.

It takes `("hit" | "miss" | "drop")[]` and renders inline SVG. Not divs. Not a chart
library.

Geometry, exact:

```
tick width        3px
pitch             5px          (3px tick + 2px gap)
tooth height     22px
baseline stub     2px
viewBox height   24px          baseline sits at y=22, 2px of air below
```

- **hit** — `rect x=i*5 y=0 width=3 height=22 fill=ink`
- **miss** — `rect x=i*5 y=20 width=3 height=2 fill=rule` — a stub on the baseline, so
  absence still occupies its slot. The gap is visible as a gap.
- **drop** — `rect x=i*5 y=0 width=3 height=22 fill=alert` — a full tooth, because a drop is
  a presence that was lost, not an absence.
- A 1px `rule` baseline runs the full width at `y=22`, under every tick.

The strip scales by adding ticks, never by stretching them. A 30-run strip is 150px wide. A
full-width strip repeats the pitch to fill the container and takes as many buckets as fit.
Ticks never get wider than 3px and never get rounded.

On the landing page the strip draws itself left to right over 900ms with a linear ease,
ticks appearing in order. Under `prefers-reduced-motion: reduce` it renders complete on
first paint with no animation. Nowhere else in the product does it animate.

---

## Layout

**App shell.** Fixed 220px left sidebar, full height, 1px `rule` on its right edge. No top
bar. No breadcrumbs. No search field in a header. The sidebar holds the workspace name, the
brand switcher, and the nav — nav labels in `mono-s` uppercase, `graphite`, with the active
item in `ink`. No icons in the nav. A 2px `ink` bar on the left edge marks the active item.

Content area: 32px padding, max content width 1100px, left aligned. Not centered.

**Vertical rhythm.** 8px base unit. Section gaps are 48px. Within a section, 16px. Nothing
gets 5px or 13px.

**Tables.** The product is mostly tables and they are the main thing to get right.

- Horizontal hairline rules only. No vertical borders, ever.
- No zebra striping.
- No row hover fill. Hover shows a 2px `ink` bar in the left gutter instead.
- Header row: `mono-s` uppercase `graphite`, `wash` background, 1px `rule` beneath.
- Numeric and prompt-text cells: mono, tabular-nums. Numeric columns right-aligned.
- Row height 44px. Dense, but not cramped.
- Sort indicator is a mono `↓` in the header, not an icon.

**Buttons.** Primary is `ink` fill, `paper` text, 0 radius, 36px tall, mono-s uppercase
label, 16px horizontal padding. Secondary is 1px `rule` border on `paper`, `ink` text. There
is no third button style. Destructive actions use ink with `alert` text, never an alert fill.

**Empty states.** Never a spinner and never an illustration. One line of prose saying what
is missing, and one line of mono saying what will fix it. During the first run, show what is
happening and roughly how long it takes — "Running 25 prompts, 3 times each, across 1 model.
About 2 minutes." — with a live count, not a progress bar with a fake percentage.

---

## What this must not look like

Binding. If a change would add anything on this list, the change is wrong. This list exists
because the default output of any AI-assisted build is a purple gradient SaaS page, and the
whole point of Ledger's surface is that it does not look like the eleven tools it competes
with.

**Never:**

1. Gradient backgrounds, gradient text, mesh gradients, animated blobs, particle fields, or
   a grid pattern fading out at the edges.
2. Purple, violet, indigo, or electric blue anywhere. The palette above is the whole palette.
3. Drop shadows. Any elevation of any size on any element.
4. Rounded corners above 0px. No pill buttons, no rounded cards, no circular avatars.
5. A dark hero with light text sitting above a light page.
6. A product screenshot inside a floating browser chrome mockup with a shadow and a tilt.
7. Three feature cards in a row, each with an icon in a rounded square.
8. A "Trusted by" strip of greyed-out logos, especially of companies who are not customers.
9. Emoji. In the UI, in the copy, in the email, in commit messages, anywhere.
10. Icon libraries used decoratively. The product ships almost no icons; hairlines and type
    do the work.
11. A highlighted middle pricing card labelled "Most popular".
12. A "Book a demo" button next to the primary call to action in the hero.
13. Numbered steps where the numbering is decorative rather than an actual sequence.
14. A newsletter signup or a row of social icons in the footer.
15. Spinners, skeleton shimmer, or indeterminate progress bars as loading states.
16. Stock photography, 3D renders, isometric illustrations, or abstract AI orb imagery.
17. Testimonial cards with a round headshot and a five-star row.
18. Title Case On Headings.
19. A visibility score presented to two decimal places as though it were precise. It is a
    percentage of a small sample and it is rendered as a whole number.

**Always:**

- One primary action per screen.
- Measured values in mono, generated text in prose, and never the reverse.
- Negative numbers shown exactly as prominently as positive ones.
- Sample size visible next to any percentage derived from fewer than 100 observations.
