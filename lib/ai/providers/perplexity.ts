import type { ModelSpec } from "@/config/models";
import type { JobInput, JobResult } from "@/lib/ai/types";

/**
 * Perplexity is the primary probe engine: it answers with live web search by
 * default and returns the sources it used, which is exactly the measurement
 * Ledger needs.
 *
 * The API is OpenAI-shaped, so this is a plain fetch rather than an SDK.
 */

const ENDPOINT = "https://api.perplexity.ai/chat/completions";

type PerplexityResponse = {
  choices?: { message?: { content?: string } }[];
  /** Older shape: a flat list of URLs. */
  citations?: string[];
  /** Current shape: structured results. */
  search_results?: { url?: string; title?: string }[];
};

export async function perplexityProvider(
  input: JobInput,
  spec: ModelSpec,
): Promise<JobResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not set");

  const messages: { role: string; content: string }[] = [];
  if (input.system) messages.push({ role: "system", content: input.system });
  messages.push({ role: "user", content: input.prompt });

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: spec.model,
      messages,
      max_tokens: spec.maxTokens,
      // Probes must reflect what a user would see today, not training data.
      return_related_questions: false,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `perplexity ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }

  const data = (await response.json()) as PerplexityResponse;
  const text = data.choices?.[0]?.message?.content ?? "";

  if (!text.trim()) {
    // An empty answer is not a measurement of absence — it is a failed probe.
    throw new Error("perplexity returned an empty answer");
  }

  const citations = [
    ...(data.citations ?? []),
    ...(data.search_results ?? []).map((r) => r.url).filter((u): u is string => !!u),
  ];

  return {
    text,
    citations: [...new Set(citations)],
    model: `perplexity/${spec.model}`,
    isFixture: false,
  };
}
