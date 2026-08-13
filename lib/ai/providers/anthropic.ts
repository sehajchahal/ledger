import Anthropic from "@anthropic-ai/sdk";
import type { ModelSpec } from "@/config/models";
import type { JobInput, JobResult } from "@/lib/ai/types";

/**
 * Claude, used two ways:
 *   - as a second probe engine, with the server-side web search tool on, so the
 *     same prompt can be compared across answer engines
 *   - as the model behind diagnose, draft, and classify
 */

let cached: Anthropic | undefined;

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  cached ??= new Anthropic();
  return cached;
}

export async function anthropicProvider(
  input: JobInput,
  spec: ModelSpec,
): Promise<JobResult> {
  // effort and format are both output_config fields, so they merge into one
  // object rather than overwriting each other.
  const outputConfig = {
    ...(spec.effort ? { effort: spec.effort } : {}),
    ...(input.schema ? { format: { type: "json_schema" as const, schema: input.schema } } : {}),
  };

  const response = await client().messages.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
    ...(input.system ? { system: input.system } : {}),
    ...(spec.webSearch
      ? { tools: [{ type: "web_search_20260209", name: "web_search" }] }
      : {}),
    messages: [{ role: "user", content: input.prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `claude declined the request${
        response.stop_details ? ` (${response.stop_details.category})` : ""
      }`,
    );
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("claude returned no text content");

  // Sources arrive two ways: as web_search_tool_result blocks, and as inline
  // citations attached to the text blocks that used them. Collect both.
  const citations: string[] = [];
  for (const block of response.content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) {
        if ("url" in result && typeof result.url === "string") citations.push(result.url);
      }
    }
    if (block.type === "text" && block.citations) {
      for (const citation of block.citations) {
        if ("url" in citation && typeof citation.url === "string") {
          citations.push(citation.url);
        }
      }
    }
  }

  return {
    text,
    citations: [...new Set(citations)],
    model: `anthropic/${spec.model}`,
    isFixture: false,
  };
}
