import { describe, expect, it } from "vitest";
import {
  computeCitedDomains,
  computeFirstMentionPosition,
  computePromptMentionRate,
  computeShareOfVoice,
  computeVisibility,
  toDomain,
  type ProbeRow,
} from "@/lib/parse/metrics";

const brand = (charPosition = 10) => ({
  entityName: "Northside Tutoring",
  isBrand: true,
  charPosition,
});
const rival = (entityName: string, charPosition = 20) => ({
  entityName,
  isBrand: false,
  charPosition,
});

function probe(overrides: Partial<ProbeRow> & { promptId: string }): ProbeRow {
  return {
    answerId: `${overrides.promptId}-${overrides.probeIndex ?? 0}`,
    probeIndex: 0,
    citations: [],
    mentions: [],
    ...overrides,
  };
}

describe("computeVisibility", () => {
  it("is the share of probes where the brand appeared", () => {
    const rows = [
      probe({ promptId: "a", probeIndex: 0, mentions: [brand()] }),
      probe({ promptId: "a", probeIndex: 1, mentions: [rival("Mathwise Academy")] }),
      probe({ promptId: "a", probeIndex: 2, mentions: [brand()] }),
      probe({ promptId: "b", probeIndex: 0, mentions: [] }),
    ];

    expect(computeVisibility(rows)).toEqual({ hits: 2, probes: 4, percent: 50 });
  });

  it("divides by probes that returned, not probes attempted", () => {
    // Two probes of this prompt failed and stored nothing, so they are absent.
    const rows = [probe({ promptId: "a", probeIndex: 0, mentions: [brand()] })];

    expect(computeVisibility(rows)).toEqual({ hits: 1, probes: 1, percent: 100 });
  });

  it("returns zero rather than dividing by zero on an empty run", () => {
    expect(computeVisibility([])).toEqual({ hits: 0, probes: 0, percent: 0 });
  });
});

describe("computePromptMentionRate", () => {
  const rows = [
    probe({ promptId: "a", probeIndex: 0, mentions: [brand()] }),
    probe({ promptId: "a", probeIndex: 1, mentions: [] }),
    probe({ promptId: "a", probeIndex: 2, mentions: [brand()] }),
    probe({ promptId: "b", probeIndex: 0, mentions: [brand()] }),
  ];

  it("counts only the probes for the prompt asked about", () => {
    expect(computePromptMentionRate(rows, "a")).toEqual({
      hits: 2,
      probes: 3,
      percent: 67,
    });
  });

  it("reports zero probes for a prompt with no stored answers", () => {
    expect(computePromptMentionRate(rows, "missing")).toEqual({
      hits: 0,
      probes: 0,
      percent: 0,
    });
  });
});

describe("computeFirstMentionPosition", () => {
  it("takes the earliest position across the prompt's probes", () => {
    const rows = [
      probe({ promptId: "a", probeIndex: 0, mentions: [brand(240)] }),
      probe({ promptId: "a", probeIndex: 1, mentions: [brand(38)] }),
    ];

    expect(computeFirstMentionPosition(rows, "a")).toBe(38);
  });

  it("is null when the brand never appears", () => {
    const rows = [probe({ promptId: "a", mentions: [rival("Mathwise Academy")] })];

    expect(computeFirstMentionPosition(rows, "a")).toBeNull();
  });
});

describe("computeShareOfVoice", () => {
  it("puts the brand first and competitors after, by mention count", () => {
    const rows = [
      probe({ promptId: "a", probeIndex: 0, mentions: [brand(), rival("Mathwise Academy")] }),
      probe({ promptId: "a", probeIndex: 1, mentions: [rival("Mathwise Academy")] }),
      probe({ promptId: "b", probeIndex: 0, mentions: [rival("Bright Path Learning")] }),
    ];

    const shares = computeShareOfVoice(rows);

    expect(shares.map((s) => s.entityName)).toEqual([
      "Northside Tutoring",
      "Mathwise Academy",
      "Bright Path Learning",
    ]);
    expect(shares[0]).toMatchObject({ mentions: 1, share: 25, isBrand: true });
    expect(shares[1]).toMatchObject({ mentions: 2, share: 50 });
  });

  it("is empty when nothing was mentioned", () => {
    expect(computeShareOfVoice([probe({ promptId: "a" })])).toEqual([]);
  });
});

describe("computeCitedDomains", () => {
  it("ranks by frequency and flags the brand's own domain", () => {
    const rows = [
      probe({
        promptId: "a",
        probeIndex: 0,
        citations: ["https://www.yelp.ca/x", "https://reddit.com/r/askTO"],
      }),
      probe({ promptId: "a", probeIndex: 1, citations: ["https://www.yelp.ca/y"] }),
      probe({
        promptId: "b",
        probeIndex: 0,
        citations: ["https://northsidetutoring.ca/pricing"],
      }),
    ];

    const domains = computeCitedDomains(rows, "northsidetutoring.ca");

    expect(domains[0]).toEqual({ domain: "yelp.ca", count: 2, isOwnDomain: false });
    expect(domains.find((d) => d.domain === "northsidetutoring.ca")).toEqual({
      domain: "northsidetutoring.ca",
      count: 1,
      isOwnDomain: true,
    });
  });

  it("counts a domain once per answer even when cited repeatedly", () => {
    const rows = [
      probe({
        promptId: "a",
        citations: [
          "https://www.yelp.ca/a",
          "https://www.yelp.ca/b",
          "https://yelp.ca/c",
        ],
      }),
    ];

    expect(computeCitedDomains(rows, "example.com")).toEqual([
      { domain: "yelp.ca", count: 1, isOwnDomain: false },
    ]);
  });

  it("matches the own-domain flag regardless of a www prefix", () => {
    const rows = [probe({ promptId: "a", citations: ["https://www.example.com/a"] })];

    expect(computeCitedDomains(rows, "www.example.com")[0].isOwnDomain).toBe(true);
  });

  it("skips citations that are not parseable URLs", () => {
    const rows = [probe({ promptId: "a", citations: ["not a url", "https://ok.com"] })];

    expect(computeCitedDomains(rows, "example.com")).toEqual([
      { domain: "ok.com", count: 1, isOwnDomain: false },
    ]);
  });
});

describe("toDomain", () => {
  it.each([
    ["https://www.Yelp.ca/search?q=1", "yelp.ca"],
    ["http://reddit.com/r/askTO", "reddit.com"],
    ["https://sub.example.co.uk/path", "sub.example.co.uk"],
  ])("normalises %s", (url, expected) => {
    expect(toDomain(url)).toBe(expected);
  });

  it("returns null for garbage", () => {
    expect(toDomain("northsidetutoring.ca")).toBeNull();
  });
});
