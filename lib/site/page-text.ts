/**
 * Fetches the readable text of a page so the draft job has the brand's own
 * words to work from.
 *
 * A fix written without reading the page is guesswork — it will describe a
 * pricing section that does not exist, or rewrite an opening paragraph it has
 * never seen. When the fetch fails, callers fall back to templates rather than
 * inventing page content.
 */

export type PageText = {
  url: string;
  title: string;
  text: string;
};

const STRIP = /<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi;

export async function fetchPageText(
  url: string,
  { maxChars = 6000 }: { maxChars?: number } = {},
): Promise<PageText | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "LedgerBot/1.0 (+brand visibility check)" },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = (await response.text()).slice(0, 300_000);

    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";

    const text = html
      .replace(STRIP, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 80) return null;

    return { url, title, text: text.slice(0, maxChars) };
  } catch {
    return null;
  }
}
