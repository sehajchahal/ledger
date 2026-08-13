# Build script

Paste these into Claude Code one at a time, in order. Do not paste two phases at once.
After each phase, run the app and check the verification step before moving on.

Before you start: put `CLAUDE.md` and `DESIGN.md` in the repo root.

Product name placeholder below is **Ledger**. Replace it everywhere with whatever you land on.

---

## Phase 0: setup

> Set up a new Next.js 15 project with TypeScript, the App Router, and Tailwind. Add Drizzle
> ORM configured for Postgres, and dotenv. Create `config/models.ts` exporting a map of job
> name to model id, with `probe`, `classify`, `diagnose`, and `draft` as the job names, all
> pointing at placeholder strings for now. Create `lib/ai/router.ts` exporting an async
> `runJob(jobName, input)` that reads from that config and throws "not implemented" for now.
> Add the fonts from DESIGN.md via next/font and wire the color tokens into
> `tailwind.config.ts` as named colors. Deploy nothing yet. Show me the file tree when done.

**Verify:** `npm run dev` serves a blank page with the right background color.

---

## Phase 1: schema

> Write the Drizzle schema and migration for these tables. Follow the column names exactly.
>
> - `organizations`: id, name, plan (enum: starter, growth, enterprise), created_at
> - `workspaces`: id, org_id, name, created_at
> - `users`: id, email, name, created_at
> - `memberships`: id, user_id, org_id, role (enum: owner, editor, viewer)
> - `brands`: id, workspace_id, name, domain, aliases (text array), created_at
> - `competitors`: id, brand_id, name, aliases (text array)
> - `prompts`: id, brand_id, text, intent (enum: discovery, comparison, problem, branded), active (bool)
> - `runs`: id, brand_id, status (enum: queued, running, complete, failed), started_at, completed_at
> - `answers`: id, run_id, prompt_id, model, probe_index (int), raw_text (text), citations (jsonb), created_at
> - `mentions`: id, answer_id, entity_name, is_brand (bool), char_position (int), is_recommendation (bool, nullable)
> - `actions`: id, brand_id, type (enum: schema_markup, page_edit, offsite_target), title, body (text), status (enum: proposed, approved, shipped, dismissed), proposed_at, shipped_at, approved_by
> - `verifications`: id, action_id, run_before_id, run_after_id, delta (numeric), checked_at
> - `digests`: id, workspace_id, cadence (enum: daily, weekly, monthly), recipient_email, last_sent_at
>
> Add indexes on the foreign keys and on `answers(run_id, prompt_id)`. Write a seed script
> that creates one org, one workspace, one brand with three competitors, and 25 prompts.

**Verify:** seed runs, and you can query the brand and its prompts from a script.

---

## Phase 2: the probe runner

> Build the probe runner as a standalone script at `scripts/run-probe.ts` before wiring any
> UI to it.
>
> It takes a brand id, creates a `runs` row with status `running`, loads all active prompts
> for that brand, and for each prompt calls the `probe` job through `lib/ai/router.ts` three
> times (probe_index 0, 1, 2). Implement the `probe` job against the Perplexity API with
> web search enabled, storing the full response text in `answers.raw_text` and the returned
> source URLs in `answers.citations`. Run prompts with a concurrency limit of 4 and retry
> once on failure. Mark the run complete when all answers are stored.
>
> Handle a failed probe by storing nothing for that probe_index rather than storing an empty
> answer, and log it.

**Verify:** run the script, then check you have 75 rows in `answers` with real text.

---

## Phase 3: the parser

> Build `lib/parse/mentions.ts`. This is deterministic TypeScript with no model calls.
>
> Given an answer row, a brand (name plus aliases), and its competitors, it:
> - finds every case-insensitive whole-word occurrence of the brand and each competitor
> - records the character position of the first occurrence of each entity
> - writes one `mentions` row per distinct entity found, with `is_brand` set correctly
> - leaves `is_recommendation` null
>
> Watch out for substring collisions: a brand called "Arc" must not match "architecture".
> Use word boundaries and normalize punctuation and possessives before matching.
>
> Then write `lib/parse/metrics.ts` with pure functions:
> - `visibilityScore(runId)`: percentage of probes across all prompts where the brand appeared
> - `promptMentionRate(runId, promptId)`: how many of the 3 probes mentioned the brand
> - `shareOfVoice(runId)`: mention count per entity as a percentage of all entity mentions
> - `citedDomains(runId)`: cited domains ranked by frequency, with whether each is the brand's own domain
>
> Write unit tests for the matcher using at least six saved sample answers including the
> substring collision case.

**Verify:** tests pass, and running the parser over your seeded run produces sane numbers.

---

## Phase 4: the app shell and brand overview

> Build the app shell per DESIGN.md: fixed 220px left sidebar, mono uppercase nav labels,
> no top bar. Nav items: Overview, Prompts, Competitors, Sources, Fixes, Settings.
>
> Then build the Overview page for a brand:
> - Top row: visibility score as a large mono number, the delta from the previous run beside
>   it in signal or alert, and the timestamp of the last check
> - Below it: one full-width aggregate presence strip covering all prompts across the last
>   30 runs
> - Below that: share of voice as a horizontal stacked bar, brand first, competitors after,
>   labeled in mono
> - A "Run checks now" button that enqueues a run and shows an amber running indicator
>
> Build the presence strip as a reusable `<PresenceStrip>` component taking an array of
> "hit" | "miss" | "drop". Render it as inline SVG, not divs. Follow the tick geometry in
> DESIGN.md exactly.

**Verify:** the overview renders real seeded data and the strip looks like a comb, not a chart.

---

## Phase 5: prompts, competitors, sources

> Build three table pages. All tables: horizontal hairline rules only, no vertical borders,
> no zebra striping, mono for all numeric and prompt-text cells.
>
> **Prompts**: each row shows the prompt text, its intent badge, mention rate as "2/3", the
> per-prompt presence strip across recent runs, and first-mention position. Clicking a row
> opens a detail panel showing the full raw answer text from the most recent probe with
> brand and competitor names highlighted inline (brand in signal, competitors in graphite).
> Add prompt create, edit, and deactivate.
>
> **Competitors**: each competitor with their mention rate, share of voice, and the count of
> prompts where they appear and the brand does not. Sort by that last column descending,
> since it's the most actionable view. Add and remove competitors.
>
> **Sources**: cited domains ranked by how often they appear across all answers, with a flag
> for whether the brand's own domain appears. This is the page that shows a client which
> third-party pages the models actually trust.

**Verify:** all three render, and the answer detail panel highlights entities correctly.

---

## Phase 6: onboarding

> Build the onboarding flow. It must take under three minutes and ask for nothing the user
> has to look up.
>
> Step 1: paste a website URL. Fetch the page, extract the company name, description, and
> obvious product category.
> Step 2: call the `diagnose` job to generate 25 candidate prompts a real buyer would type,
> spread across the four intents, plus a suggested competitor list. Show them as an editable
> list with checkboxes, all checked by default.
> Step 3: user confirms, we create the brand, prompts, and competitors, enqueue the first
> run, and drop them on the overview with the run in progress.
>
> The empty overview during that first run must show what's happening and roughly how long
> it takes, not a spinner.

**Verify:** run it against a real company's URL and check the generated prompts are ones a
buyer would actually type.

---

## Phase 7: fixes

> Build the Fixes page and the action pipeline. Three action types only.
>
> **Schema markup**: for a prompt where the brand is absent, call the `draft` job with the
> brand's relevant page content and generate valid JSON-LD (Organization, Product, or FAQPage
> as appropriate). Validate the JSON-LD structurally before saving. Present it as a copyable
> code block with a one-line explanation of where to paste it.
>
> **Page edit**: identify the brand page most relevant to a missed prompt, and generate a
> rewritten section as a before/after diff, not a wall of new text. The user copies the after.
>
> **Offsite target**: from the Sources data, list the third-party domains cited for prompts
> where the brand is absent, and for each generate a specific one-line action. This needs no
> model call for the ranking, only for the action line.
>
> Each action is a card with: type badge, the prompt it addresses, the generated fix, and two
> buttons, "Approve" and "Dismiss". Approving sets status to approved and records who. There
> is a separate "Mark as shipped" control, because we do not touch the customer's site.
>
> Enforce the monthly action allowance per plan tier before generating.

**Verify:** generate one of each type against real data and check the JSON-LD validates.

---

## Phase 8: the verification loop

> This is the feature the product exists for. Build it carefully.
>
> When an action is marked shipped, record the id of the most recent completed run as
> `run_before_id` on a new `verifications` row. Schedule a verification check 14 days out.
>
> When that check fires, run the affected prompts, store `run_after_id`, and compute the
> delta in mention rate for those prompts specifically, not for the whole brand.
>
> On the Fixes page, every shipped action shows its verification state: pending with a
> countdown, or a resolved delta in signal or alert. A negative delta is displayed as plainly
> as a positive one. Do not hide or soften it.
>
> Add a "Proof" view listing every shipped action chronologically with its delta, exportable
> as CSV. This is what a customer forwards to their boss.

**Verify:** manually backdate an action and confirm the verification job computes the delta.

---

## Phase 9: the agent and digests

> Build the scheduled agent. Its job is not to email a summary, it is to detect a change,
> prepare a fix, and ask for a decision.
>
> On each completed run, compare against the previous run. If any prompt lost the brand's
> mention, or a competitor gained a position the brand held, create a proposed action for it
> automatically via the same pipeline as Phase 7.
>
> The digest email contains: the visibility score and delta, the presence strip rendered as
> an inline image or table-based HTML fallback, the top three changes in plain sentences, and
> for each proposed action an "Approve" button that hits a signed link and approves it
> without requiring login.
>
> Cadence is per workspace: daily, weekly, or monthly, set in Settings. Add an "alert me
> immediately" toggle for drops above a threshold the user sets.
>
> Render the email with React Email. Test it renders in Outlook.

**Verify:** trigger a digest to yourself and click Approve from the email.

---

## Phase 10: accounts, workspaces, plans

> Add Auth.js with email magic link. Wire `memberships` so a user sees only their org's
> workspaces. Roles: owner can manage billing and members, editor can approve actions, viewer
> is read-only and the approve buttons are absent, not disabled.
>
> Add workspace switching in the sidebar. Multiple brands per workspace, multiple workspaces
> per org. This is what makes it usable for an agency, and it's why we build it now rather
> than retrofitting.
>
> Add plan limits as a single `lib/limits.ts` module: prompt count, check frequency, action
> allowance per month. Every enqueue path checks it. When a limit is hit, the UI says which
> limit and what it would take to lift it, in plain language.
>
> Add an audit log table recording who approved or dismissed each action, and surface it on
> the workspace settings page.

**Verify:** create a second workspace, invite a viewer, confirm they can't approve.

---

## Phase 11: the landing page

> Build the landing page. Read DESIGN.md again first. It must not look like a standard AI
> SaaS landing page, and the checklist of things to avoid at the bottom of DESIGN.md is
> binding.
>
> **Hero.** No headline-over-gradient. The hero is a live demonstration: show a real prompt
> in mono at the top, then a realistic AI answer rendered as body text below it, with four
> competitor names highlighted inline and one conspicuous gap where the visitor's brand
> would be. Beneath the answer, the presence strip draws itself left to right over 900ms,
> mostly hollow. The headline sits to the left of, or above, this in Bricolage Grotesque at
> 72px, and it states the problem in one line rather than selling. Single primary button:
> "Check your brand". No secondary "Book a demo" button in the hero.
>
> **The check.** An email-free interactive strip: visitor types their domain, we run three
> real prompts live and show the resulting presence strip. This is the whole product in
> fifteen seconds and it is the reason anyone signs up. Rate limit it by IP.
>
> **How it works.** Four steps, and here numbering is legitimate because it is a real
> sequence: measure, diagnose, fix, prove. Each step gets a small piece of real UI from the
> app, cropped, not a mockup in a floating browser frame. Hairline rules between steps.
>
> **The proof section.** The differentiator, stated plainly: a real Proof view table with
> shipped actions and their measured deltas, including one negative delta left visible.
> Headline copy along the lines of "Other tools stop at the diagnosis."
>
> **Pricing.** Three tiers as a plain table, not as three cards with a highlighted middle
> one. Mono numbers. State the prompt count, check frequency, and monthly fix allowance for
> each. No "Contact us" for the top tier unless it's genuinely custom.
>
> **Footer.** Hairline, mono links, no newsletter signup, no social icon row.
>
> Write all the copy yourself following the copy rules in CLAUDE.md. Sentence case, plain
> verbs, no exclamation marks, no "Supercharge" or "Unlock" or "Revolutionize". Responsive
> to 375px, visible keyboard focus, reduced motion respected.

**Verify:** open it at 375px and 1440px, tab through it with the keyboard, and check it
against the "what this must not look like" list.

---

## Phase 12: hardening

> - Add error boundaries and real empty states to every page, written per the copy rules
> - Add rate limiting on the public check endpoint
> - Add a health check route and structured logging on the job runner
> - Add a second model to the probe job (ChatGPT with web search) and a model column filter
>   on the prompts table so results can be compared side by side
> - Write a README with setup, env vars, and how to run a probe manually

---

## Order notes

If you have to stop early, phases 0 through 5 are a complete, demoable measurement product.
Phase 8 is what makes it different from everything else on the market, so it beats phases 9
and 10 if you're choosing. Phase 11 can be built any time after phase 5, since it only needs
screenshots of real UI.
