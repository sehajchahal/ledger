"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateActionsForBrand } from "@/lib/actions/generate";
import { scheduleVerification } from "@/lib/actions/verify";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { requireCapability } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { actions } from "@/lib/db/schema";

/**
 * Every mutation re-checks the caller's role. Server Actions are a public HTTP
 * endpoint — hiding a button in the UI is presentation, not authorisation.
 */

type Result = { ok: true; created?: number } | { ok: false; reason: string };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function proposeActions(brandId: string): Promise<Result> {
  let access;
  try {
    access = await requireCapability(brandId, "approveActions");
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }

  const result = await generateActionsForBrand(brandId);

  if (result.created > 0) {
    await recordAudit({
      workspaceId: access.workspace.id,
      actorId: access.user.id,
      actorEmail: access.user.email,
      action: "action.proposed",
      subjectLabel: `${result.created} fixes for ${access.brand.name}`,
    });
  }

  revalidatePath(`/brands/${brandId}/fixes`);

  // The generator explains why it produced nothing — plan allowance, no run yet,
  // or everything already covered. Pass that sentence through verbatim.
  return result.created > 0
    ? { ok: true, created: result.created }
    : { ok: false, reason: result.reason ?? "Nothing new to propose." };
}

/** Approve and dismiss differ only in the status they write and the word logged. */
async function decide(
  brandId: string,
  actionId: string,
  status: "approved" | "dismissed",
  event: AuditAction,
): Promise<Result> {
  let access;
  try {
    access = await requireCapability(brandId, "approveActions");
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }

  const [updated] = await db
    .update(actions)
    .set({ status, approvedBy: access.user.id })
    .where(and(eq(actions.id, actionId), eq(actions.brandId, brandId)))
    .returning();

  if (!updated) return { ok: false, reason: "That fix no longer exists." };

  await recordAudit({
    workspaceId: access.workspace.id,
    actorId: access.user.id,
    actorEmail: access.user.email,
    action: event,
    subjectId: updated.id,
    subjectLabel: updated.title,
  });

  revalidatePath(`/brands/${brandId}/fixes`);
  return { ok: true };
}

export async function approveAction(brandId: string, actionId: string): Promise<Result> {
  return decide(brandId, actionId, "approved", "action.approved");
}

export async function dismissAction(brandId: string, actionId: string): Promise<Result> {
  return decide(brandId, actionId, "dismissed", "action.dismissed");
}

/**
 * Marks an action shipped and starts its verification clock.
 *
 * Separate from approval on purpose: Ledger does not touch the customer's site,
 * so only the user knows when the change actually went live. Claiming it
 * shipped when it did not would corrupt the before-run and the delta with it.
 */
export async function markShipped(brandId: string, actionId: string): Promise<Result> {
  let access;
  try {
    access = await requireCapability(brandId, "approveActions");
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }

  const shippedAt = new Date();

  const [updated] = await db
    .update(actions)
    .set({ status: "shipped", shippedAt })
    .where(and(eq(actions.id, actionId), eq(actions.brandId, brandId)))
    .returning();

  if (!updated) return { ok: false, reason: "That fix no longer exists." };

  const scheduled = await scheduleVerification(actionId, { shippedAt });

  await recordAudit({
    workspaceId: access.workspace.id,
    actorId: access.user.id,
    actorEmail: access.user.email,
    action: "action.shipped",
    subjectId: updated.id,
    subjectLabel: updated.title,
  });

  revalidatePath(`/brands/${brandId}/fixes`);

  return scheduled.ok
    ? { ok: true }
    : { ok: false, reason: scheduled.reason ?? "Could not schedule the re-check." };
}
