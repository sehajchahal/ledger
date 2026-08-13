/**
 * Structural validation for generated JSON-LD.
 *
 * Nothing gets saved as an action until it parses and carries the fields its
 * type requires. A user is going to paste this into their site — shipping them
 * markup that silently does nothing would be worse than shipping nothing.
 *
 * This checks structure, not semantics. It does not claim the markup will make
 * any model mention the brand.
 */

export type JsonLdCheck = { ok: true; parsed: unknown } | { ok: false; problems: string[] };

const REQUIRED: Record<string, string[]> = {
  Organization: ["name", "url"],
  Product: ["name"],
  FAQPage: ["mainEntity"],
  LocalBusiness: ["name", "address"],
  Service: ["name", "provider"],
};

export function validateJsonLd(source: string): JsonLdCheck {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    return {
      ok: false,
      problems: [`not valid JSON: ${error instanceof Error ? error.message : "parse failed"}`],
    };
  }

  const problems: string[] = [];

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, problems: ["top level must be a single JSON object"] };
  }

  const node = parsed as Record<string, unknown>;

  if (node["@context"] !== "https://schema.org") {
    problems.push('"@context" must be "https://schema.org"');
  }

  const type = node["@type"];
  if (typeof type !== "string") {
    problems.push('"@type" is missing');
  } else {
    const required = REQUIRED[type];
    if (!required) {
      problems.push(`"@type": "${type}" is not one of ${Object.keys(REQUIRED).join(", ")}`);
    } else {
      for (const field of required) {
        const value = node[field];
        if (value === undefined || value === null || value === "") {
          problems.push(`"${type}" requires "${field}"`);
        }
      }
    }
  }

  if (type === "FAQPage") {
    const entities = node.mainEntity;
    if (!Array.isArray(entities) || entities.length === 0) {
      problems.push('"mainEntity" must be a non-empty array of Question items');
    } else {
      entities.forEach((entity, i) => {
        const question = entity as Record<string, unknown>;
        if (question["@type"] !== "Question") problems.push(`mainEntity[${i}] must be a Question`);
        if (!question.name) problems.push(`mainEntity[${i}] is missing "name"`);
        const answer = question.acceptedAnswer as Record<string, unknown> | undefined;
        if (!answer || answer["@type"] !== "Answer" || !answer.text) {
          problems.push(`mainEntity[${i}] needs an acceptedAnswer with text`);
        }
      });
    }
  }

  return problems.length === 0 ? { ok: true, parsed } : { ok: false, problems };
}
