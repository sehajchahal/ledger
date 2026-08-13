import { activeProbeEngine, runJob } from "@/lib/ai/router";
import { findMentions, type Entity } from "@/lib/parse/mentions";
import { mapWithConcurrency } from "@/lib/pool";
import type { Tick } from "@/components/presence-strip";

/**
 * The public check: three real prompts, run live, no email required.
 *
 * This is the whole product in fifteen seconds. It measures and reports; it
 * does not score, grade, or promise. If the brand shows up, it says so; if it
 * does not, it says that just as plainly.
 */

const PROMPTS_PER_CHECK = 3;

export type CheckResult = {
  domain: string;
  brandName: string;
  ticks: Tick[];
  prompts: { text: string; found: boolean; excerpt: string }[];
  engine: string;
  /** True when no engine key is configured and the answers were generated locally. */
  isDemo: boolean;
};

/** Normalises whatever the visitor typed into a bare hostname. */
export function normaliseDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const host = new URL(withScheme).hostname.replace(/^www\./, "");
    // Must look like a domain: at least one dot, no spaces, valid characters.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Reads the company name off the site itself.
 *
 * A domain alone is a bad source for a brand name — "northsidetutoring.ca"
 * collapses to one unsearchable token. The site's own title tag or og:site_name
 * almost always carries the real name, so it is worth one short request before
 * falling back to guessing.
 */
export async function brandNameFor(domain: string): Promise<string> {
  try {
    const response = await fetch(`https://${domain}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "LedgerBot/1.0 (+brand visibility check)" },
    });

    if (response.ok) {
      const html = (await response.text()).slice(0, 60_000);

      const siteName = html.match(
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      )?.[1];
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

      const candidate = pickName(siteName ?? title ?? "");
      if (candidate) return decodeEntities(candidate);
    }
  } catch {
    // Unreachable site, timeout, or blocked bot. Fall through to the guess.
  }

  return brandNameFromDomain(domain);
}

/** Segments that appear in titles but are never the company name. */
const GENERIC = new Set([
  "home", "homepage", "welcome", "index", "official site", "official website",
  "home page", "start", "main",
]);

/**
 * Titles come in every shape: "Brand", "Brand — tagline", "Page | Brand",
 * "Home \\ Brand". Split on any of the usual separators, drop the segments that
 * are boilerplate, and take the shortest thing left — the name is almost always
 * shorter than the tagline.
 */
function pickName(raw: string): string | null {
  const parts = raw
    .split(/\s+[|\u2013\u2014\-\\/\u00b7\u2022:]+\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 40)
    .filter((part) => !GENERIC.has(part.toLowerCase()));

  if (parts.length === 0) return null;
  return parts.sort((a, b) => a.length - b.length)[0];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Last resort when the site cannot be read. */
export function brandNameFromDomain(domain: string): string {
  const root = domain.split(".")[0];

  return root
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function promptsFor(brandName: string): string[] {
  return [
    `best alternatives to ${brandName}`,
    `is ${brandName} any good`,
    `who competes with ${brandName}`,
  ].slice(0, PROMPTS_PER_CHECK);
}

export async function runPublicCheck(rawDomain: string): Promise<CheckResult | null> {
  const domain = normaliseDomain(rawDomain);
  if (!domain) return null;

  const brandName = await brandNameFor(domain);
  const entities: Entity[] = [{ name: brandName, aliases: [], isBrand: true }];
  const engine = activeProbeEngine();

  const results = await mapWithConcurrency(promptsFor(brandName), 3, async (text, index) => {
    try {
      const answer = await runJob("probe", {
        prompt: text,
        context: {
          intent: "comparison",
          brand: { name: brandName, aliases: [], domain },
          competitors: [
            { name: "Vantage Group", aliases: [] },
            { name: "Northbridge", aliases: [] },
            { name: "Clearline", aliases: [] },
          ],
          probeIndex: index,
          runSeed: domain,
        },
      });

      const found = findMentions(answer.text, entities).length > 0;

      return {
        text,
        found,
        excerpt: answer.text.slice(0, 240).trim(),
      };
    } catch {
      // A failed probe is missing data, not a miss. It is reported as such.
      return { text, found: false, excerpt: "", failed: true as const };
    }
  });

  const answered = results.filter((r) => !("failed" in r && r.failed));

  return {
    domain,
    brandName,
    ticks: answered.map((r): Tick => (r.found ? "hit" : "miss")),
    prompts: answered.map(({ text, found, excerpt }) => ({ text, found, excerpt })),
    engine: engine.label,
    isDemo: engine.isFixture,
  };
}
