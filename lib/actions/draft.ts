import { runJob } from "@/lib/ai/router";
import { validateJsonLd } from "@/lib/actions/jsonld";
import type { Brand, Prompt } from "@/lib/db/schema";
import type { PageText } from "@/lib/site/page-text";

/**
 * The draft job: writes the actual fix.
 *
 * Everything here returns `null` rather than something approximate when the
 * model is unavailable or its output does not hold up. The caller falls back to
 * a template, which is honest about being generic — a fabricated "rewrite" of a
 * page nobody read is not.
 *
 * Nothing generated here is applied anywhere. It is a proposal a human reads,
 * approves, and pastes themselves.
 */

export type Draft = { title: string; body: string };

const SYSTEM = [
  "You write concrete, copy-pasteable fixes that help a company show up in AI",
  "assistant answers. You are precise and plain. You never promise that a change",
  "will make a model mention anyone — you describe the change only.",
  "",
  "Rules: sentence case. No marketing language. No exclamation marks. No emoji.",
  "Never invent facts about the company; if the page content does not say it,",
  "leave a clearly-marked placeholder for the user to fill in.",
].join("\n");

function fence(code: string, lang = ""): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

/* -------------------------------------------------------- schema markup -- */

/**
 * JSON-LD is requested as raw text rather than through a JSON schema, because
 * the shape varies by @type. It is validated structurally before it is allowed
 * anywhere near the database.
 */
export async function draftSchemaMarkup(
  brand: Brand,
  prompt: Prompt,
  page: PageText | null,
): Promise<Draft | null> {
  const instruction = [
    `Company: ${brand.name} (https://${brand.domain})`,
    page ? `Content of ${page.url}:\n${page.text}` : "No page content could be read.",
    "",
    `A buyer asks an AI assistant: "${prompt.text}"`,
    `${brand.name} is not named in the answer.`,
    "",
    "Write schema.org JSON-LD for the page above that would let a model see the",
    "answer to that question as structured data. Use FAQPage when the prompt is a",
    "question, otherwise Organization, Product, LocalBusiness, or Service.",
    "",
    'Return ONLY the JSON-LD object. It must have "@context": "https://schema.org".',
    "Use real details from the page content. Where the page does not say something,",
    "write a short placeholder in square brackets rather than making it up.",
  ].join("\n");

  try {
    const result = await runJob("draft", { prompt: instruction, system: SYSTEM });
    if (result.isFixture) return null;

    const raw = result.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const check = validateJsonLd(raw);

    // A snippet that does not validate is worse than no snippet: the user pastes
    // it, nothing happens, and they stop trusting the product.
    if (!check.ok) {
      console.warn(`draft produced invalid JSON-LD: ${check.problems.join("; ")}`);
      return null;
    }

    const type = (JSON.parse(raw) as { "@type": string })["@type"];

    return {
      title: `Add ${type} markup for "${prompt.text}"`,
      body: [
        `Paste this into the \`<head>\` of ${page?.url ?? `https://${brand.domain}`} inside a`,
        '`<script type="application/ld+json">` tag. Replace anything in square brackets first.',
        "",
        fence(JSON.stringify(JSON.parse(raw), null, 2), "json"),
      ].join("\n"),
    };
  } catch (error) {
    console.error("draftSchemaMarkup failed", error);
    return null;
  }
}

/* ------------------------------------------------------------ page edit -- */

const PAGE_EDIT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    section: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
    why: { type: "string" },
  },
  required: ["section", "before", "after", "why"],
  additionalProperties: false,
};

export async function draftPageEdit(
  brand: Brand,
  prompt: Prompt,
  page: PageText | null,
): Promise<Draft | null> {
  if (!page) return null;

  const instruction = [
    `Company: ${brand.name} (https://${brand.domain})`,
    `Content of ${page.url}:\n${page.text}`,
    "",
    `A buyer asks an AI assistant: "${prompt.text}"`,
    `${brand.name} is not named in the answer.`,
    "",
    "Find the section of that page that should answer the question, and rewrite it",
    "so the answer comes first.",
    "",
    "Return four fields:",
    "- section: which part of the page this is, in a few words",
    "- before: the existing text, quoted from the page content, at most 60 words",
    "- after: your rewrite, at most 90 words, answering the question in the first",
    "  two sentences. Keep every real fact from the original. Use [square brackets]",
    "  for anything the page does not state.",
    "- why: one sentence on what changed and why it helps a model quote the page",
  ].join("\n");

  try {
    const result = await runJob("draft", {
      prompt: instruction,
      system: SYSTEM,
      schema: PAGE_EDIT_SCHEMA,
    });
    if (result.isFixture) return null;

    const data = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as {
      section?: string;
      before?: string;
      after?: string;
      why?: string;
    };

    if (!data.after?.trim() || !data.before?.trim()) return null;

    return {
      title: `Rewrite the ${data.section ?? "opening"} of ${new URL(page.url).pathname} to answer "${prompt.text}"`,
      body: [
        `Page: ${page.url}`,
        data.why ? `\n${data.why}` : "",
        "",
        "Before",
        fence(data.before.trim()),
        "",
        "After",
        fence(data.after.trim()),
        "",
        "Copy the After block, check the bracketed parts, and replace that section.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  } catch (error) {
    console.error("draftPageEdit failed", error);
    return null;
  }
}

/* ------------------------------------------------------- offsite target -- */

const OFFSITE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: { action: { type: "string" } },
  required: ["action"],
  additionalProperties: false,
};

/**
 * The ranking here needs no model — it comes straight from the Sources data.
 * Only the one-line action is generated.
 */
export async function draftOffsiteTarget(
  brand: Brand,
  prompt: Prompt,
  domain: string,
  citedIn: number,
): Promise<Draft | null> {
  const instruction = [
    `Company: ${brand.name} (https://${brand.domain})`,
    `A buyer asks an AI assistant: "${prompt.text}"`,
    `${brand.name} is not named in the answer.`,
    `Assistants cited ${domain} in ${citedIn} of the answers on record, and ${brand.name} is not on it.`,
    "",
    `Write ONE specific sentence telling the user what to do about ${domain}.`,
    "Name the kind of page or listing on that site, and what getting added to it",
    "actually involves. No generic advice like 'build relationships'.",
  ].join("\n");

  try {
    const result = await runJob("draft", {
      prompt: instruction,
      system: SYSTEM,
      schema: OFFSITE_SCHEMA,
    });
    if (result.isFixture) return null;

    const data = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as {
      action?: string;
    };
    if (!data.action?.trim()) return null;

    return {
      title: `Get listed on ${domain}`,
      body: [
        `${domain} was cited in ${citedIn} of the answers on record, and you are not on it.`,
        "",
        `For "${prompt.text}", assistants are reading ${domain} rather than ${brand.domain}.`,
        "",
        data.action.trim(),
      ].join("\n"),
    };
  } catch (error) {
    console.error("draftOffsiteTarget failed", error);
    return null;
  }
}
