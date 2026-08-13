import type { ModelSpec } from "@/config/models";
import type { JobInput, JobResult } from "@/lib/ai/types";

/**
 * ChatGPT as a second probe engine.
 *
 * The whole point of a second engine is that answer engines disagree — a brand
 * can be named by one and invisible to another, and a single-engine number
 * hides that. Uses the Responses API with the hosted web search tool so the
 * answer reflects what a user would see today rather than training data.
 *
 * Plain fetch rather than the SDK: this is one endpoint, and adding a
 * dependency for it would not earn its place.
 */

const ENDPOINT = "https://api.openai.com/v1/responses";

type ResponsesPayload = {
  output_text?: string;
  output?: {
    type?: string;
    content?: {
      type?: string;
      text?: string;
      annotations?: { type?: string; url?: string }[];
    }[];
  }[];
  error?: { message?: string };
};

export async function openaiProvider(
  input: JobInput,
  spec: ModelSpec,
): Promise<JobResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: spec.model,
      input: input.prompt,
      ...(input.system ? { instructions: input.system } : {}),
      ...(spec.webSearch ? { tools: [{ type: "web_search" }] } : {}),
      max_output_tokens: spec.maxTokens,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `openai ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }

  const data = (await response.json()) as ResponsesPayload;

  // The Responses API exposes a flattened convenience field; fall back to
  // walking the output blocks when it is absent.
  const text =
    data.output_text?.trim() ||
    (data.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((block) => block.type === "output_text")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();

  if (!text) {
    // An empty answer is not a measurement of absence — it is a failed probe.
    throw new Error("openai returned an empty answer");
  }

  // Citations arrive as url_citation annotations on the text blocks.
  const citations = (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .flatMap((block) => block.annotations ?? [])
    .filter((annotation) => annotation.type === "url_citation" && annotation.url)
    .map((annotation) => annotation.url as string);

  return {
    text,
    citations: [...new Set(citations)],
    model: `openai/${spec.model}`,
    isFixture: false,
  };
}
