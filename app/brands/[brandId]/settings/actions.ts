"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireCapability } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  cadenceEnum,
  digests,
  memberships,
  roleEnum,
  users,
  type Cadence,
  type Role,
} from "@/lib/db/schema";

type Result = { ok: true } | { ok: false; reason: string };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function readRole(value: FormDataEntryValue | null): Role {
  const candidate = String(value ?? "");
  return (roleEnum.enumValues as readonly string[]).includes(candidate)
    ? (candidate as Role)
    : "viewer";
}

/**
 * Adds someone to the organisation.
 *
 * There is no separate invitation record: the membership is what grants access,
 * and they sign in with a magic link to the address entered here. Nothing is
 * emailed from this screen — the owner tells them, or the digest does.
 */
export async function inviteMember(brandId: string, formData: FormData): Promise<Result> {
  let access;
  try {
    access = await requireCapability(brandId, "manageMembers");
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = readRole(formData.get("role"));

  if (!email.includes("@")) return { ok: false, reason: "That is not an email address." };

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user =
    existing ?? (await db.insert(users).values({ email }).returning())[0];

  const [alreadyMember] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.orgId, access.org.id)))
    .limit(1);

  if (alreadyMember) return { ok: false, reason: `${email} is already a member.` };

  await db.insert(memberships).values({ userId: user.id, orgId: access.org.id, role });

  await recordAudit({
    workspaceId: access.workspace.id,
    actorId: access.user.id,
    actorEmail: access.user.email,
    action: "member.invited",
    subjectId: user.id,
    subjectLabel: `${email} as ${role}`,
  });

  revalidatePath(`/brands/${brandId}/settings`);
  return { ok: true };
}

export async function changeRole(
  brandId: string,
  membershipId: string,
  role: Role,
): Promise<Result> {
  let access;
  try {
    access = await requireCapability(brandId, "manageMembers");
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }

  const [membership] = await db
    .select({ id: memberships.id, userId: memberships.userId, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, access.org.id)))
    .limit(1);

  if (!membership) return { ok: false, reason: "That member is not in this organisation." };

  // Refuse to remove the last owner. An org nobody can administer is a support
  // ticket, not a valid state.
  if (membership.role === "owner" && role !== "owner") {
    const owners = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.orgId, access.org.id), eq(memberships.role, "owner")));

    if (owners.length <= 1) {
      return { ok: false, reason: "This is the only owner. Make someone else an owner first." };
    }
  }

  await db.update(memberships).set({ role }).where(eq(memberships.id, membershipId));

  const [member] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, membership.userId))
    .limit(1);

  await recordAudit({
    workspaceId: access.workspace.id,
    actorId: access.user.id,
    actorEmail: access.user.email,
    action: "member.role_changed",
    subjectId: membership.userId,
    subjectLabel: `${member?.email ?? "a member"} to ${role}`,
  });

  revalidatePath(`/brands/${brandId}/settings`);
  return { ok: true };
}

export async function removeMember(brandId: string, membershipId: string): Promise<Result> {
  let access;
  try {
    access = await requireCapability(brandId, "manageMembers");
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }

  const [membership] = await db
    .select({ id: memberships.id, userId: memberships.userId, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, access.org.id)))
    .limit(1);

  if (!membership) return { ok: false, reason: "That member is not in this organisation." };

  if (membership.role === "owner") {
    const owners = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.orgId, access.org.id), eq(memberships.role, "owner")));

    if (owners.length <= 1) {
      return { ok: false, reason: "This is the only owner. Make someone else an owner first." };
    }
  }

  const [member] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, membership.userId))
    .limit(1);

  await db.delete(memberships).where(eq(memberships.id, membershipId));

  await recordAudit({
    workspaceId: access.workspace.id,
    actorId: access.user.id,
    actorEmail: access.user.email,
    action: "member.removed",
    subjectId: membership.userId,
    subjectLabel: member?.email ?? "a member",
  });

  revalidatePath(`/brands/${brandId}/settings`);
  return { ok: true };
}


/**
 * Digest cadence, recipient, and the immediate-alert threshold.
 *
 * Scoped to the workspace rather than the brand: someone watching five brands
 * wants one email, not five.
 */
export async function saveDigestSettings(
  brandId: string,
  digestId: string | null,
  formData: FormData,
): Promise<Result> {
  let access;
  try {
    access = await requireCapability(brandId, "manageBilling");
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }

  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim().toLowerCase();
  if (!recipientEmail.includes("@")) {
    return { ok: false, reason: "That is not an email address." };
  }

  const candidate = String(formData.get("cadence") ?? "weekly");
  const cadence = (cadenceEnum.enumValues as readonly string[]).includes(candidate)
    ? (candidate as Cadence)
    : "weekly";

  const alertImmediately = formData.get("alertImmediately") !== null;

  const parsed = Number(formData.get("dropThreshold") ?? 10);
  const dropThreshold = Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.round(parsed))) : 10;

  const values = { cadence, recipientEmail, alertImmediately, dropThreshold };

  if (digestId) {
    await db.update(digests).set(values).where(eq(digests.id, digestId));
  } else {
    await db.insert(digests).values({ workspaceId: access.workspace.id, ...values });
  }

  revalidatePath(`/brands/${brandId}/settings`);
  return { ok: true };
}
