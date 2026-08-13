import { AddCompetitorForm, RemoveCompetitorButton } from "@/components/competitor-forms";
import {
  EmptyState,
  PageTitle,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { listCompetitorRows } from "@/lib/db/queries/competitors";
import { can, requireBrandAccess } from "@/lib/auth/session";

export default async function CompetitorsPage({
  params,
}: PageProps<"/brands/[brandId]/competitors">) {
  const { brandId } = await params;
  const access = await requireBrandAccess(brandId);
  const canEdit = can(access.role, "manageBrand");
  const rows = await listCompetitorRows(brandId);

  return (
    <>
      <PageTitle
        aside={<span className="font-mono text-mono text-graphite">last run</span>}
      >
        Competitors
      </PageTitle>

      {canEdit ? (
        <div className="mb-6">
          <AddCompetitorForm brandId={brandId} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState action={canEdit ? "Add competitor" : undefined}>
          No competitors are being tracked. Without them there is nothing to compare your
          mentions against, and share of voice cannot be calculated.
        </EmptyState>
      ) : (
        <>
          <Table>
            <THead>
              <TH>Competitor</TH>
              <TH>Also known as</TH>
              <TH align="right">Mention rate</TH>
              <TH align="right">Share of voice</TH>
              <TH align="right">Prompts won ↓</TH>
              <TH align="right">
                <span className="sr-only">Actions</span>
              </TH>
            </THead>
            <tbody>
              {rows.map((row) => (
                <TR key={row.competitor.id}>
                  <TD>{row.competitor.name}</TD>
                  <TD mono className="text-graphite">
                    {row.competitor.aliases.length > 0
                      ? row.competitor.aliases.join(", ")
                      : "—"}
                  </TD>
                  <TD mono align="right">
                    {row.rate.percent}%{" "}
                    <span className="text-graphite">
                      {row.rate.hits}/{row.rate.probes}
                    </span>
                  </TD>
                  <TD mono align="right">
                    {row.share}%
                  </TD>
                  <TD mono align="right">
                    <span className={row.promptsWon > 0 ? "text-alert" : undefined}>
                      {row.promptsWon}
                    </span>
                  </TD>
                  <TD align="right">
                    {canEdit ? (
                      <RemoveCompetitorButton
                        brandId={brandId}
                        competitorId={row.competitor.id}
                        name={row.competitor.name}
                      />
                    ) : null}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <p className="mt-4 max-w-prose text-prose-s text-graphite">
            Prompts won counts the questions where this competitor was named and you were
            not named at all. It is sorted first because it is the column worth acting on:
            those are answers you are losing outright rather than sharing.
          </p>
        </>
      )}
    </>
  );
}
