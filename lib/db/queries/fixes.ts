import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  actions,
  prompts,
  verifications,
  type Action,
  type Verification,
} from "@/lib/db/schema";

export type VerificationState =
  | { kind: "none" }
  | { kind: "pending"; scheduledFor: Date; daysLeft: number }
  | { kind: "resolved"; checkedAt: Date; before: number; after: number; delta: number };

export type ActionRow = {
  action: Action;
  promptText: string | null;
  verification: VerificationState;
};

function stateOf(row: Verification | null, now: Date): VerificationState {
  if (!row) return { kind: "none" };

  if (row.checkedAt === null) {
    const scheduledFor = new Date(row.scheduledFor);
    return {
      kind: "pending",
      scheduledFor,
      daysLeft: Math.max(
        0,
        Math.ceil((scheduledFor.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      ),
    };
  }

  return {
    kind: "resolved",
    checkedAt: new Date(row.checkedAt),
    before: Number(row.rateBefore ?? 0),
    after: Number(row.rateAfter ?? 0),
    delta: Number(row.delta ?? 0),
  };
}

export async function listActionRows(brandId: string): Promise<ActionRow[]> {
  const rows = await db
    .select({
      action: actions,
      promptText: prompts.text,
      verification: verifications,
    })
    .from(actions)
    .leftJoin(prompts, eq(prompts.id, actions.promptId))
    .leftJoin(verifications, eq(verifications.actionId, actions.id))
    .where(eq(actions.brandId, brandId))
    .orderBy(desc(actions.proposedAt));

  const now = new Date();

  return rows.map((row) => ({
    action: row.action,
    promptText: row.promptText,
    verification: stateOf(row.verification, now),
  }));
}

export type ProofRow = {
  action: Action;
  promptText: string | null;
  shippedAt: Date;
  verification: VerificationState;
};

/**
 * Every shipped action, oldest first, with whatever the re-check found.
 *
 * This is the view a customer forwards to their boss, which is exactly why
 * nothing is filtered out of it. Actions that made things worse stay on the
 * list, in order, with their real numbers.
 */
export async function listProofRows(brandId: string): Promise<ProofRow[]> {
  const rows = await listActionRows(brandId);

  return rows
    .filter((row): row is ActionRow & { action: Action & { shippedAt: Date } } =>
      row.action.status === "shipped" && row.action.shippedAt !== null,
    )
    .map((row) => ({
      action: row.action,
      promptText: row.promptText,
      shippedAt: row.action.shippedAt,
      verification: row.verification,
    }))
    .sort((a, b) => a.shippedAt.getTime() - b.shippedAt.getTime());
}
