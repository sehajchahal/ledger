import { describe, expect, it } from "vitest";
import { findAllOccurrences, findMentions } from "@/lib/parse/mentions";
import { ARC_ENTITIES, ENTITIES, SAMPLES } from "@/lib/parse/samples";

const names = (text: string, entities = ENTITIES) =>
  findMentions(text, entities).map((m) => m.entityName);

describe("findMentions", () => {
  it("finds the brand and competitors in a standard recommendation list", () => {
    const found = findMentions(SAMPLES.brandPresent, ENTITIES);

    expect(found.map((m) => m.entityName)).toEqual([
      "Mathwise Academy",
      "Northside Tutoring",
      "Bright Path Learning",
    ]);
    expect(found.find((m) => m.entityName === "Northside Tutoring")?.isBrand).toBe(true);
    expect(found.find((m) => m.entityName === "Mathwise Academy")?.isBrand).toBe(false);
  });

  it("omits the brand entirely when it does not appear", () => {
    expect(names(SAMPLES.brandAbsent)).not.toContain("Northside Tutoring");
    expect(names(SAMPLES.brandAbsent)).toEqual([
      "Mathwise Academy",
      "Scholar's Edge Tutoring",
      "Bright Path Learning",
    ]);
  });

  it("does not match a short brand name inside longer words", () => {
    const found = findMentions(SAMPLES.substringCollision, ARC_ENTITIES);
    const arc = found.find((m) => m.entityName === "Arc");

    expect(arc).toBeDefined();

    // The only real "Arc" is the standalone one near the end. If the matcher
    // had hit "architecture", the position would be far earlier.
    const standalone = SAMPLES.substringCollision.indexOf("Arc is the one");
    expect(arc!.charPosition).toBe(standalone);
  });

  it.each([
    ["architecture", "The architecture is sound."],
    ["architects", "She architects curricula."],
    ["Marcus", "Marcus Reid teaches there."],
    ["search", "Their search habits changed."],
    ["Arcadia", "Arcadia Learning is unrelated."],
  ])("treats %s as a non-match for the brand Arc", (_label, text) => {
    expect(findMentions(text, ARC_ENTITIES)).toEqual([]);
  });

  it("handles possessives and typographic apostrophes", () => {
    const found = names(SAMPLES.possessivesAndApostrophes);

    expect(found).toContain("Northside Tutoring");
    expect(found).toContain("Scholar's Edge Tutoring");
  });

  it("matches aliases across line wraps and hyphenated forms", () => {
    const found = names(SAMPLES.aliasesAndLineWraps);

    expect(found).toContain("Bright Path Learning");
    expect(found).toContain("Mathwise Academy");
    expect(found).toContain("Northside Tutoring");
  });

  it("is case insensitive and tolerates adjacent punctuation", () => {
    const found = names(SAMPLES.casingAndPunctuation);

    expect(found).toContain("Northside Tutoring");
    expect(found).toContain("Mathwise Academy");
    expect(found).toContain("Bright Path Learning");
  });

  it("does not count a brand name embedded in a bare domain", () => {
    expect(names(SAMPLES.domainOnly)).toEqual([]);
  });

  it("records the first occurrence, not a later one", () => {
    const text = "Mathwise is fine. Northside Tutoring is better. Northside again.";
    const brand = findMentions(text, ENTITIES).find((m) => m.isBrand);

    expect(brand?.charPosition).toBe(text.indexOf("Northside Tutoring"));
  });

  it("returns one entry per entity even when several aliases match", () => {
    const text = "Northside Tutoring, sometimes listed as Northside or Northside Tutors.";
    const found = findMentions(text, ENTITIES);

    expect(found.filter((m) => m.entityName === "Northside Tutoring")).toHaveLength(1);
  });

  it("orders results by where each entity first appears", () => {
    const found = findMentions(SAMPLES.brandPresent, ENTITIES);
    const positions = found.map((m) => m.charPosition);

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("is deterministic across repeated calls", () => {
    const once = findMentions(SAMPLES.brandPresent, ENTITIES);
    const twice = findMentions(SAMPLES.brandPresent, ENTITIES);

    expect(once).toEqual(twice);
  });
});

/**
 * Shapes real answer engines emit. Everything here was checked against the
 * matcher before being written down; the emphasis and zero-width cases were
 * genuine misses, and a miss here is invisible — it understates a mention rate
 * rather than raising an error.
 */
describe("real answer formatting", () => {
  const NO_ALIAS = [{ name: "Bright Path Learning", aliases: [], isBrand: false }];

  it.each([
    ["a markdown table cell", "| Provider | Rate |\n| Bright Path Learning | $50 |"],
    ["a numbered citation", "Bright Path Learning[1] is well reviewed.[2]"],
    ["a markdown link", "[Bright Path Learning](https://brightpath.ca) is cheaper."],
    ["a fully bolded name", "**Bright Path Learning** is cheaper."],
    ["a partially bolded name", "**Bright Path** Learning is cheaper."],
    ["italics around the name", "_Bright Path Learning_ is cheaper."],
    ["inline code around the name", "`Bright Path Learning` is cheaper."],
    ["a heading", "### Bright Path Learning\nStrong reviews."],
    ["a numbered list item", "1. Bright Path Learning — free assessment"],
    ["a zero-width space inside the name", "Bright\u200BPath Learning is cheaper."],
    ["a non-breaking space inside the name", "Bright\u00A0Path Learning is cheaper."],
  ])("finds a name in %s", (_label, text) => {
    expect(findMentions(text, NO_ALIAS).map((m) => m.entityName)).toEqual([
      "Bright Path Learning",
    ]);
  });

  it("still does not match a name that only appears inside a URL", () => {
    expect(findMentions("See https://brightpathlearning.ca/rates", NO_ALIAS)).toEqual([]);
  });

  it("still does not match a bare domain in prose", () => {
    expect(findMentions("Their site brightpathlearning.ca lists rates.", NO_ALIAS)).toEqual([]);
  });

  it("does not let emphasis normalisation invent a match across two names", () => {
    // "Bright Path" and "Learning Tree" are different companies; the emphasis
    // between them must not fuse into "Bright Path Learning".
    const entities = [{ name: "Bright Path Learning", aliases: [], isBrand: false }];
    expect(findMentions("**Bright Path**. **Learning** Tree is separate.", entities)).toEqual(
      [],
    );
  });
});

describe("findAllOccurrences", () => {
  it("returns every occurrence, not just the first", () => {
    const text = "Northside Tutoring is good. Northside is well reviewed.";
    const spans = findAllOccurrences(text, ENTITIES);

    expect(spans).toHaveLength(2);
    expect(spans[0].start).toBe(0);
    expect(text.slice(spans[1].start, spans[1].end)).toBe("Northside");
  });

  it("does not emit nested spans when a shorter alias sits inside a longer name", () => {
    const spans = findAllOccurrences("Northside Tutoring wins.", ENTITIES);

    expect(spans).toHaveLength(1);
    expect(spans[0].end - spans[0].start).toBe("Northside Tutoring".length);
  });

  it("produces spans that slice back to the matched text", () => {
    const text = SAMPLES.brandPresent;

    for (const span of findAllOccurrences(text, ENTITIES)) {
      expect(text.slice(span.start, span.end).toLowerCase()).toContain(
        span.entityName.split(" ")[0].toLowerCase(),
      );
    }
  });
});
