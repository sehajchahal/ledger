import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";

/**
 * Who did what, and when.
 *
 * Written on every decision that changes an action's state. The actor's email
 * is copied in alongside the id so the record still reads correctly after a
 * user is removed from the workspace.
 */

export type AuditAction =
  | "action.approved"
  | "action.dismissed"
  | "action.shipped"
  | "action.proposed"
  | "member.invited"
  | "member.role_changed"
  | "member.removed";

export async function recordAudit(entry: {
  workspaceId: string;
  actorId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  subjectId?: string | null;
  subjectLabel?: string | null;
}): Promise<void> {
  await db.insert(auditLog).values({
    workspaceId: entry.workspaceId,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    subjectId: entry.subjectId ?? null,
    subjectLabel: entry.subjectLabel ?? null,
  });
}

export type AuditRow = {
  id: string;
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  subjectLabel: string | null;
  createdAt: Date;
};

export async function listAudit(workspaceId: string, limit = 100): Promise<AuditRow[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorEmail: auditLog.actorEmail,
      actorName: users.name,
      subjectLabel: auditLog.subjectLabel,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(eq(auditLog.workspaceId, workspaceId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return rows;
}

export const AUDIT_LABEL: Record<string, string> = {
  "action.approved": "approved a fix",
  "action.dismissed": "dismissed a fix",
  "action.shipped": "marked a fix as shipped",
  "action.proposed": "generated fixes",
  "member.invited": "invited a member",
  "member.role_changed": "changed a member's role",
  "member.removed": "removed a member",
};
