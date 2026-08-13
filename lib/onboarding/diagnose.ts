import { runJob } from "@/lib/ai/router";
import { looksLocal } from "@/lib/site/categories";
import type { SiteProfile } from "@/lib/site/inspect";
import type { Intent } from "@/lib/db/schema";

/**
 * Turns a site profile into a starting prompt set and competitor list.
 *
 * The prompts have to be questions a real buyer would type. That means no
 * product jargon, no brand-first phrasing for discovery intents, and no
 * keyword-stuffed fragments — a person asking an assistant writes a sentence.
 */

export type ProposedPrompt = { text: string; intent: Intent };
export type ProposedCompetitor = { name: string; aliases: string[] };

export type Plan = {
  prompts: ProposedPrompt[];
  competitors: ProposedCompetitor[];
  /** True when the list came from templates because no model was available. */
  isTemplate: boolean;
  /**
   * True when the category could not be inferred and templates would have had
   * to put a filler word into every question. The UI asks for the category
   * instead of shipping 25 prompts that say "best business for a business".
   */
  needsCategory: boolean;
};

const TARGET_PROMPTS = 25;

const SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    prompts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          intent: {
            type: "string",
            enum: ["discovery", "comparison", "problem", "branded"],
          },
        },
        required: ["text", "intent"],
        additionalProperties: false,
      },
    },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
        },
        required: ["name", "aliases"],
        additionalProperties: false,
      },
    },
  },
  required: ["prompts", "competitors"],
  additionalProperties: false,
};

function instruction(site: SiteProfile): string {
  return [
    `A company called "${site.name}" operates at ${site.domain}.`,
    site.description ? `Its site describes it as: ${site.description}` : "",
    `It appears to be in the ${site.category} category.`,
    "",
    `Write ${TARGET_PROMPTS} questions a real buyer would type into an AI assistant`,
    "while deciding who to buy this kind of thing from, spread across four intents:",
    "",
    "- discovery: the buyer does not know who exists yet. Never name the company.",
    "- comparison: the buyer is choosing between options.",
    "- problem: the buyer describes a symptom rather than asking for a product.",
    "- branded: the buyer already knows the company name.",
    "",
    "Roughly 10 discovery, 6 comparison, 5 problem, 4 branded.",
    "",
    "Rules: write them the way a person actually types — full questions, lowercase",
    "is fine, no keyword fragments, no marketing words. Include a location only if",
    "the company is clearly local. Do not invent facts about the company.",
    "",
    "Also list up to 5 real competitors you are confident actually exist in this",
    "market, with any shorter names they are commonly called. If you are not",
    "confident, return an empty competitor list rather than guessing.",
  ]
    .filter(Boolean)
    .join("\n");
}

const INTENTS: Intent[] = ["discovery", "comparison", "problem", "branded"];

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (INTENTS as string[]).includes(value);
}

/** Accepts only well-formed entries; anything malformed is dropped, not repaired. */
function parsePlan(raw: string): Plan | null {
  let data: unknown;

  try {
    // Models occasionally wrap JSON in a code fence even under a schema.
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null) return null;
  const node = data as Record<string, unknown>;

  const prompts = Array.isArray(node.prompts)
    ? node.prompts
        .filter(
          (entry): entry is { text: string; intent: Intent } =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).text === "string" &&
            (entry as Record<string, unknown>).text !== "" &&
            isIntent((entry as Record<string, unknown>).intent),
        )
        .map((entry) => ({ text: entry.text.trim(), intent: entry.intent }))
    : [];

  if (prompts.length === 0) return null;

  const competitors = Array.isArray(node.competitors)
    ? node.competitors
        .filter(
          (entry): entry is { name: string; aliases: unknown } =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).name === "string" &&
            (entry as Record<string, unknown>).name !== "",
        )
        .map((entry) => ({
          name: entry.name.trim(),
          aliases: Array.isArray(entry.aliases)
            ? entry.aliases.filter((a): a is string => typeof a === "string")
            : [],
        }))
    : [];

  return {
    prompts: prompts.slice(0, TARGET_PROMPTS),
    competitors,
    isTemplate: false,
    needsCategory: false,
  };
}

/**
 * Deterministic fallback used when no model key is set, or when the model
 * returned something unusable.
 *
 * No competitors are suggested here. Inventing plausible-looking competitor
 * names would put fabricated companies into a customer's account, and the
 * parser would then dutifully measure a market that does not exist.
 */
export function templatePlan(site: SiteProfile): Plan {
  const c = site.category.trim();
  const n = site.name;

  // No category means no honest template. Substituting a generic noun produces
  // questions no buyer has ever typed, and 25 of them would look like the
  // product works when it does not.
  if (!c) {
    return { prompts: [], competitors: [], isTemplate: true, needsCategory: true };
  }

  const local = site.local || looksLocal(c);

  const discovery = local
    ? [
        `best ${c} near me`,
        `who offers ${c} in my area`,
        `how much does ${c} cost`,
        `affordable ${c} nearby`,
        `top rated ${c} in my city`,
        `what should I look for in a good ${c} provider`,
        `is there a well reviewed ${c} close by`,
        `best ${c} for families`,
        `who are the best ${c} providers locally`,
        `${c} with good availability`,
      ]
    : [
        `best ${c} for a small business`,
        `what is the best ${c} for a small team`,
        `how much does ${c} cost`,
        `most affordable ${c}`,
        `best ${c} for a startup`,
        `what should I look for when choosing ${c}`,
        `easiest ${c} to set up`,
        `best ${c} with good support`,
        `which ${c} do small companies actually use`,
        `${c} that scales with a growing team`,
      ];

  const comparison = local
    ? [
        `best alternatives to ${n}`,
        `${n} vs other ${c} providers`,
        `how do I compare ${c} providers`,
        `which ${c} provider is best value`,
        `cheapest versus best ${c}`,
        `chain versus independent ${c}`,
      ]
    : [
        `best alternatives to ${n}`,
        `${n} vs other ${c} tools`,
        `how do I compare ${c} options`,
        `which ${c} is best value for money`,
        `cheapest versus best ${c}`,
        `${c} comparison for small teams`,
      ];

  const problem = [
    `I need help with ${c}, where do I start`,
    `how do I switch ${c} providers`,
    `signs you need a better ${c} provider`,
    `common problems with ${c}`,
    `what happens if I pick the wrong ${c}`,
  ];

  const branded = [
    `${n} reviews`,
    `is ${n} any good`,
    `how much does ${n} cost`,
    `${n} pricing`,
  ];

  const prompts: ProposedPrompt[] = [
    ...discovery.map((text) => ({ text, intent: "discovery" as Intent })),
    ...comparison.map((text) => ({ text, intent: "comparison" as Intent })),
    ...problem.map((text) => ({ text, intent: "problem" as Intent })),
    ...branded.map((text) => ({ text, intent: "branded" as Intent })),
  ].slice(0, TARGET_PROMPTS);

  return { prompts, competitors: [], isTemplate: true, needsCategory: false };
}

export async function proposePlan(site: SiteProfile): Promise<Plan> {
  try {
    const result = await runJob("diagnose", {
      prompt: instruction(site),
      schema: SCHEMA,
    });

    // The fixture provider cannot write buyer questions; it returns a marked
    // placeholder. Templates are the honest answer in that case.
    if (result.isFixture) return templatePlan(site);

    return parsePlan(result.text) ?? templatePlan(site);
  } catch (error) {
    console.error("diagnose failed, falling back to templates", error);
    return templatePlan(site);
  }
}
