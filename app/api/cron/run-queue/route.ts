import { authorizeCron } from "@/lib/cron";
import { log } from "@/lib/log";
import { drainRunQueue } from "@/lib/probe/queue";
import { pruneRateLimits } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
// A run is 75+ model calls; give it as much wall clock as the plan allows.
export const maxDuration = 300;

/**
 * Processes queued runs. Scheduled every 5 minutes.
 *
 * Takes one run per invocation so a single slow engine cannot leave the
 * function killed mid-run with nothing recorded.
 */
export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  const result = await drainRunQueue({ limit: 1 });

  // Cheap piggyback: this route already runs often, and expired rate-limit
  // buckets have to be cleared by something.
  const pruned = await pruneRateLimits();

  log.info("run queue drained", { ...result, prunedRateLimits: pruned });
  return Response.json({ ...result, prunedRateLimits: pruned });
}
