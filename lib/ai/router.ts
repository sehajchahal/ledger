import { MODELS, type JobName, type ModelSpec } from "@/config/models";
import { anthropicProvider } from "@/lib/ai/providers/anthropic";
import { fixtureProvider } from "@/lib/ai/providers/fixture";
import { openaiProvider } from "@/lib/ai/providers/openai";
import { perplexityProvider } from "@/lib/ai/providers/perplexity";
import type { JobInput, JobResult, Provider } from "@/lib/ai/types";

export type { JobInput, JobResult, ProbeContext } from "@/lib/ai/types";

/**
 * The only place in the codebase that calls a model.
 *
 * Callers name a job, not a model or a provider. Which model answers is decided
 * by `config/models.ts` and by which API keys exist — never by the caller.
 */

const PROVIDERS: Record<string, Provider> = {
  perplexity: perplexityProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
  fixture: fixtureProvider,
};

function hasKey(provider: ModelSpec["provider"]): boolean {
  if (provider === "perplexity") return !!process.env.PERPLEXITY_API_KEY;
  if (provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  return true;
}

/**
 * Picks the provider that can actually run, given the keys present.
 *
 * A probe falls back to any other configured engine with web search before it
 * falls back to fixtures, because a real answer from a different engine is
 * still a measurement and a fixture is not.
 */
function resolve(spec: ModelSpec): ModelSpec {
  if (hasKey(spec.provider)) return spec;

  if (spec.webSearch && spec.provider !== "anthropic" && hasKey("anthropic")) {
    return { ...spec, provider: "anthropic", model: "claude-opus-4-8" };
  }

  return { ...spec, provider: "fixture" };
}

export async function runJob(jobName: JobName, input: JobInput): Promise<JobResult> {
  const requested = input.spec ?? MODELS[jobName];
  const spec = resolve(requested);
  const provider = PROVIDERS[spec.provider];

  if (!provider) throw new Error(`no provider implementation for "${spec.provider}"`);

  return provider(input, spec);
}

/**
 * What the probe job would actually use right now. Surfaced in the UI so a user
 * is never left guessing whether they are looking at a measurement or a demo.
 */
export function activeProbeEngine(): { label: string; isFixture: boolean } {
  const spec = resolve(MODELS.probe);
  return {
    label: `${spec.provider}/${spec.model}`,
    isFixture: spec.provider === "fixture",
  };
}
