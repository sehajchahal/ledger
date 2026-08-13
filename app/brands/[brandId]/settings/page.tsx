import { asc, count, eq } from "drizzle-orm";
import { DigestSettings } from "@/components/digest-settings";
import { InviteMemberForm, MemberRow } from "@/components/member-controls";
import {
  Badge,
  EmptyState,
  PageTitle,
  SectionHead,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { AUDIT_LABEL, listAudit } from "@/lib/audit";
import { can, requireBrandAccess } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { digests, memberships, organizations, prompts, users } from "@/lib/db/schema";
import { PLAN_LABEL, PLAN_LIMITS, checkActionAllowance } from "@/lib/limits";

export default async function SettingsPage({ params }: PageProps<"/brands/[brandId]/settings">) {
  const { brandId } = await params;
  const access = await requireBrandAccess(brandId);

  const canManage = can(access.role, "manageMembers");

  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, access.org.id))
    .limit(1);

  const orgPlan = org.plan;
  const limits = PLAN_LIMITS[orgPlan];

  const [members, promptCount, allowance, audit] = await Promise.all([
    db
      .select({
        membershipId: memberships.id,
        role: memberships.role,
        userId: users.id,
        email: users.email,
        name: users.name,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, access.org.id))
      .orderBy(asc(users.email)),
    db.select({ n: count() }).from(prompts).where(eq(prompts.brandId, brandId)),
    checkActionAllowance(brandId),
    listAudit(access.workspace.id, 50),
  ]);

  const [digest] = await db
    .select()
    .from(digests)
    .where(eq(digests.workspaceId, access.workspace.id))
    .limit(1);

  const promptsUsed = promptCount[0]?.n ?? 0;

  // checkActionAllowance reports what is left; the table shows what is spent.
  const fixesUsed = allowance.allowed
    ? limits.actionsPerMonth - allowance.remaining
    : limits.actionsPerMonth;

  return (
    <>
      <PageTitle aside={<Badge>{PLAN_LABEL[orgPlan]}</Badge>}>Settings</PageTitle>

      {/* Plan and what is left of it. */}
      <section className="mb-12">
        <SectionHead note={access.org.name}>Plan</SectionHead>
        <Table>
          <THead>
            <TH>Limit</TH>
            <TH align="right">Used</TH>
            <TH align="right">Allowed</TH>
          </THead>
          <tbody>
            <TR>
              <TD>Prompts on this brand</TD>
              <TD mono align="right">{promptsUsed}</TD>
              <TD mono align="right">{limits.prompts}</TD>
            </TR>
            <TR>
              <TD>Fixes this month</TD>
              <TD mono align="right">{fixesUsed}</TD>
              <TD mono align="right">{limits.actionsPerMonth}</TD>
            </TR>
            <TR>
              <TD>Check frequency</TD>
              <TD mono align="right">—</TD>
              <TD mono align="right">
                {limits.checkIntervalHours >= 24 * 7 ? "weekly" : "daily"}
              </TD>
            </TR>
            <TR>
              <TD>Members</TD>
              <TD mono align="right">{members.length}</TD>
              <TD mono align="right">
                {Number.isFinite(limits.members) ? limits.members : "unlimited"}
              </TD>
            </TR>
          </tbody>
        </Table>
      </section>

      {/* When the agent writes to you. */}
      <section className="mb-12">
        <SectionHead note={access.workspace.name}>Digest</SectionHead>
        <DigestSettings
          brandId={brandId}
          digestId={digest?.id ?? null}
          cadence={digest?.cadence ?? "weekly"}
          recipientEmail={digest?.recipientEmail ?? access.user.email}
          alertImmediately={digest?.alertImmediately ?? false}
          dropThreshold={digest?.dropThreshold ?? 10}
          canEdit={can(access.role, "manageBilling")}
        />
      </section>

      {/* Who can do what. */}
      <section className="mb-12">
        <SectionHead note={`${members.length}`}>Members</SectionHead>

        {canManage ? (
          <div className="mb-4">
            <InviteMemberForm brandId={brandId} />
          </div>
        ) : (
          <p className="mb-4 max-w-prose text-prose-s text-graphite">
            Only an owner can change who has access.
          </p>
        )}

        <Table>
          <THead>
            <TH>Email</TH>
            <TH>Name</TH>
            <TH align="right">Role</TH>
          </THead>
          <tbody>
            {members.map((member) => (
              <TR key={member.membershipId}>
                <TD mono>{member.email}</TD>
                <TD>{member.name ?? "—"}</TD>
                <TD align="right">
                  {canManage ? (
                    <MemberRow
                      brandId={brandId}
                      membershipId={member.membershipId}
                      role={member.role}
                      isSelf={member.userId === access.user.id}
                    />
                  ) : (
                    <span className="label text-graphite">{member.role}</span>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>

      {/* The record of who decided what. */}
      <section>
        <SectionHead note={audit.length > 0 ? `last ${audit.length}` : undefined}>
          Audit log
        </SectionHead>

        {audit.length === 0 ? (
          <EmptyState>
            Nothing has been approved, dismissed, or shipped in this workspace yet. Every
            decision lands here with who made it.
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <TH>When</TH>
              <TH>Who</TH>
              <TH>What</TH>
            </THead>
            <tbody>
              {audit.map((entry) => (
                <TR key={entry.id}>
                  <TD mono className="whitespace-nowrap">
                    {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </TD>
                  <TD mono>{entry.actorEmail ?? "—"}</TD>
                  <TD>
                    {AUDIT_LABEL[entry.action] ?? entry.action}
                    {entry.subjectLabel ? (
                      <span className="text-graphite"> — {entry.subjectLabel}</span>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </>
  );
}
