import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { actions, runs, verifications } from "@/lib/db/schema";
import { computePromptMentionRate, loadRun } from "@/lib/parse/metrics";
import { runProbe } from "@/lib/probe/run";

/**
 * The verification loop. This is the feature the product exists for.
 *
 * Every other tool stops at the diagnosis. Here, shipping a fix starts a clock:
 * the run in place at the time is recorded as the before, and fourteen days
 * later the affected prompt is asked again and the change is measured.
 *
 * The delta covers the action's own prompt, not the whole brand. A brand-wide
 * number would credit this fix for everything else that happened that fortnight,
 * which is exactly the sleight of hand that makes marketing dashboards useless.
 */

/** How long a change is given to show up before it is re-measured. */
export const VERIFICATION_WINDOW_DAYS = 14;

/**
 * Records the before-state for a shipped action and schedules the re-check.
 *
 * Called when a user marks an action shipped. Ledger never touches the
 * customer's site, so "shipped" is a claim the user makes and this is the point
 * at which the clock starts.
 */
export async function scheduleVerification(
  actionId: string,
  options: { shippedAt?: Date } = {},
): Promise<{ ok: boolean; reason?: string; verificationId?: string }> {
  const [action] = await db.select().from(actions).where(eq(actions.id, actionId)).limit(1);
  if (!action) return { ok: false, reason: "That action no longer exists." };
  if (!action.promptId) {
    return { ok: false, reason: "This action is not attached to a prompt, so it cannot be verified." };
  }

  const [before] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.brandId, action.brandId), eq(runs.status, "complete"), eq(runs.kind, "full")))
    .orderBy(desc(runs.startedAt))
    .limit(1);

  if (!before) {
    return { ok: false, reason: "There is no completed run to measure against yet." };
  }

  const shippedAt = options.shippedAt ?? new Date();
  const scheduledFor = new Date(
    shippedAt.getTime() + VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const beforeRate = computePromptMentionRate(await loadRun(before.id), action.promptId);

  const [verification] = await db
    .insert(verifications)
    .values({
      actionId,
      runBeforeId: before.id,
      scheduledFor,
      rateBefore: fraction(beforeRate.hits, beforeRate.probes),
    })
    .returning();

  return { ok: true, verificationId: verification.id };
}

export type VerificationOutcome = {
  verificationId: string;
  actionId: string;
  promptText: string;
  before: number;
  after: number;
  delta: number;
};

/**
 * Runs every verification whose window has elapsed.
 *
 * Re-runs only the affected prompt, stores the resulting run as the after, and
 * writes the signed delta. A negative delta is written exactly as a positive
 * one is.
 */
export async function runDueVerifications(
  options: { now?: Date; limit?: number } = {},
): Promise<VerificationOutcome[]> {
  const now = options.now ?? new Date();

  const due = await db
    .select({
      verification: verifications,
      action: actions,
    })
    .from(verifications)
    .innerJoin(actions, eq(actions.id, verifications.actionId))
    .where(and(isNull(verifications.checkedAt), lte(verifications.scheduledFor, now)))
    .orderBy(asc(verifications.scheduledFor))
    .limit(options.limit ?? 50);

  const outcomes: VerificationOutcome[] = [];

  for (const { verification, action } of due) {
    if (!action.promptId) continue;

    const result = await runProbe(action.brandId, {
      promptIds: [action.promptId],
      kind: "verification",
    });

    if (result.status === "failed") {
      console.error(
        `verification ${verification.id}: re-check failed, leaving it due rather than recording a delta`,
      );
      continue;
    }

    const afterRows = await loadRun(result.runId);
    const after = computePromptMentionRate(afterRows, action.promptId);

    // Prefer the rate captured at ship time; fall back to recomputing from the
    // before-run if this row predates that column being written.
    const beforeRate =
      verification.rateBefore !== null
        ? Number(verification.rateBefore)
        : verification.runBeforeId
          ? rateOf(
              computePromptMentionRate(await loadRun(verification.runBeforeId), action.promptId),
            )
          : 0;

    // Both sides must carry the same precision before subtracting. `rate_before`
    // is persisted as numeric(6,4), so comparing it against a full-precision
    // rate makes 2/3 look very slightly worse than 2/3 and flips the sign of a
    // delta that is actually zero.
    const afterRate = quantize(rateOf(after));
    const delta = quantize(afterRate - quantize(beforeRate));

    await db
      .update(verifications)
      .set({
        runAfterId: result.runId,
        rateAfter: afterRate.toFixed(4),
        delta: delta.toFixed(4),
        checkedAt: now,
      })
      .where(eq(verifications.id, verification.id));

    outcomes.push({
      verificationId: verification.id,
      actionId: action.id,
      promptText: action.title,
      before: quantize(beforeRate),
      after: afterRate,
      delta,
    });
  }

  return outcomes;
}

function rateOf(rate: { hits: number; probes: number }): number {
  return rate.probes === 0 ? 0 : rate.hits / rate.probes;
}

/** Matches the 4-decimal precision the rate columns are stored at. */
function quantize(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function fraction(hits: number, probes: number): string {
  return (probes === 0 ? 0 : hits / probes).toFixed(4);
}
