"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { checkRunAllowance } from "@/lib/limits";

/**
 * Enqueues a run. It does not execute one.
 *
 * A full run is 75+ model calls, which outlives any serverless function, so the
 * work is genuinely queued: this writes a `queued` row and the cron worker at
 * /api/cron/run-queue picks it up. The UI shows the amber running indicator
 * from that row immediately, so the wait is visible rather than silent.
 */
export async function enqueueRun(brandId: string) {
  try {
    await requireCapability(brandId, "runChecks");
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  const inFlight = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.brandId, brandId), inArray(runs.status, ["queued", "running"])))
    .limit(1);

  if (inFlight.length > 0) {
    return { ok: false as const, reason: "A run is already in progress." };
  }

  const allowance = await checkRunAllowance(brandId);
  if (!allowance.allowed) return { ok: false as const, reason: allowance.reason };

  const [run] = await db.insert(runs).values({ brandId, status: "queued" }).returning();

  revalidatePath(`/brands/${brandId}`, "layout");

  // Locally there is no cron, so drain the queue in the background to keep the
  // button behaving the way it does in production. On a hosted deployment the
  // scheduled worker owns this, and doing it here as well would run the probes
  // twice.
  if (!process.env.VERCEL) {
    after(async () => {
      const { drainRunQueue } = await import("@/lib/probe/queue");
      await drainRunQueue({ limit: 1 });
    });
  }

  return { ok: true as const, runId: run.id };
}
