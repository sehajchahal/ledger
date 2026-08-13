import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, brands, competitors, mentions } from "@/lib/db/schema";

/**
 * Deterministic mention detection. No model calls, ever.
 *
 * Verification deltas are computed by re-running prompts and comparing mention
 * rates. If this file's output could drift for the same input, every delta the
 * product reports would be noise. So it is plain string matching, it is tested,
 * and it stays that way.
 */

export type Entity = {
  /** Canonical name, stored in `mentions.entity_name`. */
  name: string;
  /** Other surface forms that mean the same entity. */
  aliases: string[];
  isBrand: boolean;
};

export type FoundMention = {
  entityName: string;
  isBrand: boolean;
  /** Character offset of the first occurrence in the original text. */
  charPosition: number;
};

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a matcher for one surface form.
 *
 * Three things this has to get right:
 *
 *  - Whole words only. A brand called "Arc" must not match "architecture" or
 *    "Marc". Lookarounds are used rather than `\b` so that names which begin or
 *    end with punctuation still get a real boundary check.
 *  - Apostrophes are optional, so "Scholar's Edge" and "Scholars Edge" are the
 *    same entity, and a possessive like "Northside's tutors" still matches.
 *  - Words may be separated by any run of whitespace or dashes, so a line break
 *    or an en dash inside "Bright Path" does not hide the mention.
 */
function surfaceMatcher(surface: string): RegExp | null {
  const tokens = surface
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => escapeRegExp(token).replace(/['‘’]/g, "['‘’]?"));

  if (tokens.length === 0) return null;

  return new RegExp(
    `(?<![\\p{L}\\p{N}])${tokens.join("[\\s\\-\\u2010-\\u2015]+")}(?![\\p{L}\\p{N}])`,
    "giu",
  );
}

/**
 * Position-preserving normalisation. Every replacement is one character for one
 * character, so offsets found here are valid offsets into the original text.
 *
 * Answer engines emit markdown, and they do not always wrap a whole name in it:
 * "**Bright Path** Learning" is one company, and matching only the plain form
 * would silently drop the mention — which shows up as an understated mention
 * rate rather than as an error. Emphasis markers and zero-width characters are
 * therefore mapped to spaces, where the token separator already handles them.
 */
function normalise(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    // Markdown emphasis and inline code, which can fall inside a name.
    .replace(/[*_`]/g, " ")
    // Zero-width space, non-joiner, joiner, and BOM — invisible, and common in
    // text that has been through a scraper.
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, " ");
}

/**
 * Finds the first occurrence of each entity in `text`.
 *
 * Returns one entry per distinct entity, ordered by where it first appears.
 * Entities that do not appear are omitted — absence is represented by the row
 * not existing, never by a row with a sentinel position.
 */
export function findMentions(text: string, entities: readonly Entity[]): FoundMention[] {
  const haystack = normalise(text);
  const found: FoundMention[] = [];

  for (const entity of entities) {
    let earliest = -1;

    for (const surface of [entity.name, ...entity.aliases]) {
      const matcher = surfaceMatcher(surface);
      if (!matcher) continue;

      const match = matcher.exec(haystack);
      if (match && (earliest === -1 || match.index < earliest)) earliest = match.index;
    }

    if (earliest !== -1) {
      found.push({
        entityName: entity.name,
        isBrand: entity.isBrand,
        charPosition: earliest,
      });
    }
  }

  return found.sort((a, b) => a.charPosition - b.charPosition);
}

/** Every occurrence of an entity, not just the first. Used for highlighting. */
export function findAllOccurrences(
  text: string,
  entities: readonly Entity[],
): { start: number; end: number; entityName: string; isBrand: boolean }[] {
  const haystack = normalise(text);
  const spans: { start: number; end: number; entityName: string; isBrand: boolean }[] = [];

  for (const entity of entities) {
    for (const surface of [entity.name, ...entity.aliases]) {
      const matcher = surfaceMatcher(surface);
      if (!matcher) continue;

      for (const match of haystack.matchAll(matcher)) {
        spans.push({
          start: match.index,
          end: match.index + match[0].length,
          entityName: entity.name,
          isBrand: entity.isBrand,
        });
      }
    }
  }

  // Overlapping surface forms of the same entity ("Northside" inside "Northside
  // Tutoring") would render as nested highlights. Keep the longest span at each
  // starting position and drop anything it swallows.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: typeof spans = [];
  for (const span of spans) {
    const previous = merged[merged.length - 1];
    if (previous && span.start < previous.end) continue;
    merged.push(span);
  }
  return merged;
}

/** Loads the brand and its competitors as a single entity list. */
export async function entitiesForBrand(brandId: string): Promise<Entity[]> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) throw new Error(`no brand with id ${brandId}`);

  const rivals = await db.select().from(competitors).where(eq(competitors.brandId, brandId));

  return [
    { name: brand.name, aliases: brand.aliases, isBrand: true },
    ...rivals.map((c) => ({ name: c.name, aliases: c.aliases, isBrand: false })),
  ];
}

/**
 * Parses every answer in a run and writes the mentions rows.
 *
 * `is_recommendation` is left null. Deciding whether a mention reads as a
 * recommendation rather than a passing reference needs a model, and that is the
 * classify job's business, not the parser's.
 */
export async function parseRun(runId: string, brandId: string): Promise<number> {
  const entities = await entitiesForBrand(brandId);
  const rows = await db.select().from(answers).where(eq(answers.runId, runId));

  const toInsert = rows.flatMap((answer) =>
    findMentions(answer.rawText, entities).map((mention) => ({
      answerId: answer.id,
      entityName: mention.entityName,
      isBrand: mention.isBrand,
      charPosition: mention.charPosition,
      isRecommendation: null,
    })),
  );

  if (toInsert.length > 0) await db.insert(mentions).values(toInsert);
  return toInsert.length;
}
