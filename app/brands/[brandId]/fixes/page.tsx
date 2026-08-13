import Link from "next/link";
import { ActionCard, ProposeActionsButton } from "@/components/action-card";
import { EmptyState, PageTitle, SectionHead } from "@/components/ui";
import { listActionRows } from "@/lib/db/queries/fixes";
import { can, requireBrandAccess } from "@/lib/auth/session";

export default async function FixesPage({ params }: PageProps<"/brands/[brandId]/fixes">) {
  const { brandId } = await params;
  const access = await requireBrandAccess(brandId);
  const canDecide = can(access.role, "approveActions");
  const rows = await listActionRows(brandId);

  const open = rows.filter((row) => row.action.status === "proposed");
  const approved = rows.filter((row) => row.action.status === "approved");
  const shipped = rows.filter((row) => row.action.status === "shipped");
  const closed = rows.filter((row) => row.action.status === "dismissed");

  return (
    <>
      <PageTitle
        aside={
          <Link
            href={`/brands/${brandId}/fixes/proof`}
            className="font-mono text-mono text-graphite hover:text-ink hover:underline"
          >
            Proof →
          </Link>
        }
      >
        Fixes
      </PageTitle>

      {canDecide ? (
        <div className="mb-8">
          <ProposeActionsButton brandId={brandId} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState action={canDecide ? "Propose fixes" : undefined}>
          No fixes have been proposed. Ledger reads the prompts you are missing from and
          writes a specific change for each one — markup to paste, a section to rewrite, or
          a third-party page to get listed on.
        </EmptyState>
      ) : (
        <div className="space-y-12">
          <Group title="Waiting on a decision" rows={open} brandId={brandId} canDecide={canDecide} />
          <Group title="Approved, not yet shipped" rows={approved} brandId={brandId} canDecide={canDecide} />
          <Group title="Shipped" rows={shipped} brandId={brandId} canDecide={canDecide} note="measured after 14 days" />
          <Group title="Dismissed" rows={closed} brandId={brandId} canDecide={canDecide} />
        </div>
      )}
    </>
  );
}

function Group({
  title,
  rows,
  brandId,
  canDecide,
  note,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof listActionRows>>;
  brandId: string;
  canDecide: boolean;
  note?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section>
      <SectionHead note={note ?? `${rows.length}`}>{title}</SectionHead>
      <div className="space-y-4">
        {rows.map((row) => (
          <ActionCard key={row.action.id} brandId={brandId} row={row} canDecide={canDecide} />
        ))}
      </div>
    </section>
  );
}
