"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { checkRunAllowance } from "@/lib/limits";
import { runProbe } from "@/lib/probe/run";

/**
 * Enqueues a run and returns immediately.
 *
 * The row is written as `queued` before the response so the page can render the
 * amber running indicator on the very next paint. The probes themselves happen
 * in `after()`, once the response is flushed — a real run is 75 model calls and
 * has no business blocking a form submission.
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

  after(async () => {
    try {
      await runProbe(brandId, { existingRunId: run.id });
    } catch (error) {
      console.error(`run ${run.id} failed`, error);
      await db.update(runs).set({ status: "failed", completedAt: new Date() }).where(eq(runs.id, run.id));
    }
  });

  return { ok: true as const, runId: run.id };
}
