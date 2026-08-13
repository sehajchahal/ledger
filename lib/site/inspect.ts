import { inferCategory } from "@/lib/site/categories";

/**
 * Reads what a site says about itself.
 *
 * Onboarding must not ask for anything the user would have to look up, so the
 * company name, what it does, and roughly what category it is in all come from
 * the page itself. Everything here is a guess presented for editing — the
 * onboarding UI shows each value in a field the user can correct.
 */

export type SiteProfile = {
  domain: string;
  name: string;
  description: string;
  /** Empty when nothing matched. Never a generic filler word. */
  category: string;
  /** Whether buyers would search for this with a location attached. */
  local: boolean;
  /** False when the site could not be read and everything is inferred from the domain. */
  fetched: boolean;
};

/** Normalises whatever the visitor typed into a bare hostname. */
export function normaliseDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const host = new URL(withScheme).hostname.replace(/^www\./, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** Segments that appear in page titles but are never the company name. */
const GENERIC = new Set([
  "home", "homepage", "welcome", "index", "official site", "official website",
  "home page", "start", "main",
]);

/**
 * Titles come in every shape: "Brand", "Brand — tagline", "Page | Brand",
 * "Home \ Brand". Split on any of the usual separators, drop boilerplate, and
 * take the shortest thing left — the name is almost always shorter than the
 * tagline.
 */
export function pickName(raw: string): string | null {
  const parts = raw
    .split(/\s+[|–—\-\\/·•:]+\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 40)
    .filter((part) => !GENERIC.has(part.toLowerCase()));

  if (parts.length === 0) return null;
  return parts.sort((a, b) => a.length - b.length)[0];
}

/** Last resort when the site cannot be read. */
export function nameFromDomain(domain: string): string {
  return domain
    .split(".")[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(html: string, key: string, value: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+${key}=["']${value}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${key}=["']${value}["']`,
    "i",
  );
  return html.match(pattern)?.[1] ?? html.match(reversed)?.[1];
}

export async function inspectSite(rawDomain: string): Promise<SiteProfile | null> {
  const domain = normaliseDomain(rawDomain);
  if (!domain) return null;

  const fallback: SiteProfile = {
    domain,
    name: nameFromDomain(domain),
    description: "",
    category: "",
    local: false,
    fetched: false,
  };

  try {
    const response = await fetch(`https://${domain}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "LedgerBot/1.0 (+brand visibility check)" },
    });

    if (!response.ok) return fallback;

    const html = (await response.text()).slice(0, 200_000);

    const siteName = attr(html, "property", "og:site_name");
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const description =
      attr(html, "name", "description") ?? attr(html, "property", "og:description") ?? "";
    const heading = html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i)?.[1] ?? "";

    const name = pickName(decodeEntities(siteName ?? title ?? "")) ?? fallback.name;
    const plainHeading = decodeEntities(heading.replace(/<[^>]+>/g, " "));

    const category = inferCategory(`${title ?? ""} ${description} ${plainHeading}`);

    return {
      domain,
      name: decodeEntities(name),
      description: decodeEntities(description).slice(0, 300),
      category: category?.label ?? "",
      local: category?.local ?? false,
      fetched: true,
    };
  } catch {
    // Unreachable, timed out, or blocking bots. The user fills it in instead.
    return fallback;
  }
}
