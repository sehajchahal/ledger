import { eq } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Badge, Button } from "@/components/ui";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { actions, brands, prompts, workspaces } from "@/lib/db/schema";
import { verifyToken } from "@/lib/tokens";

export const metadata = { title: "Approve a fix · Ledger" };
export const dynamic = "force-dynamic";

/**
 * Approving straight from the digest, without a login.
 *
 * The link carries a signed, expiring token naming exactly one action. It lands
 * here rather than approving on GET: corporate mail scanners follow every link
 * in a message, and a GET that mutates would have them approving fixes on the
 * recipient's behalf. One button press is the cost of not doing that, and the
 * user still never signs in.
 */
export default async function ApprovePage({ searchParams }: PageProps<"/approve">) {
  const { token } = await searchParams;

  if (typeof token !== "string") {
    return <Shell title="That link is incomplete.">Open Ledger and approve it there.</Shell>;
  }

  const result = verifyToken(token, "approve-action");
  if (!result.ok) return <Shell title="That link did not work.">{result.reason}</Shell>;

  const [row] = await db
    .select({
      action: actions,
      promptText: prompts.text,
      brandId: brands.id,
      brandName: brands.name,
      workspaceId: workspaces.id,
    })
    .from(actions)
    .innerJoin(brands, eq(brands.id, actions.brandId))
    .innerJoin(workspaces, eq(workspaces.id, brands.workspaceId))
    .leftJoin(prompts, eq(prompts.id, actions.promptId))
    .where(eq(actions.id, result.payload.subject))
    .limit(1);

  if (!row) return <Shell title="That fix no longer exists.">It may have been deleted.</Shell>;

  if (row.action.status !== "proposed") {
    return (
      <Shell title={`Already ${row.action.status}.`}>
        <span className="font-mono text-mono">{row.action.title}</span> was{" "}
        {row.action.status} already. Nothing changed.
        <OpenLink brandId={row.brandId} />
      </Shell>
    );
  }

  async function approve() {
    "use server";

    // Re-verify inside the action: the page render proves nothing about the
    // request that submits the form.
    const check = verifyToken(token as string, "approve-action");
    if (!check.ok) return;

    const [updated] = await db
      .update(actions)
      .set({ status: "approved" })
      .where(eq(actions.id, check.payload.subject))
      .returning();

    if (!updated) return;

    await recordAudit({
      workspaceId: row.workspaceId,
      actorId: null,
      actorEmail: check.payload.actor,
      action: "action.approved",
      subjectId: updated.id,
      subjectLabel: `${updated.title} (approved from the digest)`,
    });

    revalidatePath(`/brands/${row.brandId}/fixes`);
  }

  return (
    <Shell title="Approve this fix?">
      <div className="mt-6 border border-rule p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge>{row.action.type.replace("_", " ")}</Badge>
          {row.promptText ? (
            <span className="font-mono text-mono text-graphite">{row.promptText}</span>
          ) : null}
        </div>
        <p className="text-prose">{row.action.title}</p>
      </div>

      <form action={approve} className="mt-5">
        <Button type="submit">Approve</Button>
      </form>

      <p className="mt-4 max-w-prose text-prose-s text-graphite">
        Approving records the decision as {result.payload.actor}. It does not change your
        site — you still ship the change yourself, then mark it shipped so Ledger can
        re-check it.
      </p>

      <OpenLink brandId={row.brandId} />
    </Shell>
  );
}

function OpenLink({ brandId }: { brandId: string }) {
  return (
    <p className="mt-6">
      <Link
        href={`/brands/${brandId}/fixes`}
        className="font-mono text-mono text-graphite hover:text-ink hover:underline"
      >
        Open Ledger →
      </Link>
    </p>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[560px] px-5 py-16 sm:px-8">
      <Link href="/" className="font-display text-prose font-medium">
        Ledger
      </Link>
      <h1 className="mt-10 mb-3 font-display text-display-m">{title}</h1>
      <div className="text-prose-s text-graphite">{children}</div>
    </div>
  );
}
