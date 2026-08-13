import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { errorContext, log } from "@/lib/log";
import { runProbe } from "@/lib/probe/run";

/**
 * Draining the run queue.
 *
 * A full run is 75+ model calls, which is far longer than a serverless function
 * is allowed to live. So enqueueing and executing are separated: the UI writes a
 * `queued` row and returns immediately, and this drains the queue from a cron
 * route where a longer budget is available.
 *
 * The statuses to model this already existed — `queued` and `running` were in
 * the schema from the first migration — so this is a worker for a queue the
 * data model always described, not a new concept.
 */

/** A run stuck in `running` longer than this is assumed dead and is retried. */
const STALE_AFTER_MINUTES = 15;

export type DrainResult = {
  picked: number;
  completed: number;
  failed: number;
  reclaimed: number;
};

/**
 * Releases runs whose worker died mid-flight.
 *
 * A serverless function can be killed at any point — timeout, deploy, eviction —
 * leaving a row marked `running` with nothing running. Without this they sit
 * there forever and block the brand's next run, because `enqueueRun` refuses to
 * start one while another is in flight.
 */
async function reclaimStale(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_AFTER_MINUTES * 60 * 1000);

  const reclaimed = await db
    .update(runs)
    .set({ status: "queued", startedAt: null })
    .where(and(eq(runs.status, "running"), lt(runs.startedAt, cutoff)))
    .returning({ id: runs.id });

  if (reclaimed.length > 0) {
    log.warn("reclaimed stale runs", {
      count: reclaimed.length,
      staleAfterMinutes: STALE_AFTER_MINUTES,
    });
  }

  return reclaimed.length;
}

/**
 * Claims and processes queued runs, oldest first.
 *
 * `limit` is deliberately small: the caller has a wall-clock budget, and it is
 * better to finish two runs and leave the rest queued than to be killed halfway
 * through five.
 */
export async function drainRunQueue(
  { limit = 1, now = new Date() }: { limit?: number; now?: Date } = {},
): Promise<DrainResult> {
  const reclaimed = await reclaimStale(now);

  const result: DrainResult = { picked: 0, completed: 0, failed: 0, reclaimed };

  for (let i = 0; i < limit; i++) {
    // Claim one row atomically. Two workers firing at once would otherwise both
    // read the same queued run and probe it twice, doubling the spend and the
    // stored answers.
    const claimed = await db
      .update(runs)
      .set({ status: "running", startedAt: now })
      .where(
        inArray(
          runs.id,
          db
            .select({ id: runs.id })
            .from(runs)
            .where(eq(runs.status, "queued"))
            .orderBy(asc(runs.id))
            .limit(1)
            .for("update", { skipLocked: true }),
        ),
      )
      .returning({ id: runs.id, brandId: runs.brandId, kind: runs.kind });

    const run = claimed[0];
    if (!run) break;

    result.picked++;

    try {
      const outcome = await runProbe(run.brandId, {
        existingRunId: run.id,
        kind: run.kind,
      });
      if (outcome.status === "complete") result.completed++;
      else result.failed++;
    } catch (error) {
      result.failed++;
      log.error("queued run failed", {
        runId: run.id,
        brandId: run.brandId,
        ...errorContext(error),
      });

      await db
        .update(runs)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(runs.id, run.id));
    }
  }

  return result;
}

/** How many runs are waiting. Surfaced on the health check. */
export async function queueDepth(): Promise<number> {
  const rows = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from runs where status = 'queued'`,
  );
  return [...rows][0]?.n ?? 0;
}
