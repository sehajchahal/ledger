/**
 * The only place in the codebase where a model id is written.
 *
 * Swapping a model, or pointing a job at a different provider, is a one-line
 * change here. Nothing else imports a model id — routes, scripts, and jobs all
 * go through `lib/ai/router.ts`.
 */

export type JobName = "probe" | "classify" | "diagnose" | "draft";

export type ProviderName = "perplexity" | "anthropic" | "openai" | "fixture";

export type ModelSpec = {
  /** Which provider implementation handles this job. */
  provider: ProviderName;
  /** The provider's model id, verbatim. */
  model: string;
  /** Whether the job needs live web results. Only meaningful for probe jobs. */
  webSearch?: boolean;
  /** Anthropic effort level. Ignored by other providers. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Upper bound on output tokens. */
  maxTokens: number;
};

export const MODELS: Record<JobName, ModelSpec> = {
  /**
   * probe — asks a real buyer question against a real answer engine and keeps
   * the whole answer. This is the measurement. It must have web search on, or
   * the answer reflects training data rather than what a user would see today.
   */
  probe: {
    provider: "perplexity",
    model: "sonar-pro",
    webSearch: true,
    maxTokens: 2048,
  },

  /**
   * classify — short, high-volume, cheap. Decides whether a mention reads as a
   * recommendation rather than a passing reference.
   */
  classify: {
    provider: "anthropic",
    model: "claude-opus-4-8",
    effort: "low",
    maxTokens: 1024,
  },

  /**
   * diagnose — reads a page and generates the prompt set and competitor list
   * during onboarding, and explains absences. Quality matters more than cost;
   * it runs once per brand, not once per probe.
   */
  diagnose: {
    provider: "anthropic",
    model: "claude-opus-4-8",
    effort: "high",
    maxTokens: 8192,
  },

  /**
   * draft — writes the actual fix: JSON-LD, a rewritten section, an outreach
   * line. A human approves everything it produces, so it is worth the effort.
   */
  draft: {
    provider: "anthropic",
    model: "claude-opus-4-8",
    effort: "high",
    maxTokens: 8192,
  },
};

/**
 * The second probe engine.
 *
 * Answer engines disagree, and a brand that is named by one and invisible to
 * another is exactly the situation a single number hides. Running the same
 * prompt on both is what makes the model filter on the prompts table mean
 * something.
 *
 * The model id is read from the environment because OpenAI's current model
 * names move faster than this file does.
 */
export const ALTERNATE_PROBE: ModelSpec = {
  provider: "openai",
  model: process.env.OPENAI_PROBE_MODEL ?? "gpt-4o",
  webSearch: true,
  maxTokens: 2048,
};

/** Every engine that could answer a probe, in preference order. */
export const PROBE_ENGINES: ModelSpec[] = [MODELS.probe, ALTERNATE_PROBE];

/** Human-readable engine label for a spec, used in the UI and in `answers.model`. */
export function modelLabel(spec: ModelSpec): string {
  return `${spec.provider}/${spec.model}`;
}
