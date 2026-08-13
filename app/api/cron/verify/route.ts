import { runDueVerifications } from "@/lib/actions/verify";
import { authorizeCron } from "@/lib/cron";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Runs every verification whose 14-day window has elapsed. Scheduled daily.
 *
 * This is the loop the product exists for, so it runs on its own schedule
 * rather than riding along with anything else.
 */
export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  const outcomes = await runDueVerifications();

  log.info("verifications processed", {
    verified: outcomes.length,
    improved: outcomes.filter((o) => o.delta > 0).length,
    declined: outcomes.filter((o) => o.delta < 0).length,
  });

  return Response.json({
    verified: outcomes.length,
    outcomes: outcomes.map((o) => ({
      actionId: o.actionId,
      deltaPoints: Math.round(o.delta * 100),
    })),
  });
}
