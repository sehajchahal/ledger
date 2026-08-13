import { Badge, EmptyState, PageTitle, Table, TD, TH, THead, TR } from "@/components/ui";
import { getSourcesReport } from "@/lib/db/queries/sources";

export default async function SourcesPage({ params }: PageProps<"/brands/[brandId]/sources">) {
  const { brandId } = await params;
  const report = await getSourcesReport(brandId);

  const mostCited = report.domains[0]?.count ?? 0;

  return (
    <>
      <PageTitle
        aside={
          <span className="font-mono text-mono text-graphite">
            {report.answerCount} answers · {report.runCount} runs
          </span>
        }
      >
        Sources
      </PageTitle>

      {report.domains.length === 0 ? (
        <EmptyState>
          No answers have cited a source yet. Sources appear once a run completes against
          an engine that returns citations.
        </EmptyState>
      ) : (
        <>
          <p className="mb-6 max-w-prose text-prose-s text-graphite">
            These are the pages the models actually read before answering. Getting listed
            on the ones near the top is usually faster than trying to rank your own site.
          </p>

          {!report.ownDomainCited ? (
            <div className="mb-6 border border-alert px-3 py-2">
              <p className="text-prose-s">
                <span className="font-mono text-mono">{report.ownDomain}</span> was not
                cited in any of the {report.answerCount} answers on record. The models are
                answering questions about your market without reading your site.
              </p>
            </div>
          ) : null}

          <Table>
            <THead>
              <TH>Domain</TH>
              <TH align="right">Answers citing it ↓</TH>
              <TH>Share of answers</TH>
            </THead>
            <tbody>
              {report.domains.map((domain) => (
                <TR key={domain.domain}>
                  <TD mono>
                    <span className="flex items-center gap-2">
                      {domain.domain}
                      {domain.isOwnDomain ? <Badge tone="signal">your site</Badge> : null}
                    </span>
                  </TD>
                  <TD mono align="right">
                    {domain.count}
                  </TD>
                  <TD>
                    {/* A bar, not a chart: proportion against the most-cited domain. */}
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={domain.isOwnDomain ? "h-2 bg-signal" : "h-2 bg-ink"}
                        style={{
                          width: `${mostCited === 0 ? 0 : (domain.count / mostCited) * 100}%`,
                          minWidth: 2,
                        }}
                      />
                      <span className="font-mono text-mono tabular-nums text-graphite">
                        {report.answerCount === 0
                          ? 0
                          : Math.round((domain.count / report.answerCount) * 100)}
                        %
                      </span>
                    </span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
