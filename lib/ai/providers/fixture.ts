import type { ModelSpec } from "@/config/models";
import type { JobInput, JobResult, ProbeContext } from "@/lib/ai/types";

/**
 * Synthesises realistic answers locally so the whole product is demoable with
 * no API keys and no spend.
 *
 * This is not a measurement and the UI must never present it as one. Answers
 * produced here carry a `fixture/` model prefix, which is what every surface
 * keys off to label the run as demo data.
 *
 * Output is deterministic for a given (prompt, probeIndex, runSeed): replaying
 * a run reproduces it exactly. Across runs it varies, because real answer
 * engines vary run to run and a demo that returned identical answers forever
 * would make the verification loop look more certain than it is.
 */

/* ------------------------------------------------------- seeded randomness -- */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)];
}

function shuffle<T>(next: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* --------------------------------------------------------------- corpus -- */

/**
 * How often the brand shows up, by intent. These numbers describe a small
 * business that has never done this work: nearly invisible on the discovery
 * prompts that bring in new customers, present when someone already knows the
 * name. That gap is the product's entire argument, so the demo has to show it.
 */
const BRAND_APPEARANCE_RATE: Record<ProbeContext["intent"], number> = {
  discovery: 0.2,
  comparison: 0.44,
  problem: 0.24,
  branded: 0.95,
};

/** Chance that a prompt's outcome differs from its settled state on a given run. */
const RUN_FLIP_RATE = 0.1;

const DESCRIPTORS = [
  "Runs both small-group and one-on-one sessions, with tutors assigned by subject rather than rotated.",
  "Has operated in the area for over a decade and comes up regularly in local parent groups.",
  "Offers a free initial assessment and matches each student to a single tutor for continuity.",
  "Strong reviews for exam preparation, though several parents note limited weekend availability.",
  "Focuses on rebuilding fundamentals rather than homework help, which suits students who have fallen behind.",
  "Flexible scheduling and online sessions, which comes up often for families outside the immediate area.",
  "Publishes its pricing openly, which reviewers repeatedly cite as a reason they chose it.",
  "Reports progress to parents after every session, a detail that appears in most positive reviews.",
];

const OPENERS = [
  "Based on recent reviews and local directory listings, these come up most often:",
  "Several options are consistently recommended for this. The ones mentioned most frequently:",
  "Drawing on parent forums, review sites, and local listings, the most commonly suggested providers are:",
  "There are a handful of well-reviewed options. Here is what comes up most:",
];

const CLOSERS = [
  "Pricing generally runs $45 to $75 per hour in this area, with package discounts common. Availability tightens ahead of exam periods, so booking early helps.",
  "Most providers offer a trial session, which is worth using before committing to a package. Reviews suggest fit with the individual tutor matters more than the size of the company.",
  "It is worth calling two or three to compare approach and availability. Several parents note that the assessment process is the clearest signal of quality.",
  "Rates and availability vary by grade level and subject. Checking recent reviews rather than overall ratings tends to give a more accurate picture.",
];

const THIRD_PARTY_SOURCES = [
  "https://www.reddit.com/r/askTO/comments/local_tutoring_recommendations",
  "https://www.yelp.ca/search?find_desc=tutoring&find_loc=North+York%2C+Toronto",
  "https://www.ourkids.net/tutoring/toronto",
  "https://www.toronto.com/directory/tutoring-services",
  "https://www.blogto.com/city/best-tutors-toronto",
  "https://www.google.com/maps/search/math+tutor+north+york",
  "https://www.canadianparents.ca/education/choosing-a-tutor",
  "https://www.reddit.com/r/OntarioGrade12s/comments/tutor_worth_it",
];

function domainFor(name: string): string {
  return `https://www.${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.ca`;
}

/* --------------------------------------------------------------- provider -- */

export async function fixtureProvider(
  input: JobInput,
  spec: ModelSpec,
): Promise<JobResult> {
  const ctx = input.context;

  // Two streams. `stable` depends only on the prompt and probe index, so a
  // prompt the brand owns keeps being owned; `next` also depends on the run, so
  // wording and citations move around. Presence is the stable decision with a
  // small chance of flipping — real engines drift, they do not re-roll from
  // scratch every day, and a demo that churned 30% of prompts per run would
  // make the presence strip look like noise.
  const stable = rng(hash(`${input.prompt}::${ctx?.probeIndex ?? 0}`));
  const next = rng(
    hash(`${input.prompt}::${ctx?.probeIndex ?? 0}::${ctx?.runSeed ?? ""}`),
  );

  // Non-probe jobs (diagnose, draft, classify) have no entity context. They get
  // a clearly-marked placeholder rather than something that could be mistaken
  // for a real generated fix.
  if (!ctx) {
    return {
      text:
        "[demo mode] No model key is configured, so this text was generated locally " +
        "rather than by a model. Set ANTHROPIC_API_KEY in .env.local to generate real output.",
      citations: [],
      model: `fixture/${spec.model}`,
      isFixture: true,
    };
  }

  const settled = stable() < BRAND_APPEARANCE_RATE[ctx.intent];
  const brandAppears = next() < RUN_FLIP_RATE ? !settled : settled;
  const competitorCount = Math.min(
    ctx.competitors.length,
    2 + Math.floor(next() * 2), // 2 or 3
  );
  const chosenCompetitors = shuffle(next, ctx.competitors).slice(0, competitorCount);

  const entities: { name: string; isBrand: boolean }[] = chosenCompetitors.map((c) => ({
    name: c.name,
    isBrand: false,
  }));

  if (brandAppears) {
    // Where the brand lands in the list matters — first mention position is a
    // metric — so insert it at a seeded index rather than always appending.
    entities.splice(Math.floor(next() * (entities.length + 1)), 0, {
      name: ctx.brand.name,
      isBrand: true,
    });
  }

  const descriptors = shuffle(next, DESCRIPTORS);
  const body = entities
    .map((entity, i) => `**${entity.name}** — ${descriptors[i % descriptors.length]}`)
    .join("\n\n");

  const text = [pick(next, OPENERS), "", body, "", pick(next, CLOSERS)].join("\n");

  // Citations skew toward third-party sources, which is the point of the
  // Sources page: models trust directories and forums more than a brand's site.
  const citations = shuffle(next, THIRD_PARTY_SOURCES).slice(0, 2 + Math.floor(next() * 3));
  for (const entity of entities) {
    if (next() < 0.45) citations.push(domainFor(entity.name));
  }

  return {
    text,
    citations: [...new Set(citations)],
    model: `fixture/${spec.model}`,
    isFixture: true,
  };
}
