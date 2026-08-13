import { render } from "@react-email/render";
import { and, asc, desc, eq } from "drizzle-orm";
import { DigestEmail, type DigestProps } from "@/emails/digest";
import { describeChange, detectChanges } from "@/lib/agent/changes";
import { db } from "@/lib/db";
import { actions, brands, digests, prompts, workspaces } from "@/lib/db/schema";
import { getBrandOverview } from "@/lib/db/queries/overview";
import { createToken } from "@/lib/tokens";

/**
 * Builds and sends the digest.
 *
 * The email is not a summary of a dashboard. It carries the number, what moved
 * in plain sentences, and the specific decisions waiting — each with a signed
 * link that approves without a login, because asking someone to sign in to
 * click Approve is how a digest becomes an email nobody opens.
 */

function baseUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

const CADENCE_LABEL = {
  daily: "Daily check",
  weekly: "Weekly check",
  monthly: "Monthly check",
} as const;

export type BuiltDigest = {
  to: string;
  subject: string;
  html: string;
  text: string;
  props: DigestProps;
};

/** Assembles a digest for one brand. Returns null when there is nothing to report. */
export async function buildDigest(
  brandId: string,
  { cadence = "weekly", to }: { cadence?: keyof typeof CADENCE_LABEL; to: string },
): Promise<BuiltDigest | null> {
  const overview = await getBrandOverview(brandId);
  if (!overview?.latest) return null;

  const report = await detectChanges(brandId);

  // Same series the Overview draws: one tick per prompt per run. Taking the
  // tail keeps the email's strip to the most recent activity rather than an
  // arbitrary single prompt.
  const stripSource = overview.aggregateTicks;

  const openActions = await db
    .select({
      id: actions.id,
      title: actions.title,
      promptText: prompts.text,
    })
    .from(actions)
    .leftJoin(prompts, eq(prompts.id, actions.promptId))
    .where(and(eq(actions.brandId, brandId), eq(actions.status, "proposed")))
    .orderBy(desc(actions.proposedAt))
    .limit(3);

  const props: DigestProps = {
    brandName: overview.brand.name,
    periodLabel: CADENCE_LABEL[cadence],
    visibility: overview.latest.percent,
    delta: overview.delta,
    hits: overview.latest.hits,
    probes: overview.latest.probes,
    ticks: stripSource.slice(-40),
    // Top three changes, worst first — the sort in detectChanges already does this.
    headlines: report.changes.slice(0, 3).map(describeChange),
    actions: openActions.map((action) => ({
      id: action.id,
      title: action.title,
      promptText: action.promptText,
      approveUrl: `${baseUrl()}/approve?token=${encodeURIComponent(
        createToken({ purpose: "approve-action", subject: action.id, actor: to }),
      )}`,
    })),
    dashboardUrl: `${baseUrl()}/brands/${brandId}`,
    isDemoData: overview.isDemoData,
  };

  const element = DigestEmail(props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const deltaText =
    props.delta === null ? "" : ` (${props.delta > 0 ? "+" : ""}${props.delta}pt)`;

  return {
    to,
    subject: `${props.brandName}: named in ${props.visibility}% of answers${deltaText}`,
    html,
    text,
    props,
  };
}

export type DigestTarget = {
  brandId: string;
  brandName: string;
  cadence: keyof typeof CADENCE_LABEL;
  recipientEmail: string;
  digestId: string;
  alertImmediately: boolean;
  dropThreshold: number;
  lastSentAt: Date | null;
};

/** Every configured digest, joined to the brands it covers. */
export async function digestTargets(): Promise<DigestTarget[]> {
  const rows = await db
    .select({
      digestId: digests.id,
      cadence: digests.cadence,
      recipientEmail: digests.recipientEmail,
      lastSentAt: digests.lastSentAt,
      alertImmediately: digests.alertImmediately,
      dropThreshold: digests.dropThreshold,
      brandId: brands.id,
      brandName: brands.name,
    })
    .from(digests)
    .innerJoin(workspaces, eq(workspaces.id, digests.workspaceId))
    .innerJoin(brands, eq(brands.workspaceId, workspaces.id))
    .orderBy(asc(brands.name));

  return rows;
}

const INTERVAL_HOURS = { daily: 24, weekly: 24 * 7, monthly: 24 * 30 } as const;

/** Whether this digest is due, ignoring immediate alerts. */
export function isDue(target: DigestTarget, now = new Date()): boolean {
  if (!target.lastSentAt) return true;
  const hours = (now.getTime() - target.lastSentAt.getTime()) / (60 * 60 * 1000);
  return hours >= INTERVAL_HOURS[target.cadence];
}

export async function markSent(digestId: string, when = new Date()): Promise<void> {
  await db.update(digests).set({ lastSentAt: when }).where(eq(digests.id, digestId));
}
