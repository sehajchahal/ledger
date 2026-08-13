import type { ModelSpec } from "@/config/models";
import type { Intent } from "@/lib/db/schema";

/**
 * Entity context for a probe. Real answer engines ignore this — they answer the
 * prompt and we parse whatever comes back. Only the fixture provider reads it,
 * to synthesise answers that mention plausible entities.
 */
export type ProbeContext = {
  intent: Intent;
  brand: { name: string; aliases: string[]; domain: string };
  competitors: { name: string; aliases: string[] }[];
  /** Distinguishes the three probes of the same prompt. */
  probeIndex: number;
  /** Distinguishes runs. Real engines vary run to run; the fixture mirrors that. */
  runSeed?: string;
};

export type JobInput = {
  /** The user-visible instruction. For a probe, the buyer's question, verbatim. */
  prompt: string;
  /** Optional system framing. Probes deliberately send none — we want the default answer. */
  system?: string;
  /** Overrides the configured spec, e.g. to run the same prompt on a second engine. */
  spec?: ModelSpec;
  /** Only read by the fixture provider. */
  context?: ProbeContext;
  /**
   * JSON Schema the response must conform to. Providers that support structured
   * outputs enforce it; the fixture provider uses its presence to decide it is
   * being asked for data rather than prose.
   */
  schema?: Record<string, unknown>;
};

export type JobResult = {
  /** The full response text, stored verbatim. Never summarised before storage. */
  text: string;
  /** Source URLs the engine cited, in the order returned, deduplicated. */
  citations: string[];
  /** `provider/model` of whatever actually answered. */
  model: string;
  /** True when the answer was synthesised locally rather than measured. */
  isFixture: boolean;
};

export type Provider = (input: JobInput, spec: ModelSpec) => Promise<JobResult>;
