import { and, eq, inArray } from "drizzle-orm";
import type { ModelSpec } from "@/config/models";
import { runJob } from "@/lib/ai/router";
import { db } from "@/lib/db";
import { answers, brands, competitors, prompts, runs, type RunKind } from "@/lib/db/schema";
import { runAgentForBrand } from "@/lib/agent/run-agent";
import { parseRun } from "@/lib/parse/mentions";
import { errorContext, log } from "@/lib/log";
import { mapWithConcurrency, retryOnce } from "@/lib/pool";

/** Every prompt is asked three times. One answer is an anecdote; three is a rate. */
const PROBES_PER_PROMPT = 3;
const CONCURRENCY = 4;

export type ProbeRunResult = {
  runId: string;
  stored: number;
  failed: number;
  /** Mention rows written by the parser. */
  parsed: number;
  status: "complete" | "failed";
};

export type ProbeRunOptions = {
  /** Restrict the run to specific prompts. Used by verification re-checks. */
  promptIds?: string[];
  /** Run against a second engine instead of the configured probe model. */
  spec?: ModelSpec;
  /**
   * Ask every prompt on more than one engine. Each engine's answers are stored
   * separately, which is what the model filter on the prompts table compares.
   */
  engines?: ModelSpec[];
  /** Adopt a run row that was already created, e.g. by an enqueue action. */
  existingRunId?: string;
  /** Marks partial re-checks so they never count as the brand's latest measurement. */
  kind?: RunKind;
  onProgress?: (done: number, total: number) => void;
};

/**
 * Runs every active prompt for a brand three times and stores the answers.
 *
 * A probe that fails twice stores nothing for that probe index. It does not
 * store an empty answer: absence of a measurement is not a measurement of
 * absence, and every metric downstream divides by the number of probes that
 * actually returned.
 */
export async function runProbe(
  brandId: string,
  options: ProbeRunOptions = {},
): Promise<ProbeRunResult> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) throw new Error(`no brand with id ${brandId}`);

  const rivals = await db
    .select()
    .from(competitors)
    .where(eq(competitors.brandId, brandId));

  const activePrompts = await db
    .select()
    .from(prompts)
    .where(
      options.promptIds?.length
        ? and(eq(prompts.brandId, brandId), inArray(prompts.id, options.promptIds))
        : and(eq(prompts.brandId, brandId), eq(prompts.active, true)),
    );

  if (activePrompts.length === 0) throw new Error(`brand ${brandId} has no active prompts`);

  // An enqueue path may have already written a `queued` row so the UI can show
  // the run immediately. Adopt it rather than creating a second one.
  const [run] = options.existingRunId
    ? await db
        .update(runs)
        .set({ status: "running", startedAt: new Date(), kind: options.kind ?? "full" })
        .where(eq(runs.id, options.existingRunId))
        .returning()
    : await db
        .insert(runs)
        .values({ brandId, status: "running", startedAt: new Date(), kind: options.kind ?? "full" })
        .returning();

  if (!run) throw new Error(`no run row to write into for brand ${brandId}`);

  // One unit of work per (prompt, probe, engine), so the concurrency ceiling
  // applies across the whole run rather than per prompt or per engine.
  const engines: (ModelSpec | undefined)[] = options.engines?.length
    ? options.engines
    : [options.spec];

  const units = activePrompts.flatMap((prompt) =>
    Array.from({ length: PROBES_PER_PROMPT }, (_, probeIndex) =>
      engines.map((engine) => ({ prompt, probeIndex, engine })),
    ).flat(),
  );

  const runLog = log.child({ runId: run.id, brandId, kind: options.kind ?? "full" });
  runLog.info("run started", {
    prompts: activePrompts.length,
    probes: units.length,
    engines: engines.length,
  });

  const startedAt = Date.now();
  let stored = 0;
  let failed = 0;
  let done = 0;

  await mapWithConcurrency(units, CONCURRENCY, async ({ prompt, probeIndex, engine }) => {
    try {
      const result = await retryOnce(
        () =>
          runJob("probe", {
            prompt: prompt.text,
            spec: engine,
            context: {
              intent: prompt.intent,
              brand: { name: brand.name, aliases: brand.aliases, domain: brand.domain },
              competitors: rivals.map((c) => ({ name: c.name, aliases: c.aliases })),
              probeIndex,
              runSeed: `${run.id}:${engine?.provider ?? "default"}`,
            },
          }),
        (error) =>
          runLog.warn("probe failed, retrying once", {
            promptId: prompt.id,
            probeIndex,
            ...errorContext(error),
          }),
      );

      await db.insert(answers).values({
        runId: run.id,
        promptId: prompt.id,
        model: result.model,
        probeIndex,
        rawText: result.text,
        citations: result.citations,
      });
      stored++;
    } catch (error) {
      failed++;
      // Storing nothing is the correct outcome, so this is logged as the
      // decision it is rather than as an unexplained failure.
      runLog.error("probe failed twice, storing nothing for this probe", {
        promptId: prompt.id,
        probeIndex,
        ...errorContext(error),
      });
    } finally {
      options.onProgress?.(++done, units.length);
    }
  });

  // Parse before marking complete. A run is only useful once its mentions
  // exist, and every metric reads mentions rather than raw text.
  const parsed = stored > 0 ? await parseRun(run.id, brandId) : 0;

  const status = stored === 0 ? "failed" : "complete";

  await db
    .update(runs)
    .set({ status, completedAt: new Date() })
    .where(eq(runs.id, run.id));

  // The agent looks at every completed full run. Verification re-checks are
  // excluded: they ask one prompt, so "everything else disappeared" would be
  // the only conclusion available to them.
  if (status === "complete" && (options.kind ?? "full") === "full") {
    try {
      const agent = await runAgentForBrand(brandId);
      if (agent.proposed > 0) {
        runLog.info("agent proposed fixes for prompts lost this run", {
          proposed: agent.proposed,
          lost: agent.report.losses.length,
        });
      }
    } catch (error) {
      // A failed agent pass must not fail the run — the measurement is the
      // valuable part and it is already stored.
      runLog.error("agent pass failed", errorContext(error));
    }
  }

  runLog.info("run finished", {
    status,
    stored,
    failed,
    mentions: parsed,
    seconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
  });

  return { runId: run.id, stored, failed, parsed, status };
}
