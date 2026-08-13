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
