import type { Entity } from "@/lib/parse/mentions";

/**
 * Saved sample answers used by the matcher tests.
 *
 * These are the shapes real answers actually take: markdown lists, prose,
 * possessives, typographic apostrophes, line-wrapped names, and — the one that
 * breaks naive matching — brand names that occur as substrings of ordinary
 * words.
 */

export const ENTITIES: Entity[] = [
  {
    name: "Northside Tutoring",
    aliases: ["Northside", "Northside Tutors"],
    isBrand: true,
  },
  { name: "Mathwise Academy", aliases: ["Mathwise"], isBrand: false },
  {
    name: "Bright Path Learning",
    aliases: ["Bright Path", "BrightPath"],
    isBrand: false,
  },
  {
    name: "Scholar's Edge Tutoring",
    aliases: ["Scholar's Edge", "Scholars Edge"],
    isBrand: false,
  },
];

/** A brand whose name is a substring of common English words. The hard case. */
export const ARC_ENTITIES: Entity[] = [
  { name: "Arc", aliases: [], isBrand: true },
  { name: "Vantage", aliases: [], isBrand: false },
];

export const SAMPLES = {
  /** 1. Brand and competitors both present, standard recommendation list. */
  brandPresent: `Based on recent reviews, these come up most often:

**Mathwise Academy** — Runs small-group sessions for grades 7 through 12.

**Northside Tutoring** — Offers a free initial assessment and keeps students with one tutor.

**Bright Path Learning** — Flexible scheduling and online sessions.

Most offer a trial session, which is worth using before committing.`,

  /** 2. Brand absent. The common case, and the one the product exists to surface. */
  brandAbsent: `Several options are consistently recommended for grade 9 math in North York:

**Mathwise Academy** — Strong reviews for exam preparation.

**Scholar's Edge Tutoring** — Focuses on rebuilding fundamentals.

**Bright Path Learning** — Publishes pricing openly.

Rates generally run $45 to $75 per hour in this area.`,

  /**
   * 3. The substring collision case. "Arc" appears inside "architecture",
   * "architects", "Marcus", and "search" — none are mentions. The bare "Arc"
   * near the end is the only real one.
   */
  substringCollision: `The architecture of a good study plan matters more than the tutor.
Marcus Reid, who architects curricula for several boards, notes that search
habits change as exams approach. Among local providers, Arc is the one parents
mention most, ahead of Vantage.`,

  /** 4. Possessives and a typographic apostrophe in a competitor's name. */
  possessivesAndApostrophes: `Northside's approach differs from Scholar’s Edge Tutoring.
Where Scholars Edge drills fundamentals, Northside Tutoring's tutors work
through the student's own coursework.`,

  /** 5. Aliases, a hard line wrap inside a name, and a hyphenated form. */
  aliasesAndLineWraps: `Two names dominate the local listings: Bright
Path Learning and Mathwise. A third, Bright-Path, is the same company under an
older brand. Northside Tutors is smaller but well reviewed.`,

  /** 6. Case variation and adjacent punctuation on every side. */
  casingAndPunctuation: `NORTHSIDE TUTORING, along with (Mathwise) and "Bright Path",
made the shortlist. mathwise academy — despite the lowercase listing — is the
same provider.`,

  /**
   * 7. The brand name inside a bare domain. "Northside" is followed by a letter,
   * so it is not a word-boundary match and must not be counted.
   */
  domainOnly: `Pricing for these providers is listed at northsidetutoring.ca and at
mathwiseacademy.ca. Neither publishes package rates.`,
} as const;
