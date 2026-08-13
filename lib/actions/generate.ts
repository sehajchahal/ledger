import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { actions, brands, prompts, runs, type ActionType, type Brand, type Prompt } from "@/lib/db/schema";
import { getSourcesReport } from "@/lib/db/queries/sources";
import { validateJsonLd } from "@/lib/actions/jsonld";
import { draftOffsiteTarget, draftPageEdit, draftSchemaMarkup } from "@/lib/actions/draft";
import { checkActionAllowance } from "@/lib/limits";
import { loadRun } from "@/lib/parse/metrics";
import { fetchPageText, type PageText } from "@/lib/site/page-text";

/**
 * Turns missed prompts into concrete, copyable fixes.
 *
 * Three types only. Each one addresses exactly one prompt, because verification
 * re-runs that prompt to measure whether the fix moved anything. An action with
 * no prompt attached could never be proved, so it does not get created.
 *
 * Nothing here promises a result. The copy says what to change and what will be
 * re-measured; it never says this will get the brand mentioned.
 */

export type GeneratedAction = {
  promptId: string;
  type: ActionType;
  title: string;
  body: string;
};

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 5)
    .join("-");
}

/* -------------------------------------------------------- schema markup -- */

function buildSchemaMarkup(brand: Brand, prompt: Prompt): GeneratedAction | null {
  // FAQPage is the right shape for a question a buyer types; Organization is
  // the fallback when the prompt is not phrased as a question.
  const isQuestion = /^(how|what|who|where|when|why|is|are|can|does|do)\b|\?$/i.test(
    prompt.text.trim(),
  );

  const markup = isQuestion
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: prompt.text.replace(/^\w/, (c) => c.toUpperCase()),
            acceptedAnswer: {
              "@type": "Answer",
              text:
                `${brand.name} answers this on its site. Replace this sentence with your ` +
                `real answer — two or three sentences, specific, no marketing language.`,
            },
          },
        ],
      }
    : {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: brand.name,
        url: `https://${brand.domain}`,
        alternateName: brand.aliases,
        description: `Replace with one plain sentence describing what ${brand.name} does and who for.`,
      };

  const source = JSON.stringify(markup, null, 2);
  const check = validateJsonLd(source);

  // Never save markup that does not validate. A broken snippet is worse than none.
  if (!check.ok) return null;

  return {
    promptId: prompt.id,
    type: "schema_markup",
    title: `Add ${markup["@type"]} markup for "${prompt.text}"`,
    body: [
      `Paste this into the \`<head>\` of https://${brand.domain}/${slug(prompt.text)} inside a`,
      "`<script type=\"application/ld+json\">` tag. Fill in the placeholder text first — the",
      "structure is correct but the wording is yours.",
      "",
      "```json",
      source,
      "```",
    ].join("\n"),
  };
}

/* ------------------------------------------------------------ page edit -- */

function buildPageEdit(brand: Brand, prompt: Prompt): GeneratedAction {
  const path = `/${slug(prompt.text)}`;

  return {
    promptId: prompt.id,
    type: "page_edit",
    title: `Rewrite the opening of ${path} to answer "${prompt.text}"`,
    body: [
      `Most relevant page: https://${brand.domain}${path}`,
      "",
      "Before",
      "```",
      `${brand.name} offers professional, high-quality service with experienced staff and a`,
      "commitment to excellence. Contact us today to learn more about what we can do for you.",
      "```",
      "",
      "After",
      "```",
      `${brand.name} answers "${prompt.text}" directly: state the specific service, who it is`,
      "for, where you operate, and what it costs. Put the answer in the first two sentences,",
      "before any pitch. Models quote pages that answer the question in the opening paragraph",
      "and skip pages that warm up first.",
      "```",
      "",
      "Copy the After block, adapt the specifics, and replace the opening section.",
    ].join("\n"),
  };
}

/* ------------------------------------------------------- offsite target -- */

function buildOffsiteTarget(
  brand: Brand,
  prompt: Prompt,
  domain: string,
  citedIn: number,
): GeneratedAction {
  return {
    promptId: prompt.id,
    type: "offsite_target",
    title: `Get listed on ${domain}`,
    body: [
      `${domain} was cited in ${citedIn} of the answers on record, and you are not on it.`,
      "",
      `For "${prompt.text}", the models are reading ${domain} rather than ${brand.domain}.`,
      "",
      `Action: find the listing or thread on ${domain} that covers this topic, and get`,
      `${brand.name} added to it — a claimed profile, a directory entry, or a genuine reply`,
      "from someone at the company. One accurate listing on a page models already read beats",
      "several pages on your own site.",
    ].join("\n"),
  };
}

/* ------------------------------------------------------------ generator -- */

export type GenerateResult = { created: number; reason?: string };

/**
 * Tries the draft job for the page most relevant to a prompt, falling back to
 * the brand's homepage. A 404 on the guessed path is expected and silent.
 */
async function relevantPage(brand: Brand, prompt: Prompt): Promise<PageText | null> {
  return (
    (await fetchPageText(`https://${brand.domain}/${slug(prompt.text)}`)) ??
    (await fetchPageText(`https://${brand.domain}`))
  );
}

export async function generateActionsForBrand(
  brandId: string,
  options: { limit?: number; promptIds?: string[] } = {},
): Promise<GenerateResult> {
  const requested = options.limit ?? 6;

  // Generating a fix costs a model call whether or not it gets approved, so the
  // allowance is checked before any work happens.
  const allowance = await checkActionAllowance(brandId, requested);
  if (!allowance.allowed) return { created: 0, reason: allowance.reason };

  const limit = allowance.remaining;

  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) throw new Error(`no brand with id ${brandId}`);

  const [latestRun] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.brandId, brandId), eq(runs.status, "complete"), eq(runs.kind, "full")))
    .orderBy(desc(runs.startedAt))
    .limit(1);

  if (!latestRun) return { created: 0, reason: "There is no completed run to read from yet." };

  const [probeRows, allPrompts, sources, existing] = await Promise.all([
    loadRun(latestRun.id),
    db.select().from(prompts).where(and(eq(prompts.brandId, brandId), eq(prompts.active, true))),
    getSourcesReport(brandId),
    db
      .select({ promptId: actions.promptId, type: actions.type })
      .from(actions)
      .where(
        and(
          eq(actions.brandId, brandId),
          inArray(actions.status, ["proposed", "approved", "shipped"]),
        ),
      ),
  ]);

  // Prompts the brand does not reliably hold. A prompt at 1/3 is not a win —
  // it means two out of three buyers asking that question never see the name —
  // so those are worth a fix too, just ranked below the outright misses.
  const byPrompt = new Map<string, { hits: number; probes: number }>();
  for (const row of probeRows) {
    const entry = byPrompt.get(row.promptId) ?? { hits: 0, probes: 0 };
    entry.probes++;
    if (row.mentions.some((m) => m.isBrand)) entry.hits++;
    byPrompt.set(row.promptId, entry);
  }

  // The agent passes the specific prompts that regressed; the Fixes page passes
  // nothing and gets the worst-performing ones.
  const candidates = options.promptIds?.length
    ? allPrompts.filter((prompt) => options.promptIds!.includes(prompt.id))
    : allPrompts;

  const missed = candidates
    .map((prompt) => ({ prompt, entry: byPrompt.get(prompt.id) }))
    .filter(
      (row): row is { prompt: Prompt; entry: { hits: number; probes: number } } =>
        !!row.entry && row.entry.probes > 0 && row.entry.hits < row.entry.probes,
    )
    .sort((a, b) => a.entry.hits / a.entry.probes - b.entry.hits / b.entry.probes)
    .map((row) => row.prompt)
    .slice(0, limit);

  const alreadyCovered = new Set(existing.map((row) => `${row.promptId}:${row.type}`));

  // Third-party domains the models trust, excluding the brand's own site.
  const offsiteDomains = sources.domains.filter((domain) => !domain.isOwnDomain);

  const generated: GeneratedAction[] = [];

  for (const [index, prompt] of missed.entries()) {
    // Rotate the type so a user gets one of each rather than six of the same.
    const order: ActionType[] = ["schema_markup", "page_edit", "offsite_target"];
    const type = order[index % order.length];

    if (alreadyCovered.has(`${prompt.id}:${type}`)) continue;

    let action: GeneratedAction | null = null;

    if (type === "offsite_target") {
      const domain = offsiteDomains[index % Math.max(1, offsiteDomains.length)];
      if (domain) {
        const drafted = await draftOffsiteTarget(brand, prompt, domain.domain, domain.count);
        action = drafted
          ? { promptId: prompt.id, type, ...drafted }
          : buildOffsiteTarget(brand, prompt, domain.domain, domain.count);
      }
    } else {
      const page = await relevantPage(brand, prompt);

      if (type === "schema_markup") {
        const drafted = await draftSchemaMarkup(brand, prompt, page);
        action = drafted
          ? { promptId: prompt.id, type, ...drafted }
          : buildSchemaMarkup(brand, prompt);
      } else {
        const drafted = await draftPageEdit(brand, prompt, page);
        action = drafted
          ? { promptId: prompt.id, type, ...drafted }
          : buildPageEdit(brand, prompt);
      }
    }

    if (action) generated.push(action);
  }

  if (generated.length === 0) {
    return {
      created: 0,
      reason: "Nothing new to propose. Every prompt you are missing from already has a fix.",
    };
  }

  await db.insert(actions).values(
    generated.map((action) => ({
      brandId,
      promptId: action.promptId,
      type: action.type,
      title: action.title,
      body: action.body,
      status: "proposed" as const,
    })),
  );

  return { created: generated.length };
}
