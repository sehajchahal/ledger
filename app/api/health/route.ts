import { sql } from "drizzle-orm";
import { activeProbeEngine } from "@/lib/ai/router";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check.
 *
 * Reports what a load balancer needs (can this instance serve traffic) and what
 * an operator needs (is it talking to a real answer engine or synthesising
 * answers). Returns 503 when the database is unreachable, because an instance
 * that cannot read is not healthy even if it can render.
 */
export async function GET() {
  const startedAt = Date.now();

  let database: "ok" | "unreachable" = "ok";
  let detail: string | undefined;

  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    database = "unreachable";
    detail = error instanceof Error ? error.message : String(error);
  }

  const engine = activeProbeEngine();

  return Response.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      database,
      detail,
      probeEngine: engine.label,
      // Loudly flagged: an instance running on fixtures is not measuring anything.
      measuring: !engine.isFixture,
      checkedInMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    { status: database === "ok" ? 200 : 503 },
  );
}
